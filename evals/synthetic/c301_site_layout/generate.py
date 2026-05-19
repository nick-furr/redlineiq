"""
C-301 Site Layout Plan — redline overlay generator.

Reads page 4 of the Bohler plan set, draws 10 reviewer redlines,
writes output.pdf + output.png into this directory.

Run from anywhere:
    python evals/synthetic/c301_site_layout/generate.py

Then copy output to the eval set:
    copy evals/synthetic/c301_site_layout/output.pdf evals/pdfs/case_001_c301_site_layout.pdf
"""
import io
import random
import sys
from pathlib import Path

import fitz  # pymupdf
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "bohler_walpole.pdf"
SOURCE_PAGE = 4   # 1-indexed (C-301 Site Layout Plan)
RENDER_DPI = 150

sys.path.insert(0, str(HERE.parent / "_lib"))
from handdrawn import (
    RED, STROKE, STROKE_THIN,
    hand_arrow, hand_oval, hand_strikeout,
    hand_text, hand_underline,
)


def render_source_page():
    if not SOURCE_PDF.exists():
        sys.exit(f"\nSource PDF not found: {SOURCE_PDF}\n")
    doc = fitz.open(str(SOURCE_PDF))
    page = doc[SOURCE_PAGE - 1]
    mat = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
    pix = page.get_pixmap(matrix=mat)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    doc.close()
    return img


