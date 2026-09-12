export type ProviderRequestOptions = {
  headers?: Record<string, string>;
  cacheTtlMs?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
};

type CacheEntry = { body: string; expiresAt: number };

type ProviderHttpDependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_MIN_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_CACHE_ENTRIES = 200;
const MAX_BACKOFF_MS = 30_000;

export class ProviderHttpError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    status: number | null,
    retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(response: Response, attempt: number, now: number): number {
  const retryAfter = response.headers.get('retry-after')?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, MAX_BACKOFF_MS);
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - now, 0), MAX_BACKOFF_MS);
  }
  return Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS);
}

export class ProviderHttpClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly nextRequestAt = new Map<string, number>();
  private readonly originQueues = new Map<string, Promise<void>>();
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(dependencies: ProviderHttpDependencies = {}) {
    this.fetcher = dependencies.fetch || fetch;
    this.now = dependencies.now || Date.now;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async getText(url: string, options: ProviderRequestOptions = {}): Promise<string> {
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > this.now()) return cached.body;
    if (cached) this.cache.delete(url);

    const existing = this.inFlight.get(url);
    if (existing) return existing;

    const request = this.requestText(url, options).finally(() => this.inFlight.delete(url));
    this.inFlight.set(url, request);
    return request;
  }

  private async waitForOrigin(origin: string, minIntervalMs: number): Promise<void> {
    const previous = this.originQueues.get(origin) || Promise.resolve();
    let release: () => void = () => {};
    const slot = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => slot);
    this.originQueues.set(origin, queued);

    await previous;
    const delay = Math.max((this.nextRequestAt.get(origin) || 0) - this.now(), 0);
    if (delay > 0) await this.sleep(delay);
    this.nextRequestAt.set(origin, this.now() + minIntervalMs);
    release();
    if (this.originQueues.get(origin) === queued) this.originQueues.delete(origin);
  }

  private remember(url: string, body: string, ttlMs: number): void {
    this.cache.set(url, { body, expiresAt: this.now() + ttlMs });
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }

  private async requestText(url: string, options: ProviderRequestOptions): Promise<string> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new ProviderHttpError('Seules les sources HTTPS sont autorisées.', null, false);

    const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
    let lastError: ProviderHttpError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await this.waitForOrigin(parsed.origin, minIntervalMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetcher(url, {
          signal: controller.signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'MangaWave/1.0 (+https://github.com/eulogep/manga-wave-bienvenue-fusion)',
            ...options.headers,
          },
        });
        if (response.ok) {
          const body = await response.text();
          this.remember(url, body, Math.max(0, options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS));
          return body;
        }

        const retryable = isRetryableStatus(response.status);
        lastError = new ProviderHttpError(`Le fournisseur a répondu ${response.status}.`, response.status, retryable);
        if (!retryable || attempt === maxRetries) throw lastError;
        await this.sleep(retryDelay(response, attempt, this.now()));
      } catch (error: unknown) {
        if (error instanceof ProviderHttpError) {
          if (!error.retryable || attempt === maxRetries) throw error;
          lastError = error;
          continue;
        }
        lastError = new ProviderHttpError(
          error instanceof Error ? error.message : String(error),
          null,
          true,
        );
        if (attempt === maxRetries) throw lastError;
        await this.sleep(Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new ProviderHttpError('Requête fournisseur impossible.', null, false);
  }
}

export const providerHttp = new ProviderHttpClient();
