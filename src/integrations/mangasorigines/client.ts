import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
  type ExtractedChapter,
} from '@/integrations/common/extractorClient';

export type MangasOriginesSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

export type MangasOriginesDetail = {
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

const mapSearch = (item: ExtractedSearchResult): MangasOriginesSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchMangasOrigines(query: string, page = 1): Promise<MangasOriginesSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/mangasorigines?q=${encodeURIComponent(query)}&page=${page}`
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangasOrigines] search error:', error);
    return [];
  }
}

export async function getPopularMangasOrigines(): Promise<MangasOriginesSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      '/popular/mangasorigines'
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangasOrigines] popular error:', error);
    return [];
  }
}

export async function getMangasOriginesDetail(mangaId: string): Promise<MangasOriginesDetail> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/mangasorigines/${encodeURIComponent(mangaId)}`
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

export async function getMangasOriginesPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/mangasorigines/${encodeURIComponent(chapterId)}`
  );
  return data.images || [];
}
