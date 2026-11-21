/**
 * Turning a drawn or photographed signature into something that sits ON the
 * form rather than over it.
 *
 * A phone photo of a signature is dark ink on off-white paper. Pasted onto the
 * PDF as-is, the paper becomes a white box that hides the signature line and
 * the printed name under it. So every signature — drawn or uploaded — ends up
 * as an INK MASK: the ink's own colour, opacity by how dark it was, paper
 * fully transparent, cropped to the ink. The same idea as ../PDF-Signature.
 *
 * Browser-only (canvas). The PDF side just embeds the resulting PNG.
 */

export interface Signature {
  /** PNG bytes, transparent background. */
  bytes: Uint8Array;
  /** Object URL for the on-screen thumbnail; revoke when replaced. */
  url: string;
}

/** Largest side kept. A signature prints about 2 inches wide; more is waste. */
const MAX_SIDE = 1200;

/** Paper lighter than this is dropped entirely; ink darker than INK_FULL is kept solid. */
const PAPER = 225;
const INK_FULL = 110;

export async function signatureFromFile(file: File): Promise<Signature> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const ink = Math.min(1, Math.max(0, (PAPER - lum) / (PAPER - INK_FULL)));
    px[i + 3] = Math.round(px[i + 3] * ink);
  }
  ctx.putImageData(image, 0, 0);
  return signatureFromCanvas(canvas);
}

/**
 * Crops a canvas to its ink and encodes it. Throws when there is no ink at
 * all — a blank pad or a photo of empty paper is never a signature.
 */
export async function signatureFromCanvas(source: HTMLCanvasElement): Promise<Signature> {
  const cropped = trimToInk(source);
  if (!cropped) throw new Error('empty');
  const blob = await new Promise<Blob | null>((resolve) => cropped.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('encode');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) };
}

function trimToInk(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width, height } = source;
  const data = source.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // A few faint pixels of paper grain are not ink.
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(source, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// ---------------------------------------------------------------- remembering

/**
 * Your OWN signature may be remembered on this device, if you tick it — it is
 * the same every cutoff. A supervisor's never is: it is someone else's mark,
 * and it should not outlive the tab it was added in.
 */
export function signatureToDataUrl(sig: Signature): string {
  let binary = '';
  for (let i = 0; i < sig.bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...sig.bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export function signatureFromDataUrl(dataUrl: string): Signature | null {
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return null;
  try {
    const binary = atob(m[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, url: URL.createObjectURL(new Blob([bytes], { type: 'image/png' })) };
  } catch {
    return null;
  }
}
