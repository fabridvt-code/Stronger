/**
 * AI provider selection (spec §22). Gemini is the default engine; Claude is an
 * alternative. `AI_PROVIDER` forces one explicitly; otherwise we auto-pick based on
 * whichever key is present (Gemini first).
 */

import { GeminiExtractor } from './gemini';
import { AnthropicExtractor } from './anthropic';
import type { AiExtractor } from './types';

export * from './types';

export function getExtractor(): AiExtractor {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  const gemini = new GeminiExtractor();
  const anthropic = new AnthropicExtractor();

  if (forced === 'gemini') return gemini;
  if (forced === 'anthropic' || forced === 'claude') return anthropic;

  // Auto: prefer Gemini, fall back to Claude, else return the (unconfigured) default.
  if (gemini.configured) return gemini;
  if (anthropic.configured) return anthropic;
  return gemini;
}
