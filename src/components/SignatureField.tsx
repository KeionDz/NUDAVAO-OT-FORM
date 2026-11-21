import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { signatureFromCanvas, signatureFromFile, type Signature } from '../lib/signature';
import { Icon } from './Icon';

interface Props {
  id: string;
  label: string;
  /** Shown under the label, e.g. where it lands on the form. */
  hint: string;
  value: Signature | null;
  onChange: (sig: Signature | null) => void;
  /** Present only for the person's own signature; see lib/signature.ts. */
  remember?: { checked: boolean; onChange: (checked: boolean) => void };
}

/**
 * One signature slot: draw it, or upload a photo/scan of it. Either way the
 * result is a transparent ink mask (lib/signature.ts), so it sits over the
 * signature line the way a pen would.
 */
export function SignatureField({ id, label, hint, value, onChange, remember }: Props) {
  const [mode, setMode] = useState<'idle' | 'draw'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('Use a PNG or JPG photo or scan of the signature.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onChange(await signatureFromFile(file));
    } catch {
      setError('No ink found in that image. Sign in dark ink on white paper and take the photo straight on.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field sigfield">
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <p className="field__hint">{hint}</p>

      {value ? (
        <div className="sigthumb">
          <img src={value.url} alt={label} />
          <div className="actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMode('draw')}>
              <Icon name="pencil" /> Redo
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(null)}>
              <Icon name="trash" /> Remove
            </button>
          </div>
        </div>
      ) : (
        mode === 'idle' && (
          <div className="actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMode('draw')}>
              <Icon name="pencil" /> Draw
            </button>
            <label className="btn btn--ghost btn--sm">
              <Icon name={busy ? 'refresh' : 'upload'} /> {busy ? 'Reading…' : 'Upload image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="visually-hidden"
                aria-labelledby={`${id}-label`}
                disabled={busy}
                onChange={upload}
              />
            </label>
          </div>
        )
      )}

      {mode === 'draw' && (
        <SignaturePad
          label={label}
          onCancel={() => setMode('idle')}
          onDone={(sig) => {
            onChange(sig);
            setMode('idle');
          }}
        />
      )}

      {remember && (
        <label className="check">
          <input
            type="checkbox"
            checked={remember.checked}
            onChange={(e) => remember.onChange(e.target.checked)}
          />
          Remember my signature on this device
        </label>
      )}

      {error && (
        <p className="field__error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  );
}

const INKS = [
  { name: 'Black', value: '#111318' },
  { name: 'Blue', value: '#1f3aa8' },
];

interface PadProps {
  label: string;
  onDone: (sig: Signature) => void;
  onCancel: () => void;
}

/**
 * A pen on paper: pointer events (mouse, touch and stylus alike), strokes
 * smoothed through midpoints, a stylus's pressure thickening the line. The
 * canvas is backed at device-pixel resolution so the PNG is crisp in print.
 */
function SignaturePad({ label, onDone, onCancel }: PadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);
  const [ink, setInk] = useState(INKS[0].value);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // At least 2x even on a 1x screen: the drawing is printed, not just shown.
    const ratio = Math.max(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const width = (e: PointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? 1.2 + e.pressure * 2.4 : 2.4);

  function down(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    last.current = { ...p, mx: p.x, my: p.y };
    // A tap leaves a dot, as a pen would.
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, width(e) / 2, 0, Math.PI * 2);
    ctx.fill();
    setEmpty(false);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    const prev = last.current;
    if (!prev) return;
    const p = point(e);
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = width(e);
    ctx.beginPath();
    ctx.moveTo(prev.mx, prev.my);
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    ctx.stroke();
    last.current = { ...p, mx, my };
  }

  function up() {
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    setError('');
  }

  async function use() {
    try {
      onDone(await signatureFromCanvas(canvasRef.current!));
    } catch {
      setError('The pad is empty — sign above the line first.');
    }
  }

  return (
    <div className="sigpad">
      <div className="sigpad__paper">
        <canvas
          ref={canvasRef}
          className="sigpad__canvas"
          aria-label={`Drawing area for ${label}. Sign with the mouse, a finger or a stylus.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        <span className="sigpad__line" aria-hidden="true" />
        {empty && (
          <span className="sigpad__placeholder" aria-hidden="true">
            Sign here
          </span>
        )}
      </div>
      <div className="sigpad__bar">
        <div className="segmented" role="group" aria-label="Ink colour">
          {INKS.map((i) => (
            <button
              key={i.value}
              type="button"
              className={`segmented__btn${ink === i.value ? ' segmented__btn--on' : ''}`}
              aria-pressed={ink === i.value}
              onClick={() => setInk(i.value)}
            >
              <span className="sigpad__swatch" style={{ background: i.value }} aria-hidden="true" />
              {i.name}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={empty}>
            Clear
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={use} disabled={empty}>
            <Icon name="check" /> Use signature
          </button>
        </div>
      </div>
      {error && (
        <p className="field__error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  );
}
