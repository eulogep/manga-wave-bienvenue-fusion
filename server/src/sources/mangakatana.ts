import type { Chapter, MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';
import { providerHttp } from '../lib/provider-http.js';

// MangaKatana: a long-running English manga aggregator, plain server-
// rendered HTML. Verified live before writing this adapter: robots.txt
// only disallows the archive.org crawler (`ia_archiver`), and no
// Cloudflare (or any other) challenge was observed on the listing, search,
// detail or chapter-reader pages. Its image CDN (i*.mangakatana.com) also
// serves pages with no referer/hotlink check, so nothing needs to go
// through this app's image proxy.
const BASE = 'https://mangakatana.com';

async function getHtml(path: string): Promise<string> {
  return providerHttp.getText(`${BASE}${path}`, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
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

function idFromUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+\/manga\//, '').replace(/\/$/, '');
}

function parseCards(html: string, limit = 40): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();
  const pattern = /<a href="(https:\/\/mangakatana\.com\/manga\/[^"]+)"[^>]*>\s*<picture>[\s\S]*?<img src="([^"]+)"[\s\S]*?<\/picture>[\s\S]*?<h3 class="title">\s*<a href="[^"]+"[^>]*>([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && items.length < limit) {
    const [, url, cover, rawTitle] = match;
    const id = idFromUrl(url);
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
      url,
    });
  }
  return items;
}

function parseChapters(html: string): Chapter[] {
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const pattern = /<div class="chapter"><a href="([^"]+)">([^<]+)<\/a><\/div><\/td><td><div class="update_time">([^<]*)<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, url, rawTitle, date] = match;
    const id = url.replace(/^https?:\/\/[^/]+\//, '');
    if (seen.has(id)) continue;
    seen.add(id);
    const title = decodeHtml(rawTitle);
    chapters.push({
      id,
      chapterNumber: title.match(/Chapter\s+([0-9.]+)/i)?.[1] || title,
      title: title.includes(':') ? title.split(':').slice(1).join(':').trim() : null,
      date: date || '',
      language: 'en',
      url,
    });
  }
  return chapters;
}

function parseGenres(html: string): string[] {
  const block = html.match(/Genres:<\/div>\s*<div class="d-cell-small value">\s*<div class="genres">([\s\S]*?)<\/div>/i)?.[1] || '';
  return [...new Set([...block.matchAll(/class="text_0">([^<]+)</gi)].map((match) => decodeHtml(match[1])))];
}

const STATUS_MAP: Record<string, string> = {
  ongoing: 'ongoing',
  completed: 'completed',
  complete: 'completed',
  hiatus: 'hiatus',
  cancelled: 'cancelled',
  dropped: 'cancelled',
};

export const mangaKatanaExtractor: SourceExtractor = {
  id: 'mangakatana',
  name: 'MangaKatana',

  async search(query: string): Promise<SearchResult[]> {
    return parseCards(await getHtml(`/?search=${encodeURIComponent(query)}&search_by=book_name`));
  },

  async getPopular(): Promise<SearchResult[]> {
    // No dedicated popular/ranking listing observed live; the general
    // catalogue listing (most recently updated first) is the site's own
    // default browse order and the best available proxy, same fallback
    // pattern already used by other listing-based sources here.
    return parseCards(await getHtml('/manga'), 24);
  },

  async getDetail(idOrPath: string): Promise<MangaDetail> {
    const id = idOrPath.replace(/^https?:\/\/[^/]+\/manga\//, '').replace(/^manga\//, '').replace(/\/$/, '');
    const html = await getHtml(`/manga/${id}`);
    const title = decodeHtml(html.match(/<h1 class="heading">([\s\S]*?)<\/h1>/i)?.[1] || id.replace(/[.-]\d*$/, '').replace(/-/g, ' '));
    const coverUrl = html.match(/<picture>[\s\S]*?<img src="([^"]+)" alt="\[Cover\]"/i)?.[1] || null;
    const author = decodeHtml(html.match(/class="[^"]*value authors">([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, ', ') || '').replace(/^,\s*|,\s*$/g, '') || null;
    const rawStatus = html.match(/class="d-cell-small value status \w+">([^<]+)</i)?.[1]?.trim().toLowerCase() || 'ongoing';
    const synopsis = html.match(/<div class="summary">[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1];
    return {
      id,
      title,
      coverUrl,
      author: author || null,
      status: STATUS_MAP[rawStatus] || 'ongoing',
      genres: parseGenres(html),
      synopsis: synopsis ? decodeHtml(synopsis.replace(/<br\s*\/?>/gi, '\n')) : null,
      chapters: parseChapters(html),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const id = chapterId.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '').replace(/\/$/, '');
    const html = await getHtml(`/${encodeURIComponent(id)}`);
    // The reader embeds the page-image list as `var <random_name>=[...]`;
    // a short 1-item "preload" array is emitted alongside the real,
    // full-length list under a different (also arbitrary) name, so this
    // picks the longest matching array rather than a hardcoded variable
    // name — verified live that the variable names are not the same
    // across different chapters.
    const arrays = [...html.matchAll(/var\s+\w+\s*=\s*\[((?:'https:\/\/i\d\.mangakatana\.com\/[^']+',?)+)\]/gi)]
      .map((match) => [...match[1].matchAll(/'([^']+)'/g)].map((image) => image[1]));
    const longest = arrays.sort((a, b) => b.length - a.length)[0] || [];
    return [...new Set(longest)];
  },
};
