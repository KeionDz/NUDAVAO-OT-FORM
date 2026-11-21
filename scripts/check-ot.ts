/**
 * npm run check:ot — the overtime rules, the parsers and the PDF, end to end.
 *
 * The two real cases are the ones this system was built from: the September
 * 2026 biometric export (filed as 7 days, 12 hrs and 47 mins) and the November
 * 2026 DTR sheet. If either total moves, a rule changed — find out why before
 * touching the expected value.
 *
 * Writes .check/sample.pdf, .check/continued.pdf and .check/signed.pdf to look at.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { buildFormData, EMPTY_PROFILE } from '../src/lib/buildForm';
import { fillOtForm } from '../src/lib/fillForm';
import {
  DEFAULT_SETTINGS, evaluate, evaluateAll, newId, totalsOf, type DayRecord,
} from '../src/lib/overtime';
import { parseBiometricItems, recordsFromPunches, type Punch } from '../src/lib/parseBiometric';
import { parsePastedSheet } from '../src/lib/parsePaste';
import { formatDuration, formatTime12, parseDate, parseTime } from '../src/lib/time';

let failures = 0;
function eq<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     expected ${JSON.stringify(expected)}\n     actual   ${JSON.stringify(actual)}`}`);
}

// ---------------------------------------------------------------- time
eq('parse 8:30 AM', parseTime('8:30 AM'), 510);
eq('parse 5:30pm', parseTime('5:30pm'), 1050);
eq('parse 12:30 PM', parseTime('12:30 PM'), 750);
eq('parse 12:05 AM', parseTime('12:05 AM'), 5);
eq('parse 17:55', parseTime('17:55'), 1075);
eq('parse 08:05:00', parseTime('08:05:00'), 485);
eq('reject 25:00', parseTime('25:00'), null);
eq('reject text', parseTime('REST DAY'), null);
eq('format 1500 wraps', formatTime12(1500), '1:00 AM');
eq('duration 767', formatDuration(767), '12 hrs and 47 mins');
eq('duration 60', formatDuration(60), '1 hr');
eq('duration 61', formatDuration(61), '1 hr and 1 min');
eq('duration 45', formatDuration(45), '45 mins');
eq('date 11/04/2026', parseDate('11/04/2026', 2026), '2026-11-04');
eq('date Nov 4', parseDate('Nov 4', 2026), '2026-11-04');
eq('date 4-Nov', parseDate('4-Nov', 2026), '2026-11-04');
eq('date Wed, Nov 4, 2026', parseDate('Wed, Nov 4, 2026', 2026), '2026-11-04');

// ---------------------------------------------------------------- the threshold
const day = (date: string, out: string): DayRecord => ({
  id: newId(), date, dayType: 'ordinary', timeIn: 8 * 60, timeOut: parseTime(out)!,
});
eq('6:29 PM is 59 min, not OT', evaluate(day('2026-09-23', '18:29'), DEFAULT_SETTINGS).status, 'under');
eq('6:30 PM is exactly 1 hr, not OT', evaluate(day('2026-09-23', '18:30'), DEFAULT_SETTINGS).status, 'under');
eq('6:31 PM is OT in full', [evaluate(day('2026-09-23', '18:31'), DEFAULT_SETTINGS)].map((e) => [e.status, e.minutes]), [['ot', 61]]);
eq('late Saturday is possible, not ticked', [evaluate(day('2026-09-26', '15:16'), DEFAULT_SETTINGS)].map((e) => [e.status, e.included]), [['saturday', false]]);
eq('…unless Saturdays count', evaluate(day('2026-09-26', '15:16'), { ...DEFAULT_SETTINGS, countSaturdays: true }).included, true);
eq('past midnight + night diff', [evaluate(day('2026-09-23', '01:30'), DEFAULT_SETTINGS)].map((e) => [e.minutes, e.ndMinutes]), [[480, 210]]);

// ---------------------------------------------------------------- September (biometric)
// [day, first in, last out] from Transaction_2026-09-01_2026-09-30.pdf
const SEPT: Array<[number, string, string]> = [
  [1, '09:50', '17:51'], [2, '08:19', '17:46'], [3, '08:04', '17:44'], [4, '08:01', '17:55'],
  [5, '08:09', '13:08'], [7, '08:11', '17:49'], [8, '08:35', '18:06'], [9, '08:32', '18:04'],
  [10, '08:15', '18:08'], [11, '08:19', '18:02'], [12, '08:12', '12:32'], [14, '08:37', '17:50'],
  [15, '08:13', '18:36'], [16, '08:24', '18:39'], [17, '07:59', '18:49'], [18, '08:15', '19:14'],
  [19, '08:02', '12:34'], [21, '07:40', '19:46'], [22, '08:04', '20:08'], [23, '08:01', '18:29'],
  [24, '08:22', '18:06'], [25, '07:57', '20:05'], [26, '07:51', '15:16'], [28, '08:20', '16:35'],
  [29, '08:04', '18:04'], [30, '08:13', '18:15'],
];
const septPunches: Punch[] = SEPT.flatMap(([d, inn, out]) => [
  { date: `2026-09-${String(d).padStart(2, '0')}`, minutes: parseTime(inn)!, kind: 'in' as const },
  { date: `2026-09-${String(d).padStart(2, '0')}`, minutes: parseTime(out)!, kind: 'out' as const },
]);
// Sept 15 also has a lunch exit and a mid-morning entry; only the LAST out counts.
septPunches.push({ date: '2026-09-15', minutes: parseTime('12:32')!, kind: 'out' });
septPunches.push({ date: '2026-09-15', minutes: parseTime('10:34')!, kind: 'in' });

const sept = evaluateAll(recordsFromPunches(septPunches), DEFAULT_SETTINGS);
const septOt = sept.filter((d) => d.included);
eq('September OT days', septOt.map((d) => d.record.date.slice(8)), ['15', '16', '17', '18', '21', '22', '25']);
eq('September total', formatDuration(totalsOf(sept).total), '12 hrs and 47 mins');
eq('September night diff', totalsOf(sept).ndOrdinary, 0);

// The export's own text order, wrapped and unwrapped.
const items = [
  'Time Period: 2026-09-01 - 2026-09-30', 'JULIANE', 'KYLE DIMZON', '26140', '88', 'NU DAVAO', '-', '-',
  '2026-09-', '15', 'Tuesday', '18:36', 'Check Out', 'BIOMETRIC 6_Door_1-', 'Cardreader 01',
  '2026-09-', '15', 'Tuesday', '12:32', 'Check Out', 'BIOMETRIC 3_Door_1-',
  '2026-09-', '15', 'Tuesday', '08:13', 'Check In', 'BIOMETRIC 6_Door_1-',
  '2026-09-23', 'Wednesday', '18:29', 'Check Out',
];
const bio = parseBiometricItems(items);
eq('biometric period', bio.period, { from: '2026-09-01', to: '2026-09-30' });
eq('biometric punches', bio.punches.length, 4);
eq('biometric last out wins', bio.records.map((r) => [r.date, r.timeIn, r.timeOut]), [
  ['2026-09-15', 493, 1116], ['2026-09-23', undefined, 1109],
]);

// ---------------------------------------------------------------- November (pasted DTR)
const NOV = [
  'REST DAY',
  '8:30 AM\t5:30 PM\tREGULAR HOLIDAY\tREGULAR HOLIDAY',
  '8:30 AM\t5:30 PM\t08:05\t17:55',
  '8:30 AM\t5:30 PM\t08:23\t18:57',
  '8:30 AM\t5:30 PM\t08:32\t18:11',
  '8:30 AM\t5:30 PM\t08:06\t17:51',
  '8:30 AM\t12:30 PM\t08:20\t12:56',
  'REST DAY',
  '8:30 AM\t5:30 PM\t08:21\t17:43',
  '8:30 AM\t5:30 PM\t08:16\t18:50',
  '8:30 AM\t5:30 PM\t08:30\t18:31',
  '8:30 AM\t5:30 PM\t08:03\t18:54',
  '8:30 AM\t5:30 PM\t08:28\t18:33',
  '8:30 AM\t12:30 PM',
].join('\n');
const nov = parsePastedSheet(NOV, '2026-11-01');
eq('November rows', nov.records.length, 14);
const novDays = evaluateAll(nov.records, DEFAULT_SETTINGS);
eq('Nov 1 rest day', [novDays[0].record.date, novDays[0].status], ['2026-11-01', 'off']);
eq('Nov 2 holiday', [novDays[1].record.dayType, novDays[1].status], ['regular_holiday', 'off']);
eq('Nov 14 no time-out yet', [novDays[13].record.date, novDays[13].status], ['2026-11-14', 'no-punch']);
eq('November OT days', novDays.filter((d) => d.included).map((d) => [d.record.date.slice(8), d.minutes]), [
  ['04', 87], ['10', 80], ['11', 61], ['12', 84], ['13', 63],
]);
eq('November total', formatDuration(totalsOf(novDays).total), '6 hrs and 15 mins');

const dated = parsePastedSheet('Date\tIn\tOut\n11/04/2026\t08:23\t18:57\nNov 5, 2026  08:32  18:11', null);
eq('dated rows, header skipped', [dated.records.map((r) => r.date), dated.skipped.length], [['2026-11-04', '2026-11-05'], 1]);
eq('date + time-out only', parsePastedSheet('Nov 4, 2026  18:57\nNov 5, 2026  18:11', null).records.map((r) => [r.date, r.timeIn, r.timeOut]), [
  ['2026-11-04', undefined, 1137], ['2026-11-05', undefined, 1091],
]);
eq('single-space typing', parsePastedSheet('Nov 4 8:30 AM 5:30 PM 08:23 18:57', null).records.map((r) => r.timeOut), [1137]);

// ---------------------------------------------------------------- the filled example form
// Jose Raymund T. Calapuan's August form: 31 hrs and 3 mins. One window is
// before the shift (5:25 AM - 8:30 AM), so it is a manual window.
const EXAMPLE: Array<[string, string, string]> = [
  ['2026-08-17', '17:30', '20:55'], ['2026-08-20', '17:30', '20:21'], ['2026-08-24', '17:30', '18:56'],
  ['2026-08-25', '17:30', '21:40'], ['2026-08-26', '05:25', '08:30'], ['2026-08-26', '17:30', '22:36'],
  ['2026-08-27', '17:30', '22:00'], ['2026-08-28', '17:30', '23:00'], ['2026-08-29', '17:30', '18:30'],
];
const example = evaluateAll(
  EXAMPLE.map(([date, s, e]) => ({ id: newId(), date, dayType: 'ordinary' as const, manual: { start: parseTime(s)!, end: parseTime(e)! } })),
  DEFAULT_SETTINGS,
);
eq('example total matches the filed form', formatDuration(totalsOf(example).total), '31 hrs and 3 mins');

// ---------------------------------------------------------------- the PDF
const template = readFileSync('public/ot-form-template.pdf');
const profile = {
  ...EMPTY_PROFILE,
  name: 'Juan P. Dela Cruz', position: 'ITSO Assistant', department: 'ITSO',
  reason: 'Network maintenance and enrollment system support after office hours',
};
const novTotals = totalsOf(novDays);
const sample = await fillOtForm(
  template,
  buildFormData(profile, { from: '2026-11-01', to: '2026-11-15' }, '2026-11-18', novDays, novTotals),
);
mkdirSync('.check', { recursive: true });
writeFileSync('.check/sample.pdf', sample);
eq('sample is one page', (await PDFDocument.load(sample)).getPageCount(), 1);

const many = evaluateAll(
  Array.from({ length: 14 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`, '19:30')),
  { ...DEFAULT_SETTINGS, countSaturdays: true },
);
const manyData = buildFormData(profile, { from: '2026-10-01', to: '2026-10-14' }, '2026-10-15', many, totalsOf(many));
eq('14 days → rows', manyData.rows.length, 12); // two Sundays are rest days
const continued = await fillOtForm(template, manyData);
writeFileSync('.check/continued.pdf', continued);
eq('12 rows → continuation page', (await PDFDocument.load(continued)).getPageCount(), 2);

// ---------------------------------------------------------------- signatures
// Two synthetic "signatures" (a navy wave and a blue ring) as transparent
// PNGs, the same shape lib/signature.ts produces in the browser.
const signed = await fillOtForm(template, {
  ...buildFormData(profile, { from: '2026-11-01', to: '2026-11-15' }, '2026-11-18', novDays, novTotals),
  signatures: {
    requestor: pngOf(240, 70, (x, y) => Math.abs(y - 35 - 25 * Math.sin(x / 14)) < 3, [38, 45, 101]),
    superior: pngOf(200, 60, (x, y) => Math.abs(Math.hypot((x - 100) / 3.2, y - 30) - 22) < 2.5, [31, 58, 168]),
  },
});
writeFileSync('.check/signed.pdf', signed);
// A transparent PNG is embedded as an image plus a soft mask (/SMask) for
// its alpha, so each signature adds exactly one /SMask.
const masks = (bytes: Uint8Array) => (Buffer.from(bytes).toString('latin1').match(/\/SMask\s/g) ?? []).length;
eq('both signatures embedded, transparent', masks(signed) - masks(sample), 2);

/** A minimal RGBA PNG: `ink(x, y)` decides which pixels carry `rgb`; the rest are transparent. */
function pngOf(w: number, h: number, ink: (x: number, y: number) => boolean, rgb: [number, number, number]): Uint8Array {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink(x, y)) raw.set([...rgb, 255], y * (w * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
