"""M101 Mechanical Plan — redline overlay generator. Midlands Tech toilet reno page 8."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "midlands_tech_toilet_reno.pdf"
SOURCE_PAGE = 8
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
    random.seed(109)
    d = ImageDraw.Draw(canvas, "RGBA")

    # m1 — exhaust fan CFM undersized for fixture count
    hand_oval(d, 800, 1100, 110, 45, width=STROKE, jitter=5)
    hand_arrow(d, (910, 1100), (1150, 950), width=STROKE, head_len=26)
    hand_text(canvas, 1100, 800, "EF-1: 75 CFM", size=52, rotate=-2)
    hand_text(canvas, 1100, 865, "UNDERSIZED — CALC.", size=50, rotate=1)
    hand_text(canvas, 1100, 930, "REQ'S 150 CFM MIN", size=50, rotate=-1)

    # m2 — supply diffuser conflicts with light fixture above
    hand_oval(d, 2100, 900, 90, 40, width=STROKE, jitter=4)
    hand_arrow(d, (2100, 860), (2100, 680), width=STROKE, head_len=26)
    hand_text(canvas, 1850, 540, "DIFFUSER CONFLICTS", size=50, rotate=-1)
    hand_text(canvas, 1850, 600, "W/ LIGHT FIXTURE —", size=50, rotate=2)
    hand_text(canvas, 1850, 660, "COORD. W/ ELEC.", size=50, rotate=-1)

    # m3 — no backdraft damper at duct penetration through rated wall
    hand_oval(d, 3400, 1200, 100, 45, width=STROKE, jitter=4)
    hand_arrow(d, (3500, 1200), (3750, 1080), width=STROKE, head_len=26)
    hand_text(canvas, 3700, 940, "BKDFT DAMPER REQ'D", size=48, rotate=-2)
    hand_text(canvas, 3700, 1000, "AT RATED WALL", size=48, rotate=1)
    hand_text(canvas, 3700, 1060, "PENETRATION", size=48, rotate=-1)

    # m4 — access panel missing for fan unit above ceiling
    hand_oval(d, 1200, 2400, 100, 45, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (1300, 2400), (1550, 2280), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 1500, 2140, "ADD ACCESS PANEL", size=50, rotate=-1)
    hand_text(canvas, 1500, 2200, "FOR EF-2 ABOVE", size=50, rotate=2)
    hand_text(canvas, 1500, 2260, "CEILING — MIN 24x24", size=46, rotate=-1)

    # m5 — exhaust duct pitched back toward unit (wrong direction)
    hand_oval(d, 2800, 2100, 130, 50, width=STROKE, jitter=5)
    hand_arrow(d, (2800, 2050), (2500, 1900), width=STROKE, head_len=26)
    hand_text(canvas, 2100, 1760, "DUCT PITCHED BACK", size=50, rotate=-1)
    hand_text(canvas, 2100, 1820, "TOWARD UNIT —", size=50, rotate=1)
    hand_text(canvas, 2100, 1880, "MUST PITCH TO EXT.", size=48, rotate=-2)

    # m6 — return air path not shown
    hand_oval(d, 4200, 1800, 110, 45, width=STROKE, jitter=4)
    hand_arrow(d, (4090, 1800), (3850, 1950), width=STROKE, head_len=26)
    hand_text(canvas, 3400, 2000, "RETURN AIR PATH", size=52, rotate=-1)
    hand_text(canvas, 3400, 2065, "NOT SHOWN — ADD", size=52, rotate=1)
    hand_text(canvas, 3400, 2130, "TRANSFER GRILLE", size=52, rotate=-2)

    # m7 — verify? ambiguous near air handler connection
    hand_oval(d, 900, 3200, 85, 38, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 760, 3080, "verify?", size=58, rotate=-3)

    # m8 — ?? near duct routing
    hand_oval(d, 3000, 3400, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3070, 3280, "??", size=100, rotate=5)

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
