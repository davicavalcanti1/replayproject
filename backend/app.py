import os
import time
import threading
import collections
import subprocess
import platform
import uuid
from datetime import datetime
from functools import wraps
from urllib.parse import quote

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

os.environ["OPENCV_LOG_LEVEL"] = "ERROR"  # suprimir WARNs do OpenCV

import cv2
import numpy as np
from flask import (
    Flask, Response, jsonify, render_template, send_from_directory,
    request, redirect, url_for, session, flash,
)
try:
    from flask_cors import CORS
    _CORS_AVAILABLE = True
except ImportError:
    _CORS_AVAILABLE = False

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "replay-mvp-secret-2024")
if _CORS_AVAILABLE:
    # supports_credentials=True allows Flask session cookies to be forwarded
    # from the Vite dev server (localhost:5173) back to Flask (localhost:5000)
    CORS(app,
         supports_credentials=True,
         origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
         resources={r"/api/*": {}, r"/stream/*": {}, r"/snapshot/*": {},
                    r"/health": {}, r"/generate-clip/*": {}, r"/clips/*": {}},
         methods=["GET", "POST", "DELETE", "OPTIONS"])

# ── Config ───────────────────────────────────────────────────────────────────
BUFFER_SECONDS = int(os.environ.get("BUFFER_SECONDS", 10))
CAPTURE_FPS    = int(os.environ.get("CAPTURE_FPS", 20))
CAMERA_INDICES = os.environ.get("CAMERA_INDICES", "0,1,2,3")
CLIPS_DIR      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)

# ── IP Camera (Intelbras) credentials ───────────────────────────────────────
CAMERA_USER     = os.environ.get("CAMERA_USER", "admin")
CAMERA_PASSWORD = os.environ.get("CAMERA_PASSWORD", "admin")

# ── Hardware trigger (ESP8266 button) ────────────────────────────────────────
# Set TRIGGER_TOKEN in .env or environment to require authentication.
# If empty, the /api/trigger-all endpoint accepts requests without a token.
TRIGGER_TOKEN = os.environ.get("TRIGGER_TOKEN", "")

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

def _make_cam(index, backend: int = 0, ip: str = None, channel: int = 1, name: str = None) -> dict:
    return {
        "index":       index,
        "backend":     backend,
        "ip":          ip,            # None = USB camera, "10.20.100.126" = IP camera
        "channel":     channel,       # RTSP channel (1 = default)
        "name":        name,          # custom name for IP cameras
        "buffer":      collections.deque(),
        "buffer_lock": threading.Lock(),
        "latest_jpeg": None,
        "latest_lock": threading.Lock(),
        "active":      False,
        "error":       None,
        "stop":        False,
    }


def _build_rtsp_url(ip: str, channel: int = 1, subtype: int = 0) -> str:
    """Monta URL RTSP para câmeras Intelbras. Faz URL-encode das credenciais."""
    user = quote(CAMERA_USER, safe='')
    pwd  = quote(CAMERA_PASSWORD, safe='')
    return f"rtsp://{user}:{pwd}@{ip}:554/cam/realmonitor?channel={channel}&subtype={subtype}"


def _try_open_ip(ip: str, channel: int = 1) -> cv2.VideoCapture | None:
    """Tenta conectar a uma câmera IP via RTSP. Usa substream (H.264, menor resolução)."""
    # subtype=1 = substream (H.264, ~704x576 ou 640x480) — muito mais leve
    # subtype=0 = mainstream (pode ser H.265, 2560x1440) — pesado demais pra streaming
    for subtype in [1, 0]:
        url = _build_rtsp_url(ip, channel, subtype=subtype)
        label = "substream" if subtype == 1 else "mainstream"
        print(f"  Conectando câmera IP {ip} canal {channel} ({label})...", flush=True)
        try:
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        except Exception as e:
            print(f"  Erro ao conectar ({label}): {e}", flush=True)
            continue
        if not cap.isOpened():
            cap.release()
            print(f"  Câmera IP {ip} ({label}): não abriu", flush=True)
            continue
        time.sleep(2)
        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            cap.release()
            print(f"  Câmera IP {ip} ({label}): sem frames", flush=True)
            continue
        print(f"  Câmera IP {ip} OK ({label}, {frame.shape[1]}x{frame.shape[0]})", flush=True)
        return cap
    return None


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
    is_ip = cam.get("ip") is not None
    # Câmeras IP: mesmo FPS das USB para replay fluido
    effective_fps = CAPTURE_FPS
    print(f"[cam{cam_id}] Captura iniciada ({'IP ' + cam['ip'] if is_ip else 'USB'}, {effective_fps}fps)", flush=True)
    interval = 1.0 / effective_fps

    try:
      _capture_loop_inner(cam_id, cam, cap, idx, backend, is_ip, interval)
    except Exception as e:
        print(f"[cam{cam_id}] ERRO FATAL na thread: {e}", flush=True)
        cam["active"] = False
        try:
            cap.release()
        except Exception:
            pass


