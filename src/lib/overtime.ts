import { DAY_MINUTES, weekday } from './time';

/**
 * THE OVERTIME RULES. Every number on the form comes out of this file.
 *
 * The rule as HR applies it to a regular day: overtime runs from the end of the
 * shift (5:30 PM) to the last time-out, and the day only counts when that is
 * MORE than one hour. 6:29 PM is 59 minutes and does not count; 6:31 PM is
 * 61 minutes and counts in full — the threshold decides whether a day
 * qualifies, it is not deducted from it.
 *
 * Saturdays are half days that end at 12:30 PM. The rule above was stated for
 * the 5:30 PM days only, so a late Saturday is surfaced as "possible" and left
 * for the person to tick, unless `countSaturdays` is on.
 *
 * Rest days and holidays have no shift to run past. If someone worked one, the
 * whole time-in → time-out span is that day's hours, but it is never ticked
 * automatically: whether it is claimable is HR's call, not this file's.
 */

export type DayType = 'ordinary' | 'restday' | 'regular_holiday' | 'special_holiday';

export interface DayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  dayType: DayType;
  /** Scheduled shift end, minutes. Missing → the default for that weekday. */
  schedOut?: number;
  timeIn?: number;
  timeOut?: number;
  /**
   * An overtime window typed in directly, for overtime that is not "after the
   * shift" — e.g. the example form's 5:25 AM – 8:30 AM before a shift.
   */
  manual?: { start: number; end: number };
  /** The person's own tick. Undefined means "whatever the rule says". */
  include?: boolean;
}

export interface Settings {
  /** A day must exceed this many minutes past the shift end to count. */
  thresholdMinutes: number;
  weekdayEnd: number;
  saturdayEnd: number;
  countSaturdays: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  thresholdMinutes: 60,
  weekdayEnd: 17 * 60 + 30,
  saturdayEnd: 12 * 60 + 30,
  countSaturdays: false,
};

/** Night differential: 10:00 PM to 6:00 AM (Labor Code, Art. 86). */
const ND_WINDOWS: Array<[number, number]> = [
  [0, 6 * 60],
  [22 * 60, DAY_MINUTES + 6 * 60],
  [DAY_MINUTES + 22 * 60, 2 * DAY_MINUTES + 6 * 60],
];

/** The form's hour lines, in the order they are printed. */
export type Category = 'ordinary' | 'sunday' | 'legal' | 'special';

export type Status =
  | 'ot' // counts under the rule
  | 'under' // left after the shift, but not by more than the threshold
  | 'none' // left on time or early
  | 'saturday' // a late Saturday: possible overtime, not ticked
  | 'worked-off' // punches on a rest day or holiday
  | 'off' // rest day or holiday, nothing worked
  | 'no-punch' // a work day with no time-out
  | 'manual'; // a window typed in by hand

export interface Evaluated {
  record: DayRecord;
  category: Category;
  status: Status;
  /** Overtime window. `end` may exceed 1440 when it runs past midnight. */
  start?: number;
  end?: number;
  minutes: number;
  ndMinutes: number;
  /** What the rule alone decided. */
  auto: boolean;
  /** What goes on the form: the person's tick if they made one, else `auto`. */
  included: boolean;
}

export function defaultShiftEnd(date: string, settings: Settings): number | undefined {
  const wd = weekday(date);
  if (wd === 0) return undefined;
  return wd === 6 ? settings.saturdayEnd : settings.weekdayEnd;
}

function categoryOf(record: DayRecord): Category {
  if (record.dayType === 'regular_holiday') return 'legal';
  if (record.dayType === 'special_holiday') return 'special';
  if (record.dayType === 'restday' || weekday(record.date) === 0) return 'sunday';
  return 'ordinary';
}

function overlap(start: number, end: number, [a, b]: [number, number]): number {
  return Math.max(0, Math.min(end, b) - Math.max(start, a));
}

export function nightMinutes(start: number, end: number): number {
  return ND_WINDOWS.reduce((sum, w) => sum + overlap(start, end, w), 0);
}

/** A time-out earlier than the time-in means the person left after midnight. */
function unwrap(out: number, after: number | undefined): number {
  return after !== undefined && out < after ? out + DAY_MINUTES : out;
}

