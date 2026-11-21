/**
 * The text pieces of a PDF, in content order, for parseBiometric.ts.
 *
 * pdf.js is loaded only when someone actually picks a file — it is most of
 * the bundle, and the paste and type-it-in paths never need it. The legacy
 * build is used because it runs on the older browsers office PCs keep.
 */
export async function pdfTextItems(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  try {
    const items: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item) items.push(item.str);
      }
    }
    return items;
  } finally {
    await task.destroy();
  }
}
