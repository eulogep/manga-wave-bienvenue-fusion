export type CatalogProvider = 'anilist' | 'jikan' | 'kitsu';
export type CatalogMediaType = 'manga' | 'anime';

export type UnifiedCatalogItem = {
  provider: CatalogProvider;
  sourceId: string;
  mediaType: CatalogMediaType;
  title: string;
  altTitles: string[];
  synopsis: string | null;
  coverImageUrl: string | null;
  status: string | null;
  year: number | null;
  genres: string[];
  score: number | null;
  officialUrl: string | null;
};

export type CatalogSearchOptions = {
  query: string;
  mediaType?: CatalogMediaType;
  limit?: number;
};

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const JIKAN_ENDPOINT = 'https://api.jikan.moe/v4';
const KITSU_ENDPOINT = 'https://kitsu.io/api/edge';
const REQUEST_TIMEOUT_MS = 12_000;

const withTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await request(controller.signal);
  } finally {
    window.clearTimeout(timeout);
  }
};

const cleanText = (value: string | null | undefined) => value?.replace(/<[^>]*>/g, '').trim() || null;
const firstTitle = (titles: Record<string, string | null> | undefined) => titles?.english || titles?.romaji || titles?.native || null;

async function searchAniList({ query, mediaType = 'manga', limit = 12 }: CatalogSearchOptions): Promise<UnifiedCatalogItem[]> {
  const gql = `query Search($search: String, $type: MediaType, $perPage: Int) { Page(perPage: $perPage) { media(search: $search, type: $type, sort: SEARCH_MATCH) { id type title { romaji english native } synonyms description coverImage { large extraLarge } status startDate { year } genres averageScore siteUrl } } }`;
  const response = await withTimeout((signal) => fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: gql, variables: { search: query, type: mediaType.toUpperCase(), perPage: Math.min(limit, 50) } }),
  }));
  if (!response.ok) throw new Error(`AniList indisponible (${response.status})`);
  const payload = await response.json() as { data?: { Page?: { media?: Array<Record<string, unknown>> } }; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) throw new Error(payload.errors[0].message || 'Erreur AniList');
  return (payload.data?.Page?.media || []).map((item) => {
    const title = item.title as Record<string, string | null> | undefined;
    const cover = item.coverImage as Record<string, string | null> | undefined;
    const startDate = item.startDate as Record<string, number | null> | undefined;
    return {
      provider: 'anilist', sourceId: String(item.id), mediaType: item.type === 'ANIME' ? 'anime' : 'manga',
      title: firstTitle(title) || 'Titre sans nom', altTitles: Object.values(title || {}).filter((value): value is string => Boolean(value)),
      synopsis: cleanText(item.description as string | null), coverImageUrl: cover?.extraLarge || cover?.large || null,
      status: (item.status as string | null)?.toLowerCase() || null, year: startDate?.year || null,
      genres: (item.genres as string[] | undefined) || [], score: typeof item.averageScore === 'number' ? item.averageScore / 10 : null,
      officialUrl: (item.siteUrl as string | null) || `https://anilist.co/${mediaType}/${item.id}`,
    };
  });
}

async function searchJikan({ query, mediaType = 'manga', limit = 12 }: CatalogSearchOptions): Promise<UnifiedCatalogItem[]> {
  const response = await withTimeout((signal) => fetch(`${JIKAN_ENDPOINT}/${mediaType}?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 25)}`, { signal, headers: { Accept: 'application/json' } }));
  if (!response.ok) throw new Error(`Jikan indisponible (${response.status})`);
  const payload = await response.json() as { data?: Array<Record<string, unknown>> };
  return (payload.data || []).map((item) => {
    const images = item.images as { jpg?: { large_image_url?: string; image_url?: string } } | undefined;
    const title = (item.title as string | null) || (item.title_english as string | null) || 'Titre sans nom';
    const genres = [...((item.genres as Array<{ name?: string }> | undefined) || []), ...((item.themes as Array<{ name?: string }> | undefined) || [])].map((tag) => tag.name).filter((value): value is string => Boolean(value));
    return {
      provider: 'jikan', sourceId: String(item.mal_id), mediaType, title, altTitles: [item.title_japanese as string | null, item.title_english as string | null].filter((value): value is string => Boolean(value)),
      synopsis: cleanText(item.synopsis as string | null), coverImageUrl: images?.jpg?.large_image_url || images?.jpg?.image_url || null,
      status: (item.status as string | null)?.toLowerCase() || null, year: typeof item.year === 'number' ? item.year : null,
      genres, score: typeof item.score === 'number' ? item.score : null, officialUrl: (item.url as string | null) || `https://myanimelist.net/${mediaType}/${item.mal_id}`,
    };
  });
}

async function searchKitsu({ query, mediaType = 'manga', limit = 12 }: CatalogSearchOptions): Promise<UnifiedCatalogItem[]> {
  const resource = mediaType === 'anime' ? 'anime' : 'manga';
  const params = new URLSearchParams({ 'filter[text]': query, 'page[limit]': String(Math.min(limit, 20)), 'page[offset]': '0' });
  const response = await withTimeout((signal) => fetch(`${KITSU_ENDPOINT}/${resource}?${params}`, { signal, headers: { Accept: 'application/vnd.api+json' } }));
  if (!response.ok) throw new Error(`Kitsu indisponible (${response.status})`);
  const payload = await response.json() as { data?: Array<{ id: string; attributes?: Record<string, unknown> }> };
  return (payload.data || []).map((item) => {
    const attributes = item.attributes || {};
    const titles = attributes.titles as Record<string, string | null> | undefined;
    const poster = attributes.posterImage as { large?: string; medium?: string; original?: string } | undefined;
    const rating = Number(attributes.averageRating);
    const date = String(attributes.startDate || '');
    return {
      provider: 'kitsu', sourceId: item.id, mediaType, title: String(attributes.canonicalTitle || firstTitle(titles) || 'Titre sans nom'),
      altTitles: Object.values(titles || {}).filter((value): value is string => Boolean(value)), synopsis: cleanText(attributes.synopsis as string | null),
      coverImageUrl: poster?.large || poster?.medium || poster?.original || null, status: (attributes.status as string | null) || null,
      year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null, genres: [], score: Number.isFinite(rating) ? rating / 10 : null,
      officialUrl: `https://kitsu.io/${resource}/${item.id}`,
    };
  });
}

export const searchCatalogProvider = (provider: CatalogProvider, options: CatalogSearchOptions) => {
  if (provider === 'anilist') return searchAniList(options);
  if (provider === 'jikan') return searchJikan(options);
  return searchKitsu(options);
};

export async function searchAllCatalogProviders(options: CatalogSearchOptions): Promise<UnifiedCatalogItem[]> {
  const results = await Promise.allSettled((['anilist', 'jikan', 'kitsu'] as CatalogProvider[]).map((provider) => searchCatalogProvider(provider, options)));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}
