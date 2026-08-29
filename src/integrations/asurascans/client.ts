import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';

export type AsuraSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  latestChapter: string | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): AsuraSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  latestChapter: null,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchAsura(query: string, page = 1): Promise<AsuraSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/asurascans?q=${encodeURIComponent(query)}&page=${page}`,
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[AsuraScans] search error:', error);
    return [];
  }
}

export async function getPopularAsura(): Promise<AsuraSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/asurascans');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[AsuraScans] popular error:', error);
    return [];
  }
}

export async function getAsuraDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/asurascans/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getAsuraPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/asurascans/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