def _capture_loop_inner(cam_id, cam, cap, idx, backend, is_ip, interval):
    # Câmeras IP: minimizar buffer interno do OpenCV para evitar delay
    if is_ip:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while not cam["stop"]:
        t0 = time.time()
        try:
            if is_ip:
                # Drenar frames velhos do buffer RTSP — grab() descarta, retrieve() pega o último
                cap.grab()
                ret, frame = cap.retrieve()
            else:
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
                    # Reconexão: IP camera usa RTSP URL, USB usa index+backend
                    if cam.get("ip"):
                        url = _build_rtsp_url(cam["ip"], cam.get("channel", 1))
                        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    else:
                        cap = cv2.VideoCapture(idx, backend)
                    if not cap.isOpened():
                        cap.release()
                        continue
                    # Warmup longo — câmeras demoram a estabilizar
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
        # Câmeras IP com resolução muito alta: redimensionar para 1280x720
        if is_ip and frame.shape[1] > 1280:
            frame = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA)
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

        # ── Remover câmeras inativas (só USB — câmeras IP reconectam sozinhas)
        for cam_id in list(cameras.keys()):
            cam = cameras[cam_id]
            if cam.get("ip"):
                continue  # Nunca remover câmeras IP automaticamente
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


@app.after_request
def add_cors_headers(response):
    """
    When Vite dev-server proxy forwards requests, the session cookie is already
    on the same effective origin. Still add permissive headers for direct API calls.
    """
    origin = request.headers.get("Origin", "")
    if origin in ("http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"):
        response.headers["Access-Control-Allow-Origin"]      = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"]     = "Content-Type, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"]     = "GET, POST, DELETE, OPTIONS"
    return response


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


def _do_generate_clip(cam_id: str, triggered_by: str = "system") -> dict:
    """Generate a replay clip for *cam_id* and persist it in clips_db.

    Returns a dict with keys:
      - on success: {"ok": True, "clip": clip_info, "download_url": ..., "download_name": ...}
      - on failure: {"ok": False, "error": "<reason>"}
    """
    cam = cameras.get(cam_id)
    if cam is None:
        return {"ok": False, "error": "camera_not_found"}

    with cam["buffer_lock"]:
        snapshot_frames = list(cam["buffer"])
    if not snapshot_frames:
        return {"ok": False, "error": "buffer_empty"}

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
        return {"ok": False, "error": "encoding_failed"}

    mid = len(snapshot_frames) // 2
    mid_frame = cv2.imdecode(np.frombuffer(snapshot_frames[mid][1], np.uint8), cv2.IMREAD_COLOR)
    if mid_frame is not None:
        cv2.imwrite(thumb_path, mid_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])

    clip_info = {
        "id":        clip_id,
        "filename":  f"{clip_id}.mp4",
        "thumb":     f"{clip_id}_thumb.jpg",
        "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "user":      triggered_by,
        "user_name": triggered_by,
        "duration":  round(duration, 1),
    }
    clips_db.setdefault(cam_id, []).insert(0, clip_info)

    loc_name = _location_name(cam_id).replace(" ", "_").replace("—", "").replace("__", "_")
    download_name = f"replay_{loc_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

    return {
        "ok":            True,
        "clip":          clip_info,
        "download_url":  f"/clips/{cam_id}/{clip_id}.mp4",
        "download_name": download_name,
    }


