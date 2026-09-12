/**
 * Shared, provider-neutral display helpers for canonical discovery surfaces
 * (Command Search, Trending, Ranking, Search). Extracted so the same
 * status/type badge convention isn't copy-pasted a third and fourth time.
 */

export const DISCOVERY_STATUS_LABELS: Record<string, string> = {
  ongoing: 'En cours',
  completed: 'Terminé',
  hiatus: 'En pause',
  cancelled: 'Annulé',
};

export function discoveryStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return DISCOVERY_STATUS_LABELS[status] || status;
}

/** manga (purple) / manhwa (sky) / manhua (amber) — the T-3020/T-3021 convention. */
export function discoveryTypeBadgeClass(type: string | null | undefined): string {
  if (type === 'manhwa') return 'bg-sky-500/20 text-sky-300';
  if (type === 'manhua') return 'bg-amber-500/20 text-amber-300';
  return 'bg-purple-500/20 text-purple-300';
}