def draw_redlines(canvas):
    random.seed(7)
    draw = ImageDraw.Draw(canvas, "RGBA")

    # #1: FFE = 442.0 typo — should be 142.0
    ffe_cx, ffe_cy = 2140, 2010
    hand_oval(draw, ffe_cx, ffe_cy, 180, 60, width=STROKE, jitter=5)
    text_x, text_y = 1100, 2200
    hand_arrow(draw, (ffe_cx - 130, ffe_cy + 50), (text_x + 580, text_y - 20), width=STROKE, head_len=28)
    hand_text(canvas, text_x, text_y, "FFE = 442.0 ??", size=66, rotate=-1)
    hand_text(canvas, text_x, text_y + 80, "s/b 142.0 - SEE C-401", size=52, rotate=2)

    # #2: 5.0' ADA aisle — van requires 8'
    aisle_x, aisle_y = 3070, 2380
    hand_oval(draw, aisle_x, aisle_y, 60, 35, width=STROKE, jitter=4)
    hand_arrow(draw, (aisle_x - 50, aisle_y + 30), (aisle_x - 350, aisle_y + 220), width=STROKE, head_len=28)
    hand_text(canvas, aisle_x - 850, aisle_y + 220, "5'-0\" AISLE -", size=54, rotate=-1)
    hand_text(canvas, aisle_x - 850, aisle_y + 290, "ADA VAN REQ'S 8'", size=54, rotate=1)
    hand_text(canvas, aisle_x - 850, aisle_y + 360, "FIX !!", size=72, rotate=-2)
    hand_underline(draw, aisle_x - 850, aisle_y + 450, aisle_x - 615, width=STROKE)

    # #3: 36.7' — verify with fire turning template
    dim_x, dim_y = 2820, 1805
    hand_oval(draw, dim_x, dim_y, 75, 35, width=STROKE, jitter=4, rotation_deg=5)
    hand_arrow(draw, (dim_x + 80, dim_y - 20), (dim_x + 360, dim_y - 220), width=STROKE, head_len=28)
    hand_text(canvas, dim_x + 280, dim_y - 340, "VERIFY w/ FIRE", size=52, rotate=-1)
    hand_text(canvas, dim_x + 280, dim_y - 275, "TURNING TEMPLATE", size=52, rotate=2)

    # #4: 8' compact stall — town allow?
    compact_x, compact_y = 1959, 1225
    hand_oval(draw, compact_x, compact_y, 65, 80, width=STROKE, jitter=4)
    hand_arrow(draw, (compact_x - 60, compact_y), (compact_x - 350, compact_y - 200), width=STROKE, head_len=28)
    hand_text(canvas, compact_x - 900, compact_y - 280, "8' COMPACT -", size=52, rotate=-1)
    hand_text(canvas, compact_x - 900, compact_y - 215, "TOWN ALLOW?", size=52, rotate=1)
    hand_text(canvas, compact_x - 900, compact_y - 150, "CITE § ZONING.", size=52, rotate=-2)

    # #5: verify? — deliberately ambiguous
    amb_x, amb_y = 1500, 1700
    hand_oval(draw, amb_x, amb_y, 110, 50, width=STROKE_THIN, jitter=4)
    hand_text(canvas, amb_x - 90, amb_y - 90, "verify?", size=60, rotate=-3)

    # #6: remove duplicate walk label
    dup_x, dup_y = 2459, 1505
    hand_strikeout(draw, (dup_x - 180, dup_y - 5), (dup_x + 180, dup_y + 10), width=STROKE)
    hand_strikeout(draw, (dup_x - 180, dup_y + 40), (dup_x + 180, dup_y + 55), width=STROKE)
    hand_arrow(draw, (dup_x + 200, dup_y), (dup_x + 470, dup_y - 200), width=STROKE_THIN, head_len=24)
    hand_text(canvas, dup_x + 420, dup_y - 320, "REMOVE -", size=50, rotate=-1)
    hand_text(canvas, dup_x + 420, dup_y - 260, "DUPLICATE", size=50, rotate=2)

    # #7: add sight triangle dims
    sl_x, sl_y = 4350, 2983
    hand_oval(draw, sl_x, sl_y, 320, 90, width=STROKE_THIN, jitter=4)
    hand_arrow(draw, (sl_x - 340, sl_y), (sl_x - 600, sl_y - 100), width=STROKE, head_len=28)
    hand_text(canvas, sl_x - 1400, sl_y - 220, "ADD SIGHT", size=54, rotate=-1)
    hand_text(canvas, sl_x - 1400, sl_y - 155, "TRIANGLE DIMS", size=54, rotate=1)
    hand_text(canvas, sl_x - 1400, sl_y - 90, "- MA AOT STD.", size=54, rotate=-2)

    # #8: ?? — deliberately ambiguous
    q_x, q_y = 1469, 1052
    hand_oval(draw, q_x, q_y, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, q_x + 80, q_y - 130, "??", size=110, rotate=8)

    # #9: 24.0' → 26.0' drive aisle
    da_x, da_y = 3140, 2335
    hand_strikeout(draw, (da_x - 80, da_y), (da_x + 80, da_y), width=STROKE)
    hand_text(canvas, da_x + 90, da_y - 60, "26.0' MIN", size=48, rotate=-2)
    hand_text(canvas, da_x + 90, da_y, "(2-WAY)", size=40, rotate=1)

    # #10: building height waiver
    ht_x, ht_y = 4585, 500
    hand_oval(draw, ht_x, ht_y, 210, 30, width=STROKE_THIN, jitter=3)
    hand_arrow(draw, (ht_x - 210, ht_y + 15), (ht_x - 470, ht_y + 200), width=STROKE_THIN, head_len=24)
    hand_text(canvas, ht_x - 1380, ht_y + 220, "69'-11\" > 52' MAX.", size=44, rotate=-1)
    hand_text(canvas, ht_x - 1380, ht_y + 275, "WAIVER GRANTED?", size=44, rotate=1)
    hand_text(canvas, ht_x - 1380, ht_y + 330, "ATTACH ZBA DECISION.", size=44, rotate=-1)

    # Reviewer stamp
    hand_oval(draw, 450, 130, 280, 80, width=STROKE + 2, jitter=5, rotation_deg=-2)
    hand_text(canvas, 220, 75, "REVIEW SET", size=64, rotate=-3)
    hand_text(canvas, 280, 155, "REV. 1 - 8/30/23", size=34, rotate=-2)

    # Reviewer initials
    hand_text(canvas, 150, 3400, "JK", size=80, rotate=-5)
    hand_text(canvas, 150, 3490, "5/17", size=40, rotate=-3)


def main():
    print(f"Rendering page {SOURCE_PAGE} at {RENDER_DPI} DPI...")
    canvas = render_source_page()
    print(f"Canvas: {canvas.size[0]}x{canvas.size[1]}px")

    print("Drawing redlines...")
    draw_redlines(canvas)

    canvas.save(HERE / "output.pdf", "PDF", resolution=RENDER_DPI)
    canvas.save(HERE / "output.png", "PNG", optimize=True)
    print(f"Saved output.pdf and output.png to {HERE}")


if __name__ == "__main__":
    main()