@app.route("/generate-clip/<cam_id>", methods=["POST"])
@login_required
def generate_clip(cam_id):
    user = users_db[session["user"]]
    if not user.get("is_admin") and user["credits"] <= 0:
        return jsonify({"error": "no_credits", "credits": 0}), 402

    result = _do_generate_clip(cam_id, triggered_by=session["user"])

    if not result["ok"]:
        status = 404 if result["error"] == "camera_not_found" else \
                 503 if result["error"] == "buffer_empty" else 500
        return jsonify({"error": result["error"]}), status

    if not user.get("is_admin"):
        user["credits"] -= 1

    return jsonify({
        "success":       True,
        "clip":          result["clip"],
        "download_url":  url_for("serve_clip", cam_id=cam_id,
                                 filename=result["clip"]["filename"]),
        "download_name": result["download_name"],
        "credits":       user["credits"],
    })


@app.route("/api/trigger-all", methods=["POST", "GET"])
@app.route("/botao", methods=["GET"])
def trigger_all():
    """Hardware trigger endpoint — called by the ESP8266 button.

    Generates a replay clip for every active camera simultaneously.
    Authentication: if TRIGGER_TOKEN env var is set, the request must carry
    the header  X-Trigger-Token: <token>  (or Bearer token in Authorization).
    """
    if TRIGGER_TOKEN:
        provided = (
            request.headers.get("X-Trigger-Token") or
            request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        )
        if provided != TRIGGER_TOKEN:
            return jsonify({"error": "unauthorized"}), 401

    active_ids = [cam_id for cam_id, cam in cameras.items() if cam.get("active")]
    if not active_ids:
        return jsonify({"ok": False, "error": "no_active_cameras"}), 503

    results = {}
    threads = []

    def _worker(cam_id):
        results[cam_id] = _do_generate_clip(cam_id, triggered_by="hardware_button")

    for cam_id in active_ids:
        t = threading.Thread(target=_worker, args=(cam_id,), daemon=True)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    return jsonify({
        "ok":      True,
        "trigger": "hardware_button",
        "clips":   results,
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
            "ip":         cam.get("ip"),
            "channel":    cam.get("channel"),
            "is_ip":      cam.get("ip") is not None,
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


# ── Hot-plug camera scan ─────────────────────────────────────────────────────
#
# Architecture:
#   POST /api/scan-cameras  → kicks off background scan, returns immediately
#   GET  /api/scan-status   → frontend polls this every 500ms for live progress
#
# Each candidate index is checked in its own thread so they run in parallel.
# A shared _scan_state dict is updated by the threads (protected by a lock).

_scan_state: dict = {
    "running":    False,
    "started_at": None,
    "indices":    [],   # list of {"index":N, "status": "pending|checking|found|skipped|error", "cam_id":str|None, "reason":str}
    "added":      [],   # newly added cameras
    "total":      0,
}
_scan_lock = threading.Lock()


def _scan_single(idx: int):
    """
    Try to open camera at index `idx`, validate, and add to `cameras`.
    Updates _scan_state in place.  Runs in its own thread.
    """
    def _set(status, reason="", cam_id=None):
        with _scan_lock:
            for entry in _scan_state["indices"]:
                if entry["index"] == idx:
                    entry["status"] = status
                    entry["reason"] = reason
                    if cam_id:
                        entry["cam_id"] = cam_id
                    break

    _set("checking")

    # Skip index already active
    with _scan_lock:
        known = {cam["index"] for cam in cameras.values()}
    if idx in known:
        _set("skipped", "já ativa")
        return

    # Try to open
    cap, backend = _try_open(idx)
    if cap is None:
        _set("error", "não encontrada")
        return

    # Validate (ghost / duplicate check)
    if not _validate_new_camera(cap, idx):
        cap.release()
        _set("error", "ghost ou duplicata")
        return

    # Add to running system
    cam_id = str(idx)
    with _scan_lock:
        # Re-check — another thread might have added it
        if cam_id in cameras:
            cap.release()
            _set("skipped", "já ativa")
            return
        cameras[cam_id] = _make_cam(idx, backend)
        bname = _BACKEND_NAMES.get(backend, "?")
        entry = {"id": cam_id, "index": idx, "backend": bname, "name": _location_name(cam_id)}
        _scan_state["added"].append(entry)

    threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True).start()
    _set("found", cam_id=cam_id)
    print(f"[hotplug] Câmera {idx} adicionada em tempo real", flush=True)


def _run_scan(candidates: list[int]):
    """Background orchestrator: launches one thread per candidate, waits up to 12s total."""
    with _scan_lock:
        _scan_state["running"]    = True
        _scan_state["started_at"] = time.time()
        _scan_state["added"]      = []
        _scan_state["indices"]    = [
            {"index": i, "status": "pending", "cam_id": None, "reason": ""}
            for i in candidates
        ]

    threads = [threading.Thread(target=_scan_single, args=(i,), daemon=True) for i in candidates]
    for t in threads:
        t.start()

    deadline = time.time() + 12   # 12 s total budget
    for t in threads:
        remaining = max(0.1, deadline - time.time())
        t.join(timeout=remaining)

    # Mark any still-pending as timed out
    with _scan_lock:
        for entry in _scan_state["indices"]:
            if entry["status"] in ("pending", "checking"):
                entry["status"] = "error"
                entry["reason"] = "timeout"
        _scan_state["running"] = False
        _scan_state["total"]   = len(cameras)

    print(f"[hotplug] Scan concluído. {len(_scan_state['added'])} câmera(s) adicionada(s).", flush=True)


@app.route("/api/scan-cameras", methods=["POST"])
@login_required
def api_scan_cameras():
    """Kick off a hot-plug scan.  Returns immediately; poll /api/scan-status."""
    with _scan_lock:
        if _scan_state["running"]:
            return jsonify({"error": "scan_already_running"}), 409

    # Candidates: 0-9 minus indices already active
    known = {cam["index"] for cam in cameras.values()}
    data  = request.get_json(silent=True) or {}
    # Caller can pass {"indices": [0,1,2,...]} to override
    requested = data.get("indices")
    if requested:
        candidates = [int(i) for i in requested if int(i) not in known]
    else:
        candidates = [i for i in range(10) if i not in known]

    if not candidates:
        return jsonify({"message": "Nenhum índice novo para verificar.", "added": []}), 200

    threading.Thread(target=_run_scan, args=(candidates,), daemon=True).start()
    return jsonify({"message": "Scan iniciado.", "candidates": candidates}), 202


@app.route("/api/scan-status")
@login_required
def api_scan_status():
    """Poll this endpoint to get live scan progress."""
    with _scan_lock:
        state = {
            "running":    _scan_state["running"],
            "indices":    list(_scan_state["indices"]),
            "added":      list(_scan_state["added"]),
            "total_cameras": len(cameras),
        }
    return jsonify(state)


# ── IP Camera management API ────────────────────────────────────────────────

_ip_cam_counter = 100  # IDs for IP cameras start at 100 to avoid collision with USB indices


@app.route("/api/add-ip-camera", methods=["POST"])
@login_required
def api_add_ip_camera():
    """
    Add an IP camera by its IP address.
    Body: {"ip": "10.20.100.126", "channel": 1, "name": "Entrada"}
    """
    global _ip_cam_counter
    data = request.get_json(silent=True) or {}
    ip = data.get("ip", "").strip()
    channel = int(data.get("channel", 1))
    name = data.get("name", "").strip()

    if not ip:
        return jsonify({"error": "IP obrigatório"}), 400

    # Check if this IP+channel is already registered
    for cam_id, cam in cameras.items():
        if cam.get("ip") == ip and cam.get("channel", 1) == channel:
            return jsonify({"error": f"Câmera {ip} canal {channel} já cadastrada (ID {cam_id})"}), 409

    # Try to connect
    cap = _try_open_ip(ip, channel)
    if cap is None:
        return jsonify({"error": f"Não foi possível conectar em {ip}. Verifique IP, usuário e senha."}), 502

    cam_id = f"ip{_ip_cam_counter}"
    _ip_cam_counter += 1

    cam_name = name or f"Câmera IP {ip}"
    cameras[cam_id] = _make_cam(index=ip, backend=0, ip=ip, channel=channel, name=cam_name)
    LOCATION_NAMES[cam_id] = cam_name

    threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True).start()
    print(f"[ip-cam] Câmera IP adicionada: {ip} canal {channel} → ID {cam_id}", flush=True)

    return jsonify({
        "success": True,
        "cam_id": cam_id,
        "name": cam_name,
        "ip": ip,
        "channel": channel,
    }), 201


