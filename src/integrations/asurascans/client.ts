const ASURA_BASE = 'https://asuracomic.net';
const PROXY = 'https://corsproxy.io/?';

export type AsuraSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  latestChapter: string | null;
  url: string;
};

export async function searchAsura(query: string): Promise<AsuraSearchResult[]> {
  try {
    const url = `${ASURA_BASE}/series?name=${encodeURIComponent(query)}`;
    const res = await fetch(`${PROXY}${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) throw new Error(`AsuraScans ${res.status}`);
    const html = await res.text();

    const results: AsuraSearchResult[] = [];
    const regex = /<a[^>]+href="\/series\/([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*font-bold[^"]*"[^>]*>([^<]+)<\/span>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        id: match[1],
        title: match[3].trim(),
        coverUrl: match[2],
        status: 'ongoing',
        rating: 4.9,
        latestChapter: null,
        url: `${ASURA_BASE}/series/${match[1]}`,
      });
    }

    return results;
  } catch (err) {
    console.warn('AsuraScans search error:', err);
    return [];
  }
}
