import os
import time
import threading
import collections
import subprocess
import platform
import uuid
from datetime import datetime
from functools import wraps

os.environ["OPENCV_LOG_LEVEL"] = "ERROR"  # suprimir WARNs do OpenCV

import cv2
import numpy as np
from flask import (
    Flask, Response, jsonify, render_template, send_from_directory,
    request, redirect, url_for, session, flash,
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "replay-mvp-secret-2024")

# ── Config ───────────────────────────────────────────────────────────────────
BUFFER_SECONDS = int(os.environ.get("BUFFER_SECONDS", 10))
CAPTURE_FPS    = int(os.environ.get("CAPTURE_FPS", 20))
CAMERA_INDICES = os.environ.get("CAMERA_INDICES", "0,1,2,3")
CLIPS_DIR      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)

_BACKENDS = [cv2.CAP_DSHOW, cv2.CAP_MSMF, 0] if platform.system() == "Windows" else [0]
_BACKEND_NAMES = {cv2.CAP_DSHOW: "DSHOW", cv2.CAP_MSMF: "MSMF", 0: "AUTO"}

# ── In-memory stores ────────────────────────────────────────────────────────
cameras: dict = {}

users_db: dict = {
    "admin": {
        "name": "Administrador",
        "phone": "0000",
        "sex": "M",
        "dob": "2000-01-01",
        "password": "admin",
        "credits": 999,
        "is_admin": True,
        "created_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }
}

clips_db: dict = {}  # cam_id → [clip_info, …]

LOCATION_NAMES = {
    "0": "Quadra A — Principal",
    "1": "Quadra B — Coberta",
    "2": "Quadra C — Society",
    "3": "Quadra D — Beach Tennis",
}


def _location_name(cam_id: str) -> str:
    return LOCATION_NAMES.get(cam_id, f"Quadra {cam_id}")


# ── Camera helpers ───────────────────────────────────────────────────────────

def _make_cam(index: int, backend: int = 0) -> dict:
    return {
        "index":       index,
        "backend":     backend,
        "buffer":      collections.deque(),
        "buffer_lock": threading.Lock(),
        "latest_jpeg": None,
        "latest_lock": threading.Lock(),
        "active":      False,
        "error":       None,
        "stop":        False,
    }


def _get_candidates() -> list[int]:
    if CAMERA_INDICES:
        return [int(x.strip()) for x in CAMERA_INDICES.split(",") if x.strip()]
    return list(range(10))


def _try_open(idx: int):
    """Tenta abrir câmera com múltiplos backends. Retorna (cap, backend) ou (None, None)."""
    for backend in _BACKENDS:
        try:
            cap = cv2.VideoCapture(idx, backend)
        except Exception:
            continue
        if not cap.isOpened():
            cap.release()
            continue
        if cap.get(cv2.CAP_PROP_FRAME_WIDTH) == 0:
            cap.release()
            continue
        time.sleep(0.3)
        ret, _ = cap.read()
        if ret:
            bname = _BACKEND_NAMES.get(backend, str(backend))
            print(f"  Câmera {idx} OK (backend {bname})", flush=True)
            return cap, backend
        cap.release()
    return None, None


def _grab_test_frames(cap, n: int = 6):
    """Captura N frames de teste para validação."""
    frames = []
    for _ in range(n):
        ret, frame = cap.read()
        if ret and frame is not None and frame.size > 0:
            frames.append(frame)
        time.sleep(0.05)
    return frames


def _is_mostly_black(frames) -> bool:
    """Verifica se a maioria dos frames é preta (câmera ghost)."""
    if not frames:
        return True
    black = sum(1 for f in frames if np.mean(f) < 8)
    return black > len(frames) // 2


def _make_thumb(frame):
    """Cria thumbnail 64x64 para comparação rápida."""
    return cv2.resize(frame, (64, 64)).astype(np.float32)


def _is_duplicate(thumb, other_thumb, threshold: float = 12.0) -> bool:
    """Compara dois thumbnails — True se forem muito parecidos."""
    return np.mean(np.abs(thumb - other_thumb)) < threshold


def detect_cameras() -> dict:
    """Retorna {idx: (cap, backend)} filtrando ghosts e duplicatas."""
    found = {}
    validated_thumbs = {}
    consecutive_misses = 0

    for idx in _get_candidates():
        print(f"  Testando câmera {idx}...", flush=True)
        cap, backend = _try_open(idx)
        if cap is None:
            consecutive_misses += 1
            if not CAMERA_INDICES and consecutive_misses >= 2 and found:
                print(f"  Parando busca (2 índices vazios seguidos)", flush=True)
                break
            continue
        consecutive_misses = 0

        # Gravar frames de teste
        frames = _grab_test_frames(cap)
        if len(frames) < 2:
            print(f"  Câmera {idx}: descartada (sem frames válidos)", flush=True)
            cap.release()
            continue

        # Ghost — imagem preta
        if _is_mostly_black(frames):
            print(f"  Câmera {idx}: descartada (ghost/preta)", flush=True)
            cap.release()
            continue

        # Duplicata — frame muito parecido com outra câmera já aceita
        brightnesses = [np.mean(f) for f in frames]
        best = frames[brightnesses.index(max(brightnesses))]
        thumb = _make_thumb(best)

        is_dup = False
        for prev_idx, prev_thumb in validated_thumbs.items():
            if _is_duplicate(thumb, prev_thumb):
                print(f"  Câmera {idx}: descartada (duplicata de câmera {prev_idx})", flush=True)
                is_dup = True
                break
        if is_dup:
            cap.release()
            continue

        validated_thumbs[idx] = thumb
        found[idx] = (cap, backend)

    return found


def _validate_new_camera(cap, idx: int) -> bool:
    """Valida câmera nova no scanner — checa ghost e duplicata com câmeras ativas."""
    frames = _grab_test_frames(cap)
    if len(frames) < 2:
        return False

    if _is_mostly_black(frames):
        print(f"  [scanner] Câmera {idx}: ghost (preta)", flush=True)
        return False

    brightnesses = [np.mean(f) for f in frames]
    best = frames[brightnesses.index(max(brightnesses))]
    thumb = _make_thumb(best)

    for cam_id, cam in cameras.items():
        with cam["latest_lock"]:
            jpeg = cam["latest_jpeg"]
        if jpeg is None:
            continue
        existing = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
        if existing is None:
            continue
        if _is_duplicate(thumb, _make_thumb(existing)):
            print(f"  [scanner] Câmera {idx}: duplicata de cam{cam_id}", flush=True)
            return False

    return True


def capture_loop(cam_id: str, cap: cv2.VideoCapture):
    cam = cameras.get(cam_id)
    if cam is None:
        cap.release()
        return
    idx = cam["index"]
    backend = cam["backend"]
    cam["active"] = True
    print(f"[cam{cam_id}] Captura iniciada", flush=True)
    interval = 1.0 / CAPTURE_FPS

    while not cam["stop"]:
        t0 = time.time()
        try:
            ret, frame = cap.read()
        except cv2.error:
            ret = False

        if not ret or frame is None or frame.size == 0:
            cam["active"] = False
            try:
                cap.release()
            except Exception:
                pass
            if cam["stop"]:
                break
            print(f"[cam{cam_id}] Offline — tentando reconectar...", flush=True)

            # Loop de reconexão — tenta a cada 5s até voltar
            while not cam["stop"]:
                time.sleep(5)
                if cam["stop"]:
                    break
                try:
                    cap = cv2.VideoCapture(idx, backend)
                    if not cap.isOpened():
                        cap.release()
                        continue
                    # Warmup longo — Windows USB demora a estabilizar
                    time.sleep(2)
                    # Exigir pelo menos 3 de 5 frames válidos
                    good = 0
                    for _ in range(5):
                        r, _ = cap.read()
                        if r:
                            good += 1
                        time.sleep(0.15)
                    if good >= 3:
                        cam["active"] = True
                        with cam["buffer_lock"]:
                            cam["buffer"].clear()
                        print(f"[cam{cam_id}] Reconectada! ({good}/5 frames OK)", flush=True)
                        break
                    cap.release()
                except Exception:
                    pass
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
        if (s := interval - elapsed) > 0:
            time.sleep(s)

    try:
        cap.release()
    except Exception:
        pass
    cam["active"] = False
    print(f"[cam{cam_id}] Thread encerrada", flush=True)


# ── Camera hot-plug scanner ──────────────────────────────────────────────────

SCAN_INTERVAL    = int(os.environ.get("SCAN_INTERVAL", 15))    # segundos entre scans
INACTIVE_TIMEOUT = int(os.environ.get("INACTIVE_TIMEOUT", 120)) # 2 min antes de remover
_REJECT_COOLDOWN = 300  # 5 min antes de re-testar um índice rejeitado

_rejected_indices: dict[int, float] = {}  # idx → timestamp da rejeição


def camera_scanner():
    """Detecta câmeras novas (só no modo auto-detect, sem CAMERA_INDICES)."""
    inactive_since: dict[str, float] = {}

    while True:
        time.sleep(SCAN_INTERVAL)

        # Com CAMERA_INDICES definido, cada capture_loop cuida da sua reconexão
        if CAMERA_INDICES:
            continue

        now = time.time()
        known_indices = {cam["index"] for cam in cameras.values()}
        candidates = _get_candidates()
        if known_indices:
            max_idx = max(known_indices) + 2
            candidates = [i for i in candidates if i <= max_idx]

        # ── Detectar novas câmeras ───────────────────────────────────────
        for idx in candidates:
            if idx in known_indices:
                continue
            rej_time = _rejected_indices.get(idx)
            if rej_time and now - rej_time < _REJECT_COOLDOWN:
                continue
            cap, backend = _try_open(idx)
            if cap is None:
                continue
            if not _validate_new_camera(cap, idx):
                cap.release()
                _rejected_indices[idx] = now
                continue
            cam_id = str(idx)
            bname = _BACKEND_NAMES.get(backend, "?")
            print(f"[scanner] Nova câmera: {idx} ({bname})", flush=True)
            cameras[cam_id] = _make_cam(idx, backend)
            _rejected_indices.pop(idx, None)
            threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True).start()

        # ── Remover câmeras inativas ─────────────────────────────────────
        for cam_id in list(cameras.keys()):
            cam = cameras[cam_id]
            if cam["active"]:
                inactive_since.pop(cam_id, None)
            else:
                if cam_id not in inactive_since:
                    inactive_since[cam_id] = now
                elif now - inactive_since[cam_id] > INACTIVE_TIMEOUT:
                    print(f"[scanner] Removendo câmera {cam_id}", flush=True)
                    cam["stop"] = True
                    cameras.pop(cam_id, None)
                    inactive_since.pop(cam_id, None)
                    _rejected_indices.pop(cam["index"], None)


