import { resilientScrape } from '@/integrations/common/scraperClient';
import { COMICK_SEARCH_ENABLED, isRetryableProviderStatus } from '@/domain/providerHttp';

const API_HOSTS = ['https://api.comick.io', 'https://api.comick.fun'];
const IMAGE_BASE = 'https://meo.comick.pictures';

export type ComickSearchResult = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  lastChapter: string | null;
  genres: string[];
  url: string;
};

export type ComickChapter = {
  id: string;
  chapterNumber: string;
  volume: string | null;
  title: string | null;
  date: string;
  groupName: string | null;
  lang: string;
  url: string;
};

export type ComickDetail = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  year: number | null;
  rating: number | null;
  chapters: ComickChapter[];
};

type RawComic = {
  hid: string;
  slug: string;
  title: string;
  desc?: string;
  status?: number;
  year?: number;
  bayesian_rating?: string;
  md_covers?: Array<{ b2key?: string }>;
  md_titles?: Array<{ title?: string }>;
};

async function apiFetch<T>(path: string): Promise<T> {
  let lastError: Error | null = null;
  for (const host of API_HOSTS) {
    const target = `${host}${path}`;
    try {
      const response = await fetch(target, { headers: { Accept: 'application/json' } });
      if (response.ok) return response.json() as Promise<T>;
      const requestError = new Error(`Comick HTTP ${response.status}`);
      if (!isRetryableProviderStatus(response.status)) throw requestError;
      lastError = requestError;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (/Comick HTTP 4\d\d/.test(lastError.message) && !/408|429/.test(lastError.message)) throw lastError;
    }
    try {
      return await resilientScrape<T>(target, { asJson: true });
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('Comick indisponible.');
}

const coverUrl = (comic: RawComic) => comic.md_covers?.[0]?.b2key
  ? `${IMAGE_BASE}/${comic.md_covers[0].b2key}`
  : null;

const mapSearch = (comic: RawComic): ComickSearchResult => ({
  id: comic.slug || comic.hid,
  slug: comic.slug,
  title: comic.title,
  coverUrl: coverUrl(comic),
  status: comic.status === 2 ? 'completed' : 'ongoing',
  rating: comic.bayesian_rating ? Number.parseFloat(comic.bayesian_rating) / 2 : null,
  lastChapter: null,
  genres: [],
  url: `https://comick.io/comic/${comic.slug}`,
});

export async function searchComick(query: string, page = 1): Promise<ComickSearchResult[]> {
  if (!COMICK_SEARCH_ENABLED) return [];
  try {
    // Comick's public search contract accepts `q`; the former `type=comic`
    // combination produced a deterministic HTTP 400 and must not be retried.
    const data = await apiFetch<RawComic[]>(`/v1.0/search?q=${encodeURIComponent(query)}`);
    const offset = Math.max(0, page - 1) * 24;
    return Array.isArray(data) ? data.slice(offset, offset + 24).map(mapSearch) : [];
  } catch (error) {
    console.warn('[Comick] search error:', error);
    return [];
  }
}

export async function getPopularComick(): Promise<ComickSearchResult[]> {
  try {
    const data = await apiFetch<RawComic[]>('/top?type=comic&limit=20');
    return Array.isArray(data) ? data.map(mapSearch) : [];
  } catch (error) {
    console.warn('[Comick] popular error:', error);
    return [];
  }
}

export async function getComickDetail(slugOrHid: string): Promise<ComickDetail> {
  const detail = await apiFetch<{
    comic: RawComic;
    authors?: Array<{ name?: string }>;
    artists?: Array<{ name?: string }>;
    genres?: Array<{ name?: string }>;
  }>(`/comic/${encodeURIComponent(slugOrHid)}`);
  const comic = detail.comic;
  const chapterData = await apiFetch<{
    chapters?: Array<{
      hid: string;
      chap?: string;
      vol?: string;
      title?: string;
      updated_at?: string;
      group_name?: string[];
      lang?: string;
    }>;
  }>(`/comic/${encodeURIComponent(comic.hid)}/chapters?lang=fr,en&limit=500`);
  return {
    id: comic.hid,
    slug: comic.slug,
    title: comic.title,
    coverUrl: coverUrl(comic),
    altTitles: (comic.md_titles || []).map((title) => title.title).filter((title): title is string => Boolean(title)),
    author: detail.authors?.[0]?.name || null,
    artist: detail.artists?.[0]?.name || null,
    status: comic.status === 2 ? 'completed' : 'ongoing',
    genres: (detail.genres || []).map((genre) => genre.name).filter((name): name is string => Boolean(name)),
    synopsis: comic.desc?.replace(/<[^>]+>/g, '').trim() || null,
    year: comic.year || null,
    rating: comic.bayesian_rating ? Number.parseFloat(comic.bayesian_rating) / 2 : null,
    chapters: (chapterData.chapters || []).map((chapter) => ({
      id: chapter.hid,
      chapterNumber: chapter.chap || '0',
      volume: chapter.vol || null,
      title: chapter.title || null,
      date: chapter.updated_at || '',
      groupName: chapter.group_name?.join(', ') || null,
      lang: chapter.lang || 'en',
      url: `https://comick.io/comic/${comic.slug}/${chapter.hid}`,
    })),
  };
}

export async function getComickPages(chapterHid: string): Promise<string[]> {
  const data = await apiFetch<{
    chapter?: {
      md_images?: Array<{ b2key?: string; url?: string }>;
      images?: Array<{ b2key?: string; url?: string }>;
    };
  }>(`/chapter/${encodeURIComponent(chapterHid)}`);
  const images = data.chapter?.md_images || data.chapter?.images || [];
  return images.map((image) => image.url || (image.b2key ? `${IMAGE_BASE}/${image.b2key}` : '')).filter(Boolean);
}
