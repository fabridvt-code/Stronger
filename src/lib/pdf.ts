/**
 * Client-side PDF handling for import (spec §7). Extracts the embedded text layer
 * when present; for scanned PDFs (no text) it renders the first page to an image so
 * the vision route can read it. Loaded lazily so pdf.js never ships in the main bundle.
 */

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  // Webpack emits the worker asset from this URL; keeps everything self-hosted (offline-safe).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  return out.trim();
}

/** Render the first page to a PNG data payload (for scanned/image-only PDFs). */
export async function renderPdfFirstPage(file: File): Promise<{ data: string; mediaType: string }> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  return { data: dataUrl.split(',')[1] ?? '', mediaType: 'image/png' };
}
