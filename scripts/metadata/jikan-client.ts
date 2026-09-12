import type { AniListMedia } from './canonical-metadata.ts';
import type { FetchLike, Sleep } from './anilist-client.ts';
import type { CanonicalMangaType } from '../../supabase/functions/_shared/canonical-metadata.ts';

export type JikanManga = {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  type: string | null;
  authors?: Array<{ name: string }>;
  status?: string | null;
  published?: { from?: string | null; prop?: { from?: { year?: number | null } } };
};

export function normalizeJikanType(type: string | null): CanonicalMangaType {
  if (type === 'Manga') return 'manga';
  if (type === 'Manhwa') return 'manhwa';
  if (type === 'Manhua') return 'manhua';
  return null;
}

export function adaptJikan(manga: JikanManga): AniListMedia {
  return {
    source: 'jikan', id: manga.mal_id, idMal: manga.mal_id,
    title: { romaji: manga.title, english: manga.title_english || null, native: manga.title_japanese || null },
    synonyms: manga.title_synonyms || [], countryOfOrigin: null,
    // Jikan publication type does not prove a specific ISO country (e.g. CN vs TW).
    normalizedType: normalizeJikanType(manga.type), format: manga.type,
    status: manga.status || null,
    startDate: { year: manga.published?.prop?.from?.year || null },
    staff: { edges: (manga.authors || []).map((author) => ({ role: 'Story & Art', node: { name: { full: author.name } } })) },
    externalLinks: [{ site: 'MyAnimeList', url: `https://myanimelist.net/manga/${manga.mal_id}` }],
  };
}

export class JikanApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export class JikanClient {
  private lastRequestAt = 0;
  private fetchImpl: FetchLike;
  private sleep: Sleep;
  private interval: number;
  private now: () => number;
  constructor(fetchImpl: FetchLike = fetch, sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), interval = 1_100, now = Date.now) {
    this.fetchImpl = fetchImpl; this.sleep = sleep; this.interval = interval; this.now = now;
  }
  async search(title: string): Promise<AniListMedia[]> {
    const query = new URLSearchParams({ q: title, limit: '25' });
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = this.interval - (this.now() - this.lastRequestAt);
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = this.now();
      let response: Response;
      try {
        response = await this.fetchImpl(`https://api.jikan.moe/v4/manga?${query}`, {
          headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 3) throw new JikanApiError('Jikan network/timeout retry budget exhausted', 0);
        await this.sleep(1_000 * 2 ** attempt); continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const waitSeconds = Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || (response.status === 429 ? 60 : 2 ** attempt)));
        await this.sleep(waitSeconds * 1_000); continue;
      }
      if (!response.ok) throw new JikanApiError(`Jikan HTTP ${response.status}; bounded retry exhausted or non-retryable`, response.status);
      const payload = await response.json().catch(() => null) as { data?: JikanManga[]; pagination?: { has_next_page?: boolean } } | null;
      if (!Array.isArray(payload?.data) || payload.data.some((item) => !Number.isSafeInteger(item.mal_id) || typeof item.title !== 'string')) {
        throw new JikanApiError('Invalid Jikan response schema', 502);
      }
      // Never accept a unique match from a truncated result set.
      return payload.data.map((manga) => ({ ...adaptJikan(manga), searchIncomplete: Boolean(payload.pagination?.has_next_page) }));
    }
    throw new JikanApiError('Jikan retry budget exhausted', 503);
  }
}
