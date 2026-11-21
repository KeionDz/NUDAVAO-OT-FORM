import { useState, type DragEvent } from 'react';
import { newId, type DayRecord } from '../lib/overtime';
import { parseBiometricItems } from '../lib/parseBiometric';
import { parsePastedSheet } from '../lib/parsePaste';
import { addDays, formatShortDate, isValidIso, weekday } from '../lib/time';
import { Icon, type IconName } from './Icon';

export interface Loaded {
  records: DayRecord[];
  period?: { from: string; to: string };
  source: string;
}

interface Props {
  onLoad: (loaded: Loaded) => void;
  hasDays: boolean;
}

type Tab = 'biometric' | 'paste' | 'type';

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'biometric', label: 'Biometric PDF', icon: 'file' },
  { id: 'paste', label: 'Paste from Excel', icon: 'clipboard' },
  { id: 'type', label: 'Type it in', icon: 'pencil' },
];

type Message = { kind: 'ok' | 'warn' | 'err'; text: string } | null;

/**
 * The three ways attendance arrives:
 *  - the biometric "Transaction" PDF the HR system exports,
 *  - rows copied out of the DTR spreadsheet,
 *  - nothing but a picture of the sheet — then the days are created here and
 *    the time-outs typed in.
 * Each one replaces the list below; none of it is stored.
 */
