import type { AniListMedia } from './canonical-metadata.ts';
import type { FetchLike, Sleep } from './anilist-client.ts';

export type KitsuManga = { id: string; attributes: {
  canonicalTitle: string; titles: Record<string, string | null>; abbreviatedTitles?: string[];
  subtype: string; status?: string; startDate?: string | null;
} };
export function adaptKitsu(row: KitsuManga): AniListMedia {
  const attributes = row.attributes;
  const type = attributes.subtype;
  return {
    source: 'kitsu', id: Number(row.id), idMal: null,
    title: { romaji: attributes.canonicalTitle, english: attributes.titles.en || attributes.titles.en_us || null, native: null },
    synonyms: [...Object.values(attributes.titles).filter((title): title is string => Boolean(title)), ...(attributes.abbreviatedTitles || [])],
    countryOfOrigin: null, normalizedType: type === 'manga' || type === 'manhwa' || type === 'manhua' ? type : null,
    format: type, status: attributes.status || null,
    startDate: { year: attributes.startDate ? Number(attributes.startDate.slice(0, 4)) || null : null },
    staff: { edges: [] }, externalLinks: [{ site: 'Kitsu', url: `https://kitsu.app/manga/${row.id}` }],
  };
}
export class KitsuClient {
  private last = 0;
  private fetchImpl: FetchLike;
  private sleep: Sleep;
  constructor(fetchImpl: FetchLike = fetch, sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) { this.fetchImpl = fetchImpl; this.sleep = sleep; }
  async search(title: string): Promise<AniListMedia[]> {
    const query = new URLSearchParams({ 'filter[text]': title, 'page[limit]': '20' });
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = 1_100 - (Date.now() - this.last);
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      let response: Response;
      try { response = await this.fetchImpl(`https://kitsu.io/api/edge/manga?${query}`, { headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(20_000) }); }
      catch { if (attempt === 3) throw new Error('Kitsu network/timeout retry budget exhausted'); await this.sleep(1_000 * 2 ** attempt); continue; }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await this.sleep(Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || (response.status === 429 ? 60 : 2 ** attempt))) * 1_000); continue;
      }
      if (!response.ok) throw new Error(`Kitsu HTTP ${response.status}`);
      const payload = await response.json().catch(() => null) as { data?: KitsuManga[]; links?: { next?: string | null } } | null;
      if (!Array.isArray(payload?.data) || payload.data.some((row) => !Number.isSafeInteger(Number(row.id)) || !row.attributes?.canonicalTitle || !row.attributes.titles)) throw new Error('Invalid Kitsu response schema');
      return payload.data.map((row) => ({ ...adaptKitsu(row), searchIncomplete: Boolean(payload.links?.next) }));
    }
    throw new Error('Kitsu retry budget exhausted');
  }
}
