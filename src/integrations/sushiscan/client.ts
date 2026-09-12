import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';

export type SushiScanSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): SushiScanSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchSushiScan(query: string): Promise<SushiScanSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/sushiscan?q=${encodeURIComponent(query)}`,
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[SushiScan] search error:', error);
    return [];
  }
}

export async function getPopularSushiScan(): Promise<SushiScanSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/sushiscan');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[SushiScan] popular error:', error);
    return [];
  }
}

export async function getSushiScanDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/sushiscan/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getSushiScanPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/sushiscan/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