# ── Encoding helpers ─────────────────────────────────────────────────────────

def _encode_ffmpeg(frames, fps, out_path) -> bool:
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
        proc.stderr.read()
        proc.wait()
        return proc.returncode == 0 and os.path.getsize(out_path) > 0
    except FileNotFoundError:
        return False


def _encode_cv2(frames, fps, out_path) -> bool:
    first = cv2.imdecode(np.frombuffer(frames[0][1], np.uint8), cv2.IMREAD_COLOR)
    h, w = first.shape[:2]
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for _, jpeg_bytes in frames:
        frame = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
        writer.write(frame)
    writer.release()
    return os.path.getsize(out_path) > 0


# ── Auth decorators ──────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session or session["user"] not in users_db:
            session.pop("user", None)
            return redirect(url_for("login"))
        return f(*a, **kw)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session:
            return redirect(url_for("login"))
        u = users_db.get(session["user"])
        if not u or not u.get("is_admin"):
            return redirect(url_for("locations_page"))
        return f(*a, **kw)
    return wrapper


@app.context_processor
def inject_globals():
    u = users_db.get(session.get("user"))
    return {"current_user": u, "current_username": session.get("user")}


# ── Auth routes ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if "user" in session and session["user"] in users_db:
        u = users_db[session["user"]]
        return redirect(url_for("admin_page" if u.get("is_admin") else "locations_page"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = users_db.get(username)
        if user and user["password"] == password:
            session["user"] = username
            return redirect(url_for("admin_page" if user.get("is_admin") else "locations_page"))
        flash("Usuário ou senha incorretos.")
    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name  = request.form.get("name", "").strip()
        phone = request.form.get("phone", "").strip()
        sex   = request.form.get("sex", "")
        dob   = request.form.get("dob", "")
        terms = request.form.get("terms")
        if not all([name, phone, sex, dob]):
            flash("Preencha todos os campos obrigatórios.")
            return render_template("register.html")
        if not terms:
            flash("Você deve aceitar os termos de uso.")
            return render_template("register.html")
        uid = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if uid in users_db:
            flash("Este telefone já está cadastrado.")
            return render_template("register.html")
        pwd = uid[-4:]
        users_db[uid] = {
            "name": name,
            "phone": phone,
            "sex": sex,
            "dob": dob,
            "password": pwd,
            "credits": 5,
            "is_admin": False,
            "created_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        }
        session["user"] = uid
        flash(f"Bem-vindo(a), {name}! Você ganhou 5 créditos. Sua senha: {pwd}")
        return redirect(url_for("locations_page"))
    return render_template("register.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))


# ── User routes ──────────────────────────────────────────────────────────────

@app.route("/locations")
@login_required
def locations_page():
    locs = []
    for cam_id in cameras:
        locs.append({
            "id": cam_id,
            "name": _location_name(cam_id),
            "clips_count": len(clips_db.get(cam_id, [])),
        })
    return render_template("locations.html", locations=locs)


@app.route("/location/<cam_id>")
@login_required
def location_detail(cam_id):
    if cam_id not in cameras:
        flash("Localidade não encontrada.")
        return redirect(url_for("locations_page"))
    return render_template(
        "location_detail.html",
        cam_id=cam_id,
        location_name=_location_name(cam_id),
        clips=clips_db.get(cam_id, []),
        buffer_seconds=BUFFER_SECONDS,
    )


@app.route("/generate-clip/<cam_id>", methods=["POST"])
@login_required
def generate_clip(cam_id):
    cam = cameras.get(cam_id)
    if cam is None:
        return jsonify({"error": "camera_not_found"}), 404

    user = users_db[session["user"]]
    if not user.get("is_admin") and user["credits"] <= 0:
        return jsonify({"error": "no_credits", "credits": 0}), 402

    with cam["buffer_lock"]:
        snapshot_frames = list(cam["buffer"])
    if not snapshot_frames:
        return jsonify({"error": "buffer_empty"}), 503

    duration = (snapshot_frames[-1][0] - snapshot_frames[0][0]) if len(snapshot_frames) > 1 else 0.0
    fps = len(snapshot_frames) / duration if duration > 0 else float(CAPTURE_FPS)

    clip_id = uuid.uuid4().hex[:12]
    cam_dir = os.path.join(CLIPS_DIR, cam_id)
    os.makedirs(cam_dir, exist_ok=True)
    clip_path  = os.path.join(cam_dir, f"{clip_id}.mp4")
    thumb_path = os.path.join(cam_dir, f"{clip_id}_thumb.jpg")

    ok = _encode_ffmpeg(snapshot_frames, fps, clip_path) or \
         _encode_cv2(snapshot_frames, fps, clip_path)
    if not ok:
        return jsonify({"error": "encoding_failed"}), 500

    mid = len(snapshot_frames) // 2
    mid_frame = cv2.imdecode(np.frombuffer(snapshot_frames[mid][1], np.uint8), cv2.IMREAD_COLOR)
    if mid_frame is not None:
        cv2.imwrite(thumb_path, mid_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])

    if not user.get("is_admin"):
        user["credits"] -= 1

    clip_info = {
        "id":        clip_id,
        "filename":  f"{clip_id}.mp4",
        "thumb":     f"{clip_id}_thumb.jpg",
        "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "user":      session["user"],
        "user_name": user["name"],
        "duration":  round(duration, 1),
    }
    clips_db.setdefault(cam_id, []).insert(0, clip_info)

    loc_name = _location_name(cam_id).replace(" ", "_").replace("—", "").replace("__", "_")
    download_name = f"replay_{loc_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

    return jsonify({
        "success":       True,
        "clip":          clip_info,
        "download_url":  url_for("serve_clip", cam_id=cam_id, filename=f"{clip_id}.mp4"),
        "download_name": download_name,
        "credits":       user["credits"],
    })


@app.route("/buy-credits", methods=["POST"])
@login_required
def buy_credits():
    user = users_db[session["user"]]
    user["credits"] += 5
    return jsonify({"success": True, "credits": user["credits"]})


@app.route("/clips/<cam_id>/<filename>")
@login_required
def serve_clip(cam_id, filename):
    return send_from_directory(os.path.join(CLIPS_DIR, cam_id), filename)


# ── Admin routes ─────────────────────────────────────────────────────────────

@app.route("/admin")
@admin_required
def admin_page():
    cam_list = [{"id": k, "label": _location_name(k)} for k in cameras]
    users_count = len([u for u in users_db.values() if not u.get("is_admin")])
    clips_count = sum(len(v) for v in clips_db.values())
    return render_template("admin.html", cameras=cam_list,
                           users_count=users_count, clips_count=clips_count)


@app.route("/admin/users")
@admin_required
def admin_users():
    return render_template("admin_users.html", users=users_db)


# ── Camera API (no auth — used by img/stream tags) ──────────────────────────

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
    return Response(frame, mimetype="image/jpeg", headers={"Cache-Control": "no-store"})


def _gen_mjpeg(cam_id: str):
    cam = cameras[cam_id]
    while True:
        with cam["latest_lock"]:
            frame = cam["latest_jpeg"]
        if frame is None:
            time.sleep(0.05)
            continue
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        time.sleep(1.0 / CAPTURE_FPS)


@app.route("/stream/<cam_id>")
def video_stream(cam_id):
    if cam_id not in cameras:
        return Response(status=404)
    return Response(_gen_mjpeg(cam_id),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Detectando câmeras...", flush=True)
    found_caps = detect_cameras()
    if not found_caps:
        print("[ERRO] Nenhuma câmera encontrada.")
        exit(1)
    for idx, (cap, backend) in found_caps.items():
        cam_id = str(idx)
        cameras[cam_id] = _make_cam(idx, backend)
        threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True).start()
    print(f"Câmeras ativas: {list(found_caps.keys())}", flush=True)
    threading.Thread(target=camera_scanner, daemon=True).start()
    print(f"Scanner de câmeras ativo (a cada {SCAN_INTERVAL}s)", flush=True)
    print("Acesse http://localhost:5000", flush=True)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
