import {
  searchMangaKatana,
  getPopularMangaKatana,
  getMangaKatanaDetail,
  getMangaKatanaPages,
} from '@/integrations/mangakatana/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class MangaKatanaSource implements MangaSource {
  public readonly id = 'mangakatana' as const;
  public readonly name = 'MangaKatana';
  public readonly displayName = 'MangaKatana (EN)';
  public readonly baseUrl = 'https://mangakatana.com';
  public readonly lang = 'en';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchMangaKatana(query);
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
    const detail = await getMangaKatanaDetail(id);
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
    const detail = await getMangaKatanaDetail(mangaId);
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
    return getMangaKatanaPages(chapterId);
  }
}

export const mangaKatanaSource = new MangaKatanaSource();
