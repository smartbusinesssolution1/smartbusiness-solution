# Attendance Face Recognition API

A trimmed-down, single-purpose FastAPI service for face-based attendance:
take **one** live camera capture, compare it against **one** stored profile
photo, and mark attendance if it's a match **and** the capture passes a
basic liveness (anti-spoof) check.

This is a stripped version of a more complex multi-selfie dating-app
verification system — all the multi-angle pose-checking, smile-detection,
cross-selfie consistency, and duplicate-detection logic has been removed
since attendance only needs one photo vs. one profile picture.

## Project structure

```
attendance-face-recognition/
├── main.py                  # FastAPI app entry point
├── routes.py                 # /attendance/challenge + /attendance/mark-burst
├── service.py                 # face detection, embedding, matching (InsightFace)
├── liveness.py                 # passive heuristic anti-spoof checks
├── motion_liveness.py          # head-turn challenge verification + burst analysis
├── challenge.py                # signed single-use random challenge
├── screen_detect.py            # screen/phone/photo boundary detection
├── schemas.py                   # request/response models
├── config.py                     # thresholds & settings
├── requirements.txt
└── test_attendance.html            # standalone browser test page (upload or webcam)
```

## How it works

1. `POST /api/v1/attendance/mark` takes two files: `profile_image` (the
   stored reference photo) and `capture_image` (what the camera just took).
2. InsightFace (`buffalo_sc`, ArcFace embeddings) detects the face in each
   and extracts a 512-d embedding.
3. `liveness.py` runs a handful of heuristic checks on `capture_image` only
   (the profile photo is an already-trusted stored reference, so it isn't
   liveness-checked):
   - moire / screen-replay pattern detection (FFT)
   - specular glare/reflection detection (screen or glossy print glare)
   - texture micro-detail check (too smooth = print/screen recapture)
   - dynamic-range check (washed-out reproduction)
   - rectangular frame/edge detection near the face (photo-of-a-photo)
4. Cosine distance between the two embeddings decides match/no-match.
5. Response status is one of:
   - `marked` — face matched and passed liveness
   - `rejected` — face didn't match the profile photo
   - `spoof_suspected` — capture failed the liveness check (regardless of
     whether the embeddings matched)

## ⚠️ About the liveness check — please read

The anti-spoof check in `liveness.py` is a **heuristic, single-frame**
method, not a trained deep anti-spoofing model. It raises the bar against
casual spoofing (printing someone's profile picture, holding up a phone
with their photo) by looking for texture/frequency/reflection artifacts
that photo-of-a-photo and screen-replay attacks commonly produce.

It is **not** a certified/production-grade liveness product and can be
fooled by a high-quality print or a determined attacker with better
equipment. For real deployments (offices, exams, secure access), combine it
with one or more of:
- an active challenge (ask the user to blink / turn head / say a random
  number, checked across a short burst of frames)
- a trained anti-spoof model (e.g. Silent-Face-Anti-Spoofing, MiniFASNet)
- depth or IR camera hardware

## Endpoints (live capture is mandatory)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/attendance/challenge` | Fresh **single-use, signed, 90s** random challenge: an ordered list of head turns, e.g. `["left","right"]`. Call before every capture. |
| `POST /api/v1/attendance/mark-burst` | `profile_image` + `capture_images` (frames in capture order: camera-facing frames, optional `[turn, frontal]` per step, then closed-eye + open-eye blink frames; exact count = `expected_frames` from the challenge) + `challenge_token` (form field). |
| `POST /api/v1/face/detect` | Preview-only face box. |

The old single-photo `/attendance/mark` endpoint and the "plain photo upload"
fallback were **removed**: a still photo cannot carry a liveness challenge.

### Default flow: blink once (4 frames)

Employee centers face in the oval, blinks once, done. Frames: 2 camera-facing
(open eyes) + closed-eye + open-eye. Optional random head turns exist
(`CHALLENGE_STEPS=2` → frames = 2 + 4 + 2 = 8) but are OFF by default.

### Anti-spoofing (all must pass, fail-closed)

1. **Fresh single-use signed challenge token** (`challenge.py`): expires in
   90s, burned on first submit → old captured bursts can't be re-sent.
2. **Blink step** (`motion_liveness.py`): closed-eye then open-eye frame
   AFTER the camera-facing frames, judged relative to the user's own open-eye
   EAR (median of their camera-facing frames). Replay of blink-less photo or
   video with no blink fails.
3. **Screen / phone / paper boundary detection** (`screen_detect.py`): finds a
   rectangular outline (any tilt) that fully encloses the face, backed by real
   edges on all four sides. `SCREEN_BORDER_HARD_REJECT` in `config.py`.
4. Passive heuristics (moire, glare, texture, dynamic range, bezel, colour
   cast) on a sample of camera-facing frames.
5. Static-photo motion check.
6. Identity: majority of camera-facing frames must match the profile photo.
7. MediaPipe missing/broken → every attempt **fails** (no silent downgrade).
8. Optional random head-turn challenge (`CHALLENGE_STEPS` > 0): the strongest
   defence against a pre-recorded video, because a replay can't know the
   random sequence.

