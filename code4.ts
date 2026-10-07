export interface SourceExtractor {
  readonly source: string;
  search(query: string): Promise<MangaResult[]>;
  getChapters(manga: MangaRef): Promise<Chapter[]>;
  downloadChapter(ch: ChapterRef, outDir: string): Promise<string[]>;
}

export abstract class BaseScraper implements SourceExtractor {
  // session persistante, backoff, cache — porté de ta classe Python
  abstract readonly source: string;
  abstract search(query: string): Promise<MangaResult[]>;
  // ...
}

export class WebtoonScraper extends BaseScraper { /* ... */ }
export class MangakakalotScraper extends BaseScraper { /* ... */ }
