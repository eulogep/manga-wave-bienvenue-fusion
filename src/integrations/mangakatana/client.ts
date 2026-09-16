import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';

export type MangaKatanaSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): MangaKatanaSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchMangaKatana(query: string): Promise<MangaKatanaSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/mangakatana?q=${encodeURIComponent(query)}`,
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangaKatana] search error:', error);
    return [];
  }
}

export async function getPopularMangaKatana(): Promise<MangaKatanaSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/mangakatana');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangaKatana] popular error:', error);
    return [];
  }
}

export async function getMangaKatanaDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/mangakatana/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getMangaKatanaPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/mangakatana/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
