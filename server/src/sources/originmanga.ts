/**
 * OriginManga Extractor — Playwright Headless
 * Uses a server-side Chrome browser to render public chapter pages.
 */
import type { Page } from 'playwright-core';
import { createBrowserContext } from '../lib/browser-pool.js';
import type { SearchResult, Chapter, MangaDetail, SourceExtractor } from '../lib/extractor-types.js';

const BASE = 'https://www.originmanga.com';
const TIMEOUT = 30_000;

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx = await createBrowserContext();
  const page = await ctx.newPage();
  try {
    // Block ads and tracking to speed up page loads
    await page.route('**/{ads,analytics,tracking,doubleclick}**', (route) => route.abort());
    await page.route('**/*.{woff,woff2,ttf,otf}', (route) => route.abort());
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

function cleanText(el: string | null | undefined): string {
  if (!el) return '';
  return el.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export const originMangaExtractor: SourceExtractor = {
  id: 'originmanga',
  name: 'OriginManga (VF)',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    return withPage(async (p) => {
      await p.goto(`${BASE}/search.php?q=${encodeURIComponent(query)}&page=${page}`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });

      return p.evaluate((base) => {
        const items: any[] = [];
        document.querySelectorAll('a[href*="manga.php?id="]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          const idMatch = href.match(/id=([^&]+)/);
          if (!idMatch) return;
          const img = link.querySelector('img');
          const title = link.querySelector('b')?.textContent?.trim()
            || img?.getAttribute('alt')?.trim()
            || 'Manga sans titre';
          const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
          items.push({
            id: idMatch[1],
            title,
            coverUrl: src.startsWith('http') ? src : src ? `${base}${src}` : null,
            status: 'ongoing',
            rating: 4.8,
            genres: ['VF', 'Scan FR'],
            author: null,
            url: `${base}/manga.php?id=${idMatch[1]}`,
          });
        });
        return items;
      }, BASE);
    });
  },

  async getPopular(): Promise<SearchResult[]> {
    return withPage(async (p) => {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      const results = await p.evaluate((base) => {
        const seen = new Set<string>();
        const items: any[] = [];
        document.querySelectorAll('a[href*="manga.php?id="]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          const idMatch = href.match(/id=([^&]+)/);
          if (!idMatch || seen.has(idMatch[1])) return;
          seen.add(idMatch[1]);
          const img = link.querySelector('img');
          const title = link.querySelector('b')?.textContent?.trim()
            || img?.getAttribute('alt')?.trim()
            || 'Manga';
          const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
          items.push({
            id: idMatch[1],
            title,
            coverUrl: src.startsWith('http') ? src : src ? `${base}${src}` : null,
            status: 'ongoing',
            rating: 4.9,
            genres: ['VF', 'Scan FR'],
            author: null,
            url: `${base}/manga.php?id=${idMatch[1]}`,
          });
        });
        return items.slice(0, 20);
      }, BASE);
      if (results.length > 0) return results;
      return this.search('a');
    });
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    return withPage(async (p) => {
      await p.goto(`${BASE}/manga.php?id=${mangaId}`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });

      return p.evaluate((args) => {
        const { base, id } = args;
        const title = document.querySelector('h1')?.textContent?.trim() || id;
        const coverEl = document.querySelector<HTMLImageElement>('img.thumbnail, img[class*="cover"], img[class*="thumb"]');
        const coverSrc = coverEl?.getAttribute('src') || coverEl?.getAttribute('data-src') || null;
        const coverUrl = coverSrc ? (coverSrc.startsWith('http') ? coverSrc : `${base}${coverSrc}`) : null;

        const synopsis = document.querySelector<HTMLElement>('.description, [class*="synopsis"], [class*="summary"]')?.innerText?.trim() || null;
        const statusEl = document.querySelector<HTMLElement>('[class*="status"], strong:has(+ span)')?.nextElementSibling?.textContent?.trim() || 'ongoing';

        const genres: string[] = [];
        document.querySelectorAll('a[href*="genre"], a[href*="tag"]').forEach((el) => {
          const text = el.textContent?.trim();
          if (text && !genres.includes(text)) genres.push(text);
        });

        const chapters: any[] = [];
        document.querySelectorAll('a[href*="read.php?id="]').forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          const chIdMatch = href.match(/id=([a-f0-9-]+)/i);
          if (!chIdMatch) return;
          const text = link.textContent || '';
          const numMatch = text.match(/[\d.]+/);
          if (!numMatch) return;
          const dateEl = link.closest('li, tr, div')?.querySelector('span, small, time');
          chapters.push({
            id: chIdMatch[1],
            chapterNumber: numMatch[0],
            title: null,
            date: dateEl?.textContent?.trim() || '',
            language: 'fr',
            url: href,
          });
        });

        return { id, title, coverUrl, author: null, status: statusEl, genres, synopsis, chapters };
      }, { base: BASE, id: mangaId });
    });
  },

  async getPages(chapterId: string): Promise<string[]> {
    return withPage(async (p) => {
      await p.goto(`${BASE}/read.php?id=${chapterId}`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT,
      });

      // Wait for images to appear in reader
      await p.waitForSelector('img[alt*="Page"], img[src*="img-proxy"], .reader img, #reader img', {
        timeout: 15_000,
      }).catch(() => {});

      return p.evaluate((base) => {
        const selectors = [
          'img[alt*="Page"]',
          'img[src*="img-proxy"]',
          '.reader-content img',
          '#reader img',
          '.chapter-content img',
          '#chapter img',
        ];

        for (const sel of selectors) {
          const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel));
          const urls = imgs
            .map((img) => img.getAttribute('data-src') || img.getAttribute('src') || '')
            .filter((src) => src && (src.includes('img-proxy') || src.match(/\.(jpg|jpeg|png|webp)/i)))
            .map((src) => src.startsWith('http') ? src : `${base}${src}`);
          if (urls.length > 0) return urls;
        }
        return [];
      }, BASE);
    });
  },
};
