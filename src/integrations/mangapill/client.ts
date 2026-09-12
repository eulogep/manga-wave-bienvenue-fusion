import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';

export type MangaPillSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): MangaPillSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchMangaPill(query: string): Promise<MangaPillSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/mangapill?q=${encodeURIComponent(query)}`,
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangaPill] search error:', error);
    return [];
  }
}

export async function getPopularMangaPill(): Promise<MangaPillSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/mangapill');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangaPill] popular error:', error);
    return [];
  }
}

export async function getMangaPillDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/mangapill/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getMangaPillPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/mangapill/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
