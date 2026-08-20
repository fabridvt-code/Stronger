/** Humanise the internal enum slugs for display. */

export function humanize(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function repRangeLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  return `${min ?? max}`;
}
