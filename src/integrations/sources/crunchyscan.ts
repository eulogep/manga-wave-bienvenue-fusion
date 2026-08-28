import {
  getCrunchyScanDetail,
  getCrunchyScanPages,
  searchCrunchyScan,
} from '@/integrations/crunchyscan/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class CrunchyScanSource implements MangaSource {
  public readonly id = 'crunchyscan' as const;
  public readonly name = 'CrunchyScan';
  public readonly displayName = 'CrunchyScan (FR)';
  public readonly baseUrl = 'https://crunchyscan.org';
  public readonly lang = 'fr';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchCrunchyScan(query);
    return results.map((item) => ({
      id: item.id,
      source: this.id,
      title: item.title,
      coverUrl: item.coverUrl,
      status: item.status,
      rating: item.rating,
      genres: item.genres,
      url: item.url,
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const detail = await getCrunchyScanDetail(id);
    return {
      id: detail.id,
      source: this.id,
      title: detail.title,
      coverUrl: detail.coverUrl,
      altTitles: detail.altTitles,
      author: detail.author,
      artist: detail.artist,
      status: detail.status,
      genres: detail.genres,
      synopsis: detail.synopsis,
      externalUrl: `${this.baseUrl}/manga/${detail.id}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getCrunchyScanDetail(mangaId);
    return detail.chapters.map((ch) => ({
      id: ch.id,
      source: this.id,
      mangaId,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      date: ch.date,
      externalUrl: ch.url,
      language: 'fr',
    }));
  }

  async getPageUrls(chapterId: string): Promise<string[]> {
    return getCrunchyScanPages(chapterId);
  }
}

export const crunchyScanSource = new CrunchyScanSource();
