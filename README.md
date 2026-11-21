# OT Form Davao

Fills out the NU Davao **Overtime Authorization Form** (DVO-ADM-HRO-F-001,
Version 2026) and computes the hours, from your attendance.

1. **Your details** — name, position, department, reason. Remembered on this
   device. Plus **signatures**: yours (over your name, above *Requestor*) and,
   optionally, your supervisor's (above *Immediate Superior*). Draw one with
   the mouse, a finger or a stylus, or upload a photo/scan — the white paper
   is removed so only the ink lands on the form. Yours can be remembered on
   this device if you tick it; the supervisor's never is.
2. **Attendance** — any of:
   - the biometric **Transaction PDF** (Export → Transaction),
   - rows **pasted from your DTR sheet** in Excel,
   - **typed in** — create the days for a cutoff and type each time out (for
     when all you have is a picture of the sheet).
3. **Overtime days** — every day, what the rule made of it, and a tick to put
   it on the form or leave it off. Dates, times and day types can be corrected
   here — click a date to change it (Enter to keep, Escape to undo).
4. **No. of hours** — the form's hour lines and total, live. *Fill out the
   form* writes the PDF; preview it and download it.

Everything runs in the browser. Attendance is never uploaded or stored.

## The overtime rule

On a work day, overtime runs from the end of the shift (**5:30 PM**) to the
last time out, and the day counts only when that is **more than 1 hour**:

| Time out | After 5:30 PM | On the form? |
| --- | --- | --- |
| 6:29 PM | 59 min | no |
| 6:30 PM | 1 hr exactly | no |
| 6:31 PM | 1 hr 1 min | yes — 1 hr 1 min |
| 8:08 PM | 2 hr 38 min | yes — 2 hr 38 min |

- **Saturdays** end at 12:30 PM. A late Saturday is shown as *Saturday ·
  claim?* and left unticked unless *Count late Saturdays automatically* is on.
- **Rest days and holidays** with time in and out are shown as *Worked ·
  claim?* — the whole time in → time out — and are never ticked on their own.
- **Night differential** is the part between 10:00 PM and 6:00 AM. It is
  listed on its own line but is part of the day's hours, not added to the
  total — the same way the filled example form shows it.
- A **shift end pasted from the DTR sheet** wins over the defaults for that day.
- Overtime that is not "after the shift" (e.g. 5:25 AM – 8:30 AM) is added by
  hand with *Add overtime by hand*.

The shift ends and the 1-hour threshold can be changed under *Overtime rules*.

Checked against real cases (`npm run check:ot`): September 2026 from the
biometric export → 7 days, **12 hrs and 47 mins**; November 1–14 2026 from the
DTR sheet → 5 days, **6 hrs and 15 mins**; the filled example form → **31 hrs
and 3 mins**.

## Pasting from the DTR sheet

Select the rows in Excel, Ctrl+C, paste. Each non-blank row is one calendar
day — `REST DAY` and `HOLIDAY` rows included — so a sheet without a date
column only needs *Date of the first row*.

```
REST DAY
8:30 AM   5:30 PM   REGULAR HOLIDAY   REGULAR HOLIDAY
8:30 AM   5:30 PM   08:05             17:55
8:30 AM  12:30 PM   08:20             12:56
```

Read as schedule in, schedule out, time in, time out. A sheet with fewer
columns works too: `Nov 4   08:23   18:57`, or just `Nov 4   18:57`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # types + lint + the overtime checks
npm run check:ot   # just the overtime checks; writes .check/sample.pdf
npm run build      # static bundle in dist/
```

React 19 + TypeScript + Vite, plain CSS with the NU Davao design tokens
shared with `../nu-room-booking`. `pdf-lib` fills the form; `pdfjs-dist`
reads the biometric PDF. Both load only when needed.

Deploys as static files anywhere (Vercel, GitHub Pages). There is no server.
