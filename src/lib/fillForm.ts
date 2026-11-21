import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import {
  COLUMNS, HEADER, HOURS, OTHERS_LABEL, PAGE, ROW_TOPS, ROWS_PER_PAGE,
  SIGNATORIES, SIGNATURE_BOXES, type Box, type Slot,
} from './formLayout';

/**
 * Writes the values onto the blank form and returns the new PDF.
 *
 * The text is drawn into the page itself rather than into form fields — the
 * form has none — so what prints is exactly what shows on screen, and nothing
 * can be "un-filled" by a viewer that ignores annotations.
 *
 * More days than the table's 11 rows continue on another copy of the form;
 * the hours are written once, on page 1, so a continuation sheet can never be
 * misread as a second claim.
 */

export interface FormRow {
  date: string;
  day: string;
  time: string;
}

export interface FormData {
  name: string;
  position: string;
  department: string;
  dateFiled: string;
  periodFrom: string;
  periodTo: string;
  periodYear: string;
  reason: string;
  superior: string;
  hrLead: string;
  rows: FormRow[];
  hours: Partial<Record<keyof typeof HOURS, string>>;
  othersLabel: string;
  /** Transparent PNGs (lib/signature.ts), each placed over its own line. */
  signatures?: Partial<Record<keyof typeof SIGNATURE_BOXES, Uint8Array>>;
}

const INK = rgb(0, 0, 0);

export async function fillOtForm(template: Uint8Array | ArrayBuffer, data: FormData): Promise<Uint8Array> {
  const source = await PDFDocument.load(template);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const pageCount = Math.max(1, Math.ceil(data.rows.length / ROWS_PER_PAGE));
  const pages = await doc.copyPages(source, Array(pageCount).fill(0));
  const signatures: Array<[PDFImage, Box]> = [];
  for (const [who, bytes] of Object.entries(data.signatures ?? {})) {
    if (bytes) signatures.push([await doc.embedPng(bytes), SIGNATURE_BOXES[who as keyof typeof SIGNATURE_BOXES]]);
  }

  pages.forEach((page, index) => {
    doc.addPage(page);
    const put = (text: string, slot: Slot, size = 10, align: 'center' | 'left' = 'center') =>
      draw(page, font, text, slot, size, align);

    put(data.name, HEADER.name);
    put(data.dateFiled, HEADER.dateFiled);
    put(data.position, HEADER.position);
    put(data.department, HEADER.department);
    put(data.periodFrom, HEADER.periodFrom, 9);
    put(data.periodTo, HEADER.periodTo, 9);
    put(data.periodYear, HEADER.periodYear, 9);

    const [line1, line2] = wrapReason(data.reason, font, 10);
    put(line1, HEADER.reason1, 10, 'left');
    put(line2, HEADER.reason2, 10, 'left');

    const rows = data.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE);
    rows.forEach((row, i) => {
      const y = (ROW_TOPS[i] + ROW_TOPS[i + 1]) / 2 + 3;
      put(row.date, { ...COLUMNS.date, y }, 8.5);
      put(row.day, { ...COLUMNS.day, y }, 8.5);
      put(row.time, { ...COLUMNS.time, y }, 8.5);
    });

    if (index === 0) {
      for (const [key, value] of Object.entries(data.hours)) {
        if (value) put(value, HOURS[key as keyof typeof HOURS], key === 'total' ? 9.5 : 8.5);
      }
      if (data.othersLabel && data.hours.others) put(data.othersLabel, OTHERS_LABEL, 9, 'left');
    } else {
      put(`Continued - page ${index + 1} of ${pageCount}; totals on page 1`, HOURS.total, 7.5);
    }

    put(data.name, SIGNATORIES.requestor, 10.5);
    put(data.superior, SIGNATORIES.superior, 10.5);
    put(data.hrLead, SIGNATORIES.hrLead, 10.5);
    put(data.dateFiled, SIGNATORIES.preparedDate, 9.5, 'left');

    for (const [image, box] of signatures) placeSignature(page, image, box);
  });

  return doc.save();
}

/** Fits a signature inside its box, keeping its shape, centred on the line. */
function placeSignature(page: PDFPage, image: PDFImage, box: Box) {
  const scale = Math.min((box.x1 - box.x0) / image.width, (box.bottom - box.top) / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, {
    x: (box.x0 + box.x1) / 2 - w / 2,
    y: PAGE.height - box.bottom + (box.bottom - box.top - h) / 2,
    width: w,
    height: h,
  });
}

/** Draws one value in its blank, shrinking the type until it fits. */
function draw(
  page: PDFPage, font: PDFFont, text: string, slot: Slot, size: number, align: 'center' | 'left',
) {
  const value = toWinAnsi(text.trim());
  if (!value) return;
  const room = slot.x1 - slot.x0 - 2;
  let s = size;
  while (font.widthOfTextAtSize(value, s) > room && s > 5.5) s -= 0.25;
  const width = font.widthOfTextAtSize(value, s);
  const x = align === 'center' ? (slot.x0 + slot.x1) / 2 - width / 2 : slot.x0 + 1;
  page.drawText(value, { x, y: PAGE.height - slot.y, size: s, font, color: INK });
}

/**
 * The built-in Helvetica only encodes Latin-1 (WinAnsi). Ñ and é are fine —
 * which covers Filipino names — but a pasted smart quote or an emoji would
 * make pdf-lib throw and the whole form fail, so those are folded first.
 */
function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * The reason gets the short blank after "Reason/s:" and then the full line
 * under it. Words fill the first, the rest go to the second (where `draw`
 * shrinks them if they still do not fit).
 */
function wrapReason(reason: string, font: PDFFont, size: number): [string, string] {
  const words = toWinAnsi(reason).trim().split(/\s+/).filter(Boolean);
  const room = HEADER.reason1.x1 - HEADER.reason1.x0 - 2;
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (font.widthOfTextAtSize(next, size) > room) break;
    first = next;
  }
  return [first, words.slice(i).join(' ')];
}
