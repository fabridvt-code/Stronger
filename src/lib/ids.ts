/** Client-generated stable IDs (uuid v4 when available, fallback otherwise). */
export function uid(prefix = ''): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const raw = g.crypto?.randomUUID
    ? g.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
  return prefix ? `${prefix}_${raw}` : raw;
}

export const now = () => Date.now();
