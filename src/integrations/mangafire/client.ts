import {
  extractorFetch,
  type ExtractedManga,
  type ExtractedSearchResult,
} from '@/integrations/common/extractorClient';
import { filterRelevantMangaResults } from '@/domain/providerRelevance';

export type MangaFireSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  type: string | null;
  rating: number | null;
  latestChapter: string | null;
  author: string | null;
  genres: string[];
  url: string;
};

const mapSearch = (item: ExtractedSearchResult): MangaFireSearchResult => ({
  id: item.id,
  title: item.title,
  coverUrl: item.coverUrl,
  status: item.status,
  type: 'Manga',
  rating: item.rating,
  latestChapter: null,
  author: item.author,
  genres: item.genres,
  url: item.url,
});

export async function searchMangaFire(query: string, page = 1): Promise<MangaFireSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>(
      `/search/mangafire?q=${encodeURIComponent(query)}&page=${page}`,
    );
    return filterRelevantMangaResults(query, (data.results || []).map(mapSearch));
  } catch (error) {
    console.warn('[MangaFire] search error:', error);
    return [];
  }
}

export async function getPopularMangaFire(): Promise<MangaFireSearchResult[]> {
  try {
    const data = await extractorFetch<{ results: ExtractedSearchResult[] }>('/popular/mangafire');
    return (data.results || []).map(mapSearch);
  } catch (error) {
    console.warn('[MangaFire] popular error:', error);
    return [];
  }
}

export async function getMangaFireDetail(mangaId: string): Promise<ExtractedManga> {
  const data = await extractorFetch<{ manga: ExtractedManga }>(
    `/detail/mangafire/${encodeURIComponent(mangaId)}`,
  );
  return data.manga;
}

export async function getMangaFirePages(chapterId: string): Promise<string[]> {
  const data = await extractorFetch<{ images: string[] }>(
    `/pages/mangafire/${encodeURIComponent(chapterId)}`,
  );
  return data.images || [];
}
