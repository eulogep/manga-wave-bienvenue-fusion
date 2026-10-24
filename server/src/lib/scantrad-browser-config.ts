import path from 'node:path';
import { tmpdir } from 'node:os';
import type { BrowserContext, LaunchOptions } from 'playwright-core';

export type ScantradCookie = Parameters<BrowserContext['addCookies']>[0][number];

type Environment = Record<string, string | undefined>;

export type ScantradBrowserConfig = {
  userDataDir: string;
  headless: boolean;
  userAgent?: string;
  cdpUrl?: string;
  proxy?: LaunchOptions['proxy'];
  cookiesJson?: string;
  cookiesPath?: string;
};

const SCANTRAD_HOST = 'manga-scantrad.io';
const MAX_COOKIE_EXPIRES_SECONDS = 253_402_300_799;

export function buildChromeUserAgent(platform: string, version: string): string {
  if (!/^\d+(?:\.\d+){0,3}$/.test(version)) {
    throw new Error('Version Chromium invalide pour la construction du User-Agent.');
  }
  const platformToken = platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

function isScantradHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\./, '').toLowerCase();
  return normalized === SCANTRAD_HOST || normalized.endsWith(`.${SCANTRAD_HOST}`);
}

export function resolveScantradBrowserConfig(
  env: Environment = process.env,
  cwd = process.cwd(),
): ScantradBrowserConfig {
  const proxyServer = env.SCANTRAD_PROXY_SERVER?.trim();
  const proxyUsername = env.SCANTRAD_PROXY_USERNAME?.trim();
  const proxyPassword = env.SCANTRAD_PROXY_PASSWORD;

  if (!proxyServer && (proxyUsername || proxyPassword)) {
    throw new Error('SCANTRAD_PROXY_SERVER est requis lorsque des identifiants proxy sont configurés.');
  }

  let proxy: LaunchOptions['proxy'];
  if (proxyServer) {
    const proxyUrl = new URL(proxyServer);
    const protocol = proxyUrl.protocol;
    if (!['http:', 'https:', 'socks5:'].includes(protocol)) {
      throw new Error('SCANTRAD_PROXY_SERVER doit utiliser http, https ou socks5.');
    }
    if (proxyUrl.username || proxyUrl.password) {
      throw new Error('Les identifiants proxy intégrés dans l’URL sont interdits; utilisez les variables dédiées.');
    }
    if (protocol === 'socks5:' && (proxyUsername || proxyPassword)) {
      throw new Error('SOCKS5: les identifiants ne sont pas pris en charge par Playwright.');
    }
    proxy = {
      server: proxyServer,
      ...(proxyUsername ? { username: proxyUsername } : {}),
      ...(proxyPassword ? { password: proxyPassword } : {}),
    };
  }

  const configuredProfile = env.SCANTRAD_USER_DATA_DIR?.trim();
  const configuredCdpUrl = env.SCANTRAD_CDP_URL?.trim();
  let cdpUrl: string | undefined;
  if (configuredCdpUrl) {
    const parsedCdpUrl = new URL(configuredCdpUrl);
    const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
    if (
      parsedCdpUrl.protocol !== 'http:'
      || !loopbackHosts.has(parsedCdpUrl.hostname)
      || parsedCdpUrl.username
      || parsedCdpUrl.password
    ) {
      throw new Error('SCANTRAD_CDP_URL doit être une URL HTTP locale sans identifiants.');
    }
    cdpUrl = parsedCdpUrl.origin;
  }
  const isServerless = Boolean(
    env.VERCEL
    || env.AWS_LAMBDA_FUNCTION_NAME
    || env.AWS_EXECUTION_ENV?.startsWith('AWS_Lambda_'),
  );
  const defaultProfile = isServerless
    ? path.join(tmpdir(), `scantrad-${process.pid}`)
    : '.playwright_user_data/scantrad';
  return {
    userDataDir: configuredProfile
      ? path.resolve(cwd, configuredProfile)
      : path.resolve(cwd, defaultProfile),
    headless: env.SCANTRAD_HEADLESS?.toLowerCase() !== 'false',
    userAgent: env.SCANTRAD_USER_AGENT?.trim() || undefined,
    cdpUrl,
    proxy,
    cookiesJson: env.SCANTRAD_COOKIES_JSON?.trim() || undefined,
    cookiesPath: env.SCANTRAD_COOKIES_PATH?.trim()
      ? path.resolve(cwd, env.SCANTRAD_COOKIES_PATH.trim())
      : undefined,
  };
}

