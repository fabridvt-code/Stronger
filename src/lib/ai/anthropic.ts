/**
 * Anthropic Claude extractor. Kept as an alternative provider — select it with
 * AI_PROVIDER=anthropic. Same interface as Gemini; text + vision (image) support.
 */

import { AiExtraction } from '@/domain/import/schema';
import { EXTRACTION_SYSTEM } from './prompt';
import { stripJsonFences, type AiExtractor, type ExtractInput, type ExtractResult } from './types';

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export class AnthropicExtractor implements AiExtractor {
  readonly provider = 'anthropic';

  get configured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async extract({ text, image }: ExtractInput): Promise<ExtractResult> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { ok: false, error: 'Anthropic is not configured.' };

    const model = process.env.AI_MODEL || 'claude-sonnet-5';
    const content: ContentBlock[] = [];
    if (image) {
      content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
      content.push({ type: 'text', text: text.trim() || 'Extract the training program from this image.' });
    } else {
      content.push({ type: 'text', text });
    }

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2048, system: EXTRACTION_SYSTEM, messages: [{ role: 'user', content }] }),
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
    if (!res.ok) return { ok: false, error: `Anthropic error (${res.status}).` };

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = data.content?.find((c) => c.type === 'text')?.text ?? '';
    try {
      const parsed = AiExtraction.safeParse(JSON.parse(stripJsonFences(raw)));
      if (!parsed.success) return { ok: false, error: 'Claude returned an unexpected format.' };
      return { ok: true, extraction: parsed.data };
    } catch {
      return { ok: false, error: 'Could not parse the AI response.' };
    }
  }
}
