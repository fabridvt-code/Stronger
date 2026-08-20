/**
 * Google Gemini extractor. Uses the Generative Language API with JSON response mode
 * for reliable structured output, and inline image data for photo / scanned-PDF import.
 */

import { AiExtraction } from '@/domain/import/schema';
import { EXTRACTION_SYSTEM } from './prompt';
import { stripJsonFences, type AiExtractor, type ExtractInput, type ExtractResult } from './types';

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export class GeminiExtractor implements AiExtractor {
  readonly provider = 'gemini';

  get configured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async extract({ text, image }: ExtractInput): Promise<ExtractResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { ok: false, error: 'Gemini is not configured.' };

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const parts: GeminiPart[] = [];
    if (image) parts.push({ inline_data: { mime_type: image.mediaType, data: image.data } });
    parts.push({ text: text.trim() || 'Extract the training program from this image.' });

    const body = {
      systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      );
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
    if (!res.ok) return { ok: false, error: `Gemini error (${res.status}).` };

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    try {
      const parsed = AiExtraction.safeParse(JSON.parse(stripJsonFences(raw)));
      if (!parsed.success) return { ok: false, error: 'Gemini returned an unexpected format.' };
      return { ok: true, extraction: parsed.data };
    } catch {
      return { ok: false, error: 'Could not parse the AI response.' };
    }
  }
}
