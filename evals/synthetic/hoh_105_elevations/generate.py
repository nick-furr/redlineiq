"""HOH Warehouse — Sheet 105 Elevations. Page 10 of hoh_warehouse_merchant_street.pdf."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "hoh_warehouse_merchant_street.pdf"
SOURCE_PAGE = 10  # Sheet 105 Elevations
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
    # Layout: south top (y=50-430), east mid-left + west mid-right (y=440-820),
    # north bottom (y=830-1580). Margins are tight - put text in nearest blank space
    # and draw arrow FROM oval TO end of text line (c301 pattern).
    random.seed(19)
    d = ImageDraw.Draw(canvas, "RGBA")

    # #1 Bldg height missing on ALL elevations - oval on left edge of south elev
    # Text in upper-left margin
    hand_oval(d, 180, 240, 70, 30, width=S, jitter=3)
    hand_text(canvas, 290, 20, "ADD BLDG HT DIM.", size=26, rotate=-1)
    hand_text(canvas, 290, 50, "(ALL ELEVS) - PERMIT", size=26, rotate=1)
    hand_arrow(d, (200, 215), (470, 80), width=S, head_len=16)

    # #2 Man door header 7'-0" - text in top margin between elevs, strikeout existing dim
    hand_oval(d, 970, 310, 55, 30, width=S, jitter=3)
    hand_strikeout(d, (1010, 240), (1180, 240), width=S)
    hand_text(canvas, 800, 20, "DR HDR 7'-0\" - MIN", size=26, rotate=-1)
    hand_text(canvas, 800, 50, "7'-4\" IBC 1010.1.1", size=26, rotate=1)
    hand_arrow(d, (995, 285), (1000, 85), width=S, head_len=16)

    # #3 Roof pitch not labeled - oval on roof slope, text in right area of top margin
    hand_oval(d, 1500, 130, 100, 30, width=ST, jitter=3)
    hand_text(canvas, 1380, 20, "ADD PITCH CALLOUT", size=26, rotate=-1)
    hand_text(canvas, 1380, 50, "(~4:12)", size=26, rotate=2)
    hand_arrow(d, (1500, 115), (1500, 85), width=ST, head_len=16)

    # #6 Metal panel mfr/type/color not specified - oval on panel area south elev
    hand_oval(d, 2050, 220, 110, 35, width=ST, jitter=3)
    hand_text(canvas, 1800, 20, "SPEC PANEL MFR,", size=26, rotate=-1)
    hand_text(canvas, 1800, 50, "TYPE & COLOR", size=26, rotate=1)
    hand_arrow(d, (2000, 200), (1980, 85), width=ST, head_len=16)

    # #7 Wainscot label 4'-0" but graphic ~3'-6" - oval at wall base south elev
    # Text in narrow gap between south elev and east/west (y=440)
    hand_oval(d, 550, 390, 55, 25, width=S, jitter=3)
    hand_text(canvas, 30, 445, "WAINSCOT - LABEL 4'-0\" / GRAPHIC 3'-6\" ?", size=26, rotate=-1)
    hand_arrow(d, (520, 400), (260, 470), width=S, head_len=16)

    # #8 Overhead door opening not dimensioned - oval around OHD area south elev
    # Text below south elev in gap
    hand_oval(d, 1180, 340, 120, 50, width=S, jitter=3)
    hand_text(canvas, 1320, 445, "OHD - ADD OPENING DIMS", size=26, rotate=-1)
    hand_arrow(d, (1240, 390), (1500, 460), width=S, head_len=16)

    # #10 ?? - bare ambiguous mark at east corner of south elev (right side)
    hand_oval(d, 2400, 400, 45, 25, width=ST, jitter=3)
    hand_text(canvas, 2440, 300, "??", size=70, rotate=8)

    # #4 Window sill height missing on WEST elev (mid-right)
    # Oval on window of west elev, text in narrow gap between west and north
    hand_oval(d, 1750, 640, 60, 30, width=ST, jitter=3)
    hand_text(canvas, 1320, 830, "ADD SILL HT DIM. - EGRESS ANALYSIS", size=26, rotate=-1)
    hand_arrow(d, (1750, 670), (1620, 830), width=ST, head_len=16)

    # #9 verify? - bare ambiguous mark near parapet of north elev (top edge)
    hand_oval(d, 1900, 880, 70, 30, width=ST, jitter=4)
    hand_text(canvas, 1830, 830, "verify?", size=36, rotate=-3)

    # #5 Finish grade north elev - verify matches C-401
    # Oval on grade line area at bottom of north elev, text in bottom margin
    hand_oval(d, 1100, 1500, 150, 25, width=S, jitter=3)
    hand_text(canvas, 280, 1595, "FG LINE - VERIFY MATCHES C-401", size=26, rotate=-1)
    hand_arrow(d, (1050, 1525), (820, 1605), width=S, head_len=16)

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
