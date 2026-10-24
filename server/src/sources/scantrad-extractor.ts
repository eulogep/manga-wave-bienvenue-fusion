import type { Page, Response } from 'playwright-core';
import { createScantradPage } from '../lib/browser-pool.js';
import { extractorCache } from '../lib/extractor-cache.js';
import type { MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

const BASE_URL = 'https://manga-scantrad.io';
const CATALOG_PATH = '/manga/';
const MANGA_PATH = (mangaId: string) => `/manga/${mangaId}/`;
const READER_SELECTORS = [
  '.reading-content .page-break img',
  '.reading-content img',
  '[data-reader-page] img',
];
const CHAPTER_LISTING_SELECTOR = '.listing-chapters_wrap .wp-manga-chapter a';

export async function waitForScantradChapterListing(
  page: Pick<Page, 'waitForSelector'>,
): Promise<void> {
  await page.waitForSelector(CHAPTER_LISTING_SELECTOR, {
    state: 'attached',
    timeout: 15_000,
  });
}

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const page = await createScantradPage();
  try {
    await page.route('**/{ads,analytics,tracking,doubleclick,googletag}**', (route) => route.abort());
    await page.route('**/*.{woff,woff2,ttf,otf}', (route) => route.abort());
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

function assertSafeId(value: string): string {
  const decoded = decodeURIComponent(value).trim();
  if (!decoded || decoded.length > 200 || !/^[a-z0-9][a-z0-9-]*$/i.test(decoded)) {
    throw new Error('Identifiant Manga Scantrad invalide.');
  }
  return decoded;
}

function resolveChapterUrl(chapterId: string): string {
  const decoded = decodeURIComponent(chapterId);
  const url = new URL(decoded, BASE_URL);
  if (url.protocol !== 'https:' || url.hostname !== new URL(BASE_URL).hostname) {
    throw new Error('Chapitre hors du domaine Manga Scantrad.');
  }
  return url.toString();
}

export function normalizeScantradStatus(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('fr');
  if (/termin|complet|fini/.test(normalized)) return 'completed';
  if (/pause|hiatus/.test(normalized)) return 'hiatus';
  if (/annul|abandonn/.test(normalized)) return 'cancelled';
  return 'ongoing';
}

async function assertUsablePage(page: Page, response: Response | null, operation: string): Promise<void> {
  const status = response?.status() ?? 0;
  if (status === 403 || status === 429) {
    throw new Error(`SOURCE_BLOCKED: Manga Scantrad refuse ${operation} (HTTP ${status}).`);
  }
  if (status >= 400) {
    throw new Error(`SOURCE_HTTP_ERROR: Manga Scantrad ${operation} (HTTP ${status}).`);
  }
  const marker = `${await page.title()} ${(await page.locator('body').innerText().catch(() => '')).slice(0, 500)}`;
  if (/attention required|just a moment|cloudflare|captcha|access denied/i.test(marker)) {
    throw new Error(`SOURCE_BLOCKED: Manga Scantrad présente une page de protection pendant ${operation}.`);
  }
}

async function parseListing(page: Page): Promise<SearchResult[]> {
  return page.evaluate(({ baseUrl }) => {
    const results = new Map<string, SearchResult>();
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/manga/"]').forEach((link) => {
      const url = new URL(link.href, baseUrl);
      const match = url.pathname.match(/^\/manga\/([^/]+)\/?$/);
      if (!match) return;
      const card = link.closest<HTMLElement>('.page-item-detail, .row.c-tabs-item__content, article, li, [class*="manga"]')
        || link.parentElement;
      const heading = link.closest<HTMLElement>('h2, h3, h4, [class*="title"]')
        || link.querySelector<HTMLElement>('h2, h3, h4, [class*="title"]')
        || card?.querySelector<HTMLElement>('.post-title, h2, h3, h4, [class*="title"]');
      const image = link.querySelector<HTMLImageElement>('img') || card?.querySelector<HTMLImageElement>('img');
      const candidate = heading?.innerText.trim()
        || image?.alt.trim()
        || link.getAttribute('title')?.trim()
        || link.innerText.trim();
      const cover = image?.dataset.src || image?.dataset.lazySrc || image?.currentSrc || image?.src || '';
      const ratingText = card?.innerText.match(/\b([0-5](?:[.,]\d)?)\b/)?.[1];
      const previous = results.get(match[1]);
      const usableTitle = candidate && !/^(manga|manhwa|manhua|webcomic)$/i.test(candidate) ? candidate : '';
      if (!previous) {
        results.set(match[1], {
          id: match[1], title: usableTitle,
          coverUrl: cover ? new URL(cover, baseUrl).toString() : null,
          status: 'ongoing', rating: ratingText ? Number(ratingText.replace(',', '.')) : null,
          genres: [], author: null, url: url.toString(),
        });
      } else {
        if (usableTitle && (!previous.title || usableTitle.length > previous.title.length)) previous.title = usableTitle;
        if (!previous.coverUrl && cover) previous.coverUrl = new URL(cover, baseUrl).toString();
      }
    });
    return Array.from(results.values()).filter((item) => item.title).slice(0, 30);
  }, { baseUrl: BASE_URL });
}

