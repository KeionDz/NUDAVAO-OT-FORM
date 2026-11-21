/**
 * Where each value goes on DVO-ADM-HRO-F-001 (Version 2026).
 *
 * Measured from the form's own drawing — the underscores, table rules and
 * signature lines in `public/ot-form-template.pdf` — in points, TOP-DOWN (the
 * way the PDF was measured; fillForm.ts flips to PDF's bottom-up space).
 * `x0`/`x1` is the blank's width, `y` the text baseline.
 *
 * A new revision of the form means re-measuring these, nothing else.
 */

export interface Slot {
  x0: number;
  x1: number;
  y: number;
}

export const PAGE = { width: 595.4, height: 841.8 };

export const HEADER = {
  name: { x0: 133.8, x1: 270.6, y: 191.6 },
  dateFiled: { x0: 384.5, x1: 521.3, y: 191.6 },
  position: { x0: 133.8, x1: 270.8, y: 205.0 },
  department: { x0: 384.3, x1: 521.1, y: 205.0 },
  periodFrom: { x0: 109.6, x1: 164.6, y: 240.4 },
  periodTo: { x0: 177.6, x1: 227.5, y: 240.4 },
  /** The blank after the printed "20". */
  periodYear: { x0: 243.5, x1: 262.4, y: 240.4 },
  reason1: { x0: 350.3, x1: 541.9, y: 241.0 },
  reason2: { x0: 302.3, x1: 543.2, y: 258.4 },
} satisfies Record<string, Slot>;

/** Top edge of each data row, plus the bottom of the last one: 11 rows. */
export const ROW_TOPS = [271.1, 285.1, 298.9, 312.9, 326.9, 340.7, 354.7, 368.5, 382.5, 396.5, 410.3, 424.1];
export const ROWS_PER_PAGE = ROW_TOPS.length - 1;

export const COLUMNS = {
  date: { x0: 42.0, x1: 124.8 },
  day: { x0: 125.2, x1: 207.9 },
  time: { x0: 208.3, x1: 290.9 },
};

export const HOURS = {
  ordinary: { x0: 476.5, x1: 547.6, y: 289.8 },
  ndOrdinary: { x0: 476.9, x1: 548.1, y: 303.2 },
  sunday: { x0: 476.1, x1: 547.3, y: 316.6 },
  excessSunday: { x0: 475.1, x1: 546.4, y: 330.0 },
  legal: { x0: 475.5, x1: 546.5, y: 343.4 },
  ndLegal: { x0: 475.8, x1: 547.1, y: 357.0 },
  special: { x0: 476.3, x1: 547.4, y: 370.4 },
  ndSpecial: { x0: 476.6, x1: 547.7, y: 383.8 },
  others: { x0: 476.8, x1: 547.9, y: 397.2 },
  total: { x0: 408.5, x1: 523.5, y: 424.2 },
} satisfies Record<string, Slot>;

/** Free space after the printed "Others:" for what the hours are. */
export const OTHERS_LABEL: Slot = { x0: 338.0, x1: 472.0, y: 397.2 };

export const SIGNATORIES = {
  requestor: { x0: 45.5, x1: 199.75, y: 474.0 },
  superior: { x0: 220.45, x1: 374.7, y: 474.0 },
  hrLead: { x0: 393.85, x1: 548.1, y: 474.0 },
  /** After the printed "Date:" in the Prepared-by column. */
  preparedDate: { x0: 66.0, x1: 205.0, y: 500.4 },
} satisfies Record<string, Slot>;

export interface Box {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

/**
 * Where a signature image sits: above each signature line, from under the
 * grey "Prepared by / Approved by" band (449.7) to just past the line
 * (476.5), so it overlaps the printed name the way a pen signature does.
 */
export const SIGNATURE_BOXES = {
  requestor: { x0: 50, x1: 195, top: 451, bottom: 482 },
  superior: { x0: 225, x1: 370, top: 451, bottom: 482 },
} satisfies Record<string, Box>;
