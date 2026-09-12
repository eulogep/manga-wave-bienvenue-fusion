import {
  searchSushiScan,
  getPopularSushiScan,
  getSushiScanDetail,
  getSushiScanPages,
} from '@/integrations/sushiscan/client';
import { classifyContentRatingFromGenres } from '@/domain/contentRating';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class SushiScanSource implements MangaSource {
  public readonly id = 'sushiscan' as const;
  public readonly name = 'Sushi-Scan';
  public readonly displayName = 'Sushi-Scan (FR)';
  public readonly baseUrl = 'https://sushiscan.fr';
  public readonly lang = 'fr';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchSushiScan(query);
    return results.map((item) => ({
      id: item.id,
      source: this.id,
      title: item.title,
      coverUrl: item.coverUrl,
      status: item.status,
      rating: item.rating,
      author: item.author,
      url: item.url,
      genres: item.genres,
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const detail = await getSushiScanDetail(id);
    return {
      id: detail.id,
      source: this.id,
      title: detail.title,
      coverUrl: detail.coverUrl,
      altTitles: [],
      author: detail.author,
      artist: null,
      status: detail.status,
      genres: detail.genres,
      synopsis: detail.synopsis,
      externalUrl: `${this.baseUrl}/catalogue/${id}/`,
      contentRating: classifyContentRatingFromGenres(detail.genres),
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getSushiScanDetail(mangaId);
    return detail.chapters.map((chapter) => ({
      id: chapter.id,
      source: this.id,
      mangaId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      date: chapter.date,
      language: chapter.language,
      externalUrl: chapter.url,
    }));
  }

  async getPageUrls(chapterId: string): Promise<string[]> {
    return getSushiScanPages(chapterId);
  }
}

export const sushiScanSource = new SushiScanSource();
