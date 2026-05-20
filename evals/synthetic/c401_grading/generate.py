"""C-401 Grading & Drainage Plan — redline overlay generator. Bohler page 5."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "bohler_walpole.pdf"
SOURCE_PAGE = 5
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
    random.seed(11)
    d = ImageDraw.Draw(canvas, "RGBA")

    # #1 FFE/grade conflict at building entrance — spot elev 442.0 doesn't match C-301 correction
    hand_oval(d, 2280, 2350, 120, 45, width=STROKE, jitter=5)
    hand_arrow(d, (2280-120, 2350), (1700, 2500), width=STROKE, head_len=28)
    hand_text(canvas, 1100, 2500, "FFE vs FG CONFLICT", size=52, rotate=-1)
    hand_text(canvas, 1100, 2570, "MATCH C-301 CORR.", size=46, rotate=1)

    # #2 Swale slope too flat — 0.4% shown, 0.5% min for grass-lined
    hand_oval(d, 850, 2650, 100, 40, width=STROKE, jitter=4)
    hand_arrow(d, (850, 2610), (850, 2400), width=STROKE, head_len=26)
    hand_text(canvas, 430, 2280, "0.4% SLOPE -", size=50, rotate=-2)
    hand_text(canvas, 430, 2340, "MIN 0.5% FOR", size=50, rotate=1)
    hand_text(canvas, 430, 2400, "GRASS SWALE. FIX.", size=50, rotate=-1)

    # #3 Missing high point callout — drainage break with no label
    hand_oval(d, 2500, 2000, 80, 40, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (2580, 1980), (2800, 1820), width=STROKE, head_len=26)
    hand_text(canvas, 2750, 1680, "ADD HP CALLOUT", size=50, rotate=-1)
    hand_text(canvas, 2750, 1745, "- DRAINAGE BREAK", size=46, rotate=2)

    # #4 Catch basin rim elevation discrepancy — CB rim vs pavement grade
    hand_oval(d, 3600, 1850, 70, 35, width=STROKE, jitter=4)
    hand_arrow(d, (3670, 1850), (3950, 1700), width=STROKE, head_len=26)
    hand_text(canvas, 3880, 1580, "CB RIM - VERIFY", size=48, rotate=-1)
    hand_text(canvas, 3880, 1640, "FLUSH W/ PVMT", size=48, rotate=1)

    # #5 Grading extends into ROW without permit note
    hand_oval(d, 2600, 3280, 200, 50, width=STROKE, jitter=5)
    hand_arrow(d, (2600, 3230), (2000, 3050), width=STROKE, head_len=26)
    hand_text(canvas, 1380, 2950, "GRADING IN ROW -", size=50, rotate=-1)
    hand_text(canvas, 1380, 3015, "ADD PERMIT NOTE", size=50, rotate=1)

    # #6 ADA cross slope at accessible route >2.0%
    hand_oval(d, 3150, 2580, 90, 40, width=STROKE, jitter=4)
    hand_arrow(d, (3150-80, 2580), (2750, 2750), width=STROKE, head_len=26)
    hand_text(canvas, 2200, 2750, "XSLOPE > 2% MAX", size=52, rotate=-2)
    hand_text(canvas, 2200, 2815, "ADA - FIX GRADE", size=52, rotate=1)
    hand_underline(d, 2200, 2885, 2680, width=STROKE)

    # #7 Retaining wall — designer not identified per general note
    hand_oval(d, 1800, 1400, 130, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (1930, 1400), (2200, 1280), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 2150, 1100, "RET. WALL - ID", size=48, rotate=-1)
    hand_text(canvas, 2150, 1160, "WALL DESIGNER", size=48, rotate=2)
    hand_text(canvas, 2150, 1220, "PER GEN. NOTE 7", size=44, rotate=-1)

    # #8 Emergency overflow — no overflow route shown for parking field
    hand_oval(d, 1900, 1300, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (1900, 1255), (1900, 1050), width=STROKE, head_len=26)
    hand_text(canvas, 1400, 920, "ADD OVERFLOW ROUTE", size=48, rotate=-1)
    hand_text(canvas, 1400, 980, "FOR PARKING FIELD", size=48, rotate=1)

    # #9 verify? — ambiguous mark near west drainage area
    hand_oval(d, 580, 1950, 90, 40, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 490, 1840, "verify?", size=58, rotate=-3)

    # #10 ?? — ambiguous near east property corner
    hand_oval(d, 3800, 2000, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3880, 1870, "??", size=100, rotate=7)

    # Reviewer stamp
    hand_oval(d, 450, 130, 280, 80, width=STROKE+2, jitter=5, rotation_deg=-2)
    hand_text(canvas, 220, 75, "REVIEW SET", size=64, rotate=-3)
    hand_text(canvas, 280, 155, "REV. 1 - 8/30/23", size=34, rotate=-2)
    hand_text(canvas, 150, 3400, "JK", size=80, rotate=-5)
    hand_text(canvas, 150, 3490, "5/17", size=40, rotate=-3)

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
