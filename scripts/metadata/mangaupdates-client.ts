import type { AniListMedia } from './canonical-metadata.ts';
import type { FetchLike, Sleep } from './anilist-client.ts';
import {
  type CanonicalMangaType,
  normalizeMetadataText,
} from '../../supabase/functions/_shared/canonical-metadata.ts';

export type MangaUpdatesSearchResult = {
  results: Array<{
    hit_title: string;
    record: {
      series_id: number;
      title: string;
      type: string | null;
      year: string | null;
      associated?: Array<{ title: string }>;
      authors?: Array<{ name: string; type: string; author_id: number | null }>;
    };
  }>;
  total_hits: number;
  per_page: number;
  page: number;
};

export type MangaUpdatesDetail = {
  series_id: number;
  title: string;
  type: string | null;
  year: string | null;
  associated: Array<{ title: string }>;
  authors: Array<{ name: string; type: string; author_id: number | null }>;
  genres?: Array<{ genre: string }>;
  status?: string | null;
};

export function normalizeMangaUpdatesType(type: string | null): CanonicalMangaType {
  if (type === 'Manga') return 'manga';
  if (type === 'Manhwa') return 'manhwa';
  if (type === 'Manhua') return 'manhua';
  // Novel, Light Novel, Doujinshi, One-shot, OEL etc. → null
  return null;
}

export function adaptMangaUpdates(record: MangaUpdatesDetail | MangaUpdatesSearchResult['results'][number]['record']): AniListMedia {
  const type = normalizeMangaUpdatesType(record.type);
  const aliases = (record.associated || []).map((a) => a.title).filter((t) => t?.trim());
  const storyAuthors = (record.authors || [])
    .filter((a) => a.type === 'Author')
    .map((a) => a.name)
    .filter(Boolean);
  const artAuthors = (record.authors || [])
    .filter((a) => a.type === 'Artist')
    .map((a) => a.name)
    .filter(Boolean);
  const allStaff = [
    ...storyAuthors.map((name) => ({ role: 'Story', node: { name: { full: name } } })),
    ...artAuthors.map((name) => ({ role: 'Art', node: { name: { full: name } } })),
  ];

  return {
    source: 'mangaupdates' as AniListMedia['source'],
    id: record.series_id,
    idMal: null,
    title: { romaji: record.title, english: record.title, native: null },
    synonyms: aliases,
    countryOfOrigin: null,
    normalizedType: type,
    format: record.type,
    status: ('status' in record ? (record as MangaUpdatesDetail).status : null) || null,
    startDate: { year: record.year ? Number(record.year) || null : null },
    staff: { edges: allStaff },
    externalLinks: [{ site: 'MangaUpdates', url: `https://www.mangaupdates.com/series/${record.series_id}` }],
  };
}

export class MangaUpdatesApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export class MangaUpdatesClient {
  private lastRequestAt = 0;
  private fetchImpl: FetchLike;
  private sleep: Sleep;
  private interval: number;
  private now: () => number;

  constructor(
    fetchImpl: FetchLike = fetch,
    sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    interval = 1_100,
    now = Date.now,
  ) {
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.interval = interval;
    this.now = now;
  }

  private async throttle(): Promise<void> {
    const wait = this.interval - (this.now() - this.lastRequestAt);
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
  }

  async search(title: string): Promise<AniListMedia[]> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        response = await this.fetchImpl('https://api.mangaupdates.com/v1/series/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ search: title, perpage: 25 }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 3) throw new MangaUpdatesApiError('MangaUpdates network/timeout retry budget exhausted', 0);
        await this.sleep(1_000 * 2 ** attempt);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const waitSeconds = Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || (response.status === 429 ? 60 : 2 ** attempt)));
        await this.sleep(waitSeconds * 1_000);
        continue;
      }
      if (!response.ok) throw new MangaUpdatesApiError(`MangaUpdates HTTP ${response.status}`, response.status);
      const payload = await response.json().catch(() => null) as MangaUpdatesSearchResult | null;
      if (!payload?.results || !Array.isArray(payload.results)) {
        throw new MangaUpdatesApiError('Invalid MangaUpdates response schema', 502);
      }
      // Validate each record has required fields
      for (const item of payload.results) {
        if (!item.record || typeof item.record.series_id !== 'number' || typeof item.record.title !== 'string') {
          throw new MangaUpdatesApiError('Invalid MangaUpdates record schema', 502);
        }
      }
      const normalizedQuery = normalizeMetadataText(title);
      const hasExactMatch = payload.results.some((item) =>
        normalizeMetadataText(item.record.title) === normalizedQuery
      );

      const candidates: AniListMedia[] = [];
      for (let i = 0; i < payload.results.length; i++) {
        const item = payload.results[i];
        let recordToAdapt: MangaUpdatesDetail | typeof item.record = item.record;
        // Enrich top candidate or exact title match with full detail (authors, aliases)
        if (i === 0 || normalizeMetadataText(item.record.title) === normalizedQuery) {
          try {
            recordToAdapt = await this.detail(item.record.series_id);
          } catch {
            // Keep basic search record if detail fetch fails
          }
        }
        candidates.push({
          ...adaptMangaUpdates(recordToAdapt),
          searchIncomplete: !hasExactMatch && payload.total_hits > payload.per_page,
        });
      }
      return candidates;
    }
    throw new MangaUpdatesApiError('MangaUpdates retry budget exhausted', 503);
  }

  async detail(seriesId: number): Promise<MangaUpdatesDetail> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        response = await this.fetchImpl(`https://api.mangaupdates.com/v1/series/${seriesId}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 3) throw new MangaUpdatesApiError('MangaUpdates detail network/timeout retry budget exhausted', 0);
        await this.sleep(1_000 * 2 ** attempt);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await this.sleep(Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || 2 ** attempt)) * 1_000);
        continue;
      }
      if (!response.ok) throw new MangaUpdatesApiError(`MangaUpdates detail HTTP ${response.status}`, response.status);
      const detail = await response.json().catch(() => null) as MangaUpdatesDetail | null;
      if (!detail || typeof detail.series_id !== 'number' || typeof detail.title !== 'string') {
        throw new MangaUpdatesApiError('Invalid MangaUpdates detail schema', 502);
      }
      return detail;
    }
    throw new MangaUpdatesApiError('MangaUpdates detail retry budget exhausted', 503);
  }
}
