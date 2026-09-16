import type { Chapter, SearchResult } from './extractor-types.js';

export function decodeWeebCentralHtml(value: string): string {
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

const BASE = 'https://weebcentral.com';

// The search endpoint (used for both search() and, with an empty query, as
// the best available "popular" proxy — no dedicated popular/ranking
// endpoint was found live) returns each result as its own
// `<article class="bg-base-300 flex gap-4 p-4">` card, each with a desktop
// AND a mobile-duplicate <picture> (so two srcset/alt pairs per card,
// always for the same manga — but a global cross-field regex without a
// card boundary can drift onto a neighbouring card's cover/title when an
// unrelated widget elsewhere on the page repeats a series link; verified
// live against a real "one piece" search). Splitting into per-card chunks
// first keeps every field's match scoped to its own card.
export function parseWeebCentralCards(html: string, limit = 40): SearchResult[] {
  const items: SearchResult[] = [];
  const seen = new Set<string>();
  const cards = html.split('<article class="bg-base-300 flex gap-4 p-4">').slice(1);
  for (const card of cards) {
    if (items.length >= limit) break;
    const href = card.match(/href="https:\/\/weebcentral\.com\/series\/([A-Za-z0-9]+)\/([^"]+)"/);
    const cover = card.match(/srcset="(https:\/\/temp\.compsci88\.com\/cover\/normal\/[^"]+)"/)?.[1];
    const rawTitle = card.match(/alt="([^"]*?) cover"/)?.[1];
    if (!href || !cover || !rawTitle) continue;
    const [, id, slug] = href;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id: `${id}/${slug}`,
      title: decodeWeebCentralHtml(rawTitle),
      coverUrl: cover,
      status: 'ongoing',
      rating: null,
      genres: [],
      author: null,
      url: `${BASE}/series/${id}/${slug}`,
    });
  }
  return items;
}

export function parseWeebCentralChapters(html: string): Chapter[] {
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  // The label is usually "Chapter N" but can also be "Volume N" (a
  // volume-only release) or a one-shot's own title — verified live against
  // a series (Kobato.) published only as volumes, so this captures
  // whatever text the site put there rather than requiring "Chapter".
  const pattern = /<a href="\/chapters\/([A-Za-z0-9]+)"[^>]*>[\s\S]*?<span class="">([^<]+)<\/span>[\s\S]*?datetime="([^"]*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [, chapterId, rawLabel, date] = match;
    if (seen.has(chapterId)) continue;
    seen.add(chapterId);
    const label = decodeWeebCentralHtml(rawLabel);
    const number = label.match(/([0-9]+(?:\.[0-9]+)?)/)?.[1];
    chapters.push({
      id: chapterId,
      chapterNumber: number || label,
      title: number ? null : label,
      date: date || '',
      language: 'en',
      url: `${BASE}/chapters/${chapterId}`,
    });
  }
  return chapters;
}

export function weebCentralLabelValue(html: string, label: string): string | null {
  const block = html.match(new RegExp(`${label}\\(?s?\\)?:\\s*<\\/strong>([\\s\\S]*?)<\\/li>`, 'i'))?.[1];
  return block ? decodeWeebCentralHtml(block.replace(/<[^>]+>/g, ' ')).replace(/,\s*$/, '') : null;
}

export function parseWeebCentralGenres(html: string): string[] {
  return [...new Set(
    [...html.matchAll(/included_tag=[^"]+">([^<]+)</gi)].map((match) => decodeWeebCentralHtml(match[1])),
  )];
}
