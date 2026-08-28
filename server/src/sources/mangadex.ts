/**
 * MangaDex Extractor — Pure HTTP (official CORS-enabled API)
 * No Playwright needed.
 */
import type { SearchResult, Chapter, MangaDetail, SourceExtractor } from '../lib/extractor-types.js';

const API = 'https://api.mangadex.org';
const UPLOADS = 'https://uploads.mangadex.org';
const UA = 'MangaWave/1.0 (github.com/eulogep/manga-wave-bienvenue-fusion)';

function headers() {
  return { 'User-Agent': UA, 'Accept': 'application/json' };
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`MangaDex API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

function coverUrl(mangaId: string, fileName: string): string {
  return `${UPLOADS}/covers/${mangaId}/${fileName}.256.jpg`;
}

function localizedText(value: Record<string, string> | undefined): string {
  if (!value) return '';
  return value.fr || value.en || Object.values(value)[0] || '';
}

export const mangaDexExtractor: SourceExtractor = {
  id: 'mangadex',
  name: 'MangaDex',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    const data = await apiFetch<any>('/manga', {
      title: query,
      limit: '20',
      offset: String((page - 1) * 20),
      'includes[]': 'cover_art,author',
      'contentRating[]': 'safe',
      'order[relevance]': 'desc',
    });
    return (data.data || []).map((item: any) => {
      const coverFile = item.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
      const author = item.relationships?.find((r: any) => r.type === 'author')?.attributes?.name || null;
      return {
        id: item.id,
        title: localizedText(item.attributes?.title),
        coverUrl: coverFile ? coverUrl(item.id, coverFile) : null,
        status: item.attributes?.status || 'unknown',
        rating: null,
        genres: [],
        author,
        url: `https://mangadex.org/title/${item.id}`,
      };
    });
  },

  async getPopular(page = 1): Promise<SearchResult[]> {
    const data = await apiFetch<any>('/manga', {
      limit: '20',
      offset: String((page - 1) * 20),
      'includes[]': 'cover_art,author',
      'contentRating[]': 'safe',
      'order[followedCount]': 'desc',
    });
    return (data.data || []).map((item: any) => {
      const coverFile = item.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
      return {
        id: item.id,
        title: localizedText(item.attributes?.title),
        coverUrl: coverFile ? coverUrl(item.id, coverFile) : null,
        status: item.attributes?.status || 'unknown',
        rating: null,
        genres: [],
        author: null,
        url: `https://mangadex.org/title/${item.id}`,
      };
    });
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    const [mangaData, feedData] = await Promise.all([
      apiFetch<any>(`/manga/${mangaId}?includes[]=cover_art&includes[]=author`),
      apiFetch<any>(`/manga/${mangaId}/feed?limit=500&order[chapter]=desc&translatedLanguage[]=fr&translatedLanguage[]=en`),
    ]);

    const item = mangaData.data;
    const coverFile = item.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
    const author = item.relationships?.find((r: any) => r.type === 'author')?.attributes?.name || null;

    const chapters: Chapter[] = (feedData.data || []).map((ch: any) => ({
      id: ch.id,
      chapterNumber: ch.attributes?.chapter || '0',
      title: ch.attributes?.title || null,
      date: ch.attributes?.readableAt || ch.attributes?.publishAt || '',
      language: ch.attributes?.translatedLanguage || 'en',
      url: `https://mangadex.org/chapter/${ch.id}`,
    }));

    return {
      id: mangaId,
      title: localizedText(item.attributes?.title),
      coverUrl: coverFile ? coverUrl(mangaId, coverFile) : null,
      author,
      status: item.attributes?.status || 'unknown',
      genres: (item.attributes?.tags || [])
        .filter((t: any) => t.attributes?.group === 'genre')
        .map((t: any) => localizedText(t.attributes?.name)),
      synopsis: localizedText(item.attributes?.description),
      chapters,
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const data = await apiFetch<any>(`/at-home/server/${chapterId}`);
    const { baseUrl, chapter } = data;
    return (chapter.data || []).map((f: string) => `${baseUrl}/data/${chapter.hash}/${f}`);
  },
};
