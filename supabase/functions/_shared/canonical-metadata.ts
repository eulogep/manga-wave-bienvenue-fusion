export type CanonicalMangaType = 'manga' | 'manhwa' | 'manhua' | null;

export function normalizeCountryOfOrigin(value: string | null | undefined): string | null {
  const country = value?.trim().toUpperCase() || '';
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

export function canonicalTypeFromCountry(value: string | null | undefined): CanonicalMangaType {
  const country = normalizeCountryOfOrigin(value);
  if (country === 'JP') return 'manga';
  if (country === 'KR') return 'manhwa';
  if (country === 'CN' || country === 'TW' || country === 'HK') return 'manhua';
  return null;
}

export function countryFromMangaDexLanguage(value: string | null | undefined): string | null {
  const language = value?.trim().toLowerCase();
  if (language === 'ja') return 'JP';
  if (language === 'ko') return 'KR';
  if (language === 'zh') return 'CN';
  if (language === 'zh-hk') return 'HK';
  return null;
}

export function normalizeMetadataText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const FORBIDDEN_ALIASES = new Set([
  'jikan',
  'kitsu',
  'myanimelist',
  'mal',
  'anilist',
  'mangadex',
  'mangafire',
  'comick',
  'originmanga',
  'asurascans',
  'crunchyscan',
]);

export function normalizeAliases(canonicalTitle: string, values: Array<string | null | undefined>): string[] {
  const canonical = normalizeMetadataText(canonicalTitle);
  const aliases = new Map<string, string>();
  for (const raw of values) {
    const alias = raw?.trim().replace(/\s+/g, ' ');
    if (!alias) continue;
    const normalized = normalizeMetadataText(alias);
    if (!normalized || normalized === canonical || FORBIDDEN_ALIASES.has(normalized)) continue;
    if (!aliases.has(normalized)) aliases.set(normalized, alias);
  }
  return [...aliases.values()];
}
