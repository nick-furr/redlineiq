"""Render thumbnail grid for all pages in a source PDF."""
import sys
import fitz
from PIL import Image
from pathlib import Path

SOURCE_DIR = Path(__file__).parent / "source"
THUMB_W = 400

def thumb_pdf(pdf_path):
    doc = fitz.open(str(pdf_path))
    out_dir = Path(__file__).parent / "previews" / pdf_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n{pdf_path.name} — {doc.page_count} pages")
    for i in range(doc.page_count):
        page = doc[i]
        scale = THUMB_W / page.rect.width
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat)
        out = out_dir / f"page_{i+1:02d}.png"
        pix.save(str(out))
        print(f"  page {i+1:>2d} -> {out.name}")
    doc.close()

for pdf in sorted(SOURCE_DIR.glob("*.pdf")):
    thumb_pdf(pdf)

print("\nDone. Check evals/synthetic/previews/")
