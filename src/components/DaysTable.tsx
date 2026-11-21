import { useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS, newId, type DayRecord, type DayType, type Evaluated, type Settings,
} from '../lib/overtime';
import { dayName, formatDurationShort, formatShortDate, formatTime12, formatTime24, isValidIso } from '../lib/time';
import { Icon } from './Icon';

interface Props {
  days: Evaluated[];
  settings: Settings;
  onSettings: (s: Settings) => void;
  onUpdate: (id: string, patch: Partial<DayRecord>) => void;
  onRemove: (id: string) => void;
  onAdd: (record: DayRecord) => void;
}

const DAY_TYPES: Array<{ value: DayType; label: string }> = [
  { value: 'ordinary', label: 'Work day' },
  { value: 'restday', label: 'Rest day' },
  { value: 'regular_holiday', label: 'Regular holiday' },
  { value: 'special_holiday', label: 'Special holiday' },
];

/** The table's select is narrow; the add form keeps the full names. */
const SHORT: Record<DayType, string> = {
  ordinary: 'Work day',
  restday: 'Rest day',
  regular_holiday: 'Reg. holiday',
  special_holiday: 'Spl. holiday',
};

/** "17:30" from an <input type="time"> → minutes; blank → undefined. */
function fromInput(value: string): number | undefined {
  const m = value.match(/^(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

function StatusBadge({ day, threshold }: { day: Evaluated; threshold: number }) {
  const claimedByHand = day.included && !day.auto;
  if (claimedByHand) return <span className="badge badge--ok">Claimed</span>;
  switch (day.status) {
    case 'ot':
      return day.included ? <span className="badge badge--ok">Overtime</span> : <span className="badge">Left off</span>;
    case 'manual':
      return day.included ? <span className="badge badge--ok">Typed in</span> : <span className="badge">Left off</span>;
    case 'under':
      return <span className="badge">Not over {threshold === 60 ? '1 hr' : `${threshold} min`}</span>;
    case 'none':
      return <span className="badge">On time</span>;
    case 'saturday':
      return <span className="badge badge--warn">Saturday · claim?</span>;
    case 'worked-off':
      return <span className="badge badge--warn">Worked · claim?</span>;
    case 'off':
      return <span className="badge">{DAY_TYPES.find((t) => t.value === day.record.dayType)?.label ?? 'Rest day'}</span>;
    case 'no-punch':
      return <span className="badge badge--err">No time out</span>;
  }
}

/**
 * Every loaded day, what the rule made of it, and the controls to correct
 * it: a wrong swipe, a day that was really a holiday, a Saturday worth
 * claiming. The tick is the person's final word on what goes on the form.
 */
export function DaysTable({ days, settings, onSettings, onUpdate, onRemove, onAdd }: Props) {
  const [onlyOt, setOnlyOt] = useState(false);
  const [adding, setAdding] = useState(false);
  const counted = days.filter((d) => d.included).length;
  const shown = onlyOt ? days.filter((d) => d.included) : days;

  return (
    <section className="card" aria-labelledby="days-title">
      <div className="card__head">
        <h2 className="card__title" id="days-title">
          <span className="card__step">3</span> Overtime days
        </h2>
        <p className="card__sub">
          A work day counts when the time out is more than{' '}
          {settings.thresholdMinutes === 60 ? '1 hour' : `${settings.thresholdMinutes} minutes`} after{' '}
          {formatTime12(settings.weekdayEnd)}. Overtime runs from {formatTime12(settings.weekdayEnd)} to the time out.
          Click a date to change it.
        </p>
      </div>

      {days.length > 0 && (
        <div className="toolbar">
          <span className="muted" role="status">
            <strong>{counted}</strong> of {days.length} day{days.length === 1 ? '' : 's'} on the form
          </span>
          <div className="segmented" role="group" aria-label="Which days to show">
            <button
              type="button"
              className={`segmented__btn${!onlyOt ? ' segmented__btn--on' : ''}`}
              aria-pressed={!onlyOt}
              onClick={() => setOnlyOt(false)}
            >
              All days
            </button>
            <button
              type="button"
              className={`segmented__btn${onlyOt ? ' segmented__btn--on' : ''}`}
              aria-pressed={onlyOt}
              onClick={() => setOnlyOt(true)}
            >
              On the form
            </button>
          </div>
        </div>
      )}

      {days.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="calendar" size={24} />
          </span>
          <p className="empty__title">No days yet</p>
          <p className="empty__text">Load your attendance above, or add an overtime window by hand below.</p>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" title="On the form">Use</th>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">In</th>
                <th scope="col">Out</th>
                <th scope="col">Overtime</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <DayRow key={d.record.id} day={d} settings={settings} onUpdate={onUpdate} onRemove={onRemove} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <AddDay
          onCancel={() => setAdding(false)}
          onAdd={(r) => {
            onAdd(r);
            setAdding(false);
          }}
        />
      ) : (
        <div className="card__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add overtime by hand
          </button>
        </div>
      )}

      <details className="rules">
        <summary>
          <Icon name="settings" /> Overtime rules
          <Icon name="chevronDown" className="icon--chev" />
        </summary>
        <div className="rules__body stack">
          <div className="fields fields--3">
            <div className="field">
              <label className="field__label" htmlFor="r-weekday">Shift ends (Mon–Fri)</label>
              <input
                id="r-weekday"
                type="time"
                className="input"
                value={formatTime24(settings.weekdayEnd)}
                onChange={(e) => onSettings({ ...settings, weekdayEnd: fromInput(e.target.value) ?? settings.weekdayEnd })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="r-sat">Shift ends (Saturday)</label>
              <input
                id="r-sat"
                type="time"
                className="input"
                value={formatTime24(settings.saturdayEnd)}
                onChange={(e) => onSettings({ ...settings, saturdayEnd: fromInput(e.target.value) ?? settings.saturdayEnd })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="r-threshold">Counts when more than (minutes)</label>
              <input
                id="r-threshold"
                type="number"
                min={0}
                max={600}
                className="input"
                value={settings.thresholdMinutes}
                onChange={(e) => onSettings({ ...settings, thresholdMinutes: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.countSaturdays}
              onChange={(e) => onSettings({ ...settings, countSaturdays: e.target.checked })}
            />
            Count late Saturdays automatically
          </label>
          <p className="muted">
            A shift end pasted from your DTR sheet wins over these for that day. Night differential is counted from
            10:00 PM to 6:00 AM.
          </p>
          <div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSettings(DEFAULT_SETTINGS)}>
              <Icon name="refresh" /> Back to the defaults
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}

interface RowProps {
  day: Evaluated;
  settings: Settings;
  onUpdate: (id: string, patch: Partial<DayRecord>) => void;
  onRemove: (id: string) => void;
}

function DayRow({ day, settings, onUpdate, onRemove }: RowProps) {
  const r = day.record;
  const label = `${dayName(r.date)} ${formatShortDate(r.date)}`;
  const timeCell = (value: number | undefined, onChange: (v: number | undefined) => void, name: string) => (
    <input
      type="time"
      className="input input--cell"
      aria-label={`${name}, ${label}`}
      value={value === undefined ? '' : formatTime24(value)}
      onChange={(e) => onChange(fromInput(e.target.value))}
    />
  );

  return (
    <tr className={day.included ? 'is-ot' : day.status === 'off' ? 'is-muted' : undefined}>
      <td>
        <label className="check">
          <input
            type="checkbox"
            checked={day.included}
            disabled={day.minutes === 0}
            aria-label={`Put ${label} on the form`}
            onChange={(e) => onUpdate(r.id, { include: e.target.checked === day.auto ? undefined : e.target.checked })}
          />
        </label>
      </td>
      <td className="table__date">
        <DateCell
          date={r.date}
          label={label}
          // A new date can change the weekday, and with it what the rule
          // decides — so the person's old tick no longer applies.
          onChange={(date) => onUpdate(r.id, { date, include: undefined })}
        />
      </td>
      <td>
        <select
          className="input input--cell"
          aria-label={`Type of day, ${label}`}
          value={r.dayType}
          onChange={(e) => onUpdate(r.id, { dayType: e.target.value as DayType, include: undefined })}
        >
          {DAY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {SHORT[t.value]}
            </option>
          ))}
        </select>
      </td>
      {r.manual ? (
        <>
          <td>{timeCell(r.manual.start, (v) => v !== undefined && onUpdate(r.id, { manual: { ...r.manual!, start: v } }), 'Overtime from')}</td>
          <td>{timeCell(r.manual.end, (v) => v !== undefined && onUpdate(r.id, { manual: { ...r.manual!, end: v } }), 'Overtime to')}</td>
        </>
      ) : (
        <>
          <td>{timeCell(r.timeIn, (v) => onUpdate(r.id, { timeIn: v }), 'Time in')}</td>
          <td>{timeCell(r.timeOut, (v) => onUpdate(r.id, { timeOut: v, include: undefined }), 'Time out')}</td>
        </>
      )}
      <td>
        {day.minutes > 0 && day.start !== undefined && day.end !== undefined ? (
          <>
            <span className="table__span">
              {formatTime12(day.start)} – {formatTime12(day.end)}
            </span>
            <span className="table__sub">
              <span className="table__num">{formatDurationShort(day.minutes)}</span>
              {day.ndMinutes > 0 && ` · ${formatDurationShort(day.ndMinutes)} night diff`}
            </span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <StatusBadge day={day} threshold={settings.thresholdMinutes} />
      </td>
      <td>
        <button type="button" className="iconbtn" aria-label={`Remove ${label}`} onClick={() => onRemove(r.id)}>
          <Icon name="trash" />
        </button>
      </td>
    </tr>
  );
}

/**
 * The day's date, editable in place: for a row the paste put on the wrong
 * day, or a swipe the biometric filed under the wrong one. The change is
 * committed on Enter or when focus leaves, so the row does not re-sort under
 * the cursor mid-edit; Escape puts the old date back.
 */
function DateCell({ date, label, onChange }: { date: string; label: string; onChange: (date: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(date);
  const cancelled = useRef(false);

  function commit() {
    if (!cancelled.current && isValidIso(draft) && draft !== date) onChange(draft);
    cancelled.current = false;
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="date"
        className="input input--cell"
        aria-label={`New date for ${label}`}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="datebtn"
      aria-label={`${label} — change the date`}
      onClick={() => {
        setDraft(date);
        setEditing(true);
      }}
    >
      {dayName(date).slice(0, 3)}, {formatShortDate(date)}
      <span className="table__sub">
        {date} <Icon name="pencil" size={12} />
      </span>
    </button>
  );
}

function AddDay({ onAdd, onCancel }: { onAdd: (r: DayRecord) => void; onCancel: () => void }) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('17:30');
  const [end, setEnd] = useState('');
  const [dayType, setDayType] = useState<DayType>('ordinary');
  const s = fromInput(start);
  const e = fromInput(end);
  const ready = isValidIso(date) && s !== undefined && e !== undefined && s !== e;

  return (
    <div className="addday stack">
      <p className="muted">
        For overtime that is not “after the shift” — before it starts, or on a day the biometric missed.
      </p>
      <div className="fields fields--2">
        <div className="field">
          <label className="field__label" htmlFor="add-date">Date</label>
          <input id="add-date" type="date" className="input" value={date} onChange={(ev) => setDate(ev.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="add-type">Type of day</label>
          <select id="add-type" className="input" value={dayType} onChange={(ev) => setDayType(ev.target.value as DayType)}>
            {DAY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="add-start">Overtime from</label>
          <input id="add-start" type="time" className="input" value={start} onChange={(ev) => setStart(ev.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="add-end">Overtime to</label>
          <input id="add-end" type="time" className="input" value={end} onChange={(ev) => setEnd(ev.target.value)} />
        </div>
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!ready}
          onClick={() => onAdd({ id: newId(), date, dayType, manual: { start: s!, end: e! } })}
        >
          <Icon name="plus" /> Add
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
