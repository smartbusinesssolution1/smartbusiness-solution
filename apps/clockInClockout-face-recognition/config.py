from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Recognition ──────────────────────────────────────────────────────
    # Single InsightFace model handles both detection + embedding.
    RECOGNITION_MODEL: str = "buffalo_sc"
    DISTANCE_METRIC: str = "cosine"

    # Cosine distance cutoff. Lower = stricter. 0.55 is a reasonable
    # working default for buffalo_sc; tune against your own dataset.
    MATCH_THRESHOLD: float = 0.55

    # ── Liveness / Anti-Spoof ────────────────────────────────────────────
    # Overall score (0-1, higher = more likely real) required to pass.
    LIVENESS_THRESHOLD: float = 0.65
    MIN_FACE_SIZE_PX: int = 80  # reject tiny/far-away faces

    # ── Burst / Active Liveness (production path) ───────────────────────
    # Default flow = blink only (fast for employees): 2 camera-facing frames,
    # then ONE blink (closed-eye frame, open-eye frame) = 4 frames.
    # Frames per submission are EXACT:
    #   PRE_FRONTAL_FRAMES + 2*CHALLENGE_STEPS + (2 if BLINK_STEP).
    # Optional random head turns (CHALLENGE_STEPS > 0) are kept in the code
    # for high-security use but OFF by default.
    # Blink step: after the camera-facing frames (and any turns) the user
    # blinks once. Judged RELATIVE to the user's own open-eye EAR
    # (median of their frontal frames): closed <= CLOSED_RATIO*open,
    # then reopened >= OPEN_RATIO*open. Hard requirement when True.
    BLINK_STEP: bool = True
    BLINK_CLOSED_RATIO: float = 0.75
    BLINK_OPEN_RATIO: float = 0.80
    # Smaller detector input for burst frames = faster per-frame detection.
    BURST_DET_SIZE: tuple[int, int] = (320, 320)

    # ── Server-issued random challenge (anti pre-recorded-video) ────────
    # Server picks a random sequence of head turns (left/right) per attempt,
    # signs it (HMAC), and verifies from the submitted frames that those
    # turns happened IN ORDER. A pre-recorded video can't know the sequence.
    # Single-use + short expiry (also blocks re-submitting an old burst).
    # 2 steps = 4 possible sequences; raise to 3 for 8. Set CHALLENGE_SECRET in .env when running >1 worker/process
    # (default is random per process).
    CHALLENGE_STEPS: int = 0   # 0 = blink only. 2 = add random head turns (4 sequences)
    PRE_FRONTAL_FRAMES: int = 2
    CHALLENGE_TTL_SECONDS: int = 90
    CHALLENGE_SECRET: str = ""
    # Yaw ratio = (nose_x - eye_mid_x) / inter-eye distance, from FaceMesh
    # landmarks in pixel space, on the RAW (un-mirrored) camera frame.
    # |yaw| <= FRONTAL_MAX counts as facing camera; yaw*sign >= TURN_MIN
    # counts as a turn. LEFT_YAW_SIGN: sign of yaw when user turns to THEIR
    # OWN left. +1 is correct for raw front-camera frames. If left/right
    # prompts feel swapped on your device, flip to -1 (client reads it from
    # the server, so this is the only place to change).
    FRONTAL_MAX: float = 0.18
    TURN_MIN: float = 0.20
    LEFT_YAW_SIGN: int = 1
    # Lenient "same person all the way through" bound for turned frames
    # (cosine distance vs profile). Only blocks an obviously different face.
    SAME_PERSON_MAX_DIST: float = 0.80
    MIN_FRONTAL_FRAMES: int = 2

    # ── Screen / photo-border (object boundary) detection ───────────────
    # Detects a rectangular screen/phone/paper outline surrounding the face.
    # True = hard fail (spoof_suspected). Set False to only log the reason.
    SCREEN_BORDER_HARD_REJECT: bool = True

    # ── Image Constraints ────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 8
    ALLOWED_EXTENSIONS: list[str] = ["jpg", "jpeg", "png"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()