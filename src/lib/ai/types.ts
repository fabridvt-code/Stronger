/**
 * Provider-agnostic AI extraction abstraction (spec §22). Each provider (Gemini,
 * Claude, …) implements the same interface; the import route and UI never know
 * which one is active. Swapping providers is an env var, not a code change.
 */

import type { AiExtractionT } from '@/domain/import/schema';

export interface ExtractInput {
  text: string;
  image?: { data: string; mediaType: string };
}

export interface ExtractResult {
  ok: boolean;
  extraction?: AiExtractionT;
  error?: string;
}

export interface AiExtractor {
  readonly provider: string;
  /** True when the required API key is present. */
  readonly configured: boolean;
  extract(input: ExtractInput): Promise<ExtractResult>;
}

/** Strip ```json fences and whitespace before JSON.parse. */
export function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}
