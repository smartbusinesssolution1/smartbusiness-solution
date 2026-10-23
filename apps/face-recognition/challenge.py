"""
Server-issued random liveness challenge.

Stateless-signed + single-use:
  token = "<nonce>.<steps>.<expiry>.<hmac>"   (steps e.g. "LR", L=turn to own left; "" = blink-only)
The client can read the steps (it must show them) but cannot change them
(HMAC) and cannot reuse a token (nonce is burned on first submit).
"""

import hmac
import hashlib
import secrets
import threading
import time

from fastapi import HTTPException

from config import settings

_SECRET = (settings.CHALLENGE_SECRET or secrets.token_hex(32)).encode()
_used: dict[str, int] = {}
_lock = threading.Lock()


def _sign(payload: str) -> str:
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]


def _steps_to_words(code: str) -> list[str]:
    return ["left" if c == "L" else "right" for c in code]


def expected_frames() -> int:
    return settings.PRE_FRONTAL_FRAMES + 2 * settings.CHALLENGE_STEPS + (2 if settings.BLINK_STEP else 0)


def issue_challenge() -> dict:
    code = "".join(secrets.choice("LR") for _ in range(settings.CHALLENGE_STEPS))
    exp = int(time.time()) + settings.CHALLENGE_TTL_SECONDS
    nonce = secrets.token_urlsafe(12)  # chars: A-Z a-z 0-9 - _  (no '.')
    payload = f"{nonce}.{code}.{exp}"
    return {
        "challenge_token": f"{payload}.{_sign(payload)}",
        "steps": _steps_to_words(code),
        "expires_in": settings.CHALLENGE_TTL_SECONDS,
        "frontal_max": settings.FRONTAL_MAX,
        "turn_min": settings.TURN_MIN,
        "left_yaw_sign": settings.LEFT_YAW_SIGN,
        "blink_step": settings.BLINK_STEP,
        "blink_closed_ratio": settings.BLINK_CLOSED_RATIO,
        "blink_open_ratio": settings.BLINK_OPEN_RATIO,
        "pre_frontal_frames": settings.PRE_FRONTAL_FRAMES,
        "expected_frames": expected_frames(),
    }


def verify_and_consume(token: str) -> list[str]:
    """Return the steps for a valid, unexpired, unused token and burn it."""
    parts = (token or "").split(".")
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="Invalid challenge token. Retake to get a new challenge.")
    nonce, code, exp_s, sig = parts
    payload = f"{nonce}.{code}.{exp_s}"
    if not hmac.compare_digest(sig, _sign(payload)):
        raise HTTPException(status_code=400, detail="Invalid challenge token. Retake to get a new challenge.")
    try:
        exp = int(exp_s)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid challenge token.")
    now = int(time.time())
    if now > exp:
        raise HTTPException(status_code=400, detail="Challenge expired. Retake to get a new challenge.")
    if any(c not in "LR" for c in code):  # empty code = blink-only mode
        raise HTTPException(status_code=400, detail="Invalid challenge token.")
    with _lock:
        for n in [n for n, e in _used.items() if e < now]:
            del _used[n]
        if nonce in _used:
            raise HTTPException(status_code=400, detail="Challenge already used. Retake to get a new challenge.")
        _used[nonce] = exp
    return _steps_to_words(code)