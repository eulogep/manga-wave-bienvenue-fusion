export function canonicalFollowIdentity(userId: string, canonicalMangaId: number): string {
  return `${userId}:${canonicalMangaId}`;
}

export function updateFollowedCanonicalIds(
  current: number[],
  canonicalMangaId: number,
  following: boolean,
): number[] {
  const unique = [...new Set(current)];
  if (following) return unique.includes(canonicalMangaId) ? unique : [canonicalMangaId, ...unique];
  return unique.filter((id) => id !== canonicalMangaId);
}

export function isCanonicalMangaFollowed(current: number[], canonicalMangaId?: number): boolean {
  return canonicalMangaId !== undefined && current.includes(canonicalMangaId);
}
