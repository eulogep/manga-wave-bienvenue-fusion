import { searchMangasOrigines, getMangasOriginesDetail, getMangasOriginesPages } from '@/integrations/mangasorigines/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from '@/integrations/sources/types';

export class MangasOriginesSource implements MangaSource {
  public readonly id = 'mangasorigines' as const;
  public readonly name = 'MangasOrigines';
  public readonly displayName = 'Mangas Origines (FR)';
  public readonly baseUrl = 'https://mangas-origines.fr';
  public readonly lang = 'fr';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchMangasOrigines(query, page);
    return results.map(item => ({
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
    const detail = await getMangasOriginesDetail(id);
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
      externalUrl: `${this.baseUrl}/catalogue/${id}/`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getMangasOriginesDetail(mangaId);
    return detail.chapters.map(ch => ({
      id: ch.id,
      source: this.id,
      mangaId,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      date: ch.date,
      language: 'fr',
      externalUrl: ch.url,
    }));
  }

  async getPageUrls(chapterId: string): Promise<string[]> {
    return getMangasOriginesPages(chapterId);
  }
}

export const mangasOriginesSource = new MangasOriginesSource();
