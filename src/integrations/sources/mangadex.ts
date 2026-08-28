import {
  getMangaById,
  getMangaChapters,
  getMangaDexChapterPages,
  searchManga,
} from '@/integrations/mangadex/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class MangaDexSource implements MangaSource {
  public readonly id = 'mangadex' as const;
  public readonly name = 'MangaDex';
  public readonly displayName = 'MangaDex (Multi)';
  public readonly baseUrl = 'https://mangadex.org';
  public readonly lang = 'multi';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const limit = 24;
    const offset = (page - 1) * limit;
    const response = await searchManga({ title: query, limit, offset });
    return response.mangas.map((manga) => ({
      id: manga.id,
      source: this.id,
      title: manga.title,
      coverUrl: manga.coverImageUrl,
      status: manga.status,
      author: manga.author,
      url: manga.externalUrl,
      genres: manga.genres,
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const manga = await getMangaById(id);
    return {
      id: manga.id,
      source: this.id,
      title: manga.title,
      coverUrl: manga.coverImageUrl,
      altTitles: [],
      author: manga.author,
      artist: manga.artist,
      status: manga.status,
      genres: manga.genres,
      themes: manga.themes,
      synopsis: manga.description,
      year: manga.year,
      externalUrl: manga.externalUrl,
      contentRating: manga.contentRating,
      lastChapter: manga.lastChapter,
      updatedAt: manga.updatedAt,
    };
  }

  async getChapters(
    mangaId: string,
    options?: { language?: string; offset?: number; limit?: number },
  ): Promise<SourceChapter[]> {
    const response = await getMangaChapters(mangaId, {
      translatedLanguage: options?.language || 'fr',
      offset: options?.offset || 0,
      limit: options?.limit || 100,
    });

    return response.chapters.map((ch) => ({
      id: ch.id,
      source: this.id,
      mangaId,
      chapterNumber: ch.chapter || '',
      volume: ch.volume,
      title: ch.title,
      date: ch.readableAt,
      scanlationGroup: ch.scanlationGroups.join(', ') || null,
      scanlationGroups: ch.scanlationGroups,
      pageCount: ch.pageCount,
      language: ch.translatedLanguage,
      externalUrl: ch.externalUrl || ch.mangaDexUrl,
    }));
  }

  async getPageUrls(chapterId: string): Promise<string[]> {
    return getMangaDexChapterPages(chapterId);
  }
}

export const mangaDexSource = new MangaDexSource();
