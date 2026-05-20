"""P102 Plumbing Plan — redline overlay generator. Midlands Tech toilet reno page 7."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "midlands_tech_toilet_reno.pdf"
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

    # m1 — sanitary pipe 3" undersized, should be 4" for fixture unit count
    hand_oval(d, 1400, 2000, 110, 45, width=STROKE, jitter=5)
    hand_arrow(d, (1510, 2000), (1750, 1860), width=STROKE, head_len=26)
    hand_text(canvas, 1700, 1720, "3\" SAN UNDERSIZED —", size=50, rotate=-2)
    hand_text(canvas, 1700, 1780, "FU COUNT REQ'S 4\"", size=50, rotate=1)
    hand_text(canvas, 1700, 1840, "MIN — FIX PIPE SIZE", size=50, rotate=-1)

    # m2 — cleanout missing at horizontal run change of direction
    hand_oval(d, 2600, 2400, 90, 40, width=STROKE, jitter=4)
    hand_arrow(d, (2690, 2400), (2950, 2260), width=STROKE, head_len=26)
    hand_text(canvas, 2900, 2120, "CLEANOUT MISSING", size=50, rotate=-1)
    hand_text(canvas, 2900, 2180, "AT DIRECTION", size=50, rotate=2)
    hand_text(canvas, 2900, 2240, "CHANGE — ADD CO", size=50, rotate=-1)

    # m3 — floor drain not shown on renovation plan
    hand_oval(d, 900, 3000, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (900, 2955), (900, 2750), width=STROKE, head_len=26)
    hand_text(canvas, 580, 2610, "FLOOR DRAIN NOT", size=52, rotate=-2)
    hand_text(canvas, 580, 2675, "SHOWN — VERIFY", size=52, rotate=1)
    hand_text(canvas, 580, 2740, "EXISTING OR ADD NEW", size=48, rotate=-1)

    # m4 — vent stack location conflicts with structural framing
    hand_oval(d, 3500, 1500, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (3610, 1500), (3850, 1360), width=STROKE, head_len=26)
    hand_text(canvas, 3800, 1220, "VENT STACK LOC.", size=50, rotate=-1)
    hand_text(canvas, 3800, 1280, "CONFLICTS W/ STRUCT.", size=50, rotate=2)
    hand_text(canvas, 3800, 1340, "COORD. W/ ENGR.", size=50, rotate=-1)

    # m5 — fixture unit count wrong for flush valve toilets vs tank type
    hand_oval(d, 2000, 1200, 130, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (2130, 1200), (2400, 1080), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 2350, 940, "FU COUNT WRONG —", size=50, rotate=-1)
    hand_text(canvas, 2350, 1000, "FLUSH VALVE = 6 FU", size=50, rotate=2)
    hand_text(canvas, 2350, 1060, "NOT 4 FU (TANK TYPE)", size=46, rotate=-1)

    # m6 — hot/cold supply labels appear swapped at lavatory
    hand_oval(d, 1800, 3300, 100, 40, width=STROKE, jitter=4)
    hand_arrow(d, (1900, 3300), (2150, 3180), width=STROKE, head_len=26)
    hand_text(canvas, 2100, 3060, "H/C LABELS SWAPPED", size=50, rotate=-1)
    hand_text(canvas, 2100, 3120, "AT LAVORATORY —", size=50, rotate=1)
    hand_text(canvas, 2100, 3180, "VERIFY AND CORRECT", size=50, rotate=-2)

    # m7 — verify? near stack connection
    hand_oval(d, 700, 1600, 80, 35, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 560, 1490, "verify?", size=58, rotate=-3)

    # m8 — ?? near drain location
    hand_oval(d, 3800, 3100, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3870, 2980, "??", size=100, rotate=7)

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
