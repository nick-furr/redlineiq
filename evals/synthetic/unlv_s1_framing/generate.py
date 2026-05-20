"""UNLV Structural Framing Plan — redline overlay generator. UNLV Structural page 3."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "unlv_structural.pdf"
SOURCE_PAGE = 3
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
    random.seed(110)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — beam size insufficient for 28' span
    hand_oval(d, 2000, 2000, 130, 50, width=STROKE, jitter=5)
    hand_arrow(d, (2130, 2000), (2400, 1860), width=STROKE, head_len=28)
    hand_text(canvas, 2350, 1700, "W12x26 UNDERSIZED", size=52, rotate=-2)
    hand_text(canvas, 2350, 1765, "FOR 28' SPAN —", size=52, rotate=1)
    hand_text(canvas, 2350, 1830, "CALC. REQ'S W16x31", size=50, rotate=-1)

    # m2 — missing connection detail reference at ridge beam to column
    hand_oval(d, 3200, 1400, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (3310, 1400), (3600, 1260), width=STROKE, head_len=26)
    hand_text(canvas, 3550, 1100, "CONN. DETAIL MISSING", size=50, rotate=-1)
    hand_text(canvas, 3550, 1160, "AT RIDGE BEAM TO", size=50, rotate=2)
    hand_text(canvas, 3550, 1220, "COL. — ADD REF.", size=50, rotate=-1)

    # m3 — joist bearing at exterior wall not detailed
    hand_oval(d, 1200, 1500, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (1100, 1500), (800, 1650), width=STROKE, head_len=26)
    hand_text(canvas, 380, 1700, "JOIST BEARING AT", size=50, rotate=-1)
    hand_text(canvas, 380, 1760, "EXT. WALL NOT", size=50, rotate=2)
    hand_text(canvas, 380, 1820, "SHOWN — ADD DTL.", size=50, rotate=-1)

    # m4 — blocking at midspan missing for lateral bracing
    hand_oval(d, 2500, 2800, 120, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (2620, 2800), (2900, 2660), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 2850, 2520, "MIDSPAN BLOCKING", size=50, rotate=-1)
    hand_text(canvas, 2850, 2580, "MISSING — REQ'D FOR", size=50, rotate=2)
    hand_text(canvas, 2850, 2640, "LATERAL STABILITY", size=50, rotate=-1)

    # m5 — hip rafter size not called out
    hand_oval(d, 4200, 2200, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (4300, 2200), (4550, 2060), width=STROKE, head_len=26)
    hand_text(canvas, 4500, 1920, "HIP RAFTER SIZE", size=50, rotate=-2)
    hand_text(canvas, 4500, 1980, "NOT CALLED OUT —", size=50, rotate=1)
    hand_text(canvas, 4500, 2040, "ADD MEMBER SIZE", size=50, rotate=-1)

    # m6 — ledger-to-wall attachment detail missing
    hand_oval(d, 800, 3000, 110, 45, width=STROKE, jitter=5)
    hand_arrow(d, (800, 2955), (800, 2750), width=STROKE, head_len=26)
    hand_text(canvas, 480, 2610, "LEDGER ATTACH.", size=52, rotate=-1)
    hand_text(canvas, 480, 2675, "DETAIL MISSING —", size=52, rotate=1)
    hand_text(canvas, 480, 2740, "ADD W/ BOLT PATTERN", size=48, rotate=-2)

    # m7 — verify? near purlin connection
    hand_oval(d, 1800, 3300, 85, 38, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 1660, 3190, "verify?", size=58, rotate=-3)

    # m8 — ?? near valley rafter
    hand_oval(d, 3500, 3100, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3570, 2980, "??", size=100, rotate=6)

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
