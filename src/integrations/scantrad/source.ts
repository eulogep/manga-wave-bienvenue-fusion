import { searchScantrad, getScantradDetail, getScantradPages } from '@/integrations/scantrad/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from '@/integrations/sources/types';

export class ScantradSource implements MangaSource {
  public readonly id = 'scantrad' as const;
  public readonly name = 'Scantrad';
  public readonly displayName = 'Scantrad (FR)';
  public readonly baseUrl = 'https://manga-scantrad.io';
  public readonly lang = 'fr';
  public readonly hasDirectPages = true;
  public readonly supportsSearch = true;
  public readonly supportsChapters = true;

  async search(query: string, page = 1): Promise<SourceSearchResult[]> {
    const results = await searchScantrad(query, page);
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
    const detail = await getScantradDetail(id);
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
      externalUrl: `${this.baseUrl}/manga/${id}`,
      lastChapter: detail.chapters[0]?.chapterNumber || null,
    };
  }

  async getChapters(mangaId: string): Promise<SourceChapter[]> {
    const detail = await getScantradDetail(mangaId);
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
    return getScantradPages(chapterId);
  }
}

export const scantradSource = new ScantradSource();
