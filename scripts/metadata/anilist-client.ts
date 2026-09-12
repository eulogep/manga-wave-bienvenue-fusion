import type { AniListMedia } from './canonical-metadata.ts';

export type FetchLike = typeof fetch;
export type Sleep = (milliseconds: number) => Promise<void>;

const QUERY = `
query ($search: String!) {
  Page(page: 1, perPage: 25) {
    pageInfo { hasNextPage }
    media(search: $search, type: MANGA, isAdult: false) {
      id
      idMal
      title { romaji english native }
      synonyms
      countryOfOrigin
      format
      startDate { year }
      staff(perPage: 8) { edges { role node { name { full } } } }
      externalLinks { site url }
    }
  }
}`;

export class AniListApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'AniListApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export class AniListClient {
  private lastRequestAt = 0;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: Sleep;
  private readonly minimumIntervalMs: number;
  private readonly now: () => number;

  constructor(
    fetchImpl: FetchLike = fetch,
    sleep: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    minimumIntervalMs = 2_100,
    now: () => number = Date.now,
  ) {
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.minimumIntervalMs = minimumIntervalMs;
    this.now = now;
  }

  async search(title: string): Promise<AniListMedia[]> {
    let attempt = 0;
    while (attempt < 4) {
      attempt += 1;
      const wait = this.minimumIntervalMs - (this.now() - this.lastRequestAt);
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = this.now();
      let response: Response;
      try {
        response = await this.fetchImpl('https://graphql.anilist.co', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { search: title } }),
        signal: AbortSignal.timeout(20_000),
      });
      } catch {
        if (attempt < 4) { await this.sleep(1_000 * 2 ** (attempt - 1)); continue; }
        throw new AniListApiError('AniList network/timeout retry budget exhausted', 0, true);
      }
      const payload = await response.json().catch(() => null) as {
        data?: { Page?: { media?: AniListMedia[]; pageInfo?: { hasNextPage?: boolean } } };
        errors?: Array<{ message?: string; status?: number }>;
      } | null;

      const status = payload?.errors?.[0]?.status || response.status;
      if (status === 429 || status >= 500) {
        const retryAfter = Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || (status === 429 ? 60 : 2 ** (attempt - 1))));
        if (attempt < 4) {
          await this.sleep(retryAfter * 1_000);
          continue;
        }
      }
      if (!response.ok || payload?.errors?.length) {
        const message = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ') || `AniList HTTP ${status}`;
        throw new AniListApiError(message, status, status === 429 || status >= 500);
      }
      if (!Array.isArray(payload?.data?.Page?.media)) throw new AniListApiError('Invalid AniList response schema', 502, true);
      return payload.data.Page.media.map((media) => ({ ...media, source: 'anilist', searchIncomplete: Boolean(payload.data?.Page?.pageInfo?.hasNextPage) }));
    }
    throw new AniListApiError('AniList retry budget exhausted', 429, true);
  }
}
