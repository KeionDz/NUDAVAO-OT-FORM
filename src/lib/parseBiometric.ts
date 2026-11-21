import { newId, type DayRecord } from './overtime';
import { isoDate } from './time';

/**
 * Reads the "Transaction" report the campus biometric system exports
 * (Export → Transaction, one row per swipe).
 *
 * The PDF's cells wrap, so a single swipe arrives as text pieces in this
 * order: "2026-09-" · "30" · "Wednes" · "day" · "18:15" · "Check Out". This
 * walks the pieces in order instead of trying to rebuild rows from
 * coordinates — the order is stable even when the wrapping is not, and an
 * unwrapped "2026-09-30" reads just as well.
 *
 * Takes plain strings so it runs the same in the browser and in the checks.
 */

export interface Punch {
  date: string;
  minutes: number;
  kind: 'in' | 'out';
}

export interface BiometricResult {
  records: DayRecord[];
  punches: Punch[];
  /** The report's own "Time Period", when it prints one. */
  period?: { from: string; to: string };
}

export function parseBiometricItems(items: string[]): BiometricResult {
  const punches: Punch[] = [];
  let datePrefix: { y: number; m: number } | null = null;
  let date: string | null = null;
  let time: number | null = null;

  for (const raw of items) {
    const s = raw.trim();
    if (!s) continue;

    const full = s.match(/^(\d{4})-(\d{2})-(\d{1,2})$/);
    if (full) {
      date = isoDate(Number(full[1]), Number(full[2]), Number(full[3]));
      datePrefix = null;
      time = null;
      continue;
    }
    const prefix = s.match(/^(\d{4})-(\d{2})-$/);
    if (prefix) {
      datePrefix = { y: Number(prefix[1]), m: Number(prefix[2]) };
      date = null;
      time = null;
      continue;
    }
    if (datePrefix && /^\d{1,2}$/.test(s)) {
      date = isoDate(datePrefix.y, datePrefix.m, Number(s));
      datePrefix = null;
      continue;
    }
    const t = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (date && t) {
      time = Number(t[1]) * 60 + Number(t[2]);
      continue;
    }
    const check = s.match(/^Check\s*(In|Out)$/i);
    if (check && date && time !== null) {
      punches.push({ date, minutes: time, kind: check[1].toLowerCase() === 'in' ? 'in' : 'out' });
      date = null;
      time = null;
    }
  }

  const joined = items.join(' ');
  const p = joined.match(/Time Period:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);

  return {
    records: recordsFromPunches(punches),
    punches,
    period: p ? { from: p[1], to: p[2] } : undefined,
  };
}

/**
 * One record per day: the first time-in and the LAST time-out. A mid-day
 * "Check Out" at lunch (12:32) and a "Check In" after it are ordinary in this
 * export; only the day's final exit decides overtime.
 */
export function recordsFromPunches(punches: Punch[]): DayRecord[] {
  const byDate = new Map<string, Punch[]>();
  for (const p of punches) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }

  return [...byDate.keys()].sort().map((date) => {
    const list = byDate.get(date)!;
    const ins = list.filter((p) => p.kind === 'in').map((p) => p.minutes);
    const outs = list.filter((p) => p.kind === 'out').map((p) => p.minutes);
    // A missing swipe stays missing rather than being guessed from the other
    // one: a time-out standing in for the time-in would look like a real entry.
    const timeIn = ins.length ? Math.min(...ins) : undefined;
    const timeOut = outs.length ? Math.max(...outs) : undefined;
    return { id: newId(), date, dayType: 'ordinary' as const, timeIn, timeOut };
  });
}
