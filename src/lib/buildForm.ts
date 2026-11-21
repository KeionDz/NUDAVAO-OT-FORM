import type { FormData } from './fillForm';
import type { Evaluated, Totals } from './overtime';
import { dayName, formatDuration, formatLongDate, formatShortDate, formatTime12 } from './time';

export interface Profile {
  name: string;
  position: string;
  department: string;
  reason: string;
  superior: string;
  hrLead: string;
}

export const EMPTY_PROFILE: Profile = {
  name: '', position: '', department: '', reason: '', superior: '', hrLead: '',
};

export interface Period {
  from: string;
  to: string;
}

/** What the person sees on screen and what gets printed are the same strings. */
export function buildFormData(
  profile: Profile, period: Period, dateFiled: string, days: Evaluated[], totals: Totals,
): FormData {
  const rows = days
    .filter((d) => d.included && d.start !== undefined && d.end !== undefined)
    .map((d) => ({
      date: d.record.date,
      day: dayName(d.record.date),
      time: `${formatTime12(d.start!)} - ${formatTime12(d.end!)}`,
    }));

  const h = (minutes: number) => (minutes > 0 ? formatDuration(minutes) : '');

  return {
    name: profile.name,
    position: profile.position,
    department: profile.department,
    dateFiled: dateFiled ? formatLongDate(dateFiled) : '',
    periodFrom: period.from ? formatShortDate(period.from) : '',
    periodTo: period.to ? formatShortDate(period.to) : '',
    // The form prints "20" and leaves the last two digits blank.
    periodYear: (period.to || period.from).slice(2, 4),
    reason: profile.reason,
    superior: profile.superior,
    hrLead: profile.hrLead,
    rows,
    hours: {
      ordinary: h(totals.ordinary),
      ndOrdinary: h(totals.ndOrdinary),
      sunday: h(totals.sunday),
      excessSunday: h(totals.excessSunday),
      legal: h(totals.legal),
      ndLegal: h(totals.ndLegal),
      special: h(totals.special),
      ndSpecial: h(totals.ndSpecial),
      others: h(totals.ndSunday),
      total: h(totals.total),
    },
    othersLabel: totals.ndSunday > 0 ? 'Sunday night diff' : '',
  };
}

/** "OT Form - Dimzon - November 2026.pdf" */
export function fileNameFor(profile: Profile, monthYear: string): string {
  const surname = profile.name.trim().split(/\s+/).pop() ?? '';
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim();
  return ['OT Form', safe(surname), safe(monthYear)].filter(Boolean).join(' - ') + '.pdf';
}
