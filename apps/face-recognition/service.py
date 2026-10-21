"""
Face Recognition & Verification Service
========================================
(see prior docstring — unchanged in spirit)
"""

import hashlib
import cv2
import numpy as np
from PIL import Image
import io
import insightface
from insightface.app import FaceAnalysis
from fastapi import HTTPException
import logging
from config import settings
from schemas import PairResult, VerificationResponse, VerificationStatus

from pose_estimation import HeadPoseEstimator

logger = logging.getLogger(__name__)
pose_estimator = HeadPoseEstimator(static_image_mode=True)


# ── Model Loading ─────────────────────────────────────────────────────────────

def _load_model(name: str, det_size=(640, 640)):
    app = FaceAnalysis(name=name, providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=det_size)
    logger.info(f"InsightFace model '{name}' loaded.")
    return app


try:
    face_app = _load_model("buffalo_sc")
except Exception as _e:
    logger.error(f"buffalo_sc failed to load: {_e}")
    face_app = None


# ── Global Thresholds — all read from config, grouped by slot ────────────────

SELFIE_MATCH_THRESHOLD    = settings.SELFIE_MATCH_THRESHOLD
MIN_SELFIE_MATCH_RATIO    = settings.MIN_SELFIE_MATCH_RATIO
NEAR_DUPLICATE_THRESHOLD  = 0.02

# Slot 0 — front: yaw + pitch + roll
FRONT_YAW_MAX   = settings.FRONT_YAW_MAX
FRONT_PITCH_MAX = settings.FRONT_PITCH_MAX
FRONT_ROLL_MAX  = settings.FRONT_ROLL_MAX

# Slot 1 — left: yaw + roll only (pitch unconstrained)
LEFT_YAW_MIN  = settings.LEFT_YAW_MIN
LEFT_YAW_MAX  = settings.LEFT_YAW_MAX
LEFT_ROLL_MAX = settings.LEFT_ROLL_MAX

# Slot 2 — right: yaw + roll only (pitch unconstrained)
RIGHT_YAW_MIN  = settings.RIGHT_YAW_MIN
RIGHT_YAW_MAX  = settings.RIGHT_YAW_MAX
RIGHT_ROLL_MAX = settings.RIGHT_ROLL_MAX


# ── Image Decoding ────────────────────────────────────────────────────────────

def decode_image(image_bytes: bytes, filename: str) -> np.ndarray:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"'{filename}' has unsupported format. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"'{filename}' exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )
    try:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            return img
    except Exception:
        pass
    try:
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.array(pil)[:, :, ::-1]
    except Exception:
        pass
    raise HTTPException(
        status_code=400,
        detail=f"Could not read '{filename}'. Please try a different photo.",
    )


# ── Standalone pose estimation for /pose endpoint ────────────────────────────

def estimate_pose_only(img_bgr: np.ndarray) -> dict:
    """
    Lightweight pose estimation used by the live preview endpoint.
    Returns yaw/pitch/roll + per-slot validity flags using per-slot axis rules:
      front         : yaw + pitch + roll
      left  / right : yaw + roll only (pitch ignored)
    Frontend uses these flags to color the oval green/yellow/red in real time.
    """
    pose = pose_estimator.estimate_pose(img_bgr)
    if pose is None:
        return {
            "detected": False,
            "yaw": None,
            "pitch": None,
            "roll": None,
            "slots": {"front": False, "left": False, "right": False},
            "thresholds": _pose_thresholds_payload(),
        }

    yaw, pitch, roll = pose["yaw"], pose["pitch"], pose["roll"]

    # Each slot enforces only its relevant axes
    front_ok = (
        abs(roll)  <= FRONT_ROLL_MAX and
        abs(yaw)   <= FRONT_YAW_MAX  and
        abs(pitch) <= FRONT_PITCH_MAX
    )
    left_ok = (
        abs(roll) <= LEFT_ROLL_MAX and
        LEFT_YAW_MIN <= yaw <= LEFT_YAW_MAX
        # pitch NOT checked for side slots
    )
    right_ok = (
        abs(roll) <= RIGHT_ROLL_MAX and
        -RIGHT_YAW_MAX <= yaw <= -RIGHT_YAW_MIN
        # pitch NOT checked for side slots
    )

    return {
        "detected": True,
        "yaw":   yaw,
        "pitch": pitch,
        "roll":  roll,
        "slots": {
            "front": front_ok,
            "left":  left_ok,
            "right": right_ok,
        },
        "thresholds": _pose_thresholds_payload(),
    }


def _pose_thresholds_payload() -> dict:
    """
    Nested per-slot thresholds sent to the frontend so JS gauge/hint logic
    reads the same values the backend enforces — no duplication.
    """
    return {
        "front": {
            "yaw_max":   FRONT_YAW_MAX,
            "pitch_max": FRONT_PITCH_MAX,
            "roll_max":  FRONT_ROLL_MAX,
        },
        "left": {
            "yaw_min": LEFT_YAW_MIN,
            "yaw_max": LEFT_YAW_MAX,
            "roll_max": LEFT_ROLL_MAX,
        },
        "right": {
            "yaw_min": RIGHT_YAW_MIN,
            "yaw_max": RIGHT_YAW_MAX,
            "roll_max": RIGHT_ROLL_MAX,
        },
    }


