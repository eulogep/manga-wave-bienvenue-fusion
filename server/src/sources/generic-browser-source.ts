import type { Page } from 'playwright-core';
import { createBrowserContext } from '../lib/browser-pool.js';
import type { MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

type BrowserSourceConfig = {
  id: string;
  name: string;
  baseUrl: string;
  language: string;
  mangaPath: (mangaId: string) => string;
  searchPath: (query: string, page: number) => string;
  mangaHrefPattern: string;
  chapterHrefPatterns: string[];
  readerSelectors: string[];
};

const TIMEOUT = 30_000;

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await createBrowserContext();
  const page = await context.newPage();
  try {
    await page.route('**/{ads,analytics,tracking,doubleclick,googletag}**', (route) => route.abort());
    await page.route('**/*.{woff,woff2,ttf,otf}', (route) => route.abort());
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

function assertSafeId(value: string): string {
  const decoded = decodeURIComponent(value);
  if (!decoded || decoded.length > 500 || [...decoded].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error('Identifiant de ressource invalide.');
  }
  return decoded;
}

function resolveChapterUrl(config: BrowserSourceConfig, chapterId: string): string {
  const decoded = assertSafeId(chapterId);
  const url = new URL(decoded.startsWith('http') ? decoded : decoded, config.baseUrl);
  if (url.protocol !== 'https:' || url.hostname !== new URL(config.baseUrl).hostname) {
    throw new Error(`Chapitre hors du domaine autorisé pour ${config.name}.`);
  }
  return url.toString();
}

export function createGenericBrowserSource(config: BrowserSourceConfig): SourceExtractor {
  const mapListingPage = async (page: Page): Promise<SearchResult[]> => page.evaluate((args) => {
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    document.querySelectorAll<HTMLAnchorElement>(`a[href*="${args.hrefPattern}"]`).forEach((link) => {
      const url = new URL(link.href, args.baseUrl);
      const markerIndex = url.pathname.indexOf(args.hrefPattern);
      if (markerIndex < 0) return;
      const id = url.pathname.slice(markerIndex + args.hrefPattern.length).replace(/^\/+|\/+$/g, '');
      if (!id || seen.has(id)) return;
      const card = link.closest<HTMLElement>('article, li, [class*="unit"], [class*="card"], [class*="item"]')
        || link.parentElement?.parentElement
        || link.parentElement;
      const image = link.querySelector<HTMLImageElement>('img') || card?.querySelector<HTMLImageElement>('img');
      const title = link.querySelector<HTMLElement>('h1, h2, h3, h4, [class*="title"], [class*="name"]')?.innerText?.trim()
        || card?.querySelector<HTMLElement>('h1, h2, h3, h4, [class*="title"], [class*="name"]')?.innerText?.trim()
        || link.innerText?.trim()
        || image?.alt?.trim()
        || link.getAttribute('title')?.trim()
        || '';
      if (!title) return;
      seen.add(id);
      const imageSource = image?.dataset.src || image?.dataset.lazySrc || image?.src || '';
      results.push({
        id,
        title,
        coverUrl: imageSource ? new URL(imageSource, args.baseUrl).toString() : null,
        status: 'ongoing',
        rating: null,
        genres: [args.language],
        author: null,
        url: url.toString(),
      });
    });
    return results.slice(0, 24);
  }, {
    baseUrl: config.baseUrl,
    hrefPattern: config.mangaHrefPattern,
    language: config.language,
  });

  return {
    id: config.id,
    name: config.name,

    async search(query: string, page = 1): Promise<SearchResult[]> {
      return withPage(async (browserPage) => {
        await browserPage.goto(new URL(config.searchPath(query, page), config.baseUrl).toString(), {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT,
        });
        await browserPage.waitForTimeout(1_200);
        return mapListingPage(browserPage);
      });
    },

    async getPopular(): Promise<SearchResult[]> {
      return withPage(async (browserPage) => {
        await browserPage.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await browserPage.waitForTimeout(1_200);
        return mapListingPage(browserPage);
      });
    },

    async getDetail(mangaId: string): Promise<MangaDetail> {
      const safeMangaId = assertSafeId(mangaId);
      return withPage(async (browserPage) => {
        const detailUrl = new URL(config.mangaPath(safeMangaId), config.baseUrl).toString();
        await browserPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await browserPage.waitForTimeout(800);

        return browserPage.evaluate((args) => {
          const title = document.querySelector<HTMLElement>('h1')?.innerText?.trim()
            || document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim()
            || args.mangaId.replace(/[-_]/g, ' ');
          const coverElement = document.querySelector<HTMLImageElement>('img[class*="cover"], img[class*="poster"], img[class*="thumb"]');
          const coverSource = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content
            || coverElement?.dataset.src
            || coverElement?.src
            || null;
          const synopsis = document.querySelector<HTMLElement>('[class*="synopsis"], [class*="description"], [class*="summary"]')?.innerText?.trim()
            || document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim()
            || null;
          const chapters: MangaDetail['chapters'] = [];
          const seen = new Set<string>();
          const selector = args.chapterPatterns.map((pattern) => `a[href*="${pattern}"]`).join(',');
          document.querySelectorAll<HTMLAnchorElement>(selector).forEach((link) => {
            const href = new URL(link.href, args.baseUrl).toString();
            if (seen.has(href)) return;
            const text = link.innerText || link.textContent || '';
            const numberMatch = text.match(/(?:chapter|chapitre|ch\.?|episode|ep\.?)\s*([\d.]+)/i)
              || href.match(/(?:chapter|chapitre|ch-|episode)[-_/]?([\d.]+)/i)
              || text.match(/([\d.]+)/);
            if (!numberMatch) return;
            seen.add(href);
            const row = link.closest('li, article, tr, [class*="chapter"], div');
            const date = row?.querySelector<HTMLElement>('time, [class*="date"], small')?.innerText?.trim() || '';
            chapters.push({
              id: href,
              chapterNumber: numberMatch[1],
              title: null,
              date,
              language: args.language,
              url: href,
            });
          });
          return {
            id: args.mangaId,
            title,
            coverUrl: coverSource ? new URL(coverSource, args.baseUrl).toString() : null,
            author: null,
            status: 'ongoing',
            genres: [args.language],
            synopsis,
            chapters,
          };
        }, {
          baseUrl: config.baseUrl,
          mangaId: safeMangaId,
          language: config.language,
          chapterPatterns: config.chapterHrefPatterns,
        });
      });
    },

    async getPages(chapterId: string): Promise<string[]> {
      const chapterUrl = resolveChapterUrl(config, chapterId);
      return withPage(async (browserPage) => {
        await browserPage.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await browserPage.waitForTimeout(1_200);
        for (let step = 0; step < 5; step += 1) {
          await browserPage.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 2, 1600)));
          await browserPage.waitForTimeout(250);
        }

        return browserPage.evaluate((selectors) => {
          for (const selector of selectors) {
            const images: string[] = [];
            const seen = new Set<string>();
            const nodes = document.querySelectorAll<HTMLImageElement>(selector);
            for (const image of nodes) {
              const source = image.dataset.src
                || image.dataset.lazySrc
                || image.getAttribute('data-original')
                || image.currentSrc
                || image.src;
              if (!source) continue;
              const absoluteUrl = new URL(source, document.baseURI).toString();
              if (/(logo|avatar|banner|advert|favicon|icon|emoji)/i.test(absoluteUrl) || seen.has(absoluteUrl)) continue;
              seen.add(absoluteUrl);
              images.push(absoluteUrl);
            }
            if (images.length > 0) return images;
          }
          return [];
        }, config.readerSelectors);
      });
    },
  };
}