export function parseScantradCookies(serialized: string): ScantradCookie[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('SCANTRAD_COOKIES_JSON ne contient pas un JSON valide.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Les cookies Scantrad doivent être fournis sous forme de tableau JSON.');
  }

  return parsed.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`Cookie Scantrad #${index + 1} invalide.`);
    }
    const cookie = candidate as Record<string, unknown>;
    if (typeof cookie.name !== 'string' || typeof cookie.value !== 'string') {
      throw new Error(`Cookie Scantrad #${index + 1}: name et value sont requis.`);
    }
    if (!cookie.name.trim()) {
      throw new Error(`Cookie Scantrad #${index + 1}: name ne peut pas être vide.`);
    }

    const hasUrl = cookie.url !== undefined;
    const hasDomain = cookie.domain !== undefined;
    const hasPath = cookie.path !== undefined;
    if (hasUrl && (hasDomain || hasPath)) {
      throw new Error(`Cookie Scantrad #${index + 1}: utilisez url ou domain + path, jamais les deux.`);
    }
    if (!hasUrl && (!hasDomain || !hasPath)) {
      throw new Error(`Cookie Scantrad #${index + 1}: domain et path sont requis sans url.`);
    }

    const domain = hasDomain && typeof cookie.domain === 'string' && cookie.domain
      ? cookie.domain
      : undefined;
    const cookiePath = hasPath && typeof cookie.path === 'string' && cookie.path
      ? cookie.path
      : undefined;
    const url = hasUrl && typeof cookie.url === 'string' && cookie.url
      ? cookie.url
      : undefined;
    if (hasUrl && !url) {
      throw new Error(`Cookie Scantrad #${index + 1}: url doit être une chaîne non vide.`);
    }
    if (!hasUrl && (!domain || !cookiePath)) {
      throw new Error(`Cookie Scantrad #${index + 1}: domain et path doivent être des chaînes non vides.`);
    }
    if (domain && !isScantradHost(domain)) {
      throw new Error(`Cookie Scantrad #${index + 1} doit cibler manga-scantrad.io.`);
    }
    if (url) {
      let cookieUrl: URL;
      try {
        cookieUrl = new URL(url);
      } catch {
        throw new Error(`Cookie Scantrad #${index + 1}: url invalide.`);
      }
      if (cookieUrl.protocol !== 'https:' || !isScantradHost(cookieUrl.hostname)) {
        throw new Error(`Cookie Scantrad #${index + 1} doit cibler manga-scantrad.io en HTTPS.`);
      }
    }

    const expires = cookie.expires;
    if (
      expires !== undefined
      && (
        typeof expires !== 'number'
        || !Number.isFinite(expires)
        || (expires !== -1 && (expires < 0 || expires > MAX_COOKIE_EXPIRES_SECONDS))
      )
    ) {
      throw new Error(`Cookie Scantrad #${index + 1}: expires invalide.`);
    }

    const sameSite = cookie.sameSite;
    if (sameSite !== undefined && !['Strict', 'Lax', 'None'].includes(String(sameSite))) {
      throw new Error(`Cookie Scantrad #${index + 1}: sameSite invalide.`);
    }

    return {
      name: cookie.name,
      value: cookie.value,
      ...(url ? { url } : {}),
      ...(domain ? { domain } : {}),
      ...(cookiePath ? { path: cookiePath } : {}),
      ...(expires !== undefined ? { expires } : {}),
      ...(typeof cookie.httpOnly === 'boolean' ? { httpOnly: cookie.httpOnly } : {}),
      ...(typeof cookie.secure === 'boolean' ? { secure: cookie.secure } : {}),
      ...(sameSite ? { sameSite: sameSite as 'Strict' | 'Lax' | 'None' } : {}),
    } as ScantradCookie;
  });
}