# ── Face Detection ────────────────────────────────────────────────────────────

def _bgr_to_rgb(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def _largest_face(faces):
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def _detect(img_bgr: np.ndarray, filename: str, app=None):
    app = app or face_app
    if app is None:
        raise HTTPException(status_code=500, detail="Face recognition model not loaded.")
    try:
        faces = app.get(_bgr_to_rgb(img_bgr))
    except Exception as e:
        logger.error(f"InsightFace error on '{filename}': {e}")
        raise HTTPException(status_code=422, detail=f"Face detection failed for '{filename}': {e}")
    if not faces:
        raise HTTPException(
            status_code=422,
            detail=f"No face detected in '{filename}'. Ensure the face is clearly visible and well-lit.",
        )
    if len(faces) > 1:
        logger.warning(f"Multiple faces in '{filename}' — using largest.")
    return [_largest_face(faces) if len(faces) > 1 else faces[0]]


# ── Duplicate detection ───────────────────────────────────────────────────────

def _sha256(img: np.ndarray) -> str:
    return hashlib.sha256(img.tobytes()).hexdigest()


def _check_no_duplicates(selfie_images, selfie_filenames, selfie_embeddings):
    n = len(selfie_images)
    hashes = [_sha256(img) for img in selfie_images]
    for i in range(n):
        for j in range(i + 1, n):
            if hashes[i] == hashes[j]:
                raise HTTPException(
                    status_code=422,
                    detail=f"Duplicate image: '{selfie_filenames[i]}' and '{selfie_filenames[j]}' are identical.",
                )
            dist = cosine_distance(selfie_embeddings[i], selfie_embeddings[j])
            if dist < NEAR_DUPLICATE_THRESHOLD:
                raise HTTPException(
                    status_code=422,
                    detail=f"Near-duplicate: '{selfie_filenames[i]}' vs '{selfie_filenames[j]}' (dist={dist:.4f}). "
                           f"Move slightly between shots.",
                )


# ── Pose helpers ──────────────────────────────────────────────────────────────

def _pose(img_bgr: np.ndarray, filename: str):
    pose = pose_estimator.estimate_pose(img_bgr)
    if pose is None:
        logger.warning(f"No pose detected for '{filename}'")
        return None, None, None
    yaw, pitch, roll = pose["yaw"], pose["pitch"], pose["roll"]
    logger.info(f"[POSE] {filename} | yaw={yaw:.2f} pitch={pitch:.2f} roll={roll:.2f}")
    return yaw, pitch, roll


# ── Slot checkers ─────────────────────────────────────────────────────────────

def _check_left(face, img_bgr, filename: str) -> None:
    """
    Slot 1 — left turn. LOGS ONLY, does not reject.
    See _check_frontal docstring for why pose is non-blocking here.
    """
    yaw, _, roll = _pose(img_bgr, filename)
    if yaw is None:
        return
    if (roll is not None and abs(roll) > LEFT_ROLL_MAX) or not (LEFT_YAW_MIN <= yaw <= LEFT_YAW_MAX):
        logger.info(f"[Slot 1 — left] '{filename}': pose outside soft range (yaw={yaw:.1f}° roll={roll:.1f}°) — not rejected, logged only.")


def _check_right(face, img_bgr, filename: str) -> None:
    """
    Slot 2 — right turn. LOGS ONLY, does not reject.
    See _check_frontal docstring for why pose is non-blocking here.
    """
    yaw, _, roll = _pose(img_bgr, filename)
    if yaw is None:
        return
    if (roll is not None and abs(roll) > RIGHT_ROLL_MAX) or not (-RIGHT_YAW_MAX <= yaw <= -RIGHT_YAW_MIN):
        logger.info(f"[Slot 2 — right] '{filename}': pose outside soft range (yaw={yaw:.1f}° roll={roll:.1f}°) — not rejected, logged only.")


def _check_frontal(face, img_bgr, filename: str, slot_label: str) -> None:
    """
    Front pose sanity check — LOGS ONLY, does not reject.

    Why non-blocking: the frontend already gates capture in real time using
    MediaPipe FaceLandmarker's transformation matrix (a full metric 3D face
    model). This backend check uses a cruder 6-point FaceMesh + solvePnP with
    a generic 3D model and no real camera calibration — a fundamentally
    different algorithm that reads several degrees off the frontend's number
    on the exact same photo (this is what caused already-"captured!" selfies
    to come back rejected — e.g. frontend read pitch fine, backend recomputed
    39.9° and rejected it). Hard-rejecting here means re-litigating an angle
    the user already satisfied, with a less accurate method. Pose direction
    doesn't affect identity matching anyway (that's the point of ArcFace);
    the only thing that must actually gate here is face presence.
    """
    yaw, pitch, roll = _pose(img_bgr, filename)
    if yaw is None:
        return
    if abs(roll) > FRONT_ROLL_MAX or abs(yaw) > FRONT_YAW_MAX or abs(pitch) > FRONT_PITCH_MAX:
        logger.info(
            f"[{slot_label}] '{filename}': pose outside soft range "
            f"(yaw={yaw:.1f}° pitch={pitch:.1f}° roll={roll:.1f}°) — not rejected, logged only."
        )


def _check_straight(face, img_bgr, filename: str) -> None:
    _check_frontal(face, img_bgr, filename, "Slot 0 — straight")


# ── Slot registry ─────────────────────────────────────────────────────────────

SELFIE_SLOTS = {
    0: {"label": "straight / neutral selfie",
        "instruction": "Look straight into the camera with neutral expression",
        "pose_check": lambda f, i, n: _check_straight(f, i, n)},
    1: {"label": "left-turn selfie",
        "instruction": "Turn your head to YOUR LEFT",
        "pose_check": lambda f, i, n: _check_left(f, i, n)},
    2: {"label": "right-turn selfie",
        "instruction": "Turn your head to YOUR RIGHT",
        "pose_check": lambda f, i, n: _check_right(f, i, n)},
    3: {"label": "straight / confirm selfie",
        "instruction": "Look straight into the camera again to confirm",
        "pose_check": lambda f, i, n: _check_straight(f, i, n)},
}
REQUIRED_SELFIE_COUNT = len(SELFIE_SLOTS)


# ── Embedding helpers ─────────────────────────────────────────────────────────

def get_face_embedding(img: np.ndarray, filename: str) -> np.ndarray:
    return _detect(img, filename)[0].embedding


def get_face_embedding_with_pose_check(img, filename, slot_index):
    if slot_index not in SELFIE_SLOTS:
        raise HTTPException(status_code=400, detail=f"Unknown slot {slot_index}.")
    slot = SELFIE_SLOTS[slot_index]
    faces = _detect(img, filename)
    face = faces[0]
    slot["pose_check"](face, img, filename)
    return face.embedding


def cosine_distance(a, b) -> float:
    a, b = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (na * nb))