@app.route("/api/remove-camera/<cam_id>", methods=["DELETE"])
@login_required
def api_remove_camera(cam_id):
    """Remove a camera (IP or USB) by its ID."""
    cam = cameras.get(cam_id)
    if cam is None:
        return jsonify({"error": "Câmera não encontrada"}), 404

    cam["stop"] = True
    cameras.pop(cam_id, None)
    LOCATION_NAMES.pop(cam_id, None)
    print(f"[remove] Câmera {cam_id} removida", flush=True)

    return jsonify({"success": True, "cam_id": cam_id})


@app.route("/api/ip-cameras")
@login_required
def api_list_ip_cameras():
    """List all registered IP cameras."""
    result = []
    for cam_id, cam in cameras.items():
        if cam.get("ip"):
            result.append({
                "cam_id": cam_id,
                "ip": cam["ip"],
                "channel": cam.get("channel", 1),
                "name": cam.get("name", f"Câmera IP {cam['ip']}"),
                "active": cam["active"],
            })
    return jsonify(result)


# ── React Frontend extended API ──────────────────────────────────────────────

@app.route("/api/me")
def api_me():
    """Return current logged-in user info (no sensitive data)."""
    uname = session.get("user")
    if not uname or uname not in users_db:
        return jsonify({"error": "not_logged_in"}), 401
    u = users_db[uname]
    return jsonify({
        "username": uname,
        "name":     u["name"],
        "phone":    u["phone"],
        "is_admin": u.get("is_admin", False),
        "credits":  u.get("credits"),
        "created_at": u.get("created_at"),
    })


