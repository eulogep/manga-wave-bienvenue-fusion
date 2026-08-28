/**
 * AsuraScans / AsuraComic Extractor
 * High-performance manhwa/action extractor connecting to asuracomic.net
 */
import type { SearchResult, Chapter, MangaDetail, SourceExtractor } from '../lib/extractor-types.js';

const BASE = 'https://asurascans.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AsuraScans HTTP ${res.status}: ${url}`);
  return res.text();
}

function parseCards(html: string): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();

  // Match /comics/ links
  const cardRegex = /<a[^>]+href="(\/comics\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.includes('/chapter/')) continue;
    const slug = href.replace('/comics/', '').replace(/^\/+|\/+$/g, '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const inner = match[2];

    // Extract cover
    const srcMatch = inner.match(/src="([^"]+)"/i);
    const coverUrl = srcMatch ? srcMatch[1] : null;

    // Extract alt / title
    const altMatch = inner.match(/alt="([^"]*)"/i);
    const h3Match = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = h3Match
      ? h3Match[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim()
      : altMatch
      ? altMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim()
      : slug.replace(/-b57aa235$/i, '').replace(/[-_]/g, ' ');

    // Extract rating
    const ratingMatch = inner.match(/<span[^>]*class="[^"]*text-white[^"]*"[^>]*>([\d.]+)<\/span>/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) / 2 : 4.8;

    items.push({
      id: slug,
      title: title || slug,
      coverUrl: coverUrl ? (coverUrl.startsWith('http') ? coverUrl : `${BASE}${coverUrl}`) : null,
      status: 'ongoing',
      rating: isNaN(rating) ? 4.8 : Math.min(5, Math.max(1, rating)),
      genres: ['Manhwa', 'Action', 'EN'],
      author: 'AsuraScans',
      url: `${BASE}${href}`,
    });
  }

  return items.slice(0, 24);
}

export const asuraScansExtractor: SourceExtractor = {
  id: 'asurascans',
  name: 'AsuraScans',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    try {
      const url = `${BASE}/browse?q=${encodeURIComponent(query)}&page=${page}`;
      const html = await fetchHtml(url);
      const results = parseCards(html);
      if (results.length > 0) return results;
      // Fallback: search in popular list
      const popular = await this.getPopular();
      const q = query.toLowerCase();
      return popular.filter((p) => p.title.toLowerCase().includes(q));
    } catch (err: unknown) {
      console.warn('[AsuraScans] search error:', err);
      return [];
    }
  },

  async getPopular(): Promise<SearchResult[]> {
    try {
      const html = await fetchHtml(`${BASE}/comics`);
      return parseCards(html);
    } catch (err: unknown) {
      console.warn('[AsuraScans] popular error:', err);
      return [];
    }
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    const slug = mangaId.replace(/^\/comics\//, '').replace(/^\/+|\/+$/g, '');
    const url = `${BASE}/comics/${slug}`;
    const html = await fetchHtml(url);

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : slug.replace(/[-_]/g, ' ');

    // Extract cover
    const coverMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<img[^>]+class="[^"]*cover[^"]*"[^>]+src="([^"]+)"/i);
    const coverUrl = coverMatch ? coverMatch[1] : null;

    // Extract synopsis
    const synopsisMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
      || html.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const synopsis = synopsisMatch ? synopsisMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract chapters belonging to this manga
    const chapters: Chapter[] = [];
    const seen = new Set<string>();
    const cleanSlug = slug.replace(/-b57aa235$/i, '');
    const chRegex = /href="(\/comics\/[^"]*chapter\/[^"]*)"/gi;
    let chMatch: RegExpExecArray | null;

    while ((chMatch = chRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      if (seen.has(chHref)) continue;
      // Only include chapters that belong to this series
      if (!chHref.includes(cleanSlug) && !chHref.includes(slug)) continue;
      seen.add(chHref);

      const numMatch = chHref.match(/chapter\/([\d.]+)/i);
      const num = numMatch ? numMatch[1] : '0';

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
      author: 'AsuraScans',
      status: 'ongoing',
      genres: ['Manhwa', 'Action', 'Webtoon'],
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

    // Extract all image URLs from HTML
    const imgRegex = /https:\/\/[^\s"'<>;,]+\.(?:webp|jpg|jpeg|png)/gi;
    let imgMatch: RegExpExecArray | null;

    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const imgUrl = imgMatch[0];
      if (
        seen.has(imgUrl) ||
        /logo|banner|cover|avatar|icon|profile|toraka|announcement/i.test(imgUrl)
      ) {
        continue;
      }
      seen.add(imgUrl);
      images.push(imgUrl);
    }

    return images;
  },
};