def distance_to_confidence(distance, threshold) -> float:
    return float(max(0.0, min(1.0, 1.0 - distance / (threshold * 2.0))))


# ── Verification pipeline ─────────────────────────────────────────────────────

# ── Verification pipeline — SELFIE-ONLY MODE ──────────────────────────────────
# No reference photo. We trust the 4-selfie capture flow itself (front, left,
# right, front-confirm) as the identity claim, and approve/reject based on
# whether all 4 shots are mutually consistent (same face embedding cluster).
# This is a liveness/self-consistency check, not a lookup against a stored
# photo — so an old/bad reference photo can no longer cause a false reject.

def verify_faces(selfie_images, selfie_filenames):
    if len(selfie_images) != REQUIRED_SELFIE_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Exactly {REQUIRED_SELFIE_COUNT} selfies required (got {len(selfie_images)}).",
        )

    selfie_embeddings = []
    for i, (img, fn) in enumerate(zip(selfie_images, selfie_filenames)):
        selfie_embeddings.append(get_face_embedding_with_pose_check(img, fn, slot_index=i))

    _check_no_duplicates(selfie_images, selfie_filenames, selfie_embeddings)

    pair_results, matched = [], 0
    n = len(selfie_embeddings)
    for i in range(n):
        for j in range(i + 1, n):
            d = cosine_distance(selfie_embeddings[i], selfie_embeddings[j])
            is_match = d < SELFIE_MATCH_THRESHOLD
            conf = distance_to_confidence(d, SELFIE_MATCH_THRESHOLD)
            if is_match:
                matched += 1
            pair_results.append(PairResult(
                selfie_a_index=i, selfie_b_index=j, is_match=is_match,
                confidence_score=round(conf, 4), distance=round(d, 4),
            ))

    total = len(pair_results)
    ratio = matched / total if total else 0.0
    overall = round(
        (sum(p.confidence_score for p in pair_results if p.is_match) / matched) if matched
        else max((p.confidence_score for p in pair_results), default=0.0),
        4,
    )
    is_verified = ratio >= MIN_SELFIE_MATCH_RATIO
    status = VerificationStatus.VERIFIED if is_verified else VerificationStatus.REJECTED
    msg = (
        f"Identity {'verified' if is_verified else 'rejected'} — "
        f"{matched}/{total} selfie pairs consistent ({ratio*100:.1f}%)."
    )
    return VerificationResponse(
        status=status, confidence_score=overall, matched_pairs=matched,
        total_pairs=total, match_ratio=round(ratio, 4),
        pair_results=pair_results, message=msg,
    )