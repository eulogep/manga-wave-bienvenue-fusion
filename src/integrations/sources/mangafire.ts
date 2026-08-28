import { getMangaFireDetail, getMangaFirePages, searchMangaFire } from '@/integrations/mangafire/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class MangaFireSource implements MangaSource {
  public readonly id = 'mangafire' as const;
  public readonly name = 'MangaFire';
  public readonly displayName = 'MangaFire (EN / Multi)';
  public readonly baseUrl = 'https://mangafire.to';
  public readonly lang = 'multi';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchMangaFire(query, page);
    return results.map((item) => ({
      id: item.id,
      source: this.id,
      title: item.title,
      coverUrl: item.coverUrl,
      status: item.status,
      rating: item.rating,
      url: item.url,
      genres: ['Manga', 'Manhwa'],
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const detail = await getMangaFireDetail(id);
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
    const detail = await getMangaFireDetail(mangaId);
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
    return getMangaFirePages(chapterId);
  }
}

export const mangaFireSource = new MangaFireSource();