async function loadCatalog(page = 1): Promise<SearchResult[]> {
  const cacheKey = `scantrad|catalog|${page}`;
  const cached = extractorCache.get<SearchResult[]>(cacheKey);
  if (cached) return cached;
  const results = await withPage(async (browserPage) => {
    const path = page > 1 ? `${CATALOG_PATH}page/${page}/` : CATALOG_PATH;
    const response = await browserPage.goto(new URL(path, BASE_URL).toString(), {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await assertUsablePage(browserPage, response, 'le chargement du catalogue');
    const parsed = await parseListing(browserPage);
    if (parsed.length === 0) {
      throw new Error('SOURCE_LAYOUT_ERROR: aucun manga Manga Scantrad reconnu dans le catalogue.');
    }
    return parsed;
  });
  extractorCache.set(cacheKey, results);
  return results;
}

export const scantradExtractor: SourceExtractor = {
  id: 'scantrad',
  name: 'Manga Scantrad (VF)',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    const needle = query.trim().toLocaleLowerCase('fr');
    if (!needle) return [];
    const catalogue = await loadCatalog(page);
    return catalogue.filter((item) => item.title.toLocaleLowerCase('fr').includes(needle));
  },

  async getPopular(page = 1): Promise<SearchResult[]> {
    return loadCatalog(page);
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    const safeId = assertSafeId(mangaId);
    const cacheKey = `scantrad|detail|${safeId}`;
    const cached = extractorCache.get<MangaDetail>(cacheKey);
    if (cached) return cached;
    const detail = await withPage(async (browserPage) => {
      const response = await browserPage.goto(new URL(MANGA_PATH(safeId), BASE_URL).toString(), {
        waitUntil: 'domcontentloaded', timeout: 30_000,
      });
      await assertUsablePage(browserPage, response, 'le chargement de la fiche');
      await waitForScantradChapterListing(browserPage);
      const parsed = await browserPage.evaluate(({ baseUrl, id }) => {
        const title = document.querySelector<HTMLElement>('.post-title h1, .site-content h1, h1')?.innerText?.trim() || '';
        const coverNode = document.querySelector<HTMLImageElement>('.summary_image img, .profile-manga img, img[class*="cover"]');
        const cover = coverNode?.dataset.src || coverNode?.dataset.lazySrc || coverNode?.currentSrc || coverNode?.src
          || document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || null;
        const fields = Array.from(document.querySelectorAll<HTMLElement>('.post-content_item'));
        const authorItem = fields.find((node) => /author|auteur/i.test(node.querySelector<HTMLElement>('.summary-heading, h5')?.innerText || ''));
        const author = authorItem?.querySelector<HTMLElement>('.summary-content')?.innerText?.trim() || null;
        const statusItem = fields.find((node) => /status|statut/i.test(node.querySelector<HTMLElement>('.summary-heading, h5')?.innerText || ''));
        const statusRaw = statusItem?.querySelector<HTMLElement>('.summary-content')?.innerText?.trim() || '';
        const genreItem = fields.find((node) => /genre/i.test(node.querySelector<HTMLElement>('.summary-heading, h5')?.innerText || ''));
        const genres = Array.from(genreItem?.querySelectorAll<HTMLAnchorElement>('.summary-content a, a') || [])
          .map((link) => link.innerText.trim())
          .filter((value) => value && !/^fr$/i.test(value));
        const synopsis = document.querySelector<HTMLElement>('.summary__content, .description-summary, [class*="synopsis"]')?.innerText?.trim()
          || document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim() || null;
        const chapters: MangaDetail['chapters'] = [];
        const seen = new Set<string>();
        document.querySelectorAll<HTMLAnchorElement>('.listing-chapters_wrap .wp-manga-chapter a, .page-content-listing a[href*="chapter"], a[href*="chapitre"]').forEach((link) => {
          const label = link.innerText.trim();
          const number = label.match(/(?:chapitre|chapter|ch\.?)\s*([\d.]+)/i)?.[1]
            || link.href.match(/(?:chapter|chapitre)[-_/]([\d.]+)/i)?.[1];
          if (!number) return;
          const href = new URL(link.href, baseUrl);
          if (href.hostname !== new URL(baseUrl).hostname) return;
          const absolute = href.toString();
          if (seen.has(absolute)) return;
          seen.add(absolute);
          const row = link.closest<HTMLElement>('li, article, tr, [class*="chapter"]');
          const date = row?.querySelector<HTMLElement>('.chapter-release-date, time, [class*="date"]')?.innerText?.trim() || '';
          chapters.push({ id: absolute, chapterNumber: number, title: null, date, language: 'fr', url: absolute });
        });
        return { id, title, coverUrl: cover ? new URL(cover, baseUrl).toString() : null, author, status: statusRaw, genres, synopsis, chapters };
      }, { baseUrl: BASE_URL, id: safeId });
      if (!parsed.title) throw new Error('SOURCE_LAYOUT_ERROR: titre Manga Scantrad introuvable.');
      return { ...parsed, status: normalizeScantradStatus(parsed.status) };
    });
    extractorCache.set(cacheKey, detail);
    return detail;
  },

  async getPages(chapterId: string): Promise<string[]> {
    const url = resolveChapterUrl(chapterId);
    const cacheKey = `scantrad|pages|${url}`;
    const cached = extractorCache.get<string[]>(cacheKey);
    if (cached) return cached;
    const images = await withPage(async (browserPage) => {
      const response = await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await assertUsablePage(browserPage, response, 'le chargement du chapitre');
      for (let step = 0; step < 5; step += 1) {
        await browserPage.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 2, 1600)));
        await browserPage.waitForTimeout(250);
      }
      const result = await browserPage.evaluate((selectors) => {
        for (const selector of selectors) {
          const seen = new Set<string>();
          const urls = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
            .map((image) => image.dataset.src || image.dataset.lazySrc || image.getAttribute('data-original') || image.currentSrc || image.src)
            .filter((source): source is string => Boolean(source))
            .map((source) => new URL(source, document.baseURI).toString())
            .filter((source) => !/(logo|avatar|banner|advert|favicon|icon|emoji)/i.test(source))
            .filter((source) => !seen.has(source) && Boolean(seen.add(source)));
          if (urls.length > 0) return urls;
        }
        return [];
      }, READER_SELECTORS);
      if (result.length === 0) throw new Error('SOURCE_LAYOUT_ERROR: aucune page Manga Scantrad reconnue.');
      return result;
    });
    extractorCache.set(cacheKey, images);
    return images;
  },
};
