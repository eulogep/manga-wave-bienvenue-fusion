const MANGAFIRE_BASE = 'https://mangafire.to';
const PROXY = 'https://corsproxy.io/?';

export type MangaFireSearchResult = {
  id: string; // slug
  title: string;
  coverUrl: string | null;
  status: string;
  type: string | null;
  rating: number | null;
  latestChapter: string | null;
  url: string;
};

export async function searchMangaFire(query: string): Promise<MangaFireSearchResult[]> {
  try {
    const url = `${MANGAFIRE_BASE}/filter?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(`${PROXY}${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) throw new Error(`MangaFire ${res.status}`);
    const html = await res.text();

    const results: MangaFireSearchResult[] = [];
    const regex = /<div[^>]+class="[^"]*unit[^"]*"[^>]*>[\s\S]*?<a[^>]+href="\/manga\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<a[^>]+class="[^"]*info-title[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        id: match[1],
        title: match[3].trim(),
        coverUrl: match[2],
        status: 'ongoing',
        type: 'Manga',
        rating: 4.8,
        latestChapter: null,
        url: `${MANGAFIRE_BASE}/manga/${match[1]}`,
      });
    }

    return results;
  } catch (err) {
    console.warn('MangaFire search error:', err);
    return [];
  }
}
