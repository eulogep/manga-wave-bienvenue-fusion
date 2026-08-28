import {
  searchOriginManga,
  getOriginMangaDetail,
  getOriginMangaPages,
} from '@/integrations/originmanga/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class OriginMangaSource implements MangaSource {
  public readonly id = 'originmanga' as const;
  public readonly name = 'OriginManga';
  public readonly displayName = 'OriginManga (FR)';
  public readonly baseUrl = 'https://www.originmanga.com';
  public readonly lang = 'fr';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchOriginManga(query, page);
    return results.map((item) => ({
      id: item.id,
      source: this.id,
      title: item.title,
      coverUrl: item.coverUrl,
      status: item.status,
      rating: item.rating,
      url: item.url,
    }));
  }

  async getMangaDetails(id: string): Promise<SourceManga> {
    const detail = await getOriginMangaDetail(id);
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
      externalUrl: `${this.baseUrl}/manga.php?id=${id}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getOriginMangaDetail(mangaId);
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
    return getOriginMangaPages(chapterId);
  }
}

export const originMangaSource = new OriginMangaSource();
