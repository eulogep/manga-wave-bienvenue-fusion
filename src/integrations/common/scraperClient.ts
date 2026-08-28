/**
 * Resilient Scraper Client inspired by manga-py and comic-dl
 * Features:
 * - Multi-proxy fallback rotation (avoids single point of failure)
 * - Exponential backoff retry logic
 * - Header & Referer emulation
 * - Robust HTML & Regex extractors
 */

export interface ScraperRequestOptions {
  headers?: Record<string, string>;
  referer?: string;
  maxRetries?: number;
  timeoutMs?: number;
  asJson?: boolean;
}

const configuredProxyBase = import.meta.env.VITE_MANGA_PROXY_URL ||
  (import.meta.env.VITE_SUPABASE_URL
    ? `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')}/functions/v1/manga-proxy`
    : '');

// Prefer the project-owned proxy. Public relays remain fallbacks for local
// development and temporary upstream outages.
const PROXY_POOL = [
  ...(configuredProxyBase
    ? [(url: string) => `${configuredProxyBase}?url=${encodeURIComponent(url)}`]
    : []),
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Perform a resilient fetch with proxy rotation, timeouts, and retries
 */
export async function resilientScrape<T = string>(
  targetUrl: string,
  options: ScraperRequestOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Rotate proxy based on attempt count
    const proxyFn = PROXY_POOL[attempt % PROXY_POOL.length];
    const proxyUrl = proxyFn(targetUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: options.asJson
            ? 'application/json, text/plain, */*'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          ...(options.referer ? { Referer: options.referer } : {}),
          ...(configuredProxyBase && proxyUrl.startsWith(configuredProxyBase) && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
            ? { apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) }
            : {}),
          ...options.headers,
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }

      if (options.asJson) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 400 * Math.pow(2, attempt)));
      }
    }
  }

  throw new Error(`Échec de récupération pour ${targetUrl} après ${maxRetries + 1} essais. Dernier motif : ${lastError?.message}`);
}

/**
 * Text parsing helpers (inspired by comic-dl and manga-py regex extractors)
 */
export function extractRegexAll(html: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  while ((match = re.exec(html)) !== null) {
    matches.push(match);
  }
  return matches;
}

export function extractFirstMatch(html: string, regex: RegExp, groupIndex = 1): string | null {
  const match = regex.exec(html);
  return match && match[groupIndex] ? match[groupIndex].trim() : null;
}

export function cleanHtmlText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