export function evaluate(record: DayRecord, settings: Settings): Evaluated {
  const category = categoryOf(record);
  const base = { record, category, minutes: 0, ndMinutes: 0, auto: false };

  const finish = (e: Omit<Evaluated, 'included'>): Evaluated => ({
    ...e,
    included: e.minutes > 0 && (record.include ?? e.auto),
  });

  if (record.manual) {
    const { start } = record.manual;
    const end = unwrap(record.manual.end, start);
    return finish({
      ...base,
      status: 'manual',
      start,
      end,
      minutes: end - start,
      ndMinutes: nightMinutes(start, end),
      auto: true,
    });
  }

  const shiftEnd = record.schedOut ?? defaultShiftEnd(record.date, settings);
  const isOffDay = record.dayType !== 'ordinary' || shiftEnd === undefined;

  if (isOffDay) {
    if (record.timeIn === undefined || record.timeOut === undefined) {
      return finish({ ...base, status: 'off' });
    }
    const end = unwrap(record.timeOut, record.timeIn);
    return finish({
      ...base,
      status: 'worked-off',
      start: record.timeIn,
      end,
      minutes: end - record.timeIn,
      ndMinutes: nightMinutes(record.timeIn, end),
    });
  }

  if (record.timeOut === undefined) return finish({ ...base, status: 'no-punch' });

  const end = unwrap(record.timeOut, record.timeIn ?? shiftEnd - 9 * 60);
  const past = end - shiftEnd;
  if (past <= 0) return finish({ ...base, status: 'none' });

  const qualifies = past > settings.thresholdMinutes;
  const saturday = weekday(record.date) === 6 && !settings.countSaturdays;
  return finish({
    ...base,
    status: !qualifies ? 'under' : saturday ? 'saturday' : 'ot',
    start: shiftEnd,
    end,
    minutes: past,
    ndMinutes: nightMinutes(shiftEnd, end),
    auto: qualifies && !saturday,
  });
}

// ---------------------------------------------------------------- totals

export interface Totals {
  ordinary: number;
  ndOrdinary: number;
  sunday: number;
  excessSunday: number;
  legal: number;
  ndLegal: number;
  special: number;
  ndSpecial: number;
  /** Night differential on a Sunday / rest day — the form has no line for it,
   *  so it goes under "Others", as the filled example did ("Sunday night diff"). */
  ndSunday: number;
  total: number;
}

/** Hours beyond eight on a Sunday are "Excess Sunday". */
const SUNDAY_REGULAR = 8 * 60;

/**
 * Night-differential lines are a SUBSET of the day's hours, not extra hours:
 * on the filled example, 1 hour of night differential sits inside the 31 hrs
 * and 3 mins of "Ordinary day", and the total is still 31 hrs and 3 mins. So
 * the total adds the base lines only.
 */
export function totalsOf(days: Evaluated[]): Totals {
  const t: Totals = {
    ordinary: 0, ndOrdinary: 0, sunday: 0, excessSunday: 0, legal: 0,
    ndLegal: 0, special: 0, ndSpecial: 0, ndSunday: 0, total: 0,
  };
  for (const d of days) {
    if (!d.included) continue;
    switch (d.category) {
      case 'ordinary':
        t.ordinary += d.minutes;
        t.ndOrdinary += d.ndMinutes;
        break;
      case 'sunday':
        t.sunday += Math.min(d.minutes, SUNDAY_REGULAR);
        t.excessSunday += Math.max(0, d.minutes - SUNDAY_REGULAR);
        t.ndSunday += d.ndMinutes;
        break;
      case 'legal':
        t.legal += d.minutes;
        t.ndLegal += d.ndMinutes;
        break;
      case 'special':
        t.special += d.minutes;
        t.ndSpecial += d.ndMinutes;
        break;
    }
  }
  t.total = t.ordinary + t.sunday + t.excessSunday + t.legal + t.special;
  return t;
}

export function evaluateAll(records: DayRecord[], settings: Settings): Evaluated[] {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.manual?.start ?? 0) - (b.manual?.start ?? 0))
    .map((r) => evaluate(r, settings));
}

let seq = 0;
export function newId(): string {
  seq += 1;
  return `d${Date.now().toString(36)}${seq}`;
}
