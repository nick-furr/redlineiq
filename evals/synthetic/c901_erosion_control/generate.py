"""C-901 Soil Erosion & Sediment Control Plan — redline overlay generator. Bohler page 7."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "bohler_walpole.pdf"
SOURCE_PAGE = 7
RENDER_DPI = 150

sys.path.insert(0, str(HERE.parent / "_lib"))
from handdrawn import RED, STROKE, STROKE_THIN, hand_arrow, hand_oval, hand_strikeout, hand_text, hand_underline

def render():
    doc = fitz.open(str(SOURCE_PDF))
    pix = doc[SOURCE_PAGE - 1].get_pixmap(matrix=fitz.Matrix(RENDER_DPI/72, RENDER_DPI/72))
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    doc.close()
    return img

def draw(canvas):
    random.seed(107)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — silt fence missing at down-slope property line
    hand_oval(d, 1200, 2600, 130, 50, width=STROKE, jitter=5)
    hand_arrow(d, (1330, 2600), (1650, 2450), width=STROKE, head_len=28)
    hand_text(canvas, 1600, 2300, "SILT FENCE MISSING", size=52, rotate=-2)
    hand_text(canvas, 1600, 2365, "AT DOWN-SLOPE PROP.", size=50, rotate=1)
    hand_text(canvas, 1600, 2430, "LINE — ADD PER NPDES", size=48, rotate=-1)

    # m2 — stabilized construction entrance not shown
    hand_oval(d, 2400, 3100, 130, 50, width=STROKE, jitter=4)
    hand_arrow(d, (2530, 3100), (2800, 2960), width=STROKE, head_len=26)
    hand_text(canvas, 2750, 2820, "STAB. CONSTR. ENT.", size=50, rotate=-1)
    hand_text(canvas, 2750, 2880, "NOT SHOWN AT SITE", size=50, rotate=2)
    hand_text(canvas, 2750, 2940, "ACCESS — ADD SCE", size=50, rotate=-1)

    # m3 — SWPPP note missing — required before earth disturbance
    hand_oval(d, 700, 1500, 150, 55, width=STROKE, jitter=5)
    hand_arrow(d, (700, 1445), (700, 1200), width=STROKE, head_len=26)
    hand_text(canvas, 380, 1060, "SWPPP NOTE MISSING —", size=50, rotate=-2)
    hand_text(canvas, 380, 1120, "REQ'D BEFORE EARTH", size=50, rotate=1)
    hand_text(canvas, 380, 1180, "DISTURBANCE PERMIT", size=50, rotate=-1)

    # m4 — sediment trap sizing not noted — verify capacity
    hand_oval(d, 3200, 2000, 120, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (3320, 2000), (3600, 1860), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 3550, 1720, "SED. TRAP SIZING", size=50, rotate=-1)
    hand_text(canvas, 3550, 1780, "NOT NOTED — VERIFY", size=50, rotate=2)
    hand_text(canvas, 3550, 1840, "CAPACITY FOR DA", size=50, rotate=-1)

    # m5 — inlet protection not shown at catch basin
    hand_oval(d, 2800, 1400, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (2910, 1400), (3150, 1260), width=STROKE, head_len=26)
    hand_text(canvas, 3100, 1120, "INLET PROTECTION", size=52, rotate=-2)
    hand_text(canvas, 3100, 1185, "NOT SHOWN AT CB —", size=52, rotate=1)
    hand_text(canvas, 3100, 1250, "ADD CURB SOCK/BLOCK", size=48, rotate=-1)

    # m6 — verify? near disturbed area boundary
    hand_oval(d, 1800, 1200, 85, 38, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 1660, 1090, "verify?", size=58, rotate=-3)

    # m7 — ?? near outlet protection
    hand_oval(d, 3800, 2800, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3870, 2680, "??", size=100, rotate=7)

    # Reviewer stamp
    hand_oval(d, 450, 120, 280, 75, width=STROKE+2, jitter=5, rotation_deg=-2)
    hand_text(canvas, 220, 68, "REVIEW SET", size=60, rotate=-3)
    hand_text(canvas, 280, 145, "REV. 1 - 8/30/23", size=32, rotate=-2)
    hand_text(canvas, 150, 3420, "JK", size=80, rotate=-5)
    hand_text(canvas, 150, 3500, "5/17", size=40, rotate=-3)

def main():
    print(f"Rendering page {SOURCE_PAGE} at {RENDER_DPI} DPI...")
    canvas = render()
    print(f"Canvas: {canvas.size[0]}x{canvas.size[1]}px")
    draw(canvas)
    canvas.save(HERE / "output.pdf", "PDF", resolution=RENDER_DPI)
    canvas.save(HERE / "output.png", "PNG", optimize=True)
    print(f"Saved to {HERE}")

if __name__ == "__main__":
    main()
