"""Shared hand-drawn markup primitives for synthetic eval sheet generators."""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RED = (200, 25, 25, 255)
STROKE = 8
STROKE_THIN = 5

_FONT_CANDIDATES = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def _font(size):
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def jitter_point(x, y, amp=4):
    return (x + random.uniform(-amp, amp), y + random.uniform(-amp, amp))


def hand_line(draw, p1, p2, width=STROKE, color=RED, segments=8, jitter=3):
    pts = []
    for i in range(segments + 1):
        t = i / segments
        x = p1[0] + (p2[0] - p1[0]) * t
        y = p1[1] + (p2[1] - p1[1]) * t
        if 0 < i < segments:
            x, y = jitter_point(x, y, jitter)
        pts.append((x, y))
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width)


def hand_oval(draw, cx, cy, rx, ry, width=STROKE, color=RED, jitter=4, rotation_deg=0):
    segments = 40
    rot = math.radians(rotation_deg)
    pts = []
    for i in range(segments + 1):
        a = (i / segments) * 2 * math.pi
        xl = rx * math.cos(a)
        yl = ry * math.sin(a)
        x = cx + xl * math.cos(rot) - yl * math.sin(rot)
        y = cy + xl * math.sin(rot) + yl * math.cos(rot)
        pts.append(jitter_point(x, y, jitter))
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width)


def hand_arrow(draw, p1, p2, width=STROKE, color=RED, head_len=30):
    hand_line(draw, p1, p2, width, color, segments=6, jitter=2)
    angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    a1 = angle + math.radians(150)
    a2 = angle - math.radians(150)
    h1 = (p2[0] + head_len * math.cos(a1), p2[1] + head_len * math.sin(a1))
    h2 = (p2[0] + head_len * math.cos(a2), p2[1] + head_len * math.sin(a2))
    draw.line([p2, h1], fill=color, width=width)
    draw.line([p2, h2], fill=color, width=width)


def hand_strikeout(draw, p1, p2, width=STROKE, color=RED):
    hand_line(draw, p1, p2, width, color, segments=4, jitter=2)


def hand_text(canvas, x, y, text, size=42, color=RED, rotate=None):
    font = _font(size)
    if rotate is None:
        rotate = random.uniform(-3, 3)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0] + 30
    th = bbox[3] - bbox[1] + 30
    txt_layer = Image.new("RGBA", (tw, th), (255, 255, 255, 0))
    tdraw = ImageDraw.Draw(txt_layer)
    tdraw.text((15 - bbox[0], 15 - bbox[1]), text, font=font, fill=color)
    if abs(rotate) > 0.1:
        txt_layer = txt_layer.rotate(rotate, resample=Image.BICUBIC, expand=True)
    canvas.paste(txt_layer, (int(x), int(y)), txt_layer)


def hand_underline(draw, x1, y, x2, width=STROKE_THIN, color=RED):
    hand_line(draw, (x1, y), (x2, y), width, color, segments=4, jitter=2)
