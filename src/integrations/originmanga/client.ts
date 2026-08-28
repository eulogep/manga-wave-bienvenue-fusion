/**
 * OriginManga frontend client — calls the local scraper backend
 * The backend renders public pages and extracts their chapter content.
 */

import {
  extractorFetch,
  type ExtractedChapter,
  type ExtractedManga,
} from '@/integrations/common/extractorClient';

export type OriginMangaChapter = {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  url: string;
};

export type OriginMangaDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: OriginMangaChapter[];
};

export type OriginMangaSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number;
  url: string;
};

export async function searchOriginManga(query: string, page = 1): Promise<OriginMangaSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: OriginMangaSearchResult[] }>(
      `/search/originmanga?q=${encodeURIComponent(query)}&page=${page}`,
    );
    return data.results || [];
  } catch (err) {
    console.warn('[OriginManga] search error:', err);
    return [];
  }
}

export async function getPopularOriginManga(): Promise<OriginMangaSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: OriginMangaSearchResult[] }>(
      '/popular/originmanga',
    );
    return data.results || [];
  } catch (err) {
    console.warn('[OriginManga] popular error:', err);
    return searchOriginManga('a', 1);
  }
}

export async function getOriginMangaDetail(mangaId: string): Promise<OriginMangaDetail> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/originmanga/${encodeURIComponent(mangaId)}`,
  );
  const m = data.manga;
  return {
    id: m.id,
    title: m.title,
    coverUrl: m.coverUrl,
    altTitles: [],
    author: m.author,
    artist: null,
    status: m.status,
    genres: m.genres,
    synopsis: m.synopsis,
    chapters: (m.chapters || []).map((ch: ExtractedChapter) => ({
      id: ch.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      date: ch.date,
      url: ch.url,
    })),
  };
}

export async function getOriginMangaPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/originmanga/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
