"""
Screen / phone / photo boundary detection ("object boundary" check).

When someone replays a video of a face on a laptop/phone/tablet (or holds up
a printed photo), the camera usually sees the device's rectangular outline
with the face INSIDE it. A real selfie has no 4-sided straight-edged frame
tightly enclosing the face.

Method (pure OpenCV, no model download):
  1. Canny edges -> close small gaps -> contours.
  2. Convex hull of each contour -> polygon approx -> keep convex 4-gons
     with ~right angles (works for tilted / perspective-skewed devices).
  3. Quad must be big, must fully contain the face box, and must be clearly
     larger than the face.
  4. All four sides must be backed by real edge pixels (rejects random
     4-point blobs).

Limit: a screen filling the whole frame (no visible border) is NOT caught
here -- moire / glare / texture checks in liveness.py and the random
head-turn challenge still apply. A trained object detector (YOLO: cell
phone / laptop / tv) can be added later as an extra signal.
"""

from dataclasses import dataclass, field

import cv2
import numpy as np

MAX_DIM = 640
MIN_QUAD_FRAC = 0.10        # quad area / frame area
MAX_QUAD_FRAC = 0.97
MIN_QUAD_TO_FACE = 1.5      # quad area / face-box area
MIN_SIDE_SUPPORT = 0.60     # fraction of side points sitting on an edge
ANGLE_MIN, ANGLE_MAX = 65.0, 115.0


@dataclass
class ScreenDetection:
    detected: bool
    confidence: float = 0.0
    reasons: list[str] = field(default_factory=list)


def _order(pts: np.ndarray) -> np.ndarray:
    pts = pts.reshape(-1, 2).astype(np.float32)
    c = pts.mean(axis=0)
    ang = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0])
    return pts[np.argsort(ang)]


def _angles_ok(q: np.ndarray) -> bool:
    for i in range(4):
        a, b, c = q[i - 1], q[i], q[(i + 1) % 4]
        v1, v2 = a - b, c - b
        n = np.linalg.norm(v1) * np.linalg.norm(v2)
        if n == 0:
            return False
        ang = np.degrees(np.arccos(np.clip(np.dot(v1, v2) / n, -1.0, 1.0)))
        if not (ANGLE_MIN <= ang <= ANGLE_MAX):
            return False
    return True


def _side_support(q: np.ndarray, edge_map: np.ndarray) -> float:
    """Min over 4 sides of fraction of sample points lying on an edge pixel."""
    h, w = edge_map.shape
    fr = []
    for i in range(4):
        p0, p1 = q[i], q[(i + 1) % 4]
        hits, total = 0, 0
        # skip the corners themselves (t in 0.05..0.95)
        for t in np.linspace(0.05, 0.95, 25):
            x, y = (p0 * (1 - t) + p1 * t)
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < w and 0 <= yi < h:
                total += 1
                hits += 1 if edge_map[yi, xi] else 0
        if total < 10:  # side mostly outside the frame -> unsupported
            return 0.0
        fr.append(hits / total)
    return float(min(fr))


def detect_screen_around_face(img_bgr: np.ndarray, bbox) -> ScreenDetection:
    h0, w0 = img_bgr.shape[:2]
    scale = min(1.0, MAX_DIM / max(h0, w0))
    img = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else img_bgr
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [float(v) * scale for v in bbox]
    face_area = max(1.0, (x2 - x1) * (y2 - y1))
    frame_area = float(h * w)

    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    edges = cv2.Canny(gray, 40, 120)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thick = cv2.dilate(edges, k, iterations=1)
    closed = cv2.morphologyEx(thick, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    support_map = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    contours, _ = cv2.findContours(closed, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    face_corners = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]

    best = 0.0
    for cnt in contours:
        if cv2.contourArea(cnt) < 0.02 * frame_area and cv2.arcLength(cnt, True) < 0.5 * (h + w):
            continue
        hull = cv2.convexHull(cnt)
        peri = cv2.arcLength(hull, True)
        if peri <= 0:
            continue
        approx = cv2.approxPolyDP(hull, 0.03 * peri, True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        q = _order(approx)
        area = float(cv2.contourArea(q))
        if not (MIN_QUAD_FRAC * frame_area <= area <= MAX_QUAD_FRAC * frame_area):
            continue
        if area < MIN_QUAD_TO_FACE * face_area:
            continue
        if not _angles_ok(q):
            continue
        poly = q.reshape(-1, 1, 2)
        if any(cv2.pointPolygonTest(poly, (float(px), float(py)), False) < 0 for px, py in face_corners):
            continue
        sup = _side_support(q, support_map)
        if sup >= MIN_SIDE_SUPPORT:
            best = max(best, sup)

    if best > 0:
        return ScreenDetection(
            True, round(best, 3),
            ["rectangular screen/photo border surrounds the face (possible replay on a device)"],
        )
    return ScreenDetection(False, 0.0, [])