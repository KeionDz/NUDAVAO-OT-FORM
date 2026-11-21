import { newId, type DayRecord, type DayType } from './overtime';
import { addDays, parseDate, parseTime } from './time';

/**
 * Reads rows copied straight out of a timesheet in Excel or Google Sheets.
 *
 * The DTR sheet this was built against looks like:
 *
 *   REST DAY
 *   8:30 AM   5:30 PM   REGULAR HOLIDAY   REGULAR HOLIDAY
 *   8:30 AM   5:30 PM   08:05             17:55
 *   8:30 AM  12:30 PM   08:20             12:56
 *   8:30 AM  12:30 PM
 *
 * i.e. schedule in, schedule out, time in, time out — one line per calendar
 * day, rest days included, and often NO date column. So every non-blank line
 * is one day, and when a line has no date of its own it takes the date after
 * the previous line's (the first line takes `firstDate`).
 *
 * What a line's times mean depends on the SHEET, not just the line. In a
 * four-column sheet the last line above has two times and they are the
 * schedule of a day not yet worked; in a sheet that only ever has two
 * columns, two times are the time in and out. So lines are read first and
 * interpreted after:
 *
 *   four-column sheet:  4 → sched in, sched out, in, out
 *                       3 → sched in, sched out, in (no time-out yet)
 *                       2 → the schedule only
 *   narrower sheet:     2+ → first is time in, last is time out
 *                       1  → the time out ("Nov 4   18:57")
 */

export interface PasteResult {
  records: DayRecord[];
  /** Lines that looked like a day but could not be dated. */
  undated: number;
  skipped: string[];
}

interface Line {
  date: string | null;
  times: number[];
  dayType: DayType;
}

export function parsePastedSheet(text: string, firstDate: string | null): PasteResult {
  const skipped: string[] = [];
  const fallbackYear = Number((firstDate ?? new Date().toISOString()).slice(0, 4));

  const lines: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cells = splitCells(raw);
    if (cells.length === 0) continue;
    const line = readLine(cells, fallbackYear);
    // A header row ("Date  Time In  Time Out") or a stray note: no time, no
    // day marker, no date. It is not a calendar day, so it does not advance
    // the date either.
    if (line.times.length === 0 && line.dayType === 'ordinary' && !line.date) {
      skipped.push(raw.trim());
      continue;
    }
    lines.push(line);
  }

  const fourColumn = lines.some((l) => l.times.length >= 4);
  const records: DayRecord[] = [];
  let undated = 0;
  let nextDate = firstDate;

  for (const line of lines) {
    let date = line.date;
    if (!date) {
      if (!nextDate) {
        undated += 1;
        continue;
      }
      date = nextDate;
    }
    nextDate = addDays(date, 1);

    const record: DayRecord = { id: newId(), date, dayType: line.dayType };
    const t = line.times;
    if (fourColumn) {
      if (t.length >= 2) record.schedOut = t[1];
      if (t.length >= 3) record.timeIn = t[2];
      if (t.length >= 4) record.timeOut = t[3];
    } else if (t.length >= 2) {
      record.timeIn = t[0];
      record.timeOut = t[t.length - 1];
    } else if (t.length === 1) {
      record.timeOut = t[0];
    }
    records.push(record);
  }

  return { records, undated, skipped };
}

function readLine(cells: string[], fallbackYear: number): Line {
  let date: string | null = null;
  const times: number[] = [];
  let dayType: DayType = 'ordinary';

  for (const whole of cells) {
    const t = parseTime(whole);
    if (t !== null) {
      times.push(t);
      continue;
    }
    // Several times in one cell ("8:30 AM 5:30 PM 08:05 17:55" typed with
    // single spaces): take each, then read what is left for a date or marker.
    const found = whole.match(TIME_IN_TEXT) ?? [];
    for (const f of found) {
      const ft = parseTime(f);
      if (ft !== null) times.push(ft);
    }
    const cell = found.length ? whole.replace(TIME_IN_TEXT, ' ').trim() : whole;
    if (!cell) continue;

    const d: string | null = date ? null : parseDate(cell, fallbackYear);
    if (d) {
      date = d;
      continue;
    }
    const upper = cell.toUpperCase();
    if (/REST\s*DAY|\bDAY\s*OFF\b/.test(upper)) dayType = 'restday';
    else if (/SPECIAL/.test(upper) && /HOLI/.test(upper)) dayType = 'special_holiday';
    else if (/HOLI/.test(upper) && dayType === 'ordinary') dayType = 'regular_holiday';
  }
  return { date, times, dayType };
}

const TIME_IN_TEXT = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?\s*[Mm]\.?)?/g;

/** Tabs from a spreadsheet copy; runs of 2+ spaces from a typed or PDF copy. */
function splitCells(line: string): string[] {
  const parts = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
  return parts.map((c) => c.trim()).filter(Boolean);
}
