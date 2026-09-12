import type { Chapter, MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

// MangaPill: a plain server-rendered HTML aggregator (no Cloudflare/JS
// challenge observed), English catalogue. Verified live before writing this
// adapter: the site's own banner states manhwa support was discontinued
// ("we have decided to discontinue supporting manhwa on this site"), so its
// catalogue is manga/manhua-oriented, not a full replacement for the
// manhwa-focused sources already integrated.
const BASE = 'https://mangapill.com';
const REQUEST_TIMEOUT = 15_000;

async function getHtml(path: string): Promise<string> {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`MangaPill a répondu ${response.status}.`);
  return response.text();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#0*39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCards(html: string, limit = 40): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();
  const pattern = /<a href="\/manga\/(\d+)\/([a-z0-9-]+)" class="relative block">\s*<figure[^>]*>\s*<img[^>]+data-src="([^"]+)"[\s\S]*?line-clamp-2">([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && items.length < limit) {
    const [, numericId, slug, cover, rawTitle] = match;
    const id = `${numericId}/${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: decodeHtml(rawTitle),
      coverUrl: cover,
      status: 'ongoing',
      rating: null,
      genres: [],
      author: null,
      url: `${BASE}/manga/${id}`,
    });
  }
  return items;
}

function parseChapters(html: string, mangaSlug: string): Chapter[] {
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const pattern = /<a class="border[^"]*"[^>]+href="\/chapters\/([^"]+)"[^>]*title="[^"]*">Chapter ([0-9.]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, chapterPath, chapterNumber] = match;
    if (seen.has(chapterPath)) continue;
    seen.add(chapterPath);
    chapters.push({
      id: chapterPath,
      chapterNumber,
      title: null,
      date: '',
      language: 'en',
      url: `${BASE}/chapters/${chapterPath}`,
    });
  }
  return chapters;
}

function parseGenres(html: string): string[] {
  return [...new Set(
    [...html.matchAll(/href="\/search\?genre=[^"]+">([^<]+)</gi)].map((match) => decodeHtml(match[1])),
  )];
}

function parsePages(html: string): string[] {
  const images = [...html.matchAll(/<img[^>]+class="js-page"[^>]+data-src="([^"]+)"/gi)].map((match) => match[1]);
  const unique = [...new Set(images)];
  // Verified live: MangaPill's page CDN (cdn.readdetectiveconan.com) enforces
  // referer-based hotlink protection and 403s any request that doesn't carry
  // Referer: https://mangapill.com/ — including the browser's own direct,
  // no-referrer image load. Route through the existing image-proxy with the
  // correct referer pre-attached instead of relying on the Reader's generic
  // onError fallback (which defaults referer to the image host itself, not
  // the site that embeds it, and would still 403).
  return unique.map((image) => (
    `/api/extract/image-proxy?url=${encodeURIComponent(image)}&referer=${encodeURIComponent(`${BASE}/`)}`
  ));
}

export const mangaPillExtractor: SourceExtractor = {
  id: 'mangapill',
  name: 'MangaPill',

  async search(query: string): Promise<SearchResult[]> {
    return parseCards(await getHtml(`/search?q=${encodeURIComponent(query)}`));
  },

  async getPopular(): Promise<SearchResult[]> {
    // No dedicated "popular" listing observed live; the homepage's featured
    // rail is the best available proxy, same fallback pattern already used
    // by the existing homepage-based sources in this codebase.
    return parseCards(await getHtml('/'), 24);
  },

  async getDetail(idOrPath: string): Promise<MangaDetail> {
    const id = idOrPath.replace(/^https?:\/\/[^/]+\/manga\//, '').replace(/^manga\//, '').replace(/\/$/, '');
    const slug = id.split('/')[1] || id;
    const html = await getHtml(`/manga/${id}`);
    const title = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || slug.replace(/-/g, ' '));
    const coverUrl = html.match(/<img[^>]+data-src="(https:\/\/cdn\.readdetectiveconan\.com\/file\/mangapill\/[^"]+)"/i)?.[1] || null;
    const status = decodeHtml(html.match(/Status<\/label>\s*<div>([^<]+)<\/div>/i)?.[1] || 'ongoing').toLowerCase();
    const synopsis = decodeHtml(html.match(/<p class="text-sm text--secondary">([\s\S]*?)<\/p>/i)?.[1] || '');
    return {
      id,
      title,
      coverUrl,
      author: null,
      status,
      genres: parseGenres(html),
      synopsis: synopsis || null,
      chapters: parseChapters(html, slug),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const id = chapterId.replace(/^https?:\/\/[^/]+\/chapters\//, '').replace(/^chapters\//, '').replace(/\/$/, '');
    return parsePages(await getHtml(`/chapters/${id}`));
  },
};
