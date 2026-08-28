import { getAsuraDetail, getAsuraPages, searchAsura } from '@/integrations/asurascans/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class AsuraScansSource implements MangaSource {
  public readonly id = 'asurascans' as const;
  public readonly name = 'AsuraScans';
  public readonly displayName = 'AsuraScans (Manhwa EN)';
  public readonly baseUrl = 'https://asurascans.com';
  public readonly lang = 'en';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchAsura(query, page);
    return results.map((item) => ({
      id: item.id,
      source: this.id,
      title: item.title,
      coverUrl: item.coverUrl,
      status: item.status,
      rating: item.rating,
      url: item.url,
      genres: ['Manhwa', 'Action'],
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const detail = await getAsuraDetail(id);
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
      externalUrl: `${this.baseUrl}/comics/${id}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getAsuraDetail(mangaId);
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
    return getAsuraPages(chapterId);
  }
}

export const asuraScansSource = new AsuraScansSource();
