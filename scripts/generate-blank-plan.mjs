import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const outDir = path.resolve('scripts/blank-plans');
await fs.mkdir(outDir, { recursive: true });

const W = 17 * 72;
const H = 11 * 72;
const M = 36;

const pdf = await PDFDocument.create();
const page = pdf.addPage([W, H]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

const black = rgb(0, 0, 0);
const grey = rgb(0.55, 0.55, 0.55);
const lightGrey = rgb(0.78, 0.78, 0.78);

page.drawRectangle({ x: M, y: M, width: W - 2 * M, height: H - 2 * M, borderColor: black, borderWidth: 2 });
page.drawRectangle({ x: M + 6, y: M + 6, width: W - 2 * M - 12, height: H - 2 * M - 12, borderColor: black, borderWidth: 0.5 });

const tbX = W - M - 250;
const tbY = M + 6;
const tbW = 244;
const tbH = 150;

page.drawRectangle({ x: tbX, y: tbY, width: tbW, height: tbH, borderColor: black, borderWidth: 1, color: rgb(1, 1, 1) });
page.drawLine({ start: { x: tbX, y: tbY + 110 }, end: { x: tbX + tbW, y: tbY + 110 }, thickness: 0.5, color: black });
page.drawLine({ start: { x: tbX, y: tbY + 70 }, end: { x: tbX + tbW, y: tbY + 70 }, thickness: 0.5, color: black });
page.drawLine({ start: { x: tbX, y: tbY + 40 }, end: { x: tbX + tbW, y: tbY + 40 }, thickness: 0.5, color: black });
page.drawLine({ start: { x: tbX + 120, y: tbY }, end: { x: tbX + 120, y: tbY + 40 }, thickness: 0.5, color: black });

page.drawText('BOHLER ENGINEERING', { x: tbX + 8, y: tbY + tbH - 18, size: 11, font: fontBold });
page.drawText('Civil + Site Engineering', { x: tbX + 8, y: tbY + tbH - 32, size: 7, font: font, color: grey });

page.drawText('KIG SILVERSTRAND WALPOLE LLC', { x: tbX + 8, y: tbY + 95, size: 8, font: fontBold });
page.drawText('Proposed Multi-Family Development', { x: tbX + 8, y: tbY + 84, size: 7, font: font });
page.drawText('981, 989 & 1015 East Street, Walpole MA', { x: tbX + 8, y: tbY + 74, size: 6.5, font: font, color: grey });

page.drawText('GRADING & DRAINAGE PLAN', { x: tbX + 8, y: tbY + 56, size: 10, font: fontBold });
page.drawText('Scale: 1" = 30\'', { x: tbX + 8, y: tbY + 44, size: 7, font: font });

page.drawText('Date: 09/30/2023', { x: tbX + 8, y: tbY + 26, size: 7, font: font });
page.drawText('Rev: 1', { x: tbX + 8, y: tbY + 12, size: 7, font: font });
page.drawText('SHEET', { x: tbX + 132, y: tbY + 26, size: 7, font: font, color: grey });
page.drawText('C-401', { x: tbX + 130, y: tbY + 8, size: 18, font: fontBold });

const drawArea = { x: M + 12, y: M + 12, w: W - 2 * M - 24 - tbW - 20, h: H - 2 * M - 24 };

const cx = drawArea.x + drawArea.w * 0.45;
const cy = drawArea.y + drawArea.h * 0.55;

page.drawRectangle({ x: cx - 140, y: cy - 60, width: 280, height: 120, borderColor: black, borderWidth: 1.2 });
page.drawText('PROPOSED BUILDING', { x: cx - 75, y: cy + 10, size: 8, font: fontBold, color: grey });
page.drawText('FFE = 142.0', { x: cx - 40, y: cy - 5, size: 7, font: font, color: grey });
page.drawText('3 STORIES', { x: cx - 35, y: cy - 20, size: 6.5, font: font, color: grey });

for (let i = 0; i < 6; i++) {
  const y = drawArea.y + 80 + i * 35;
  const offset = Math.sin(i * 0.7) * 25;
  page.drawLine({ start: { x: drawArea.x + 20, y }, end: { x: drawArea.x + drawArea.w - 20, y: y + offset }, thickness: 0.5, color: lightGrey });
  page.drawText(`${140 + i}`, { x: drawArea.x + 8, y: y - 3, size: 6, font: font, color: grey });
}

const parkX = cx - 140;
const parkY = cy - 220;
page.drawRectangle({ x: parkX, y: parkY, width: 280, height: 110, borderColor: grey, borderWidth: 0.6 });
for (let i = 1; i < 14; i++) {
  page.drawLine({ start: { x: parkX + i * 20, y: parkY }, end: { x: parkX + i * 20, y: parkY + 110 }, thickness: 0.3, color: lightGrey });
}
page.drawLine({ start: { x: parkX, y: parkY + 55 }, end: { x: parkX + 280, y: parkY + 55 }, thickness: 0.4, color: lightGrey });
page.drawText('PARKING FIELD', { x: parkX + 105, y: parkY + 50, size: 7, font: fontBold, color: grey });
page.drawText('48 STALLS', { x: parkX + 115, y: parkY + 38, size: 6, font: font, color: grey });

page.drawLine({ start: { x: drawArea.x + drawArea.w * 0.05, y: drawArea.y + 50 }, end: { x: drawArea.x + drawArea.w * 0.95, y: drawArea.y + 50 }, thickness: 1.5, color: black });
page.drawText('EAST STREET (PUBLIC — 50\' WIDE)', { x: drawArea.x + drawArea.w * 0.4, y: drawArea.y + 35, size: 7, font: fontBold });

const swaleY = drawArea.y + drawArea.h * 0.4;
page.drawLine({ start: { x: drawArea.x + 30, y: swaleY }, end: { x: drawArea.x + 30, y: swaleY + 120 }, thickness: 0.6, color: lightGrey });
page.drawText('GRASS SWALE', { x: drawArea.x + 38, y: swaleY + 55, size: 6.5, font: font, color: grey });
page.drawText('S = 0.4%', { x: drawArea.x + 38, y: swaleY + 42, size: 6, font: font, color: grey });

page.drawLine({ start: { x: drawArea.x + drawArea.w - 60, y: cy + 70 }, end: { x: drawArea.x + drawArea.w - 60, y: cy + 30 }, thickness: 0.4, color: lightGrey });
page.drawText('CB-7', { x: drawArea.x + drawArea.w - 75, y: cy + 75, size: 6, font: font, color: grey });
page.drawText('RIM=141.2', { x: drawArea.x + drawArea.w - 90, y: cy + 22, size: 5.5, font: font, color: grey });

const naX = M + 30;
const naY = H - M - 60;
page.drawCircle({ x: naX, y: naY, size: 18, borderColor: black, borderWidth: 0.8 });
page.drawLine({ start: { x: naX, y: naY - 14 }, end: { x: naX, y: naY + 14 }, thickness: 1.2, color: black });
page.drawText('N', { x: naX - 3, y: naY + 22, size: 9, font: fontBold });

const sbX = M + 12;
const sbY = M + 16;
page.drawRectangle({ x: sbX, y: sbY, width: 120, height: 8, borderColor: black, borderWidth: 0.6 });
page.drawRectangle({ x: sbX, y: sbY, width: 30, height: 8, color: black });
page.drawRectangle({ x: sbX + 60, y: sbY, width: 30, height: 8, color: black });
page.drawText("0", { x: sbX - 2, y: sbY - 10, size: 6, font: font });
page.drawText("30'", { x: sbX + 24, y: sbY - 10, size: 6, font: font });
page.drawText("60'", { x: sbX + 54, y: sbY - 10, size: 6, font: font });
page.drawText("120'", { x: sbX + 110, y: sbY - 10, size: 6, font: font });

const notesX = M + 12;
const notesY = drawArea.y + drawArea.h - 12;
page.drawText('GENERAL NOTES:', { x: notesX, y: notesY, size: 8, font: fontBold });
const notes = [
  '1. ALL ELEVATIONS REFER TO NAVD88.',
  '2. CONTRACTOR TO VERIFY ALL EXISTING UTILITIES PRIOR TO CONSTRUCTION.',
  '3. ALL DISTURBED AREAS TO BE STABILIZED WITH PERMANENT VEGETATION.',
  '4. CATCH BASINS PER MASS DOT STANDARD 201.',
  '5. PAVEMENT SECTIONS PER DETAIL 3/C-901.',
  '6. ADA ACCESSIBLE ROUTES SHALL NOT EXCEED 2.0% CROSS-SLOPE.',
  '7. RETAINING WALLS > 4\'-0\" SHALL BE DESIGNED BY OTHERS.',
  '8. PROVIDE 18" MIN. VERTICAL SEPARATION AT UTILITY CROSSINGS.',
];
notes.forEach((n, i) => {
  page.drawText(n, { x: notesX, y: notesY - 14 - i * 11, size: 6.5, font: font });
});

const outPath = path.join(outDir, 'case_R001_blank_c401_grading.pdf');
const bytes = await pdf.save();
await fs.writeFile(outPath, bytes);
console.log(`✓ ${outPath}`);
console.log(`  ${(bytes.length / 1024).toFixed(1)} KB`);
