import os
import time
import threading
import collections
import tempfile
import subprocess
import platform
from datetime import datetime

import cv2
import numpy as np
from flask import Flask, Response, jsonify, render_template, send_file

app = Flask(__name__)

BUFFER_SECONDS = int(os.environ.get("BUFFER_SECONDS", 10))
CAPTURE_FPS    = int(os.environ.get("CAPTURE_FPS", 20))
# Índices explícitos: "0,1"  — ou vazio para auto-detectar 0-3
CAMERA_INDICES = os.environ.get("CAMERA_INDICES", "")

# DirectShow no Windows evita câmeras virtuais (OBS, Teams, Camera Effects…)
_CAP_BACKEND = cv2.CAP_DSHOW if platform.system() == "Windows" else 0

cameras: dict = {}


def _make_cam(index: int) -> dict:
    return {
        "index":       index,
        "buffer":      collections.deque(),
        "buffer_lock": threading.Lock(),
        "latest_jpeg": None,
        "latest_lock": threading.Lock(),
        "active":      False,
        "error":       None,
    }


# ── Camera detection ──────────────────────────────────────────────────────────

def detect_cameras() -> dict:
    """Retorna {idx: cap} com caps JÁ ABERTOS.
    Manter o cap aberto evita race condition de reabrir no Windows."""
    if CAMERA_INDICES:
        candidates = [int(x.strip()) for x in CAMERA_INDICES.split(",") if x.strip()]
    else:
        candidates = list(range(4))  # probar 0-3

    found = {}
    for idx in candidates:
        print(f"  Testando câmera {idx}...", flush=True)
        cap = cv2.VideoCapture(idx, _CAP_BACKEND)
        if not cap.isOpened():
            cap.release()
            continue

        # Câmeras virtuais às vezes abrem mas reportam resolução 0
        if cap.get(cv2.CAP_PROP_FRAME_WIDTH) == 0:
            print(f"  Câmera {idx}: resolução 0 (virtual/inválida)", flush=True)
            cap.release()
            continue

        time.sleep(0.3)
        ret, _ = cap.read()
        if ret:
            print(f"  Câmera {idx} OK", flush=True)
            found[idx] = cap   # mantém aberto — vai para a thread diretamente
        else:
            print(f"  Câmera {idx}: abre mas não lê frames", flush=True)
            cap.release()

    return found


# ── Capture loop (uma thread por câmera) ──────────────────────────────────────

def capture_loop(cam_id: str, cap: cv2.VideoCapture):
    """Recebe o cap já aberto pela detecção — sem reabrir."""
    cam = cameras[cam_id]
    idx = cam["index"]
    cam["active"] = True
    print(f"[cam{cam_id}] Ativa!", flush=True)
    interval = 1.0 / CAPTURE_FPS

    while True:
        t0 = time.time()
        try:
            ret, frame = cap.read()
        except cv2.error:
            ret = False

        if not ret or frame is None or frame.size == 0:
            cam["active"] = False
            cap.release()
            time.sleep(1.5)
            cap = cv2.VideoCapture(idx, _CAP_BACKEND)
            time.sleep(0.5)
            cam["active"] = True
            continue

        now = time.time()
        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        jpeg_bytes = jpeg.tobytes()

        with cam["latest_lock"]:
            cam["latest_jpeg"] = jpeg_bytes

        with cam["buffer_lock"]:
            cam["buffer"].append((now, jpeg_bytes))
            cutoff = now - BUFFER_SECONDS
            while cam["buffer"] and cam["buffer"][0][0] < cutoff:
                cam["buffer"].popleft()

        elapsed = time.time() - t0
        sleep_for = interval - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    cam_list = [{"id": k, "label": f"Câmera {i+1}"} for i, k in enumerate(cameras)]
    return render_template("index.html", cameras=cam_list)


@app.route("/health")
def health():
    result = {}
    for cam_id, cam in cameras.items():
        with cam["buffer_lock"]:
            n = len(cam["buffer"])
            dur = round(cam["buffer"][-1][0] - cam["buffer"][0][0], 1) if n > 1 else 0.0
        result[cam_id] = {
            "index":      cam["index"],
            "active":     cam["active"],
            "error":      cam["error"],
            "frames":     n,
            "duration_s": dur,
        }
    return jsonify(result)


