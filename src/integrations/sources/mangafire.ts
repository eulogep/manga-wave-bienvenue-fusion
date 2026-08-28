import { searchMangaFire } from '@/integrations/mangafire/client';
import type { MangaSource, SourceChapter, SourceManga, SourceSearchResult } from './types';

export class MangaFireSource implements MangaSource {
  public readonly id = 'mangafire' as const;
  public readonly name = 'MangaFire';
  public readonly displayName = 'MangaFire (EN / Multi)';
  public readonly baseUrl = 'https://mangafire.to';
  public readonly lang = 'multi';
  public readonly hasDirectPages = false;
  public readonly supportsSearch = true;
  public readonly supportsChapters = false;

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await searchMangaFire(query);
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
    return {
      id,
      source: this.id,
      title: id.replace(/-/g, ' ').toUpperCase(),
      coverUrl: null,
      altTitles: [],
      author: null,
      artist: null,
      status: 'ongoing',
      genres: ['Manga'],
      synopsis: 'Consultez la fiche complète directement sur MangaFire.',
      externalUrl: `${this.baseUrl}/manga/${id}`,
    };
  }

  async getChapters(): Promise<SourceChapter[]> {
    return [];
  }

  async getPageUrls(): Promise<string[]> {
    return [];
  }
}

export const mangaFireSource = new MangaFireSource();
