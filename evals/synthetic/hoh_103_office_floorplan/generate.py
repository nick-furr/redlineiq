"""HOH Warehouse — Sheet 103 Office Floorplan. Page 9 of hoh_warehouse_merchant_street.pdf."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "hoh_warehouse_merchant_street.pdf"
SOURCE_PAGE = 8   # Sheet 103 Office Floorplan
RENDER_DPI = 150  # yields 2550x1650px

sys.path.insert(0, str(HERE.parent / "_lib"))
from handdrawn import RED, STROKE, STROKE_THIN, hand_arrow, hand_oval, hand_strikeout, hand_text, hand_underline

# Scaled constants for 11x17 sheet (half the pixel density of ARCH D)
S = 5   # stroke
ST = 3  # stroke thin

def render():
    doc = fitz.open(str(SOURCE_PDF))
    pix = doc[SOURCE_PAGE - 1].get_pixmap(matrix=fitz.Matrix(RENDER_DPI/72, RENDER_DPI/72))
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    doc.close()
    return img

def draw(canvas):
    random.seed(17)
    d = ImageDraw.Draw(canvas, "RGBA")

    # #1 ADA restroom lavatory clear floor space 28" — need 30" min
    hand_oval(d, 1150, 1080, 65, 35, width=S, jitter=3)
    hand_arrow(d, (1085, 1080), (800, 980), width=S, head_len=18)
    hand_text(canvas, 480, 880, "LAV. CFS = 28\"", size=34, rotate=-1)
    hand_text(canvas, 480, 920, "ADA MIN 30\"", size=34, rotate=1)
    hand_text(canvas, 480, 960, "FIX LAYOUT", size=34, rotate=-2)

    # #2 Conference room door swings into corridor — egress width issue
    hand_oval(d, 920, 700, 50, 50, width=S, jitter=3)
    hand_arrow(d, (920, 650), (750, 520), width=S, head_len=18)
    hand_text(canvas, 480, 410, "DR SWING BLOCKS", size=34, rotate=-1)
    hand_text(canvas, 480, 450, "EGRESS CORR.", size=34, rotate=1)
    hand_text(canvas, 480, 490, "FLIP OR RECESSE", size=34, rotate=-1)

    # #3 Missing reception counter dimension
    hand_oval(d, 390, 700, 80, 30, width=ST, jitter=3)
    hand_arrow(d, (390, 670), (390, 530), width=S, head_len=18)
    hand_text(canvas, 130, 430, "ADD COUNTER", size=32, rotate=-1)
    hand_text(canvas, 130, 465, "LENGTH DIM.", size=32, rotate=2)

    # #4 Electrical panel clearance 3'-0" shown — NEC 110.26 requires 3'-6" at 240V
    hand_oval(d, 2020, 380, 55, 40, width=S, jitter=3)
    hand_arrow(d, (2020, 420), (1850, 580), width=S, head_len=18)
    hand_text(canvas, 1600, 600, "PANEL CLRNC.", size=34, rotate=-1)
    hand_text(canvas, 1600, 638, "3'-6\" MIN PER", size=34, rotate=1)
    hand_text(canvas, 1600, 676, "NEC 110.26", size=34, rotate=-1)

    # #5 Office 3 travel distance to exit — verify <200' without sprinkler
    hand_oval(d, 2050, 650, 70, 35, width=ST, jitter=3)
    hand_arrow(d, (1980, 650), (1750, 750), width=ST, head_len=16)
    hand_text(canvas, 1500, 800, "VERIFY TOD <200'", size=32, rotate=-1)
    hand_text(canvas, 1500, 836, "W/O SPKLR (IBC)", size=32, rotate=1)

    # #6 Wall type not called out between office and conference
    hand_oval(d, 1220, 520, 45, 80, width=ST, jitter=3)
    hand_arrow(d, (1265, 520), (1450, 420), width=ST, head_len=16)
    hand_text(canvas, 1420, 310, "ADD WALL TYPE", size=32, rotate=-1)
    hand_text(canvas, 1420, 346, "CALLOUT", size=32, rotate=2)

    # #7 Window count conflict — 2 shown here, 1 on elevations Sheet 105
    hand_oval(d, 1780, 260, 80, 25, width=S, jitter=3)
    hand_arrow(d, (1780, 285), (1780, 430), width=S, head_len=18)
    hand_text(canvas, 1450, 450, "2 WIN. HERE /", size=34, rotate=-1)
    hand_text(canvas, 1450, 488, "1 ON SHT 105 -", size=34, rotate=1)
    hand_text(canvas, 1450, 526, "RECONCILE", size=34, rotate=-1)

    # #8 Storage closet 2'-0" deep — not functional, coord. with owner
    hand_oval(d, 1700, 1050, 50, 50, width=ST, jitter=3)
    hand_arrow(d, (1750, 1050), (1920, 950), width=ST, head_len=16)
    hand_text(canvas, 1880, 840, "CLOSET 2'-0\" DEEP", size=30, rotate=-1)
    hand_text(canvas, 1880, 874, "NOT FUNCTIONAL -", size=30, rotate=1)
    hand_text(canvas, 1880, 908, "COORD. W/ OWNER", size=30, rotate=-1)

    # #9 verify? — ambiguous near mech room
    hand_oval(d, 2120, 300, 70, 35, width=ST, jitter=4)
    hand_text(canvas, 2030, 210, "verify?", size=38, rotate=-3)

    # #10 ?? — ambiguous near kitchenette/break area
    hand_oval(d, 1450, 1150, 45, 25, width=ST, jitter=3)
    hand_text(canvas, 1510, 1060, "??", size=70, rotate=7)

    # Reviewer stamp (scaled for smaller sheet)
    hand_oval(d, 250, 80, 180, 50, width=S+1, jitter=3, rotation_deg=-2)
    hand_text(canvas, 120, 48, "REVIEW SET", size=40, rotate=-3)
    hand_text(canvas, 150, 98, "REV. 1", size=22, rotate=-2)
    hand_text(canvas, 80, 1540, "JK", size=50, rotate=-5)
    hand_text(canvas, 80, 1595, "5/17", size=26, rotate=-3)

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
