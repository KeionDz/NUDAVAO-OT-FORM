# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A static React app that fills out the NU Davao Overtime Authorization Form
(DVO-ADM-HRO-F-001, Version 2026) from a person's attendance and computes the
hours. No server, no database: attendance is read, ruled on and printed in the
browser and never leaves it. `README.md` is the authority on the overtime rule
— read it before changing anything in `src/lib/overtime.ts`.

React 19 + TypeScript + Vite. Follows the sibling NU Davao apps
(`../nu-room-booking`) deliberately: plain CSS with design tokens (no CSS
framework), inline-SVG icons, comments that explain *why*.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # tsc + oxlint + scripts/check-ot.ts — run after ANY change in src/lib/
npm run check:ot   # rules, parsers and the PDF; writes .check/*.pdf to look at
npm run build
```

`scripts/check-ot.ts` holds the real cases the rule was agreed on (September
2026 → 12 hrs and 47 mins, November 1–14 2026 → 6 hrs and 15 mins, the filled
example → 31 hrs and 3 mins). If one of those totals moves, a rule changed:
find out why before touching the expected value.

## Where things belong

| Change | File |
| --- | --- |
| The overtime rule, threshold, Saturday/holiday handling, night differential | `src/lib/overtime.ts` |
| Which hour line a day's minutes land on; what the total adds up | `totalsOf()` in `src/lib/overtime.ts` |
| Reading the biometric Transaction PDF | `src/lib/parseBiometric.ts` (pure; strings in) |
| Reading rows pasted from the DTR sheet | `src/lib/parsePaste.ts` |
| Time and date parsing / wording ("12 hrs and 47 mins", "Sept. 1") | `src/lib/time.ts` |
| What text goes in which blank | `src/lib/buildForm.ts` |
| Where a blank IS on the page | `src/lib/formLayout.ts` — measured points |
| Drawing onto the PDF, continuation pages, placing signatures | `src/lib/fillForm.ts` |
| Signature boxes on the page | `SIGNATURE_BOXES` in `src/lib/formLayout.ts` |
| Turning a drawing or photo into a transparent ink PNG | `src/lib/signature.ts` |
| The draw pad and upload control | `src/components/SignatureField.tsx` |
| Which signatures are remembered | `src/hooks/useSignatures.ts` |
| Brand colours, type, spacing | `src/styles/theme.css` |

**A new revision of the form** means: replace `public/ot-form-template.pdf`,
re-measure `src/lib/formLayout.ts`, run `npm run check:ot` and look at
`.check/sample.pdf`.

## Rules that are easy to break

- **Night differential is a subset, not an addition.** The total adds the base
  lines only; the example form has 1 hr of ND inside 31 hrs 3 mins of
  "Ordinary day" and a total of 31 hrs 3 mins.
- **The threshold qualifies a day; it is not deducted.** 61 minutes past the
  shift counts as 61 minutes.
- **Nothing outside a regular work day is ticked automatically** — late
  Saturdays, rest days, holidays. Whether those are claimable is HR's call.
- **Attendance is never persisted.** Only the person's details and rules go
  in localStorage (`useStored`). Swipe times are personal.
- **Only the requestor's own signature may be stored**, and only while
  "Remember my signature" is ticked — unticking deletes it. The supervisor's
  signature is someone else's mark and lives only as long as the tab.
- **Every signature is a transparent PNG by the time it reaches the PDF.** An
  opaque photo would paint white over the signature line and printed name;
  `signatureFromFile()` removes the paper. Don't embed an upload directly.
- **Never commit real attendance or filled forms.** `.gitignore` covers
  `Transaction_*.pdf`, `/output` and `.check`; the checks use synthetic names.
- The PDF text is Helvetica (WinAnsi). `toWinAnsi()` in `fillForm.ts` folds
  anything it cannot encode — keep it in the path of every drawn string.
