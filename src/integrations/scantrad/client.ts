import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
  type ExtractedChapter,
} from '@/integrations/common/extractorClient';

export type ScantradSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

export type ScantradDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: {
    id: string;
    chapterNumber: string;
    title: string | null;
    date: string;
    url: string;
  }[];
};

const mapSearch = (item: ExtractedSearchResult): ScantradSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchScantrad(query: string, page = 1): Promise<ScantradSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/scantrad?q=${encodeURIComponent(query)}&page=${page}`
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[Scantrad] search error:', error);
    return [];
  }
}

export async function getPopularScantrad(): Promise<ScantradSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      '/popular/scantrad'
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[Scantrad] popular error:', error);
    return [];
  }
}

export async function getScantradDetail(mangaId: string): Promise<ScantradDetail> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/scantrad/${encodeURIComponent(mangaId)}`
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

export async function getScantradPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/scantrad/${encodeURIComponent(chapterId)}`
  );
  return data.images || [];
}
