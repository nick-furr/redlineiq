"""UNLV Foundation Plan — redline overlay generator. UNLV Structural page 2."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "unlv_structural.pdf"
SOURCE_PAGE = 2
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
    random.seed(102)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — footing may be undersized for soil bearing pressure
    hand_oval(d, 1500, 2200, 120, 50, width=STROKE, jitter=5)
    hand_arrow(d, (1620, 2200), (1900, 2060), width=STROKE, head_len=28)
    hand_text(canvas, 1850, 1900, "18x18 FTG MAY BE", size=52, rotate=-2)
    hand_text(canvas, 1850, 1965, "UNDERSIZED — GEOTECH", size=50, rotate=1)
    hand_text(canvas, 1850, 2030, "ALLOWS 2000 PSF MAX", size=48, rotate=-1)

    # m2 — anchor bolt spacing exceeds 48" max per ASCE 7
    hand_oval(d, 3000, 1600, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (3110, 1600), (3380, 1460), width=STROKE, head_len=26)
    hand_text(canvas, 3330, 1300, "AB SPACING 72\" —", size=52, rotate=-1)
    hand_text(canvas, 3330, 1365, "EXCEEDS 48\" MAX", size=52, rotate=2)
    hand_text(canvas, 3330, 1430, "PER ASCE 7-22", size=52, rotate=-1)

    # m3 — slab thickness not called out on plan
    hand_oval(d, 2200, 3000, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (2200, 2955), (2200, 2750), width=STROKE, head_len=26)
    hand_text(canvas, 1850, 2610, "SLAB THICKNESS NOT", size=52, rotate=-2)
    hand_text(canvas, 1850, 2675, "NOTED ON PLAN —", size=52, rotate=1)
    hand_text(canvas, 1850, 2740, "ADD 4\" MIN CALLOUT", size=50, rotate=-1)

    # m4 — rebar not specified at slab on grade
    hand_oval(d, 3800, 2800, 120, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (3920, 2800), (4200, 2660), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 4150, 2520, "REBAR NOT SPECIFIED", size=50, rotate=-1)
    hand_text(canvas, 4150, 2580, "AT SOG — ADD #4", size=50, rotate=2)
    hand_text(canvas, 4150, 2640, "@18\" EW PER GEOTECH", size=46, rotate=-1)

    # m5 — grade beam depth not shown
    hand_oval(d, 1000, 1800, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (900, 1800), (650, 1950), width=STROKE, head_len=26)
    hand_text(canvas, 220, 2000, "GRADE BEAM DEPTH", size=50, rotate=-1)
    hand_text(canvas, 220, 2060, "NOT SHOWN — ADD", size=50, rotate=1)
    hand_text(canvas, 220, 2120, "EL. OR DEPTH NOTE", size=50, rotate=-2)

    # m6 — verify? near column footing
    hand_oval(d, 2800, 3500, 85, 38, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 2660, 3390, "verify?", size=58, rotate=-3)

    # m7 — ?? near slab edge condition
    hand_oval(d, 4300, 3200, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 4370, 3080, "??", size=100, rotate=5)

    # Reviewer initials
    hand_text(canvas, 200, 4300, "RG", size=80, rotate=-4)
    hand_text(canvas, 200, 4390, "5/18", size=40, rotate=-2)

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