@app.route("/api/clips/<cam_id>")
def api_clips(cam_id):
    """Return the list of clips for a camera."""
    return jsonify({"clips": clips_db.get(cam_id, [])})


@app.route("/api/users")
@admin_required
def api_users():
    """Return all users (admin only)."""
    safe = {}
    for uname, u in users_db.items():
        safe[uname] = {
            "name":       u["name"],
            "phone":      u["phone"],
            "sex":        u.get("sex", ""),
            "is_admin":   u.get("is_admin", False),
            "credits":    u.get("credits"),
            "created_at": u.get("created_at", ""),
        }
    return jsonify(safe)


@app.route("/api/users/<username>/credits", methods=["POST"])
@admin_required
def api_adjust_credits(username):
    """Add/subtract credits for a user (admin only)."""
    if username not in users_db:
        return jsonify({"error": "user_not_found"}), 404
    data = request.get_json(silent=True) or {}
    delta = int(data.get("delta", 0))
    users_db[username]["credits"] = max(0, (users_db[username].get("credits") or 0) + delta)
    return jsonify({"credits": users_db[username]["credits"]})


@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    """Read/write runtime-visible config values."""
    if request.method == "GET":
        return jsonify({
            "buffer_seconds": BUFFER_SECONDS,
            "capture_fps":    CAPTURE_FPS,
            "scan_interval":  SCAN_INTERVAL,
        })
    # POST — just acknowledge (full restart needed to apply)
    return jsonify({"ok": True, "note": "Restart backend to apply buffer/fps changes."})


@app.route("/api/replay_stream/<cam_id>")
def api_replay_stream(cam_id):
    """
    Stream the buffered frames as MJPEG from oldest → newest at the original fps.
    The React player uses this to replay the last N seconds like a DVR.
    """
    cam = cameras.get(cam_id)
    if cam is None:
        return Response(status=404)

    with cam["buffer_lock"]:
        frames = list(cam["buffer"])  # snapshot of the buffer

    if not frames:
        return Response(status=503)

    duration = frames[-1][0] - frames[0][0] if len(frames) > 1 else 0.0
    fps = len(frames) / duration if duration > 0 else float(CAPTURE_FPS)
    interval = 1.0 / fps

    def generate():
        for _, jpeg_bytes in frames:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg_bytes + b"\r\n"
            time.sleep(interval)

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


# ── React UI static serving ──────────────────────────────────────────────────
# Serves the built Vite/React app. Build it with: npm run build inside replay-ui/
# then copy the dist/ folder here as "react_dist/"

REACT_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "react_dist")


@app.route("/ui")
@app.route("/ui/")
def react_ui_index():
    index = os.path.join(REACT_DIST, "index.html")
    if os.path.exists(index):
        return send_from_directory(REACT_DIST, "index.html")
    return "React UI not built yet. Run: npm run build inside replay-ui/ and copy dist/ to replay_mvp/react_dist/", 503


@app.route("/ui/<path:path>")
def react_ui_static(path):
    full = os.path.join(REACT_DIST, path)
    if os.path.exists(full):
        return send_from_directory(REACT_DIST, path)
    # SPA fallback
    index = os.path.join(REACT_DIST, "index.html")
    if os.path.exists(index):
        return send_from_directory(REACT_DIST, "index.html")
    return "Not found", 404


