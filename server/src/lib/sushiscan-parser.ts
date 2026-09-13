export type SushiScanCard = {
  id: string;
  title: string;
  coverUrl: string;
  status: 'ongoing';
  rating: null;
  genres: string[];
  author: null;
  url: string;
};

const BASE = 'https://sushiscan.fr';

function parseGenreMap(html: string): Map<string, string[]> {
  const genresById = new Map<string, string[]>();
  const listItemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let listItem: RegExpExecArray | null;

  while ((listItem = listItemPattern.exec(html))) {
    const block = listItem[1];
    if (!/<b>\s*Genres\s*<\/b>/i.test(block)) continue;

    const id = block.match(/href="https?:\/\/(?:www\.)?sushiscan\.fr\/catalogue\/([^"/]+)\/"/i)?.[1];
    if (!id) continue;

    const genres = [...block.matchAll(/href="https?:\/\/(?:www\.)?sushiscan\.fr\/genres\/[^"/]+\/?"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => decodeSushiScanHtml(match[1]))
      .filter(Boolean);
    if (genres.length === 0) continue;

    const existing = genresById.get(id) || [];
    genresById.set(id, [...new Set([...existing, ...genres])]);
  }

  return genresById;
}

export function decodeSushiScanHtml(value: string): string {
  return value
    .replace(/&#0*39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSushiScanCards(html: string, limit = 40): SushiScanCard[] {
  const items: SushiScanCard[] = [];
  const seen = new Set<string>();
  const genresById = parseGenreMap(html);
  // Parse one complete anchor at a time. A cross-anchor wildcard can bind a
  // text-only title link to the image belonging to the following manga.
  const anchorPattern = /<a\s+href="https?:\/\/(?:www\.)?sushiscan\.fr\/catalogue\/([^"/]+)\/"\s+title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && items.length < limit) {
    const [, id, rawTitle, anchorBody] = match;
    const rawCover = anchorBody.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i)?.[1];
    if (!rawCover || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: decodeSushiScanHtml(rawTitle) || id.replace(/-/g, ' '),
      coverUrl: rawCover,
      status: 'ongoing',
      rating: null,
      genres: genresById.get(id) || [],
      author: null,
      url: `${BASE}/catalogue/${id}/`,
    });
  }
  return items;
}
