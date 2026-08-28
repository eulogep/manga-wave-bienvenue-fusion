import { searchAsura } from '@/integrations/asurascans/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class AsuraScansSource implements MangaSource {
  public readonly id = 'asurascans' as const;
  public readonly name = 'AsuraScans';
  public readonly displayName = 'AsuraScans (Manhwa EN)';
  public readonly baseUrl = 'https://asuracomic.net';
  public readonly lang = 'en';
  public readonly hasDirectPages = false;
  public readonly supportsSearch = true;
  public readonly supportsChapters = false;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchAsura(query);
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
    return {
      id,
      source: this.id,
      title: id.replace(/-/g, ' ').toUpperCase(),
      coverUrl: null,
      altTitles: [],
      author: 'AsuraScans',
      artist: null,
      status: 'ongoing',
      genres: ['Manhwa', 'Action', 'Fantasy'],
      synopsis: 'Consultez la fiche complète directement sur AsuraScans.',
      externalUrl: `${this.baseUrl}/series/${id}`,
    };
  }

  async getChapters(): Promise<SourceChapter[]> {
    return [];
  }

  async getPageUrls(): Promise<string[]> {
    return [];
  }
}

export const asuraScansSource = new AsuraScansSource();
