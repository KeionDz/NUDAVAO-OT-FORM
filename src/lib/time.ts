/**
 * Times are minutes after midnight (8:30 PM = 1230) and dates are ISO strings
 * ("2026-11-04"). Plain numbers and strings keep the overtime rules free of
 * time-zone surprises: nothing here ever builds a local Date, so a laptop set
 * to another zone computes the same hours.
 */

export const DAY_MINUTES = 24 * 60;

/** "8:30 AM", "5:30pm", "17:55", "08:05:00" → minutes. Null when it is not a time. */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])\.?\s*[Mm]?\.?$/) ??
    text.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  const meridiem = m[3]?.toUpperCase();
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === 'A' && h === 12) h = 0;
    if (meridiem === 'P' && h !== 12) h += 12;
  } else if (h > 23) {
    return null;
  }
  return h * 60 + min;
}

/** 1050 → "5:30 PM". Values past midnight wrap (1500 → "1:00 AM"). */
export function formatTime12(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 1050 → "17:30", the value an <input type="time"> takes. */
export function formatTime24(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * 767 → "12 hrs and 47 mins", the wording on the filled example form.
 * Singular where it reads that way: "1 hr", "1 min".
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hrs = `${h} ${h === 1 ? 'hr' : 'hrs'}`;
  const mins = `${m} ${m === 1 ? 'min' : 'mins'}`;
  if (h === 0) return mins;
  if (m === 0) return hrs;
  return `${hrs} and ${mins}`;
}

/** Short "1h 07m" for dense table cells. */
export function formatDurationShort(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

// ---------------------------------------------------------------- dates

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** AP-style abbreviations, matching how the September form was filed ("Sept. 1"). */
const MONTHS_SHORT = [
  'Jan.', 'Feb.', 'March', 'April', 'May', 'June',
  'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayName(iso: string): string {
  return DAYS[weekday(iso)];
}

/** "2026-11-01" → "Nov. 1" */
export function formatShortDate(iso: string): string {
  const [, m, d] = parts(iso);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

/** "2026-11-18" → "November 18, 2026" */
export function formatLongDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-11-18" → "November 2026" */
export function formatMonthYear(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Today in the browser's own calendar, as an ISO date. */
export function todayIso(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Reads the date formats a timesheet tends to hold: "2026-11-04",
 * "11/04/2026" (month first, as Excel shows it in the Philippines), "Nov 4, 2026",
 * "November 4", "4-Nov", "04-Nov-26". A missing year comes from `fallbackYear`.
 */
export function parseDate(text: string, fallbackYear: number): string | null {
  const t = text.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return checked(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return checked(fullYear(m[3]), Number(m[1]), Number(m[2]));

  // "Nov 4 2026", "November 4", "Wed Nov 4"
  m = t.match(/^(?:[A-Za-z]{3,9}\.? )?([A-Za-z]{3,9})\.? (\d{1,2})(?: (\d{4}))?$/);
  if (m) {
    const month = monthIndex(m[1]);
    if (month) return checked(m[3] ? Number(m[3]) : fallbackYear, month, Number(m[2]));
  }

  // "4-Nov", "04-Nov-26", "4 Nov 2026"
  m = t.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})\.?(?:[- ](\d{2}|\d{4}))?$/);
  if (m) {
    const month = monthIndex(m[2]);
    if (month) return checked(m[3] ? fullYear(m[3]) : fallbackYear, month, Number(m[1]));
  }
  return null;
}

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

function monthIndex(name: string): number | null {
  const key = name.slice(0, 3).toLowerCase();
  const i = MONTHS.findIndex((mo) => mo.slice(0, 3).toLowerCase() === key);
  return i === -1 ? null : i + 1;
}

function checked(y: number, m: number, d: number): string | null {
  const iso = isoDate(y, m, d);
  return isValidIso(iso) ? iso : null;
}
