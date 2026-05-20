"""E100 Electrical Plan — redline overlay generator. Midlands Tech toilet reno page 11."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "midlands_tech_toilet_reno.pdf"
SOURCE_PAGE = 11
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
    random.seed(108)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — GFCI missing at wet location near lavatory
    hand_oval(d, 900, 2200, 100, 45, width=STROKE, jitter=5)
    hand_arrow(d, (900, 2155), (700, 1950), width=STROKE, head_len=26)
    hand_text(canvas, 380, 1820, "GFCI REQ'D AT", size=52, rotate=-2)
    hand_text(canvas, 380, 1885, "WET LOCATION -", size=52, rotate=1)
    hand_text(canvas, 380, 1950, "NEC 210.8(B)", size=52, rotate=-1)

    # m2 — circuit breaker 15A too small for 20A required at bath
    hand_oval(d, 2200, 1400, 90, 40, width=STROKE, jitter=4)
    hand_arrow(d, (2290, 1400), (2550, 1250), width=STROKE, head_len=26)
    hand_text(canvas, 2500, 1100, "20A CIRCUIT REQ'D", size=50, rotate=-1)
    hand_text(canvas, 2500, 1160, "HERE — UPDATE", size=50, rotate=2)
    hand_text(canvas, 2500, 1220, "PANEL SCHEDULE", size=50, rotate=-1)

    # m3 — exit sign missing at egress path
    hand_oval(d, 3600, 800, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (3600, 755), (3600, 580), width=STROKE, head_len=26)
    hand_text(canvas, 3250, 440, "EXIT SIGN MISSING", size=52, rotate=-2)
    hand_text(canvas, 3250, 505, "AT EGRESS PATH —", size=52, rotate=1)
    hand_text(canvas, 3250, 570, "ADD W/ BATTERY BCK", size=48, rotate=-1)

    # m4 — lighting level note: fixture type conflicts with spec
    hand_oval(d, 1600, 1800, 120, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (1720, 1800), (2050, 1700), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 2020, 1580, "FIXTURE TYPE 2B", size=48, rotate=-1)
    hand_text(canvas, 2020, 1640, "CONFLICTS W/ SPEC", size=48, rotate=2)
    hand_text(canvas, 2020, 1700, "SEC. 265000 — VERIFY", size=44, rotate=-1)

    # m5 — conduit routing unclear — conflicts with plumbing
    hand_oval(d, 2900, 2500, 90, 40, width=STROKE, jitter=4)
    hand_arrow(d, (2900, 2460), (2900, 2250), width=STROKE, head_len=26)
    hand_text(canvas, 2600, 2120, "CONDUIT ROUTE", size=50, rotate=-1)
    hand_text(canvas, 2600, 2180, "CONFLICTS W/", size=50, rotate=1)
    hand_text(canvas, 2600, 2240, "PLUMBING — COORD.", size=48, rotate=-2)

    # m6 — panel schedule not updated for new circuits
    hand_oval(d, 4500, 1600, 130, 50, width=STROKE, jitter=5)
    hand_arrow(d, (4370, 1600), (4100, 1750), width=STROKE, head_len=26)
    hand_text(canvas, 3700, 1800, "PANEL SCHED.", size=52, rotate=-1)
    hand_text(canvas, 3700, 1865, "NOT UPDATED FOR", size=52, rotate=1)
    hand_text(canvas, 3700, 1930, "NEW CIRCUITS", size=52, rotate=-2)

    # m7 — verify? ambiguous near switch location
    hand_oval(d, 1100, 3100, 80, 35, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 960, 2990, "verify?", size=58, rotate=-3)

    # m8 — ?? ambiguous near junction box
    hand_oval(d, 3200, 3300, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3270, 3180, "??", size=100, rotate=6)

    # Reviewer initials
    hand_text(canvas, 200, 4300, "JB", size=80, rotate=-4)
    hand_text(canvas, 200, 4390, "5/17", size=40, rotate=-2)

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