# ── React Frontend API ──────────────────────────────────────────────────────
# These endpoints power the new React UI at /ui (dev: localhost:5173)

@app.route("/api/buffer/<cam_id>")
def api_buffer(cam_id):
    """Return metadata about the frame buffer for a given camera."""
    cam = cameras.get(cam_id)
    if cam is None:
        return jsonify({"error": "camera_not_found"}), 404
    with cam["buffer_lock"]:
        buf = list(cam["buffer"])
    if not buf:
        return jsonify({"frames": 0, "duration_s": 0, "fps": CAPTURE_FPS, "latest_ts": None})
    duration = buf[-1][0] - buf[0][0] if len(buf) > 1 else 0.0
    fps = len(buf) / duration if duration > 0 else float(CAPTURE_FPS)
    return jsonify({
        "frames": len(buf),
        "duration_s": round(duration, 3),
        "fps": round(fps, 2),
        "latest_ts": buf[-1][0],
        "oldest_ts": buf[0][0],
        "active": cam["active"],
    })


@app.route("/api/frame/<cam_id>")
def api_frame(cam_id):
    """
    Return a JPEG frame at a given offset (seconds in the past from now).
    Query params:
      offset  — float, seconds in the past (0 = latest, -5 = 5 seconds ago)
      format  — 'jpeg' (default) or 'png'
      quality — 'original' (default) | 'hd' | 'fhd' | 'thumb'
    """
    cam = cameras.get(cam_id)
    if cam is None:
        return Response(status=404)

    try:
        offset = float(request.args.get("offset", "0"))
    except ValueError:
        offset = 0.0

    fmt = request.args.get("format", "jpeg").lower()
    quality_preset = request.args.get("quality", "original").lower()

    with cam["buffer_lock"]:
        buf = list(cam["buffer"])

    if not buf:
        return Response(status=503)

    # Find frame closest to target timestamp
    if offset >= 0:
        # Latest frame
        _, jpeg_bytes = buf[-1]
    else:
        target_ts = time.time() + offset  # offset is negative
        # Binary search for closest timestamp
        best = buf[-1]
        best_delta = abs(buf[-1][0] - target_ts)
        lo, hi = 0, len(buf) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            delta = buf[mid][0] - target_ts
            if abs(delta) < best_delta:
                best_delta = abs(delta)
                best = buf[mid]
            if delta < 0:
                lo = mid + 1
            else:
                hi = mid - 1
        _, jpeg_bytes = best

    # Decode and optionally resize
    if quality_preset != "original":
        sizes = {"thumb": (640, 360), "hd": (1280, 720), "fhd": (1920, 1080)}
        target_size = sizes.get(quality_preset)
        if target_size:
            img = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is not None:
                h, w = img.shape[:2]
                tw, th = target_size
                if w != tw or h != th:
                    img = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
                    q = 85 if fmt == "jpeg" else 9
                    ext = ".jpg" if fmt == "jpeg" else ".png"
                    _, enc = cv2.imencode(ext, img, [cv2.IMWRITE_JPEG_QUALITY, q] if fmt == "jpeg" else [cv2.IMWRITE_PNG_COMPRESSION, q])
                    jpeg_bytes = enc.tobytes()

    if fmt == "png":
        img = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is not None:
            _, enc = cv2.imencode(".png", img)
            return Response(enc.tobytes(), mimetype="image/png",
                            headers={"Cache-Control": "no-store"})

    return Response(jpeg_bytes, mimetype="image/jpeg",
                    headers={"Cache-Control": "no-store"})


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Detectando câmeras...", flush=True)
    found_caps = detect_cameras()
    if not found_caps:
        print("[AVISO] Nenhuma câmera USB encontrada. Câmeras IP podem ser adicionadas pela interface.")
    else:
        for idx, (cap, backend) in found_caps.items():
            cam_id = str(idx)
            cameras[cam_id] = _make_cam(idx, backend)
            threading.Thread(target=capture_loop, args=(cam_id, cap), daemon=True).start()
        print(f"Câmeras ativas: {list(found_caps.keys())}", flush=True)
    threading.Thread(target=camera_scanner, daemon=True).start()
    print(f"Scanner de câmeras ativo (a cada {SCAN_INTERVAL}s)", flush=True)
    print("Acesse http://localhost:5000", flush=True)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
