import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';

export type WeebCentralSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): WeebCentralSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  rating: item.rating,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchWeebCentral(query: string): Promise<WeebCentralSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/weebcentral?q=${encodeURIComponent(query)}`,
    );
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[WeebCentral] search error:', error);
    return [];
  }
}

export async function getPopularWeebCentral(): Promise<WeebCentralSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/weebcentral');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[WeebCentral] popular error:', error);
    return [];
  }
}

export async function getWeebCentralDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/weebcentral/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getWeebCentralPages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/weebcentral/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
