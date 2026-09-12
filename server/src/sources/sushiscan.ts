import type { Chapter, MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';

// Sushi-Scan: a French Madara/WordPress scan site (same underlying CMS as
// the existing "crunchyscan" extractor, which actually targets LelManga —
// both expose the standard Madara `ts_reader.run(...)` reader payload and
// `data-num` chapter list markup, verified live before writing this file).
//
// Content note (see MANGA_WAVE README / T-3020 audit discipline): this
// site's own genre taxonomy includes explicit-content tags ("Érotique",
// "Pornhwa" among them) mixed into its general catalogue with no separate
// gate. Per explicit product decision, this source is integrated as-is —
// consistent with how MangaDex's own `erotica` content rating is already
// requested and stored today — and `contentRating` is derived from those
// genre tags (see src/integrations/sources/sushiscan.ts) rather than left
// unmarked. This extractor itself only extracts what the site publishes;
// it does not filter.
const BASE = 'https://sushiscan.fr';
const REQUEST_TIMEOUT = 15_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&#0*39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  if (!response.ok) throw new Error(`Sushi-Scan a répondu ${response.status}.`);
  return response.text();
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const value = html.match(pattern)?.[1];
  return value ? decodeHtml(value) : null;
}

function parseCards(html: string, limit = 40): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();
  const pattern = /<a href="https?:\/\/(?:www\.)?sushiscan\.fr\/catalogue\/([^"/]+)\/"\s+title="([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && items.length < limit) {
    const [, id, rawTitle, rawCover] = match;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: decodeHtml(rawTitle) || id.replace(/-/g, ' '),
      coverUrl: rawCover,
      status: 'ongoing',
      rating: null,
      genres: [],
      author: null,
      url: `${BASE}/catalogue/${id}/`,
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
    if (rawNumber === '{{number}}') continue; // Vue/Handlebars template row, not a real chapter.
    const chapterSlug = block.match(/href="https?:\/\/(?:www\.)?sushiscan\.fr\/([^"/]+)\/"/i)?.[1];
    if (!chapterSlug || seen.has(chapterSlug)) continue;
    seen.add(chapterSlug);
    chapters.push({
      id: chapterSlug,
      chapterNumber: decodeHtml(rawNumber),
      title: null,
      date: firstMatch(block, /class="chapterdate"[^>]*>([\s\S]*?)<\/(?:span|i)>/i) || '',
      language: 'fr',
      url: `${BASE}/${chapterSlug}/`,
    });
  }
  return chapters;
}

function parseGenres(html: string): string[] {
  const container = html.match(/class="seriestugenre"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  return [...new Set([...container.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => decodeHtml(match[1])).filter(Boolean))];
}

type ReaderPayload = { sources?: Array<{ images?: unknown }> };

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
    console.warn('[SushiScan] Données lecteur invalides:', error instanceof Error ? error.message : error);
  }
  return [];
}

export const sushiScanExtractor: SourceExtractor = {
  id: 'sushiscan',
  name: 'Sushi-Scan (VF)',

  async search(query: string): Promise<SearchResult[]> {
    return parseCards(await getHtml(`/?s=${encodeURIComponent(query)}&post_type=wp-manga`));
  },

  async getPopular(): Promise<SearchResult[]> {
    return parseCards(await getHtml('/'), 24);
  },

  async getDetail(idOrSlug: string): Promise<MangaDetail> {
    const id = idOrSlug.replace(/^https?:\/\/[^/]+\/catalogue\//, '').replace(/^catalogue\//, '').replace(/\/$/, '');
    const html = await getHtml(`/catalogue/${encodeURIComponent(id)}/`);
    const title = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || id.replace(/-/g, ' ');
    const coverUrl = firstMatch(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
    const synopsis = firstMatch(html, /class="[^"]*entry-content-single[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const status = firstMatch(html, /<td>Statut<\/td>\s*<td>([^<]+)<\/td>/i) || 'ongoing';
    return {
      id,
      title,
      coverUrl,
      author: null,
      status: status.toLowerCase().includes('cours') ? 'ongoing' : status.toLowerCase().includes('termin') ? 'completed' : status.toLowerCase(),
      genres: parseGenres(html),
      synopsis,
      chapters: parseChapters(html),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const id = chapterId.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '').replace(/\/$/, '');
    return parseReaderImages(await getHtml(`/${encodeURIComponent(id)}/`));
  },
};
