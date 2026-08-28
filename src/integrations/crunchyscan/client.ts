import {
  cleanHtmlText,
  extractFirstMatch,
  extractRegexAll,
  resilientScrape,
} from '@/integrations/common/scraperClient';

const CRUNCHY_BASE = 'https://crunchyscan.fr';

export type CrunchyScanSearchResult = {
  id: string; // slug or numeric id
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  genres: string[];
  url: string;
};

export type CrunchyScanDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: Array<{
    id: string;
    chapterNumber: string;
    title: string | null;
    date: string;
    url: string;
  }>;
};

export async function searchCrunchyScan(query: string): Promise<CrunchyScanSearchResult[]> {
  try {
    // 1. Try the JSON search API endpoint
    const data = await resilientScrape<any>(
      `${CRUNCHY_BASE}/api/manga/search/manga/${encodeURIComponent(query)}`,
      { asJson: true, referer: CRUNCHY_BASE },
    );
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.slug || String(item.id),
        title: item.name || item.title || 'Manga sans titre',
        coverUrl: item.cover ? (item.cover.startsWith('http') ? item.cover : `${CRUNCHY_BASE}/${item.cover}`) : null,
        status: item.status || 'ongoing',
        rating: 4.8,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.name || g) : ['VF', 'Manga'],
        url: `${CRUNCHY_BASE}/manga/${item.slug || item.id}`,
      }));
    }
  } catch (err) {
    console.warn('CrunchyScan API search failed, attempting HTML fallback:', err);
  }

  // 2. Fallback: HTML regex extraction
  try {
    const html = await resilientScrape<string>(
      `${CRUNCHY_BASE}/search?q=${encodeURIComponent(query)}`,
      { referer: CRUNCHY_BASE },
    );
    const results: CrunchyScanSearchResult[] = [];
    const regex = /<a[^>]+href="\/manga\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    const matches = extractRegexAll(html, regex);

    for (const match of matches) {
      const slug = match[1];
      const cover = match[2];
      const title = cleanHtmlText(match[3]);
      results.push({
        id: slug,
        title,
        coverUrl: cover.startsWith('http') ? cover : `${CRUNCHY_BASE}${cover}`,
        status: 'ongoing',
        rating: 4.7,
        genres: ['VF'],
        url: `${CRUNCHY_BASE}/manga/${slug}`,
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function getPopularCrunchyScan(): Promise<CrunchyScanSearchResult[]> {
  try {
    const html = await resilientScrape<string>(`${CRUNCHY_BASE}/`, { referer: CRUNCHY_BASE });
    const results: CrunchyScanSearchResult[] = [];
    const regex = /<a[^>]+href="\/manga\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    const matches = extractRegexAll(html, regex);

    for (const match of matches) {
      if (!results.some((r) => r.id === match[1])) {
        results.push({
          id: match[1],
          title: cleanHtmlText(match[3]),
          coverUrl: match[2].startsWith('http') ? match[2] : `${CRUNCHY_BASE}${match[2]}`,
          status: 'ongoing',
          rating: 4.8,
          genres: ['VF', 'Français'],
          url: `${CRUNCHY_BASE}/manga/${match[1]}`,
        });
      }
    }
    if (results.length > 0) return results.slice(0, 18);
  } catch {
    // Fallback
  }
  return searchCrunchyScan('a');
}


export async function getCrunchyScanDetail(idOrSlug: string): Promise<CrunchyScanDetail> {
  const html = await resilientScrape<string>(`${CRUNCHY_BASE}/manga/${idOrSlug}`, {
    referer: CRUNCHY_BASE,
  });

  const titleRaw = extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleRaw ? cleanHtmlText(titleRaw) : idOrSlug;

  const coverUrl =
    extractFirstMatch(html, /<img[^>]+(?:data-src|src)="([^"]+)"[^>]*class="[^"]*(?:cover|poster|thumb)[^"]*"/i) ||
    extractFirstMatch(html, /<img[^>]+class="[^"]*(?:cover|poster|thumb)[^"]*"[^>]+(?:data-src|src)="([^"]+)"/i);

  const synopsisRaw = extractFirstMatch(html, /<div[^>]*class="[^"]*(?:synopsis|description|summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = synopsisRaw ? cleanHtmlText(synopsisRaw) : null;

  const chapters: CrunchyScanDetail['chapters'] = [];
  const chRegex = /<a[^>]+href="([^"]*(?:read|lecture|chapter)[^"]*)"[^>]*>[\s\S]*?(?:Chapitre|Ch\.?)\s*([\d.]+)(?:[\s\S]*?<span[^>]*>([^<]+)<\/span>)?/gi;
  const chMatches = extractRegexAll(html, chRegex);

  for (const chMatch of chMatches) {
    chapters.push({
      id: chMatch[1].replace(/^\//, ''),
      chapterNumber: chMatch[2],
      title: null,
      date: chMatch[3] ? cleanHtmlText(chMatch[3]) : '',
      url: chMatch[1].startsWith('http') ? chMatch[1] : `${CRUNCHY_BASE}${chMatch[1]}`,
    });
  }

  return {
    id: idOrSlug,
    title,
    coverUrl: coverUrl ? (coverUrl.startsWith('http') ? coverUrl : `${CRUNCHY_BASE}${coverUrl}`) : null,
    altTitles: [],
    author: null,
    artist: null,
    status: 'ongoing',
    genres: ['VF', 'Français'],
    synopsis,
    chapters,
  };
}

export async function getCrunchyScanPages(chapterPath: string): Promise<string[]> {
  const targetUrl = chapterPath.startsWith('http') ? chapterPath : `${CRUNCHY_BASE}/${chapterPath}`;
  const html = await resilientScrape<string>(targetUrl, { referer: `${CRUNCHY_BASE}/manga` });

  const pages: string[] = [];
  const imgRegex = /<img[^>]+(?:data-src|src)="([^"]+)"[^>]*class="[^"]*(?:page|reader|chapter-image)[^"]*"/gi;
  const matches = extractRegexAll(html, imgRegex);

  for (const match of matches) {
    const url = match[1];
    pages.push(url.startsWith('http') ? url : `${CRUNCHY_BASE}${url}`);
  }

  return pages;
}
