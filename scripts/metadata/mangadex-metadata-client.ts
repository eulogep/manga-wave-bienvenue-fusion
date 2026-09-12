import type { AniListMedia } from './canonical-metadata.ts';
import type { FetchLike, Sleep } from './anilist-client.ts';
import {
  canonicalTypeFromCountry,
  countryFromMangaDexLanguage,
} from '../../supabase/functions/_shared/canonical-metadata.ts';

/**
 * MangaDex direct metadata lookup client.
 * Unlike the search-based providers, this client performs direct ID lookups
 * for canonical rows that already have a mangadex_id. This produces EXACT
 * confidence without any title matching ambiguity.
 */

type MangaDexMangaResponse = {
  data: {
    id: string;
    attributes: {
      title: Record<string, string>;
      altTitles: Array<Record<string, string>>;
      originalLanguage?: string;
      status?: string;
      year?: number | null;
      tags?: Array<{ attributes?: { group?: string; name?: Record<string, string> } }>;
    };
    relationships?: Array<{
      id: string;
      type: string;
      attributes?: { name?: string };
    }>;
  };
};

export class MangaDexMetadataError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export class MangaDexMetadataClient {
  private lastRequestAt = 0;
  private fetchImpl: FetchLike;
  private sleep: Sleep;
  private interval: number;
  private now: () => number;

  constructor(
    fetchImpl: FetchLike = fetch,
    sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    interval = 250, // MangaDex allows 5 req/s
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

  /**
   * Directly fetch metadata for a manga by its MangaDex UUID.
   * Returns an AniListMedia-shaped object for use with the shared matching system.
   */
  async getById(mangadexId: string): Promise<AniListMedia> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        response = await this.fetchImpl(
          `https://api.mangadex.org/manga/${encodeURIComponent(mangadexId)}?includes[]=author&includes[]=artist`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)',
            },
            signal: AbortSignal.timeout(20_000),
          },
        );
      } catch {
        if (attempt === 3) throw new MangaDexMetadataError('MangaDex metadata network/timeout retry budget exhausted', 0);
        await this.sleep(1_000 * 2 ** attempt);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const waitSeconds = Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || 2 ** attempt));
        await this.sleep(waitSeconds * 1_000);
        continue;
      }
      if (response.status === 404) {
        throw new MangaDexMetadataError(`MangaDex manga not found: ${mangadexId}`, 404);
      }
      if (!response.ok) throw new MangaDexMetadataError(`MangaDex HTTP ${response.status}`, response.status);
      const payload = await response.json().catch(() => null) as MangaDexMangaResponse | null;
      if (!payload?.data?.id || !payload.data.attributes) {
        throw new MangaDexMetadataError('Invalid MangaDex metadata response schema', 502);
      }

      return this.adapt(payload.data);
    }
    throw new MangaDexMetadataError('MangaDex metadata retry budget exhausted', 503);
  }

  /**
   * Search MangaDex by title.
   * Returns AniListMedia candidates with author and artist relationships.
   */
  async search(title: string): Promise<AniListMedia[]> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&includes[]=author&includes[]=artist`;
        response = await this.fetchImpl(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)',
          },
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 3) throw new MangaDexMetadataError('MangaDex search network/timeout retry budget exhausted', 0);
        await this.sleep(1_000 * 2 ** attempt);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const waitSeconds = Math.min(60, Math.max(1, Number(response.headers.get('retry-after')) || 2 ** attempt));
        await this.sleep(waitSeconds * 1_000);
        continue;
      }
      if (!response.ok) throw new MangaDexMetadataError(`MangaDex search HTTP ${response.status}`, response.status);
      const payload = await response.json().catch(() => null) as {
        data?: Array<MangaDexMangaResponse['data']>;
        total?: number;
        limit?: number;
      } | null;
      if (!Array.isArray(payload?.data)) {
        throw new MangaDexMetadataError('Invalid MangaDex search response schema', 502);
      }
      return payload.data.map((item) => ({
        ...this.adapt(item),
        searchIncomplete: (payload.total ?? 0) > (payload.limit ?? 10),
      }));
    }
    throw new MangaDexMetadataError('MangaDex search retry budget exhausted', 503);
  }

  adapt(data: MangaDexMangaResponse['data']): AniListMedia {
    const attrs = data.attributes;
    const relationships = data.relationships || [];

    // Extract titles
    const primaryTitle = this.text(attrs.title);
    const altTitles = (attrs.altTitles || []).flatMap((obj) => Object.values(obj)).filter(Boolean);

    // Extract authors
    const authors = relationships
      .filter((r) => r.type === 'author')
      .map((r) => r.attributes?.name || '')
      .filter(Boolean);
    const artists = relationships
      .filter((r) => r.type === 'artist')
      .map((r) => r.attributes?.name || '')
      .filter(Boolean);

    // Derive country from originalLanguage
    const country = countryFromMangaDexLanguage(attrs.originalLanguage);
    const mangaType = canonicalTypeFromCountry(country);

    return {
      source: 'mangadex' as AniListMedia['source'],
      id: data.id,
      idMal: null,
      title: {
        romaji: primaryTitle,
        english: this.textByLocale(attrs.title, attrs.altTitles, 'en'),
        native: this.textByLocale(attrs.title, attrs.altTitles, 'ja') ||
                this.textByLocale(attrs.title, attrs.altTitles, 'ko') ||
                this.textByLocale(attrs.title, attrs.altTitles, 'zh'),
      },
      synonyms: altTitles,
      countryOfOrigin: country,
      normalizedType: mangaType,
      format: 'MANGA',
      status: attrs.status || null,
      startDate: { year: attrs.year || null },
      staff: {
        edges: [
          ...authors.map((name) => ({ role: 'Story', node: { name: { full: name } } })),
          ...artists.map((name) => ({ role: 'Art', node: { name: { full: name } } })),
        ],
      },
      externalLinks: [{ site: 'MangaDex', url: `https://mangadex.org/title/${data.id}` }],
      _mangadexUuid: data.id,
    } as AniListMedia & { _mangadexUuid: string };
  }

  private text(value: Record<string, string>): string {
    for (const locale of ['en', 'ja-ro', 'ko-ro', 'fr', 'ja', 'ko']) {
      const candidate = value[locale];
      if (candidate?.trim()) return candidate.trim();
    }
    return Object.values(value).find((v) => v?.trim())?.trim() || '';
  }

  private textByLocale(
    primary: Record<string, string>,
    altTitles: Array<Record<string, string>>,
    locale: string,
  ): string | null {
    if (primary[locale]?.trim()) return primary[locale].trim();
    for (const obj of altTitles || []) {
      if (obj[locale]?.trim()) return obj[locale].trim();
    }
    return null;
  }
}
