import type { MangaDetail, SearchResult, SourceExtractor } from '../lib/extractor-types.js';
import { providerHttp } from '../lib/provider-http.js';
import {
  decodeWeebCentralHtml,
  parseWeebCentralCards,
  parseWeebCentralChapters,
  parseWeebCentralGenres,
  weebCentralLabelValue,
} from '../lib/weebcentral-parser.js';

// WeebCentral: an English manga/manhwa/manhua aggregator built on an
// htmx-driven Next.js frontend. Verified live before writing this adapter:
// robots.txt only disallows /users/*, and no Cloudflare (or any other)
// challenge was observed on the homepage, the search endpoint, series
// detail pages, the chapter-list endpoint or the reader image endpoint.
// Its cover and page-image CDNs (temp.compsci88.com, hot.planeptune.us)
// also serve images with no referer/hotlink check, so — unlike MangaPill —
// nothing needs to go through this app's image proxy here.
const BASE = 'https://weebcentral.com';

async function getHtml(path: string, absolute = false): Promise<string> {
  return providerHttp.getText(absolute ? path : `${BASE}${path}`, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

const STATUS_MAP: Record<string, string> = {
  complete: 'completed',
  completed: 'completed',
  ongoing: 'ongoing',
  hiatus: 'hiatus',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

export const weebCentralExtractor: SourceExtractor = {
  id: 'weebcentral',
  name: 'WeebCentral',

  async search(query: string): Promise<SearchResult[]> {
    return parseWeebCentralCards(await getHtml(
      `/search/data?text=${encodeURIComponent(query)}&sort=Best+Match&order=Descending&official=Any&anime=Any&adult=Any&display_mode=Full+Display`,
    ));
  },

  async getPopular(): Promise<SearchResult[]> {
    // No dedicated popular/ranking endpoint observed live; an empty search
    // query is the site's own "browse everything" behaviour, same fallback
    // pattern already used by other homepage/search-based sources here.
    return parseWeebCentralCards(await getHtml(
      '/search/data?text=&sort=Best+Match&order=Descending&official=Any&anime=Any&adult=Any&display_mode=Full+Display',
    ), 24);
  },

  async getDetail(idOrPath: string): Promise<MangaDetail> {
    const id = idOrPath.replace(/^https?:\/\/[^/]+\/series\//, '').replace(/^series\//, '').replace(/\/$/, '');
    const seriesId = id.split('/')[0];
    const html = await getHtml(`/series/${id}`);
    const title = decodeWeebCentralHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || id.split('/')[1]?.replace(/-/g, ' ') || id);
    const coverUrl = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || null;
    const author = weebCentralLabelValue(html, 'Author');
    const rawStatus = (weebCentralLabelValue(html, 'Status') || 'ongoing').toLowerCase();
    const rawType = (weebCentralLabelValue(html, 'Type') || '').toLowerCase();
    const synopsis = html.match(/Description<\/strong>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    const chaptersHtml = await getHtml(`${BASE}/series/${seriesId}/full-chapter-list`, true);
    return {
      id,
      title,
      coverUrl,
      author,
      status: STATUS_MAP[rawStatus] || 'ongoing',
      genres: [...parseWeebCentralGenres(html), ...(rawType ? [rawType] : [])],
      synopsis: synopsis ? decodeWeebCentralHtml(synopsis) : null,
      chapters: parseWeebCentralChapters(chaptersHtml),
    };
  },

  async getPages(chapterId: string): Promise<string[]> {
    const id = chapterId.replace(/^https?:\/\/[^/]+\/chapters\//, '').replace(/^chapters\//, '').replace(/\/$/, '');
    const html = await getHtml(`${BASE}/chapters/${id}/images?is_prev=False&reading_style=long_strip`, true);
    return [...new Set([...html.matchAll(/<img\s+src="(https:\/\/[^"]+)"/gi)].map((match) => match[1]))];
  },
};