export function AttendanceCard({ onLoad, hasDays }: Props) {
  const [tab, setTab] = useState<Tab>('biometric');
  const [message, setMessage] = useState<Message>(null);

  return (
    <section className="card" aria-labelledby="att-title">
      <div className="card__head">
        <h2 className="card__title" id="att-title">
          <span className="card__step">2</span> Attendance
        </h2>
        <p className="card__sub">
          Read on this computer only — nothing is uploaded anywhere.
          {hasDays && ' Loading again replaces the days below.'}
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="How to load attendance">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tab${tab === t.id ? ' tab--on' : ''}`}
            onClick={() => {
              setTab(t.id);
              setMessage(null);
            }}
          >
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      <div className="card__body stack" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'biometric' && <BiometricPanel onLoad={onLoad} setMessage={setMessage} />}
        {tab === 'paste' && <PastePanel onLoad={onLoad} setMessage={setMessage} />}
        {tab === 'type' && <TypePanel onLoad={onLoad} setMessage={setMessage} />}

        {message && (
          <p className={`notice notice--${message.kind}`} role="status">
            <Icon name={message.kind === 'ok' ? 'check' : 'alert'} />
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}

interface PanelProps {
  onLoad: (loaded: Loaded) => void;
  setMessage: (m: Message) => void;
}

function BiometricPanel({ onLoad, setMessage }: PanelProps) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== 'application/pdf') {
      setMessage({ kind: 'err', text: `“${file.name}” is not a PDF. Export the Transaction report as PDF.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { pdfTextItems } = await import('../lib/pdfText');
      const result = parseBiometricItems(await pdfTextItems(await file.arrayBuffer()));
      if (result.records.length === 0) {
        setMessage({
          kind: 'err',
          text: 'No swipes found. This reads the biometric “Transaction” report (Date, Time, Check In/Out columns).',
        });
        return;
      }
      const dates = result.records.map((r) => r.date);
      const period = result.period ?? { from: dates[0], to: dates[dates.length - 1] };
      onLoad({ records: result.records, period, source: file.name });
      setMessage({
        kind: 'ok',
        text: `Read ${result.punches.length} swipes over ${result.records.length} days, ${formatShortDate(period.from)} – ${formatShortDate(period.to)}.`,
      });
    } catch {
      setMessage({ kind: 'err', text: `Could not read “${file.name}”. Is it a PDF that opens normally?` });
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files[0]);
  };

  return (
    <label
      className={`dropzone${over ? ' dropzone--over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <span className="dropzone__icon">
        <Icon name={busy ? 'refresh' : 'upload'} size={24} />
      </span>
      <span className="dropzone__title">{busy ? 'Reading…' : 'Choose or drop the Transaction PDF'}</span>
      <span className="dropzone__hint">
        The biometric export, e.g. <code>Transaction_2026-09-01_2026-09-30.pdf</code>. The last check-out of each day is
        used; lunch swipes are ignored.
      </span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        disabled={busy}
        onChange={(e) => {
          void read(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function PastePanel({ onLoad, setMessage }: PanelProps) {
  const [text, setText] = useState('');
  const [firstDate, setFirstDate] = useState('');

  function read() {
    const result = parsePastedSheet(text, isValidIso(firstDate) ? firstDate : null);
    if (result.undated > 0) {
      setMessage({
        kind: 'warn',
        text: `${result.undated} row${result.undated === 1 ? ' has' : 's have'} no date. Set “Date of the first row” so each row gets the next day.`,
      });
      return;
    }
    if (result.records.length === 0) {
      setMessage({ kind: 'err', text: 'No days found. Paste rows that have times like 17:55 or 5:30 PM.' });
      return;
    }
    const dates = result.records.map((r) => r.date);
    onLoad({
      records: result.records,
      period: { from: dates[0], to: dates[dates.length - 1] },
      source: 'pasted rows',
    });
    setMessage({
      kind: 'ok',
      text: `Read ${result.records.length} days, ${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])}.${
        result.skipped.length ? ` Skipped ${result.skipped.length} header line${result.skipped.length === 1 ? '' : 's'}.` : ''
      }`,
    });
  }

  return (
    <>
      <div className="field">
        <label className="field__label" htmlFor="paste-text">Rows from your DTR sheet</label>
        <p className="field__hint" id="paste-hint">
          Select the rows in Excel and copy (Ctrl+C), then paste here. Columns: schedule in, schedule out, time in, time
          out — or just a date and the time out. REST DAY and HOLIDAY rows count as days.
        </p>
        <textarea
          id="paste-text"
          className="input textarea textarea--sheet"
          aria-describedby="paste-hint"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'REST DAY\n8:30 AM\t5:30 PM\t08:05\t17:55\n8:30 AM\t5:30 PM\t08:23\t18:57'}
        />
      </div>
      <div className="fields fields--2">
        <div className="field">
          <label className="field__label" htmlFor="paste-first">Date of the first row</label>
          <p className="field__hint">Only needed when the rows have no date column.</p>
          <input
            id="paste-first"
            type="date"
            className="input"
            value={firstDate}
            onChange={(e) => setFirstDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--primary" disabled={!text.trim()} onClick={read}>
            <Icon name="check" /> Read the rows
          </button>
        </div>
      </div>
    </>
  );
}

function TypePanel({ onLoad, setMessage }: PanelProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function create() {
    if (!isValidIso(from) || !isValidIso(to) || to < from) {
      setMessage({ kind: 'err', text: 'Pick a start date and an end date on or after it.' });
      return;
    }
    const records: DayRecord[] = [];
    for (let d = from; d <= to && records.length < 62; d = addDays(d, 1)) {
      records.push({ id: newId(), date: d, dayType: weekday(d) === 0 ? 'restday' : 'ordinary' });
    }
    onLoad({ records, period: { from, to }, source: 'typed in' });
    setMessage({
      kind: 'ok',
      text: `Created ${records.length} days. Type each day's time out in the table below — Sundays start as rest days.`,
    });
  }

  return (
    <>
      <p className="muted">
        For when all you have is a picture of the sheet: create the days for the cutoff, then type each time out.
      </p>
      <div className="fields fields--3">
        <div className="field">
          <label className="field__label" htmlFor="type-from">From</label>
          <input id="type-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="type-to">To</label>
          <input id="type-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--primary" disabled={!from || !to} onClick={create}>
            <Icon name="calendar" /> Create the days
          </button>
        </div>
      </div>
    </>
  );
}
