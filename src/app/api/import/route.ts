/**
 * AI import route (spec §7, §19, §22). Server-side only so API keys are never
 * exposed. Provider-agnostic: the active engine (Gemini by default, Claude optional)
 * is chosen by getExtractor(); this route just validates input and shapes the reply.
 *
 * Contract: POST { text?, image? } → { available, extraction?, error?, needsKeyForImage? }.
 * - No key configured → { available: false }; the client uses the deterministic parser
 *   for text (works offline). Images/scanned PDFs have no offline fallback.
 */

import { NextResponse } from 'next/server';
import { getExtractor } from '@/lib/ai';

export const runtime = 'nodejs';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(req: Request) {
  let text = '';
  let image: { data: string; mediaType: string } | null = null;
  try {
    const body = await req.json();
    text = String(body?.text ?? '');
    if (body?.image?.data && body?.image?.mediaType) {
      image = { data: String(body.image.data), mediaType: String(body.image.mediaType) };
    }
  } catch {
    return NextResponse.json({ available: false, error: 'Invalid request body.' }, { status: 400 });
  }

  if (!text.trim() && !image) {
    return NextResponse.json({ available: false, error: 'No text or image provided.' }, { status: 400 });
  }
  if (image && !ALLOWED_IMAGE_TYPES.includes(image.mediaType)) {
    return NextResponse.json({ available: false, error: 'Unsupported image type.' }, { status: 400 });
  }

  const extractor = getExtractor();
  if (!extractor.configured) {
    // Text can still be parsed deterministically client-side; images cannot.
    return NextResponse.json({ available: false, needsKeyForImage: !!image });
  }

  const result = await extractor.extract({ text, image: image ?? undefined });
  if (result.ok && result.extraction) {
    return NextResponse.json({ available: true, provider: extractor.provider, extraction: result.extraction });
  }
  return NextResponse.json({
    available: false,
    error: result.error ?? 'AI extraction failed.',
    needsKeyForImage: !!image,
  });
}
