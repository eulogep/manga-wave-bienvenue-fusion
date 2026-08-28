export type SourceType =
  | 'mangadex'
  | 'originmanga'
  | 'crunchyscan'
  | 'mangafire'
  | 'asurascans'
  | 'comick'
  | 'shikimori'
  | 'kitsu'
  | 'anilist'
  | 'jikan';

export type SourceSearchResult = {
  id: string;
  source: SourceType;
  title: string;
  coverUrl: string | null;
  status?: string | null;
  rating?: number | null;
  author?: string | null;
  url?: string | null;
  genres?: string[];
};

export type SourceManga = {
  id: string;
  source: SourceType;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  themes?: string[];
  synopsis: string | null;
  year?: number | null;
  externalUrl?: string | null;
  contentRating?: string | null;
  lastChapter?: string | null;
  updatedAt?: string | null;
};

export type SourceChapter = {
  id: string;
  source: SourceType;
  mangaId?: string;
  chapterNumber: string;
  volume?: string | null;
  title: string | null;
  date: string;
  scanlationGroup?: string | null;
  scanlationGroups?: string[];
  pageCount?: number;
  language?: string;
  externalUrl?: string | null;
};

export interface MangaSource {
  id: SourceType;
  name: string;
  displayName: string;
  baseUrl: string;
  lang: string;
  hasDirectPages: boolean;
  supportsSearch: boolean;
  supportsChapters: boolean;

  search(query: string, page?: number): Promise<SourceSearchResult[]>;
  getMangaDetails(id: string): Promise<SourceManga>;
  getChapters(mangaId: string, options?: { language?: string; offset?: number; limit?: number }): Promise<SourceChapter[]>;
  getPageUrls(chapterId: string): Promise<string[]>;
}
