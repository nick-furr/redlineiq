"""C-501 Utility Plan — redline overlay generator. Bohler page 6."""
import io, random, sys
from pathlib import Path
import fitz
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
SOURCE_PDF = HERE.parent / "source" / "bohler_walpole.pdf"
SOURCE_PAGE = 6
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
    random.seed(13)
    d = ImageDraw.Draw(canvas, "RGBA")

    # #1 Sanitary pipe undersized — 8" shown, 10" required per flow calcs
    hand_oval(d, 1800, 1600, 200, 35, width=STROKE, jitter=4)
    hand_arrow(d, (1800, 1565), (1500, 1350), width=STROKE, head_len=28)
    hand_text(canvas, 900, 1200, "8\" SAN. - UNDERSIZED", size=52, rotate=-1)
    hand_text(canvas, 900, 1265, "CALCS REQ. 10\"", size=52, rotate=1)
    hand_text(canvas, 900, 1330, "FIX PIPE SIZE", size=52, rotate=-2)

    # #2 Water/storm crossing <18" vertical separation
    hand_oval(d, 3100, 2000, 80, 80, width=STROKE, jitter=5)
    hand_arrow(d, (3180, 2000), (3500, 1800), width=STROKE, head_len=28)
    hand_text(canvas, 3450, 1660, "W/STORM XING -", size=50, rotate=-1)
    hand_text(canvas, 3450, 1720, "SHOW 18\" MIN SEP.", size=50, rotate=2)
    hand_text(canvas, 3450, 1780, "OR SLEEVE", size=50, rotate=-1)

    # #3 MH invert error — outgoing higher than incoming (reverse slope)
    hand_oval(d, 2500, 2300, 90, 45, width=STROKE, jitter=4)
    hand_arrow(d, (2500, 2345), (2200, 2550), width=STROKE, head_len=28)
    hand_strikeout(d, (1650, 2590), (2100, 2590), width=STROKE)
    hand_text(canvas, 1600, 2620, "INV OUT > INV IN -", size=50, rotate=-1)
    hand_text(canvas, 1600, 2680, "REVERSE SLOPE !", size=54, rotate=2)

    # #4 Missing cleanout at building service bend
    hand_oval(d, 2900, 2700, 70, 35, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (2970, 2700), (3250, 2550), width=STROKE, head_len=26)
    hand_text(canvas, 3200, 2420, "ADD CO AT BEND", size=50, rotate=-1)
    hand_text(canvas, 3200, 2480, "PER LOCAL CODE", size=50, rotate=1)

    # #5 Fire hydrant too close to curb — 4' shown, 6' min
    hand_oval(d, 4200, 2500, 60, 60, width=STROKE, jitter=4)
    hand_arrow(d, (4140, 2500), (3850, 2350), width=STROKE, head_len=26)
    hand_text(canvas, 3300, 2250, "FH - 4' FROM CURB", size=48, rotate=-1)
    hand_text(canvas, 3300, 2310, "MIN 6' REQD. MOVE", size=48, rotate=2)

    # #6 Domestic service size — verify 1" adequate for unit count
    hand_oval(d, 2100, 2900, 80, 35, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (2100, 2935), (2100, 3100), width=STROKE_THIN, head_len=24)
    hand_text(canvas, 1550, 3120, "VERIFY 1\" DOM. SVC", size=48, rotate=-1)
    hand_text(canvas, 1550, 3180, "FOR UNIT COUNT", size=48, rotate=1)

    # #7 Missing gate valve before building entry
    hand_oval(d, 2700, 2950, 65, 35, width=STROKE, jitter=4)
    hand_arrow(d, (2765, 2950), (3050, 3050), width=STROKE, head_len=26)
    hand_text(canvas, 3000, 3130, "ADD GATE VLV", size=50, rotate=-1)
    hand_text(canvas, 3000, 3190, "BEFORE BLDG ENTRY", size=50, rotate=2)

    # #8 Storm outfall end treatment not specified
    hand_oval(d, 4000, 2900, 120, 50, width=STROKE_THIN, jitter=4)
    hand_arrow(d, (3880, 2900), (3600, 2750), width=STROKE, head_len=26)
    hand_text(canvas, 3050, 2620, "OUTFALL - SPEC", size=50, rotate=-1)
    hand_text(canvas, 3050, 2680, "END TREATMENT", size=50, rotate=1)
    hand_text(canvas, 3050, 2740, "(RIP-RAP / FES?)", size=46, rotate=-2)

    # #9 verify? — ambiguous near force main
    hand_oval(d, 1200, 1100, 100, 40, width=STROKE_THIN, jitter=5)
    hand_text(canvas, 1100, 990, "verify?", size=58, rotate=-3)

    # #10 ?? — ambiguous near NE utility cluster
    hand_oval(d, 3700, 1500, 55, 30, width=STROKE_THIN, jitter=3)
    hand_text(canvas, 3780, 1370, "??", size=100, rotate=6)

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
