"""HOH Site Landscaping Plan — redline overlay generator. HOH warehouse page 12."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "hoh_warehouse_merchant_street.pdf"
SOURCE_PAGE = 12
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
    random.seed(112)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — street tree species conflicts with overhead power line clearance
    hand_oval(d, 400, 500, 80, 35, width=STROKE, jitter=4)
    hand_arrow(d, (480, 500), (650, 380), width=STROKE, head_len=20)
    hand_text(canvas, 620, 280, "TREE SPECIES CONFLICTS", size=28, rotate=-2)
    hand_text(canvas, 620, 315, "W/ POWER LINE CLEAR. —", size=28, rotate=1)
    hand_text(canvas, 620, 350, "USE LOW-GROWTH TYPE", size=28, rotate=-1)

    # m2 — shrub spacing at parking lot edge non-standard
    hand_oval(d, 900, 1100, 80, 35, width=STROKE, jitter=4)
    hand_arrow(d, (980, 1100), (1150, 980), width=STROKE, head_len=20)
    hand_text(canvas, 1120, 880, "SHRUB SPACING 8' O.C.", size=28, rotate=-1)
    hand_text(canvas, 1120, 915, "NON-STANDARD — LOCAL", size=28, rotate=2)
    hand_text(canvas, 1120, 950, "CODE REQ'S 5' MAX", size=28, rotate=-1)

    # m3 — irrigation coverage missing at east corner
    hand_oval(d, 1700, 700, 85, 35, width=STROKE, jitter=4)
    hand_arrow(d, (1785, 700), (1900, 580), width=STROKE, head_len=20)
    hand_text(canvas, 1870, 480, "IRRIGATION COVERAGE", size=28, rotate=-2)
    hand_text(canvas, 1870, 515, "MISSING AT E. CORNER —", size=28, rotate=1)
    hand_text(canvas, 1870, 550, "ADD ZONE OR HEADS", size=28, rotate=-1)

    # m4 — large caliper tree too close to utility easement
    hand_oval(d, 1300, 400, 75, 32, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (1375, 400), (1520, 300), width=STROKE_THIN, head_len=18)
    hand_text(canvas, 1490, 200, "TREE 8' FROM UTIL.", size=26, rotate=-1)
    hand_text(canvas, 1490, 232, "EASEMENT — VERIFY", size=26, rotate=2)
    hand_text(canvas, 1490, 264, "MIN. SETBACK REQ'D", size=26, rotate=-1)

    # m5 — groundcover type not specified at bioretention area
    hand_oval(d, 600, 900, 80, 35, width=STROKE, jitter=4)
    hand_arrow(d, (520, 900), (350, 1020), width=STROKE, head_len=20)
    hand_text(canvas, 120, 1060, "GROUNDCOVER TYPE", size=28, rotate=-1)
    hand_text(canvas, 120, 1095, "NOT SPECIFIED AT", size=28, rotate=1)
    hand_text(canvas, 120, 1130, "BIORETENTION AREA", size=28, rotate=-2)

    # m6 — verify? near planting schedule
    hand_oval(d, 2000, 1100, 65, 28, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 1900, 1020, "verify?", size=34, rotate=-3)

    # m7 — ?? near irrigation head location
    hand_oval(d, 350, 1300, 40, 22, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 400, 1220, "??", size=60, rotate=6)


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
