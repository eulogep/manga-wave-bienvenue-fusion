import type { MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

const API_HOSTS = ['https://api.comick.dev', 'https://api.comick.io'];
const SITE = 'https://comick.io';
const IMAGES = 'https://meo.comick.pictures';

async function apiFetch<T>(path: string): Promise<T> {
  let lastError: Error | null = null;
  for (const host of API_HOSTS) {
    try {
      const response = await fetch(`${host}${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'MangaWave/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response.json() as Promise<T>;
      lastError = new Error(`Comick ${response.status}`);
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('API Comick indisponible.');
}

type RawComic = {
  hid?: string;
  slug?: string;
  title?: string;
  desc?: string;
  status?: number;
  bayesian_rating?: string;
  md_covers?: Array<{ b2key?: string }>;
  md_titles?: Array<{ title?: string }>;
};

const coverUrl = (comic: RawComic) => comic.md_covers?.[0]?.b2key
  ? `${IMAGES}/${comic.md_covers[0].b2key}`
  : null;

function mapSearch(comic: RawComic): SearchResult {
  const id = comic.slug || comic.hid || '';
  return {
    id,
    title: comic.title || 'Sans titre',
    coverUrl: coverUrl(comic),
    status: comic.status === 2 ? 'completed' : 'ongoing',
    rating: comic.bayesian_rating ? Number.parseFloat(comic.bayesian_rating) / 2 : null,
    genres: [],
    author: null,
    url: `${SITE}/comic/${id}`,
  };
}

export const comickExtractor: SourceExtractor = {
  id: 'comick',
  name: 'Comick.io',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    try {
      const data = await apiFetch<RawComic[]>(
        `/v1.0/search?q=${encodeURIComponent(query)}&page=${page}&limit=24&type=comic`,
      );
      if (Array.isArray(data) && data.length > 0) {
        return data.map(mapSearch).filter((item) => item.id);
      }
    } catch (err) {
      console.warn('[Comick] apiFetch failed, attempting fallback...');
    }
    return [];
  },

  async getPopular(): Promise<SearchResult[]> {
    try {
      const data = await apiFetch<RawComic[]>('/v1.0/search?sort=view&limit=20&type=comic');
      if (Array.isArray(data) && data.length > 0) {
        return data.map(mapSearch).filter((item) => item.id);
      }
    } catch (err) {
      console.warn('[Comick] apiFetch failed for popular');
    }
    return [];
  },

  async getDetail(slugOrHid: string): Promise<MangaDetail> {
    const detail = await apiFetch<{
      comic: RawComic;
      authors?: Array<{ name?: string }>;
      genres?: Array<{ name?: string }>;
    }>(`/comic/${encodeURIComponent(slugOrHid)}`);
    const comic = detail.comic;
    const comicHid = comic.hid || slugOrHid;
    const chapterData = await apiFetch<{
      chapters?: Array<{
        hid: string;
        chap?: string;
        title?: string;
        updated_at?: string;
        lang?: string;
      }>;
    }>(`/comic/${encodeURIComponent(comicHid)}/chapters?lang=fr,en&limit=500`);

    return {
      id: comic.slug || slugOrHid,
      title: comic.title || slugOrHid,
      coverUrl: coverUrl(comic),
      author: detail.authors?.[0]?.name || null,
      status: comic.status === 2 ? 'completed' : 'ongoing',
      genres: (detail.genres || []).map((genre) => genre.name).filter((name): name is string => Boolean(name)),
      synopsis: comic.desc?.replace(/<[^>]+>/g, '').trim() || null,
      chapters: (chapterData.chapters || []).map((chapter) => ({
        id: chapter.hid,
        chapterNumber: chapter.chap || '0',
        title: chapter.title || null,
        date: chapter.updated_at || '',
        language: chapter.lang || 'en',
        url: `${SITE}/comic/${comic.slug || slugOrHid}/${chapter.hid}`,
      })),
    };
  },

  async getPages(chapterHid: string): Promise<string[]> {
    const data = await apiFetch<{
      chapter?: {
        md_images?: Array<{ b2key?: string; url?: string }>;
        images?: Array<{ b2key?: string; url?: string }>;
      };
    }>(`/chapter/${encodeURIComponent(chapterHid)}`);
    const images = data.chapter?.md_images || data.chapter?.images || [];
    return images.map((image) => image.url || (image.b2key ? `${IMAGES}/${image.b2key}` : '')).filter(Boolean);
  },
};
