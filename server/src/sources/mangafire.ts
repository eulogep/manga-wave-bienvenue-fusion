/**
 * MangaFire / FlameComics Extractor
 * High-performance action & fantasy manhwa/manga source
 */
import type { SearchResult, Chapter, MangaDetail, SourceExtractor } from '../lib/extractor-types.js';
import { createBrowserContext } from '../lib/browser-pool.js';

const BASE = 'https://flamecomics.xyz';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(urlOrPath: string): Promise<string> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`MangaFire/Flame HTTP ${res.status}: ${urlOrPath}`);
  return res.text();
}

async function fetchRenderedHtml(urlOrPath: string): Promise<string> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  const context = await createBrowserContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1_500);
    return page.content();
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

function parseCards(html: string): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();

  // Extract /series/:id links
  const cardRegex = /<a[^>]+href="(\/series\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const href = match[1];
    const slug = href.replace('/series/', '').replace(/^\/+|\/+$/g, '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const inner = match[2];

    // Extract image URL
    const srcMatch = inner.match(/src="([^"]+)"/i) || inner.match(/srcSet="([^",\s]+)/i);
    let coverUrl = srcMatch ? srcMatch[1] : null;
    if (coverUrl && coverUrl.includes('/_next/image?url=')) {
      try {
        const u = new URL(coverUrl, BASE);
        const realUrl = u.searchParams.get('url');
        if (realUrl) coverUrl = realUrl;
      } catch {
        // Conserver l'URL d'origine si le proxy Next.js est mal formé.
      }
    }

    // Extract alt / title
    const altMatch = inner.match(/alt="([^"]*)"/i);
    const textTitle = inner.replace(/<[^>]+>/g, '').trim();
    const title = altMatch && altMatch[1].trim()
      ? altMatch[1].trim()
      : textTitle || `Series #${slug}`;

    items.push({
      id: slug,
      title: title || `Manga #${slug}`,
      coverUrl: coverUrl ? (coverUrl.startsWith('http') ? coverUrl : `${BASE}${coverUrl}`) : null,
      status: 'ongoing',
      rating: 4.9,
      genres: ['Manga', 'Action', 'EN'],
      author: 'FlameComics',
      url: `${BASE}${href}`,
    });
  }

  return items.slice(0, 24);
}

async function loadCards(path: string): Promise<SearchResult[]> {
  const direct = parseCards(await fetchHtml(path));
  if (direct.length > 0) return direct;

  const rendered = parseCards(await fetchRenderedHtml(path));
  if (rendered.length === 0) throw new Error('MangaFire/Flame ne contient aucune fiche exploitable.');
  return rendered;
}

export const mangaFireExtractor: SourceExtractor = {
  id: 'mangafire',
  name: 'MangaFire',

  async search(query: string): Promise<SearchResult[]> {
    try {
      const all = await loadCards('/browse');
      const q = query.toLowerCase();
      const filtered = all.filter((item) => item.title.toLowerCase().includes(q));
      return filtered.length > 0 ? filtered : all.slice(0, 10);
    } catch (err: unknown) {
      console.warn('[MangaFire] search error:', err);
      return [];
    }
  },

  async getPopular(): Promise<SearchResult[]> {
    try {
      return await loadCards('/browse');
    } catch (err: unknown) {
      console.warn('[MangaFire] popular error:', err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    const slug = mangaId.replace('/series/', '').replace(/^\/+|\/+$/g, '');
    const url = `${BASE}/series/${slug}`;
    const html = await fetchHtml(url);

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : `Series #${slug}`;

    // Extract cover
    const coverMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<img[^>]+src="([^"]*thumbnail[^"]*)"/i);
    const coverUrl = coverMatch ? coverMatch[1] : null;

    // Extract synopsis
    const synopsisMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
      || html.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const synopsis = synopsisMatch ? synopsisMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract chapters
    const chapters: Chapter[] = [];
    const seen = new Set<string>();
    const chRegex = new RegExp(`<a[^>]+href="(\\/series\\/${slug}\\/[a-f0-9]+)"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
    let chMatch: RegExpExecArray | null;

    while ((chMatch = chRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      if (seen.has(chHref)) continue;
      seen.add(chHref);

      const inner = chMatch[2];
      const numMatch = inner.match(/Chapter\s*<!--\s*-->\s*([\d.]+)/i)
        || inner.match(/Chapter\s*([\d.]+)/i)
        || inner.match(/([\d.]+)/);
      const num = numMatch ? numMatch[1] : '1';

      chapters.push({
        id: chHref,
        chapterNumber: num,
        title: `Chapter ${num}`,
        date: 'Recent',
        language: 'en',
        url: `${BASE}${chHref}`,
      });
    }

    return {
      id: slug,
      title,
      coverUrl,
      author: 'FlameComics',
      status: 'ongoing',
      genres: ['Manga', 'Action', 'Fantasy'],
      synopsis,
      chapters,
    };
  },

  async getPages(chapterPathOrUrl: string): Promise<string[]> {
    const url = chapterPathOrUrl.startsWith('http')
      ? chapterPathOrUrl
      : `${BASE}${chapterPathOrUrl.startsWith('/') ? '' : '/'}${chapterPathOrUrl}`;
    const html = await fetchHtml(url);

    const images: string[] = [];
    const seen = new Set<string>();

    const imgRegex = /https:\/\/cdn\.flamecomics\.xyz\/uploads\/images\/series\/[^\s"'<>;,]+\.(?:webp|jpg|jpeg|png)/gi;
    let imgMatch: RegExpExecArray | null;

    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const imgUrl = imgMatch[0];
      if (
        seen.has(imgUrl) ||
        /thumbnail|cover\.|logo|banner/i.test(imgUrl)
      ) {
        continue;
      }
      seen.add(imgUrl);
      images.push(imgUrl);
    }

    return images;
  },
};
