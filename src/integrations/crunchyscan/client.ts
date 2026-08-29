/**
 * CrunchyScan frontend client — calls the local scraper backend
 * The backend renders public pages and extracts their chapter content.
 */

import {
  extractorFetch,
  type ExtractedChapter,
  type ExtractedManga,
} from '@/integrations/common/extractorClient';

export type CrunchyScanSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  genres: string[];
  author: string | null;
  url: string;
};

export type CrunchyScanDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: Array<{
    id: string;
    chapterNumber: string;
    title: string | null;
    date: string;
    url: string;
  }>;
};

export async function searchCrunchyScan(query: string): Promise<CrunchyScanSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: CrunchyScanSearchResult[] }>(
      `/search/crunchyscan?q=${encodeURIComponent(query)}`,
    );
    return data.results || [];
  } catch (err) {
    console.warn('[CrunchyScan] search error:', err);
    return [];
  }
}

export async function getPopularCrunchyScan(): Promise<CrunchyScanSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: CrunchyScanSearchResult[] }>(
      '/popular/crunchyscan',
    );
    return data.results || [];
  } catch (err) {
    console.warn('[CrunchyScan] popular error:', err);
    return searchCrunchyScan('a');
  }
}

export async function getCrunchyScanDetail(idOrSlug: string): Promise<CrunchyScanDetail> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/crunchyscan/${encodeURIComponent(idOrSlug)}`,
  );
  const m = data.manga;
  return {
    id: m.id,
    title: m.title,
    coverUrl: m.coverUrl,
    altTitles: [],
    author: m.author,
    artist: null,
    status: m.status || 'ongoing',
    genres: m.genres || ['VF'],
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

export async function getCrunchyScanPages(chapterPath: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/crunchyscan/${encodeURIComponent(chapterPath)}`,
  );
  return data.images || [];
}
