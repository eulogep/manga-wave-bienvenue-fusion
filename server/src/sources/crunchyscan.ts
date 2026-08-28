/**
 * CrunchyScan Extractor — Playwright Headless + JSON API fallback
 * First tries the JSON API, then falls back to DOM scraping with Playwright.
 */
import type { Page } from 'playwright-core';
import { createBrowserContext } from '../lib/browser-pool.js';
import type { SearchResult, Chapter, MangaDetail, SourceExtractor } from '../lib/extractor-types.js';

const CANDIDATE_DOMAINS = [
  'https://crunchyscan.org',
  'https://crunchyscan.st',
  'https://crunchyscan.com',
  'https://crunchy-scan.com',
  'https://crunchyscan.net',
];
const BASE = CANDIDATE_DOMAINS[0];
const TIMEOUT = 15_000;

async function findActiveBase(): Promise<string> {
  for (const domain of CANDIDATE_DOMAINS) {
    try {
      const res = await fetch(domain, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      if (res.status < 500) return domain;
    } catch {
      // Try the next known public domain.
    }
  }
  return CANDIDATE_DOMAINS[0];
}

async function withPage<T>(fn: (page: Page, base: string) => Promise<T>): Promise<T> {
  const ctx = await createBrowserContext();
  const page = await ctx.newPage();
  const base = await findActiveBase();
  try {
    await page.route('**/{ads,analytics,tracking,doubleclick}**', (route) => route.abort());
    return await fn(page, base);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

async function tryJsonApi(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'MangaWave/1.0' },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return res.json();
  } catch {/* Fallback to Playwright */}
  return null;
}

export const crunchyScanExtractor: SourceExtractor = {
  id: 'crunchyscan',
  name: 'CrunchyScan (VF)',

  async search(query: string): Promise<SearchResult[]> {
    // 1. Try JSON API endpoint first
    const json = await tryJsonApi(`/api/manga/search/manga/${encodeURIComponent(query)}`);
    if (Array.isArray(json) && json.length > 0) {
      return json.map((item: any) => ({
        id: item.slug || String(item.id),
        title: item.name || item.title || 'Manga sans titre',
        coverUrl: item.cover
          ? item.cover.startsWith('http') ? item.cover : `${BASE}/${item.cover}`
          : null,
        status: item.status || 'ongoing',
        rating: 4.7,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.name || g) : ['VF'],
        author: null,
        url: `${BASE}/manga/${item.slug || item.id}`,
      }));
    }

    // 2. Playwright fallback
    return withPage(async (p, base) => {
      try {
        await p.goto(`${base}/search?q=${encodeURIComponent(query)}`, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT,
        });
      } catch (err) {
        console.warn(`[CrunchyScan] Could not reach ${base}:`, err);
        return [];
      }
      return p.evaluate((b) => {
        const items: any[] = [];
        document.querySelectorAll('a[href*="/lecture-en-ligne/"]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          if (href.includes('/read/')) return;
          const slugMatch = href.match(/\/lecture-en-ligne\/([^/?]+)/);
          if (!slugMatch) return;
          const img = link.querySelector('img');
          const h3 = link.querySelector('h3, h2, .title, [class*="title"]');
          const title = h3?.textContent?.trim() || img?.getAttribute('alt')?.trim() || '';
          if (!title) return;
          const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
          items.push({
            id: slugMatch[1],
            title,
            coverUrl: src.startsWith('http') ? src : src ? `${b}${src}` : null,
            status: 'ongoing',
            rating: 4.7,
            genres: ['VF'],
            author: null,
            url: `${b}/lecture-en-ligne/${slugMatch[1]}`,
          });
        });
        return [...new Map(items.map((i) => [i.id, i])).values()];
      }, base);
    });
  },

  async getPopular(): Promise<SearchResult[]> {
    return withPage(async (p, base) => {
      try {
        await p.goto(base, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      } catch (err) {
        console.warn(`[CrunchyScan] Could not reach ${base}:`, err);
        return [];
      }
      const items = await p.evaluate((b) => {
        const results: any[] = [];
        document.querySelectorAll('a[href*="/lecture-en-ligne/"]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          if (href.includes('/read/')) return;
          const slugMatch = href.match(/\/lecture-en-ligne\/([^/?]+)/);
          if (!slugMatch) return;
          const img = link.querySelector('img');
          const title = link.querySelector('h3, h2, .title')?.textContent?.trim()
            || img?.getAttribute('alt')?.trim() || '';
          if (!title) return;
          const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
          results.push({
            id: slugMatch[1],
            title,
            coverUrl: src.startsWith('http') ? src : src ? `${b}${src}` : null,
            status: 'ongoing',
            rating: 4.8,
            genres: ['VF', 'Français'],
            author: null,
            url: `${b}/lecture-en-ligne/${slugMatch[1]}`,
          });
        });
        return [...new Map(results.map((i) => [i.id, i])).values()].slice(0, 20);
      }, base);
      if (items.length > 0) return items;
      return [];
    });
  },

  async getDetail(idOrSlug: string): Promise<MangaDetail> {
    return withPage(async (p, base) => {
      await p.goto(`${base}/lecture-en-ligne/${idOrSlug}`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });
      return p.evaluate((args) => {
        const { b, id } = args;
        const title = document.querySelector('h1')?.textContent?.trim() || id;
        const coverEl = document.querySelector<HTMLImageElement>('img[class*="cover"], img[class*="poster"], img[class*="thumb"]');
        const coverSrc = coverEl?.getAttribute('data-src') || coverEl?.getAttribute('src') || null;
        const coverUrl = coverSrc ? (coverSrc.startsWith('http') ? coverSrc : `${b}${coverSrc}`) : null;

        const synopsis = document.querySelector<HTMLElement>('[class*="synopsis"], [class*="description"], [class*="summary"]')?.innerText?.trim() || null;

        const chapters: any[] = [];
        document.querySelectorAll('a[href*="/read/"]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          const text = link.textContent || '';
          const numMatch = text.match(/[\d.]+/);
          if (!numMatch) return;
          const dateEl = link.closest('li, div, tr')?.querySelector('time, span[class*="date"], small');
          chapters.push({
            id: href,
            chapterNumber: numMatch[0],
            title: null,
            date: dateEl?.textContent?.trim() || '',
            language: 'fr',
            url: href.startsWith('http') ? href : `${b}${href}`,
          });
        });

        return { id, title, coverUrl, author: null, status: 'ongoing', genres: ['VF'], synopsis, chapters };
      }, { b: base, id: idOrSlug });
    });
  },

  async getPages(chapterPath: string): Promise<string[]> {
    return withPage(async (p, base) => {
      const targetUrl = chapterPath.startsWith('http') ? chapterPath : `${base}/${chapterPath}`;
      await p.goto(targetUrl, { waitUntil: 'networkidle', timeout: TIMEOUT });

      // Wait for reader images
      await p.waitForSelector('.reading-content img, .chapter-images img, #reader img, img[class*="page"]', {
        timeout: 15_000,
      }).catch(() => {});

      return p.evaluate((b) => {
        const selectors = [
          '.reading-content img',
          '.chapter-images img',
          '#reader img',
          'img[class*="page-image"]',
          'img[class*="chapter-image"]',
          '.page img',
        ];
        for (const sel of selectors) {
          const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel));
          const urls = imgs
            .map((img) => img.getAttribute('data-src') || img.getAttribute('src') || '')
            .filter((src) => src && src.match(/\.(jpg|jpeg|png|webp)/i))
            .map((src) => src.startsWith('http') ? src : `${b}${src}`);
          if (urls.length > 0) return urls;
        }
        // Last resort: collect all manga-like images on the page
        return Array.from(document.querySelectorAll<HTMLImageElement>('img'))
          .map((img) => img.getAttribute('data-src') || img.getAttribute('src') || '')
          .filter((src) => src && src.match(/\.(jpg|jpeg|png|webp)/i) && !src.includes('logo') && !src.includes('icon'))
          .map((src) => src.startsWith('http') ? src : `${b}${src}`);
      }, base);
    });
  },
};
