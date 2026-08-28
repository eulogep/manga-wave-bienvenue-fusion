import type { Chapter, MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

const BASE = 'https://www.originmanga.com';
const REQUEST_TIMEOUT = 15_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getHtml(path: string): Promise<string> {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'User-Agent': 'MangaWave/1.0 (+public chapter reader)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`OriginManga a répondu ${response.status}.`);
  return response.text();
}

function parseCards(html: string, limit = 40): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const cardPattern = /<a\s+href="\/manga\.php\?id=([^"&]+)"[^>]*>\s*<img[^>]+src="([^"]*)"[^>]+alt="([^"]*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = cardPattern.exec(html)) && results.length < limit) {
    const [, id, coverUrl, rawTitle] = match;
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      title: decodeHtml(rawTitle) || 'Manga',
      coverUrl: coverUrl.startsWith('http') ? coverUrl : `${BASE}${coverUrl}`,
      status: 'ongoing',
      rating: 4.8,
      genres: ['VF', 'Scan FR'],
      author: null,
      url: `${BASE}/manga.php?id=${id}`,
    });
  }
  return results;
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const value = html.match(pattern)?.[1];
  return value ? decodeHtml(value) : null;
}

function parseChapters(html: string): Chapter[] {
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const chapterPattern = /<a\s+href="\/read\.php\?id=([a-f0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = chapterPattern.exec(html))) {
    const [, id, block] = match;
    if (seen.has(id)) continue;
    const chapterNumber = block.match(/Chapter\s+([\d.]+)/i)?.[1];
    if (!chapterNumber) continue;
    seen.add(id);
    const date = block.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/)?.[1] || '';
    chapters.push({
      id,
      chapterNumber,
      title: null,
      date,
      language: 'fr',
      url: `${BASE}/read.php?id=${id}`,
    });
  }
  return chapters;
}

export const originMangaExtractor: SourceExtractor = {
  id: 'originmanga',
  name: 'OriginManga (VF)',

  async search(query: string, page = 1): Promise<SearchResult[]> {
    const html = await getHtml(`/search.php?q=${encodeURIComponent(query)}&page=${page}`);
    return parseCards(html);
  },

  async getPopular(): Promise<SearchResult[]> {
    return parseCards(await getHtml('/'), 20);
  },

  async getDetail(mangaId: string): Promise<MangaDetail> {
    const html = await getHtml(`/manga.php?id=${encodeURIComponent(mangaId)}`);
    const title = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || mangaId;
    const coverUrl = firstMatch(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
    const synopsis = firstMatch(html, /<meta\s+name="description"\s+content="([^"]+)"/i);
    const status = firstMatch(html, /Status[\s\S]{0,300}?<[^>]+>(Ongoing|Completed|Hiatus|Dropped)<\/[^>]+>/i) || 'ongoing';
    return {
      id: mangaId,
      title,
      coverUrl,
      author: null,
      status: status.toLowerCase(),
      genres: ['VF', 'Scan FR'],
      synopsis,
      chapters: parseChapters(html),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const html = await getHtml(`/read.php?id=${encodeURIComponent(chapterId)}`);
    const urls: string[] = [];
    const seen = new Set<string>();
    const imagePattern = /<img[^>]+(?:src|data-src)="([^"]*img-proxy[^"]*)"/gi;
    let match: RegExpExecArray | null;
    while ((match = imagePattern.exec(html))) {
      const rawUrl = decodeHtml(match[1]);
      if (!rawUrl.includes('img-proxy')) continue;
      const url = rawUrl.startsWith('http') ? rawUrl : `${BASE}${rawUrl}`;
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
    return urls;
  },
};
