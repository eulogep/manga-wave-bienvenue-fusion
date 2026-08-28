import {
  cleanHtmlText,
  extractFirstMatch,
  extractRegexAll,
  resilientScrape,
} from '@/integrations/common/scraperClient';

const ORIGIN_BASE = 'https://www.originmanga.com';

export type OriginMangaChapter = {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  url: string;
};

export type OriginMangaDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: OriginMangaChapter[];
};

export type OriginMangaSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number;
  url: string;
};

/* ───── 1. RECHERCHE & POPULAIRES ───── */
export async function searchOriginManga(query: string, page = 1): Promise<OriginMangaSearchResult[]> {
  try {
    const html = await resilientScrape<string>(
      `${ORIGIN_BASE}/search.php?q=${encodeURIComponent(query)}&page=${page}`,
      { referer: ORIGIN_BASE },
    );

    const results: OriginMangaSearchResult[] = [];
    const regex = /<a\s+href="\/manga\.php\?id=([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<b>([^<]+)<\/b>/gi;
    const matches = extractRegexAll(html, regex);

    for (const match of matches) {
      results.push({
        id: match[1],
        title: cleanHtmlText(match[3]),
        coverUrl: match[2].startsWith('http') ? match[2] : `${ORIGIN_BASE}${match[2]}`,
        status: 'ongoing',
        rating: 4.8,
        url: `${ORIGIN_BASE}/manga.php?id=${match[1]}`,
      });
    }
    return results;
  } catch (err) {
    console.warn('OriginManga search error:', err);
    return [];
  }
}

export async function getPopularOriginManga(): Promise<OriginMangaSearchResult[]> {
  try {
    const html = await resilientScrape<string>(`${ORIGIN_BASE}/`, { referer: ORIGIN_BASE });
    const results: OriginMangaSearchResult[] = [];
    const regex = /<a\s+href="\/manga\.php\?id=([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<b>([^<]+)<\/b>/gi;
    const matches = extractRegexAll(html, regex);

    for (const match of matches) {
      if (!results.some((r) => r.id === match[1])) {
        results.push({
          id: match[1],
          title: cleanHtmlText(match[3]),
          coverUrl: match[2].startsWith('http') ? match[2] : `${ORIGIN_BASE}${match[2]}`,
          status: 'ongoing',
          rating: 4.9,
          url: `${ORIGIN_BASE}/manga.php?id=${match[1]}`,
        });
      }
    }
    if (results.length > 0) return results.slice(0, 18);
  } catch {
    // Fallback search
  }
  return searchOriginManga('a', 1);
}

/* ───── 2. DÉTAILS + CHAPITRES ───── */
export async function getOriginMangaDetail(mangaId: string): Promise<OriginMangaDetail> {
  const html = await resilientScrape<string>(`${ORIGIN_BASE}/manga.php?id=${mangaId}`, {
    referer: ORIGIN_BASE,
  });

  const title = extractFirstMatch(html, /<h1[^>]*>([^<]+)<\/h1>/i) || 'Sans titre';
  const coverUrl = extractFirstMatch(html, /<img[^>]+class="[^"]*thumbnail[^"]*"[^>]+src="([^"]+)"/i);
  const synopsisRaw = extractFirstMatch(html, /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const statusRaw = extractFirstMatch(html, /Status[^:]*:?\s*<\/strong>\s*([^<]+)/i);

  // Genres
  const genreMatches = extractRegexAll(html, /<a[^>]+href="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/gi);
  const genres = genreMatches.map((m) => cleanHtmlText(m[1])).filter(Boolean);

  // Chapters
  const chapters: OriginMangaChapter[] = [];
  const chRegex = /<a\s+href="\/read\.php\?id=([a-f0-9-]+)">\s*(?:Chapter|Ch\.?)\s*([\d.]+)\s*(?:—\s*(.+?))?\s*<\/a>\s*(?:<span[^>]*>([^<]+)<\/span>)?/gi;
  const chMatches = extractRegexAll(html, chRegex);

  for (const chMatch of chMatches) {
    chapters.push({
      id: chMatch[1],
      chapterNumber: chMatch[2],
      title: chMatch[3] ? cleanHtmlText(chMatch[3]) : null,
      date: chMatch[4] ? cleanHtmlText(chMatch[4]) : '',
      url: `${ORIGIN_BASE}/read.php?id=${chMatch[1]}`,
    });
  }

  return {
    id: mangaId,
    title: cleanHtmlText(title),
    coverUrl: coverUrl ? (coverUrl.startsWith('http') ? coverUrl : `${ORIGIN_BASE}${coverUrl}`) : null,
    altTitles: [],
    author: null,
    artist: null,
    status: statusRaw ? cleanHtmlText(statusRaw) : 'ongoing',
    genres,
    synopsis: synopsisRaw ? cleanHtmlText(synopsisRaw) : null,
    chapters,
  };
}

/* ───── 3. PAGES D'UN CHAPITRE ───── */
export async function getOriginMangaPages(chapterId: string): Promise<string[]> {
  const html = await resilientScrape<string>(`${ORIGIN_BASE}/read.php?id=${chapterId}`, {
    referer: `${ORIGIN_BASE}/manga.php`,
  });

  const pages: string[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*alt="Page\s*\d+"/gi;
  const matches = extractRegexAll(html, imgRegex);

  for (const match of matches) {
    const imgUrl = match[1];
    if (imgUrl.includes('img-proxy.php') || imgUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
      pages.push(imgUrl.startsWith('http') ? imgUrl : `${ORIGIN_BASE}${imgUrl}`);
    }
  }
  return pages;
}