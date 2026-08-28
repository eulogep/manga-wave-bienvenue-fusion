import {
  getComickDetail,
  getComickPages,
  searchComick,
} from '@/integrations/comick/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class ComickSource implements MangaSource {
  public readonly id = 'comick' as const;
  public readonly name = 'Comick';
  public readonly displayName = 'Comick.io (Multi / FR)';
  public readonly baseUrl = 'https://comick.io';
  public readonly lang = 'multi';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchComick(query, page);
    return results.map((item) => ({
      id: item.slug || item.id,
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
    const detail = await getComickDetail(id);
    return {
      id: detail.slug,
      source: this.id,
      title: detail.title,
      coverUrl: detail.coverUrl,
      altTitles: detail.altTitles,
      author: detail.author,
      artist: detail.artist,
      status: detail.status,
      genres: detail.genres,
      synopsis: detail.synopsis,
      year: detail.year,
      externalUrl: `https://comick.io/comic/${detail.slug}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getComickDetail(mangaId);
    return detail.chapters.map((ch) => ({
      id: ch.id,
      source: this.id,
      mangaId,
      chapterNumber: ch.chapterNumber,
      volume: ch.volume,
      title: ch.title,
      date: ch.date,
      scanlationGroup: ch.groupName,
      language: ch.lang,
      externalUrl: ch.url,
    }));
  }

  async getPageUrls(chapterId: string): Promise<string[]> {
    return getComickPages(chapterId);
  }
}

export const comickSource = new ComickSource();