@app.route("/snapshot/<cam_id>")
def snapshot(cam_id):
    cam = cameras.get(cam_id)
    if cam is None:
        return Response(status=404)
    with cam["latest_lock"]:
        frame = cam["latest_jpeg"]
    if frame is None:
        return Response(status=503)
    return Response(frame, mimetype="image/jpeg",
                    headers={"Cache-Control": "no-store"})


def _gen_mjpeg(cam_id: str):
    cam = cameras[cam_id]
    while True:
        with cam["latest_lock"]:
            frame = cam["latest_jpeg"]
        if frame is None:
            time.sleep(0.05)
            continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        )
        time.sleep(1.0 / CAPTURE_FPS)


@app.route("/stream/<cam_id>")
def video_stream(cam_id):
    if cam_id not in cameras:
        return Response(status=404)
    return Response(_gen_mjpeg(cam_id),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


def _encode_ffmpeg(frames, fps, out_path) -> bool:
    """H.264 via ffmpeg. Retorna False se ffmpeg não estiver instalado ou falhar."""
    cmd = [
        "ffmpeg", "-y",
        "-f", "image2pipe", "-vcodec", "mjpeg",
        "-framerate", str(round(fps, 3)),
        "-i", "pipe:0",
        "-vcodec", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out_path,
    ]
    try:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        for _, jpeg_bytes in frames:
            proc.stdin.write(jpeg_bytes)
        proc.stdin.close()
        stderr_out = proc.stderr.read()
        proc.wait()
        if proc.returncode == 0 and os.path.getsize(out_path):
            return True
        print(f"[ffmpeg] {stderr_out.decode(errors='replace')}", flush=True)
        return False
    except FileNotFoundError:
        print("[ffmpeg] não encontrado — usando fallback cv2 (mp4v)", flush=True)
        return False


def _encode_cv2(frames, fps, out_path) -> bool:
    """Fallback: mp4v via OpenCV. Funciona em todos os PCs sem dependências extras."""
    first = cv2.imdecode(np.frombuffer(frames[0][1], np.uint8), cv2.IMREAD_COLOR)
    h, w = first.shape[:2]
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for _, jpeg_bytes in frames:
        frame = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
        writer.write(frame)
    writer.release()
    return os.path.getsize(out_path) > 0


@app.route("/download/<cam_id>")
def download_clip(cam_id):
    cam = cameras.get(cam_id)
    if cam is None:
        return "Câmera não encontrada.", 404

    with cam["buffer_lock"]:
        snapshot_frames = list(cam["buffer"])

    if not snapshot_frames:
        return "Câmera ainda inicializando — aguarde alguns segundos.", 503

    duration = (snapshot_frames[-1][0] - snapshot_frames[0][0]
                if len(snapshot_frames) > 1 else 0.0)
    fps = len(snapshot_frames) / duration if duration > 0 else float(CAPTURE_FPS)

    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.close()

    ok = _encode_ffmpeg(snapshot_frames, fps, tmp.name) or \
         _encode_cv2(snapshot_frames, fps, tmp.name)

    if not ok:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
        return "Erro ao gerar vídeo.", 500

    filename = f"replay_cam{cam_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

    def delayed_delete(path):
        time.sleep(60)
        try:
            os.unlink(path)
        except Exception:
            pass
    threading.Thread(target=delayed_delete, args=(tmp.name,), daemon=True).start()

    return send_file(tmp.name, as_attachment=True,
                     download_name=filename, mimetype="video/mp4")


if __name__ == "__main__":
    print("Detectando câmeras...", flush=True)
    found_caps = detect_cameras()
    if not found_caps:
        print("[ERRO] Nenhuma câmera encontrada.")
        exit(1)

    for idx, cap in found_caps.items():
        cam_id = str(idx)
        cameras[cam_id] = _make_cam(idx)
        t = threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True)
        t.start()

    print(f"Câmeras ativas: {list(found_caps.keys())}", flush=True)
    print(f"Acesse http://localhost:5000", flush=True)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