**Honest limit of blink-only:** a blink is predictable, so a good recorded
blink video shown full-frame (no visible screen edge) can only be caught by
the passive checks (moire/glare/texture), which are heuristic. For real
assurance add a trained passive anti-spoof model (MiniFASNet) and/or turn the
head-turn challenge on for high-risk cases.

Tuning (`config.py`): `CHALLENGE_STEPS` (0 = blink only; 2 → 4 sequences, 3 → 8), `BLINK_CLOSED_RATIO`/`BLINK_OPEN_RATIO`,
`TURN_MIN`, `FRONTAL_MAX`, `LEFT_YAW_SIGN` (flip to `-1` if left/right feel
swapped on your device — the page reads it from the server).

Known limits: a screen that fills the whole frame (no visible border) is only
caught by the passive checks; a door/window frame tightly around the face can
false-trigger the border check (set `SCREEN_BORDER_HARD_REJECT=False` to log
only); the server can't prove frames came from a camera — direct API callers
can still craft frames, so use app/device attestation for high assurance.

`test_attendance.html` implements the client flow (camera only, auto-capture).
Tests: `python -m pytest tests` (ML stubbed; real models need
`insightface` + `mediapipe==0.10.14` on Python 3.9–3.12).

## ⚠️ Production-readiness notes — please read before deploying

The burst endpoint closes the two biggest gaps in a single-frame system
(**static photo** and **plain video replay with no matching live
challenge**), but it is still not a certified/production anti-spoof
solution on its own. To actually get to production grade:

1. **Add a trained passive anti-spoof model.** Heuristics (texture, moire,
   color cast, bezel/edge detection) and the blink/motion check in
   `motion_liveness.py` are still hand-tuned signals, not a learned
   classifier. Plug in a trained model such as
   [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing)
   (MiniFASNet, ONNX-exportable) as an additional score in
   `check_liveness()` / `analyze_burst()`. This is the single highest-value
   upgrade.
2. **Server-issued random challenges.** Right now the "blink" prompt is a
   fixed client-side instruction. For real assurance, have the *server*
   pick a random challenge per attempt (blink twice / turn head left / say
   a number shown on screen) and verify it was actually performed — this
   defeats a pre-recorded video of the *right* person blinking on cue.
3. **A video replay of the correct blink can still beat blink-only
   checks.** Combine with the motion/flicker checks already in
   `motion_liveness.py`, and ideally a screen/device detection model
   (bezel + moire + flicker are heuristics for this; a trained detector is
   more robust).
4. **Depth or IR camera hardware** if the deployment (e.g. secure office
   entry) justifies the cost — this is the most robust anti-spoof
   guarantee and is what commercial FaceID-grade systems rely on.
5. **Operational hardening**, independent of the liveness model:
   - Store face **embeddings**, not raw photos, in your DB where possible;
     encrypt anything you do keep at rest.
   - Rate-limit and log every attempt (who, when, match score, liveness
     score, IP/device) for audit and abuse detection.
   - Serve over HTTPS only; never accept plaintext camera uploads.
   - Add a manual-review fallback path for borderline/rejected cases
     rather than a hard binary allow/deny.
   - Re-tune `MATCH_THRESHOLD`, `LIVENESS_THRESHOLD`, and the blink/motion
     thresholds in `config.py` / `motion_liveness.py` against your actual
     camera hardware and a labeled dataset of real vs. spoof attempts
     before go-live — these heuristic thresholds are camera- and
     lighting-dependent and will need calibration.
   - Version your models/thresholds and monitor false-accept/false-reject
     rates over time; spoof techniques evolve.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Visit `http://localhost:8000/health` to confirm it's running, and
`http://localhost:8000/docs` for interactive API docs.

To try it end to end without wiring up your own frontend yet, just open
`test_attendance.html` in a browser — it lets you upload a profile photo
and either upload or capture (webcam) a test photo, and shows the raw JSON
response.

## Wiring in your database later

Right now `profile_image` is sent as a file on every request so the
endpoint is testable standalone. Once your table structure is available,
swap `routes.py`'s `profile_image` upload for a lookup by user/employee ID:
fetch the stored profile photo (or, better, a precomputed embedding column)
from your DB instead of re-uploading and re-embedding it on every check.

## Configuration (`config.py`)

| Setting | Default | Meaning |
|---|---|---|
| `MATCH_THRESHOLD` | `0.55` | Cosine distance cutoff for a face match (lower = stricter) |
| `LIVENESS_THRESHOLD` | `0.60` | Minimum liveness score (0-1) to pass anti-spoof check |
| `MIN_FACE_SIZE_PX` | `80` | Reject faces smaller than this (too far from camera) |
| `MAX_FILE_SIZE_MB` | `8` | Max upload size per image |

Tune `MATCH_THRESHOLD` and `LIVENESS_THRESHOLD` against your own camera
hardware and sample photos before deploying — heuristic thresholds like
these are camera- and lighting-dependent.