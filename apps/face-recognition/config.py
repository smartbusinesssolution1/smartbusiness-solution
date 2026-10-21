from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Recognition ──────────────────────────────────────────────────────
    RECOGNITION_MODEL: str = "ArcFace"
    DISTANCE_METRIC: str = "cosine"

    # ── Verification Thresholds — SELFIE-ONLY MODE ─────────────────────
    # No reference photo anymore. We only check the 4 selfies are
    # mutually consistent (same person captured in one live session).
    SELFIE_MATCH_THRESHOLD: float = 0.60   # cosine distance below this = "same person" for a pair
    MIN_SELFIE_MATCH_RATIO: float = 0.66   # fraction of the 6 pairs that must match to approve (4/6)

    # ── SLOT 0 — FRONT (relaxed, advisory only — see service.py _check_frontal) ──
    FRONT_YAW_MAX: float   = 25.0  # was 18
    FRONT_PITCH_MAX: float = 45.0  # was 35 — phone selfies naturally tilt pitch
    FRONT_ROLL_MAX: float  = 25.0  # was 20

    # ── SLOT 1 — LEFT (relaxed, advisory only) ──────────────
    LEFT_YAW_MIN: float  = 12.0  # was 15
    LEFT_YAW_MAX: float  = 75.0  # was 70
    LEFT_ROLL_MAX: float = 28.0  # was 25

    # ── SLOT 2 — RIGHT (relaxed, advisory only) ─────────────
    RIGHT_YAW_MIN: float  = 12.0
    RIGHT_YAW_MAX: float  = 75.0
    RIGHT_ROLL_MAX: float = 28.0

    # ── SLOT 3 — FRONT-CONFIRM ──────────────────────────────
    # Second straight-on shot, captured last. Same thresholds as slot 0.
    # Purpose: catch someone swapping in a different face/photo mid-flow —
    # this is now the main anti-spoof signal since there's no reference photo.

    # ── Image Constraints ───────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: list[str] = ["jpg", "jpeg", "png"]
    MIN_SELFIE_IMAGES: int = 4
    MAX_SELFIE_IMAGES: int = 4

    # Order: 0=front, 1=left, 2=right, 3=front-confirm
    SELFIE_ORDER: list[str] = ["front", "left", "right", "front_confirm"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()