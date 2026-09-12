const TYPE_LABELS: Record<string, string> = {
  manga: 'Manga',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
};

const normalizeLabel = (value: string): string => value.normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase('en-US')
  .replace(/['’]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const ORIGIN_LABELS: Record<string, string> = {
  JP: 'Japon',
  KR: 'Corée du Sud',
  CN: 'Chine',
  TW: 'Taïwan',
  HK: 'Hong Kong',
};

const METADATA_SOURCE_LABELS: Record<string, string> = {
  anilist: 'AniList',
  jikan: 'MyAnimeList / Jikan',
};

export function canonicalTypeLabel(type: string | null | undefined): string | null {
  return type ? TYPE_LABELS[type.toLowerCase()] || null : null;
}

export function canonicalOriginLabel(country: string | null | undefined): string | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  return ORIGIN_LABELS[code] || code;
}

export function canonicalMetadataSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  const normalized = source.trim().toLowerCase();
  return METADATA_SOURCE_LABELS[normalized] || source.trim();
}

export function canonicalAliases(title: string, aliases: Array<string | null | undefined>, limit = 5): string[] {
  const titleKey = normalizeLabel(title);
  const seen = new Set<string>();
  return aliases.flatMap((alias) => {
    const value = alias?.trim();
    const key = normalizeLabel(value || '');
    if (!value || !key || key === titleKey || seen.has(key)) return [];
    seen.add(key);
    return [value];
  }).slice(0, Math.max(0, limit));
}
