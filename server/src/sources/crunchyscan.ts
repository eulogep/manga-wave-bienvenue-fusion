import type { Chapter, MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';
import { createBrowserContext } from '../lib/browser-pool.js';

const BASE = 'https://www.lelmanga.com';
const REQUEST_TIMEOUT = 15_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&#0*39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getRenderedHtml(path: string): Promise<string> {
  const context = await createBrowserContext();
  const page = await context.newPage();
  try {
    await page.route('**/*.{woff,woff2,ttf,otf,mp4,webm}', (route) => route.abort());
    const response = await page.goto(`${BASE}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`LelManga a répondu ${response?.status() || 'sans statut'}.`);
    }
    return page.content();
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

async function getHtml(path: string): Promise<string> {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (response.status === 403 || response.status === 429) return getRenderedHtml(path);
  if (!response.ok) throw new Error(`LelManga a répondu ${response.status}.`);
  return response.text();
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const value = html.match(pattern)?.[1];
  return value ? decodeHtml(value) : null;
}

function parseCards(html: string, limit = 40): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s+href="https?:\/\/(?:www\.)?lelmanga\.com\/manga\/([^"/]+)"\s+title="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && items.length < limit) {
    const [, id, rawTitle, rawCover] = match;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: decodeHtml(rawTitle) || id.replace(/-/g, ' '),
      coverUrl: decodeHtml(rawCover),
      status: 'ongoing',
      rating: 4.8,
      genres: ['VF', 'Français'],
      author: null,
      url: `${BASE}/manga/${id}`,
    });
  }
  return items;
}

function parseChapters(html: string): Chapter[] {
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const pattern = /<li[^>]+data-num="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, rawNumber, block] = match;
    const chapterUrl = block.match(/href="https?:\/\/(?:www\.)?lelmanga\.com\/([^"/]+)"/i)?.[1];
    if (!chapterUrl || seen.has(chapterUrl)) continue;
    seen.add(chapterUrl);
    chapters.push({
      id: chapterUrl,
      chapterNumber: decodeHtml(rawNumber),
      title: null,
      date: firstMatch(block, /class="chapterdate"[^>]*>([\s\S]*?)<\/span>/i) || '',
      language: 'fr',
      url: `${BASE}/${chapterUrl}`,
    });
  }
  return chapters;
}

function parseGenres(html: string): string[] {
  const container = html.match(/<(?:div|span)[^>]+class="[^"]*mgen[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/i)?.[1] || '';
  const genres = [...container.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);
  return [...new Set(genres)];
}

type ReaderPayload = {
  sources?: Array<{ images?: unknown }>;
};

function parseReaderImages(html: string): string[] {
  const payload = html.match(/ts_reader\.run\((\{[\s\S]*?\})\);/i)?.[1];
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload) as ReaderPayload;
    for (const source of parsed.sources || []) {
      if (!Array.isArray(source.images)) continue;
      const images = source.images.filter((image): image is string => typeof image === 'string' && image.startsWith('https://'));
      if (images.length > 0) return [...new Set(images)];
    }
  } catch (error: unknown) {
    console.warn('[LelManga] Données lecteur invalides:', error instanceof Error ? error.message : error);
  }
  return [];
}

export const crunchyScanExtractor: SourceExtractor = {
  id: 'crunchyscan',
  name: 'LelManga (Scans VF)',

  async search(query: string): Promise<SearchResult[]> {
    return parseCards(await getHtml(`/?s=${encodeURIComponent(query)}`));
  },

  async getPopular(): Promise<SearchResult[]> {
    return parseCards(await getHtml('/'), 24);
  },

  async getDetail(idOrSlug: string): Promise<MangaDetail> {
    const id = idOrSlug.replace(/^https?:\/\/[^/]+\/manga\//, '').replace(/^manga\//, '').replace(/\/$/, '');
    const html = await getHtml(`/manga/${encodeURIComponent(id)}`);
    const title = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || id.replace(/-/g, ' ');
    const coverUrl = firstMatch(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i)
      || firstMatch(html, /class="[^"]*(?:thumb|bigcover)[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const synopsis = firstMatch(html, /class="[^"]*(?:entry-content|synopsis)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const status = firstMatch(html, /Status[\s\S]{0,180}?(Ongoing|Completed|Hiatus|Dropped)/i) || 'ongoing';
    return {
      id,
      title,
      coverUrl,
      author: null,
      status: status.toLowerCase(),
      genres: parseGenres(html),
      synopsis,
      chapters: parseChapters(html),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const id = chapterId.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '').replace(/\/$/, '');
    return parseReaderImages(await getHtml(`/${encodeURIComponent(id)}`));
  },
};
