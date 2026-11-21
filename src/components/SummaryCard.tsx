import type { Period } from '../lib/buildForm';
import type { Totals } from '../lib/overtime';
import { formatDuration } from '../lib/time';
import { Icon } from './Icon';

interface Props {
  totals: Totals;
  dayCount: number;
  period: Period;
  onPeriod: (p: Period) => void;
  dateFiled: string;
  onDateFiled: (d: string) => void;
  warnings: string[];
  onGenerate: () => void;
  busy: boolean;
  download: { url: string; fileName: string; stale: boolean } | null;
}

/**
 * The form's "No. of Hours" block, live. The lines are the form's own, in its
 * order; night-differential lines are indented because they are part of the
 * line above, not added to the total (see totalsOf).
 */
const LINES: Array<{ key: keyof Totals; label: string; sub?: boolean }> = [
  { key: 'ordinary', label: 'Ordinary day' },
  { key: 'ndOrdinary', label: 'Night differential', sub: true },
  { key: 'sunday', label: 'Sunday' },
  { key: 'excessSunday', label: 'Excess Sunday' },
  { key: 'ndSunday', label: 'Sunday night diff (Others)', sub: true },
  { key: 'legal', label: 'Legal holiday' },
  { key: 'ndLegal', label: 'Night differential', sub: true },
  { key: 'special', label: 'Special holiday' },
  { key: 'ndSpecial', label: 'Night differential', sub: true },
];

export function SummaryCard(p: Props) {
  const lines = LINES.filter((l) => l.key === 'ordinary' || p.totals[l.key] > 0);

  return (
    <section className="card" aria-labelledby="sum-title">
      <div className="card__head">
        <h2 className="card__title" id="sum-title">
          <span className="card__step">4</span> No. of hours
        </h2>
      </div>
      <div className="card__body stack">
        <div className="fields fields--2">
          <div className="field">
            <label className="field__label" htmlFor="s-from">Period from</label>
            <input
              id="s-from"
              type="date"
              className="input"
              value={p.period.from}
              onChange={(e) => p.onPeriod({ ...p.period, from: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="s-to">to</label>
            <input
              id="s-to"
              type="date"
              className="input"
              value={p.period.to}
              onChange={(e) => p.onPeriod({ ...p.period, to: e.target.value })}
            />
          </div>
          <div className="field field--wide">
            <label className="field__label" htmlFor="s-filed">Date filed</label>
            <input
              id="s-filed"
              type="date"
              className="input"
              value={p.dateFiled}
              onChange={(e) => p.onDateFiled(e.target.value)}
            />
          </div>
        </div>

        <div>
          <dl className="hours">
            {lines.map((l) => (
              <div key={l.key} className={`hours__row${l.sub ? ' hours__row--sub' : ''}`}>
                <dt>{l.label}</dt>
                <dd>{p.totals[l.key] > 0 ? formatDuration(p.totals[l.key]) : '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="total" aria-live="polite">
            <div className="total__label">Total no. of hours</div>
            <div className="total__value">{p.totals.total > 0 ? formatDuration(p.totals.total) : '0 hrs'}</div>
            <div className="total__days">
              {p.dayCount} day{p.dayCount === 1 ? '' : 's'} on the form
            </div>
          </div>
        </div>

        {p.warnings.map((w) => (
          <p key={w} className="notice notice--warn">
            <Icon name="alert" /> {w}
          </p>
        ))}

        <button type="button" className="btn btn--primary btn--block" disabled={p.busy} onClick={p.onGenerate}>
          <Icon name={p.busy ? 'refresh' : 'file'} />
          {p.busy ? 'Filling the form…' : p.download ? 'Fill the form again' : 'Fill out the form'}
        </button>

        {p.download && (
          <>
            {p.download.stale && (
              <p className="notice notice--warn" role="status">
                <Icon name="info" /> You changed something since — fill the form again to update the PDF.
              </p>
            )}
            <a className="btn btn--ok btn--block" href={p.download.url} download={p.download.fileName}>
              <Icon name="download" /> Download PDF
            </a>
          </>
        )}
      </div>
    </section>
  );
}
