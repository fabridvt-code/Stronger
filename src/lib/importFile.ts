/**
 * Turn an uploaded file into an import payload (spec §7).
 *   - text/markdown → { text }
 *   - PDF with a text layer → { text }
 *   - scanned PDF / image → { image } (needs the vision route)
 */

import { extractPdfText, renderPdfFirstPage } from './pdf';

export interface ImportPayload {
  text?: string;
  image?: { data: string; mediaType: string };
  /** How we interpreted the file, for user-facing messaging. */
  kind: 'text' | 'pdf-text' | 'pdf-image' | 'image';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// A PDF with fewer than this many extracted characters is treated as scanned.
const MIN_PDF_TEXT = 40;

export async function fileToImportPayload(file: File): Promise<ImportPayload> {
  const type = file.type;

  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const text = await extractPdfText(file);
    if (text.length >= MIN_PDF_TEXT) return { text, kind: 'pdf-text' };
    // No usable text layer → render to an image for the vision model.
    const image = await renderPdfFirstPage(file);
    return { image, kind: 'pdf-image' };
  }

  if (type.startsWith('image/')) {
    const data = await fileToBase64(file);
    return { image: { data, mediaType: type }, kind: 'image' };
  }

  // Plain text / markdown / anything readable as text.
  const text = await file.text();
  return { text, kind: 'text' };
}
