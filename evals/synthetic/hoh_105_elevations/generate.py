"""HOH Warehouse — Sheet 105 Elevations. Page 11 of hoh_warehouse_merchant_street.pdf."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "hoh_warehouse_merchant_street.pdf"
SOURCE_PAGE = 11  # Sheet 105 Elevations
RENDER_DPI = 150  # yields 2550x1650px

sys.path.insert(0, str(HERE.parent / "_lib"))
from handdrawn import RED, STROKE, STROKE_THIN, hand_arrow, hand_oval, hand_strikeout, hand_text, hand_underline

S = 5
ST = 3

def render():
    doc = fitz.open(str(SOURCE_PDF))
    pix = doc[SOURCE_PAGE - 1].get_pixmap(matrix=fitz.Matrix(RENDER_DPI/72, RENDER_DPI/72))
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    doc.close()
    return img

def draw(canvas):
    # Sheet has 4 elevations stacked: south (bottom), two west (middle), north (top)
    # Approx y bands: north 50-450, west-1 450-850, west-2 850-1200, south 1200-1600
    random.seed(19)
    d = ImageDraw.Draw(canvas, "RGBA")

    # #1 Total building height dimension missing on all elevations (code requires it)
    hand_oval(d, 400, 1380, 80, 30, width=S, jitter=3)
    hand_arrow(d, (480, 1380), (700, 1280), width=S, head_len=18)
    hand_text(canvas, 680, 1170, "ADD BLDG HT DIM.", size=34, rotate=-1)
    hand_text(canvas, 680, 1210, "ON ALL ELEVS.", size=34, rotate=1)
    hand_text(canvas, 680, 1250, "REQ'D FOR PERMIT", size=34, rotate=-1)

    # #2 Man door header height — appears 7'-0", commercial min is 7'-4" per IBC
    hand_oval(d, 950, 1450, 50, 30, width=S, jitter=3)
    hand_arrow(d, (1000, 1450), (1200, 1330), width=S, head_len=18)
    hand_strikeout(d, (1180, 1310), (1550, 1310), width=S)
    hand_text(canvas, 1170, 1240, "DR HDR 7'-0\" -", size=34, rotate=-1)
    hand_text(canvas, 1170, 1278, "MIN 7'-4\" IBC", size=34, rotate=1)
    hand_text(canvas, 1170, 1316, "1010.1.1. FIX.", size=34, rotate=-1)

    # #3 Roof pitch not labeled — add callout (appears 4:12 from profile)
    hand_oval(d, 1300, 1320, 120, 30, width=ST, jitter=3)
    hand_arrow(d, (1300, 1290), (1300, 1150), width=S, head_len=18)
    hand_text(canvas, 1050, 1060, "ADD PITCH CALLOUT", size=32, rotate=-1)
    hand_text(canvas, 1050, 1096, "(APPEARS 4:12)", size=32, rotate=2)

    # #4 Window sill height not dimensioned on west elevation — needed for egress
    hand_oval(d, 800, 650, 60, 30, width=ST, jitter=3)
    hand_arrow(d, (800, 680), (650, 800), width=ST, head_len=16)
    hand_text(canvas, 330, 820, "ADD SILL HT DIM.", size=32, rotate=-1)
    hand_text(canvas, 330, 856, "EGRESS ANALYSIS", size=32, rotate=1)

    # #5 Finish grade line on north elevation doesn't match grading plan
    hand_oval(d, 1100, 290, 150, 25, width=S, jitter=3)
    hand_arrow(d, (1100, 315), (900, 430), width=S, head_len=18)
    hand_text(canvas, 580, 440, "FG LINE - VERIFY", size=34, rotate=-1)
    hand_text(canvas, 580, 478, "MATCHES C-401", size=34, rotate=2)

    # #6 Metal panel type/color/manufacturer not specified
    hand_oval(d, 1700, 1250, 120, 40, width=ST, jitter=3)
    hand_arrow(d, (1820, 1250), (2050, 1150), width=ST, head_len=16)
    hand_text(canvas, 2020, 1040, "SPEC PANEL MFR,", size=30, rotate=-1)
    hand_text(canvas, 2020, 1074, "TYPE & COLOR", size=30, rotate=1)

    # #7 Wainscot height — 4'-0" labeled but graphic shows ~3'-6"
    hand_oval(d, 350, 1500, 60, 25, width=S, jitter=3)
    hand_arrow(d, (350, 1475), (200, 1350), width=S, head_len=18)
    hand_text(canvas, 50, 1250, "WAINSCOT -", size=32, rotate=-1)
    hand_text(canvas, 50, 1286, "LABEL 4'-0\" /", size=32, rotate=1)
    hand_text(canvas, 50, 1322, "GRAPHIC 3'-6\"?", size=32, rotate=-1)

    # #8 Overhead door opening not dimensioned — permit requires it
    hand_oval(d, 1050, 1430, 130, 40, width=S, jitter=3)
    hand_arrow(d, (1050, 1390), (1050, 1250), width=S, head_len=18)
    hand_text(canvas, 800, 1160, "OHD - ADD OPENING", size=32, rotate=-1)
    hand_text(canvas, 800, 1196, "DIMENSIONS", size=32, rotate=2)

    # #9 verify? — parapet detail reference
    hand_oval(d, 1900, 160, 70, 30, width=ST, jitter=4)
    hand_text(canvas, 1820, 80, "verify?", size=38, rotate=-3)

    # #10 ?? — near east corner south elevation
    hand_oval(d, 2100, 1540, 45, 25, width=ST, jitter=3)
    hand_text(canvas, 2160, 1460, "??", size=70, rotate=8)

    # Reviewer stamp
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
