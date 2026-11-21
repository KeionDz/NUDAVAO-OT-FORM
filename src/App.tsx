import { useEffect, useMemo, useRef, useState } from 'react';
import { AttendanceCard, type Loaded } from './components/AttendanceCard';
import { DaysTable } from './components/DaysTable';
import { DetailsCard } from './components/DetailsCard';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { SummaryCard } from './components/SummaryCard';
import { useSignatures } from './hooks/useSignatures';
import { useStored } from './hooks/useStored';
import { buildFormData, EMPTY_PROFILE, fileNameFor, type Period } from './lib/buildForm';
import { ROWS_PER_PAGE } from './lib/formLayout';
import { DEFAULT_SETTINGS, evaluateAll, totalsOf, type DayRecord } from './lib/overtime';
import { formatMonthYear, todayIso } from './lib/time';

const TEMPLATE_URL = `${import.meta.env.BASE_URL}ot-form-template.pdf`;

interface Output {
  url: string;
  fileName: string;
  /** The inputs the PDF was made from, to tell when it has gone stale. */
  key: string;
}

export default function App() {
  const [profile, setProfile] = useStored('ot.profile', EMPTY_PROFILE);
  const [settings, setSettings] = useStored('ot.settings', DEFAULT_SETTINGS);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [period, setPeriod] = useState<Period>({ from: '', to: '' });
  const [dateFiled, setDateFiled] = useState(todayIso);
  const signatures = useSignatures();
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<Output | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  const days = useMemo(() => evaluateAll(records, settings), [records, settings]);
  const totals = useMemo(() => totalsOf(days), [days]);
  const formData = useMemo(
    () => buildFormData(profile, period, dateFiled, days, totals),
    [profile, period, dateFiled, days, totals],
  );
  const key = JSON.stringify(formData) + (signatures.mine?.url ?? '') + (signatures.supervisor?.url ?? '');

  // Object URLs hold the PDF in memory until revoked.
  useEffect(() => () => {
    if (output) URL.revokeObjectURL(output.url);
  }, [output]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (records.length > 0 && formData.rows.length === 0) w.push('No day is on the form yet — tick the days to claim.');
    if (formData.rows.length > ROWS_PER_PAGE) {
      w.push(`${formData.rows.length} days won't fit the form's ${ROWS_PER_PAGE} rows — they continue on a second page.`);
    }
    const noOut = days.filter((d) => d.status === 'no-punch').length;
    if (noOut) w.push(`${noOut} work day${noOut === 1 ? ' has' : 's have'} no time out. Check ${noOut === 1 ? 'it' : 'them'} in the table.`);
    const possible = days.filter((d) => (d.status === 'saturday' || d.status === 'worked-off') && !d.included).length;
    if (possible) w.push(`${possible} Saturday/rest day${possible === 1 ? '' : 's'} went past the shift — tick to claim.`);
    if (records.length > 0 && !profile.reason.trim()) w.push('Reason/s is blank — HR may return the form without it.');
    return w;
  }, [days, records.length, formData.rows.length, profile.reason]);

  function load(loaded: Loaded) {
    setRecords(loaded.records);
    if (loaded.period) setPeriod(loaded.period);
  }

  /** A day moved or added outside the period stretches it, so it is never
   *  printed on a form whose period excludes it. */
  function widenPeriod(date: string) {
    setPeriod((p) => ({
      from: !p.from || date < p.from ? date : p.from,
      to: !p.to || date > p.to ? date : p.to,
    }));
  }

  function update(id: string, patch: Partial<DayRecord>) {
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (patch.date) widenPeriod(patch.date);
  }

  function add(record: DayRecord) {
    setRecords((rs) => [...rs, record]);
    widenPeriod(record.date);
  }

  async function generate() {
    setAttempted(true);
    setError('');
    if (!profile.name.trim()) {
      document.getElementById('p-name')?.focus();
      return;
    }
    if (formData.rows.length === 0) {
      setError('Nothing to put on the form yet — load your attendance and tick at least one day.');
      return;
    }
    setBusy(true);
    try {
      const [{ fillOtForm }, template] = await Promise.all([
        import('./lib/fillForm'),
        fetch(TEMPLATE_URL).then((r) => {
          if (!r.ok) throw new Error(`template ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      const bytes = await fillOtForm(template, {
        ...formData,
        signatures: { requestor: signatures.mine?.bytes, superior: signatures.supervisor?.bytes },
      });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      setOutput({
        url,
        fileName: fileNameFor(profile, formatMonthYear(period.to || period.from || dateFiled)),
        key,
      });
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      setError('The form could not be filled. Reload the page and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />

      <main className="main" id="main">
        <div className="page__head">
          <h1 className="page__title">Overtime Authorization Form</h1>
          <p className="page__lead">
            Load your attendance, check which days count, and download the filled form ready to sign and submit to
            HR.
          </p>
        </div>

        <div className="layout">
          <div className="layout__main">
            <DetailsCard
              profile={profile}
              onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
              signatures={signatures}
              nameMissing={attempted && !profile.name.trim()}
            />
            <AttendanceCard onLoad={load} hasDays={records.length > 0} />
            <DaysTable
              days={days}
              settings={settings}
              onSettings={setSettings}
              onUpdate={update}
              onRemove={(id) => setRecords((rs) => rs.filter((r) => r.id !== id))}
              onAdd={add}
            />
          </div>

          <aside className="layout__aside" aria-label="Totals">
            <SummaryCard
              totals={totals}
              dayCount={formData.rows.length}
              period={period}
              onPeriod={setPeriod}
              dateFiled={dateFiled}
              onDateFiled={setDateFiled}
              warnings={error ? [error, ...warnings] : warnings}
              onGenerate={generate}
              busy={busy}
              download={output && { url: output.url, fileName: output.fileName, stale: output.key !== key }}
            />
          </aside>
        </div>

        {output && (
          <section className="card" style={{ marginTop: 'var(--space-5)' }} ref={previewRef} aria-labelledby="pv-title">
            <div className="card__head">
              <h2 className="card__title" id="pv-title">
                <Icon name="file" /> {output.fileName}
              </h2>
              <a className="btn btn--ok btn--sm" href={output.url} download={output.fileName}>
                <Icon name="download" /> Download
              </a>
            </div>
            <iframe className="preview" src={output.url} title="Filled overtime form preview" />
          </section>
        )}
      </main>

      <footer className="footer">
        NU Davao · Overtime Authorization Form DVO-ADM-HRO-F-001 · Everything stays in this browser.
      </footer>
    </div>
  );
}
