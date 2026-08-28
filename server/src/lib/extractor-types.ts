/**
 * Extractor Types & Interfaces
 * Each source implements this interface, regardless of whether it uses
 * Playwright (scraped) or HTTP JSON (API-backed).
 */

export interface SearchResult {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  genres: string[];
  author: string | null;
  url: string;
}

export interface Chapter {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  language: string;
  url: string;
}

export interface MangaDetail {
  id: string;
  title: string;
  coverUrl: string | null;
  author: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: Chapter[];
}

export interface SourceExtractor {
  id: string;
  name: string;
  search(query: string, page?: number): Promise<SearchResult[]>;
  getPopular(page?: number): Promise<SearchResult[]>;
  getDetail(mangaId: string): Promise<MangaDetail>;
  getPages(chapterId: string): Promise<string[]>;
}

/** Registry of all available extractors */
import type { SourceExtractor as SE } from './extractor-types.js';
export { SE };
