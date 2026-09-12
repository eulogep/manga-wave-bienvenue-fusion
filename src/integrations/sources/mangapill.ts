import {
  searchMangaPill,
  getPopularMangaPill,
  getMangaPillDetail,
  getMangaPillPages,
} from '@/integrations/mangapill/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class MangaPillSource implements MangaSource {
  public readonly id = 'mangapill' as const;
  public readonly name = 'MangaPill';
  public readonly displayName = 'MangaPill (EN)';
  public readonly baseUrl = 'https://mangapill.com';
  public readonly lang = 'en';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchMangaPill(query);
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
    const detail = await getMangaPillDetail(id);
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
      externalUrl: `${this.baseUrl}/manga/${id}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getMangaPillDetail(mangaId);
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
    return getMangaPillPages(chapterId);
  }
}

export const mangaPillSource = new MangaPillSource();
