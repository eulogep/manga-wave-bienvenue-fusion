import { AniListApiError } from './anilist-client.ts';
import { JikanApiError } from './jikan-client.ts';
import { MangaUpdatesApiError } from './mangaupdates-client.ts';
import { MangaDexMetadataError } from './mangadex-metadata-client.ts';
import type { AniListMedia } from './canonical-metadata.ts';

export type MetadataSource = 'anilist' | 'jikan' | 'kitsu' | 'mangaupdates' | 'mangadex';
export type CacheEntry = { source: MetadataSource; query: string; fetchedAt: string; candidates: AniListMedia[] };
export type MetadataCache = Record<string, CacheEntry>;
export type SearchProvider = { search(title: string): Promise<AniListMedia[]> };

type ProviderSlot = { name: MetadataSource; provider: SearchProvider; unavailable: boolean };

/**
 * Multi-source metadata provider with ordered failover.
 *
 * Failover chain (configurable):
 *   AniList → Jikan → MangaUpdates → Kitsu
 *
 * Each provider is tried in order. Availability failures (network, 5xx, 403 temporary disable)
 * trip the circuit for that provider, advancing to the next. Non-availability errors
 * (e.g. forbidden token) propagate immediately without fallback.
 *
 * Results are cached by source+query with a 7-day TTL.
 */
export class MetadataProvider {
  private slots: ProviderSlot[];
  readonly cache: MetadataCache;
  readonly outages: Array<{ source: MetadataSource; status: number; message: string }> = [];
  private now: () => number;

  constructor(
    providersOrPrimary: Array<{ name: MetadataSource; provider: SearchProvider }> | SearchProvider,
    secondaryOrCache: SearchProvider | MetadataCache = {},
    cacheOrNow: MetadataCache | (() => number) = {},
    now: () => number = Date.now,
    tertiary?: SearchProvider,
  ) {
    if (Array.isArray(providersOrPrimary)) {
      this.slots = providersOrPrimary.map((p) => ({ ...p, unavailable: false }));
      this.cache = (secondaryOrCache as MetadataCache) || {};
      this.now = typeof cacheOrNow === 'function' ? cacheOrNow : now;
    } else {
      const providers: Array<{ name: MetadataSource; provider: SearchProvider }> = [
        { name: 'anilist', provider: providersOrPrimary },
        { name: 'jikan', provider: secondaryOrCache as SearchProvider },
      ];
      if (tertiary) providers.push({ name: 'kitsu', provider: tertiary });
      this.slots = providers.map((p) => ({ ...p, unavailable: false }));
      this.cache = (cacheOrNow as MetadataCache) || {};
      this.now = now;
    }
  }

  /**
   * Legacy constructor compatibility: primary, secondary, cache, now, tertiary.
   */
  static legacy(
    primary: SearchProvider,
    secondary: SearchProvider,
    cache: MetadataCache = {},
    now = Date.now,
    tertiary?: SearchProvider,
  ): MetadataProvider {
    return new MetadataProvider(primary, secondary, cache, now, tertiary);
  }

  private async lookup(source: MetadataSource, query: string, provider: SearchProvider): Promise<AniListMedia[]> {
    const key = `${source}:${query}`;
    const cached = this.cache[key];
    const age = cached ? this.now() - Date.parse(cached.fetchedAt) : Infinity;
    if (cached?.source === source && cached.query === query && age >= 0 && age < 7 * 86_400_000) return cached.candidates;
    const candidates = await provider.search(query);
    this.cache[key] = { source, query, fetchedAt: new Date(this.now()).toISOString(), candidates };
    return candidates;
  }

  private isAvailabilityError(error: unknown): boolean {
    if (error instanceof AniListApiError) {
      return error.status === 0 || error.status >= 500 ||
        (error.status === 403 && /disabled|temporar|unavailable/i.test(error.message));
    }
    if (error instanceof JikanApiError) {
      return error.status === 0 || error.status >= 500;
    }
    if (error instanceof MangaUpdatesApiError) {
      return error.status === 0 || error.status >= 500;
    }
    if (error instanceof MangaDexMetadataError) {
      return error.status === 0 || error.status >= 500;
    }
    // Generic errors from Kitsu or unknown providers
    if (error instanceof Error && /network|timeout|retry budget exhausted/i.test(error.message)) {
      return true;
    }
    return false;
  }

  async search(query: string): Promise<{ source: MetadataSource; candidates: AniListMedia[] }> {
    let lastError: unknown;

    for (const slot of this.slots) {
      if (slot.unavailable) continue;

      try {
        const candidates = await this.lookup(slot.name, query, slot.provider);
        return { source: slot.name, candidates };
      } catch (error) {
        if (!this.isAvailabilityError(error)) throw error;
        slot.unavailable = true;
        const status = (error as { status?: number }).status || 0;
        const message = error instanceof Error ? error.message : String(error);
        this.outages.push({ source: slot.name, status, message });
        lastError = error;
      }
    }

    throw lastError || new Error('All metadata providers unavailable');
  }
}
