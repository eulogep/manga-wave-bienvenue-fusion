/**
 * Playwright Browser Pool for local Node and Vercel Functions.
 * Reuses a shared Chromium instance for ordinary sources and a dedicated,
 * persistent profile for Scantrad.
 */
import serverlessChromium from '@sparticuz/chromium';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  buildChromeUserAgent,
  parseScantradCookies,
  resolveScantradBrowserConfig,
  type ScantradBrowserConfig,
} from './scantrad-browser-config.js';

const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ORDINARY_CONTEXT_OPTIONS = {
  userAgent: STEALTH_USER_AGENT,
  viewport: { width: 1920, height: 1080 },
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  extraHTTPHeaders: {
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
  },
} as const;

let browser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let scantradContext: BrowserContext | null = null;
let scantradContextPromise: Promise<BrowserContext> | null = null;
let scantradCdpBrowser: Browser | null = null;
const scantradPagePromises = new Set<Promise<Page>>();
let closePromise: Promise<void> | null = null;
const execFileAsync = promisify(execFile);

function getLocalExecutable(): string | undefined {
  const windowsCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter((value): value is string => Boolean(value));

  if (process.platform === 'win32') {
    return windowsCandidates.find((candidate) => existsSync(candidate));
  }
  if (process.platform === 'darwin') {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();
  }
  return undefined;
}

async function getExecutableAndArgs(): Promise<{ executablePath: string; args: string[] }> {
  const localExecutable = getLocalExecutable();
  return {
    executablePath: localExecutable || await serverlessChromium.executablePath(),
    args: localExecutable
      ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      : serverlessChromium.args,
  };
}

async function resolveScantradUserAgent(executablePath: string, configured?: string): Promise<string | undefined> {
  if (configured) return configured;
  try {
    const { stdout } = await execFileAsync(executablePath, ['--version']);
    const version = stdout.match(/(\d+(?:\.\d+){1,3})/)?.[1];
    return version ? buildChromeUserAgent(process.platform, version) : undefined;
  } catch (error) {
    console.warn('[BrowserPool] Unable to derive Chromium User-Agent:', error);
    return undefined;
  }
}

async function getBrowser(): Promise<Browser> {
  if (closePromise) {
    throw new Error('Le pool de navigateurs est en cours de fermeture.');
  }
  if (browser && browser.isConnected()) return browser;
  if (!browserPromise) {
    browserPromise = (async () => {
      const executable = await getExecutableAndArgs();
      const launchedBrowser = await chromium.launch({
        headless: true,
        ...executable,
      });
      browser = launchedBrowser;
      console.log('[BrowserPool] Chromium launched');
      return launchedBrowser;
    })().finally(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/**
 * Creates an isolated browser context for sources that do not need persistence.
 * Always close the returned context after use.
 */
export async function createBrowserContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  return b.newContext(ORDINARY_CONTEXT_OPTIONS);
}

async function loadConfiguredScantradCookies(config: ScantradBrowserConfig) {
  if (config.cookiesJson && config.cookiesPath) {
    throw new Error('Configurez SCANTRAD_COOKIES_JSON ou SCANTRAD_COOKIES_PATH, pas les deux.');
  }
  if (config.cookiesJson) return parseScantradCookies(config.cookiesJson);
  if (config.cookiesPath) {
    const serialized = await readFile(config.cookiesPath, 'utf8');
    return parseScantradCookies(serialized);
  }
  return [];
}

async function launchScantradContext(): Promise<BrowserContext> {
  const config = resolveScantradBrowserConfig();
  const cookies = await loadConfiguredScantradCookies(config);
  let context: BrowserContext;

  if (config.cdpUrl) {
    const cdpBrowser = await chromium.connectOverCDP(config.cdpUrl);
    const connectedContext = cdpBrowser.contexts()[0];
    if (!connectedContext) {
      await cdpBrowser.close().catch(() => undefined);
      throw new Error('Le Chrome CDP local ne fournit aucun contexte de navigation.');
    }
    scantradCdpBrowser = cdpBrowser;
    cdpBrowser.on('disconnected', () => {
      if (scantradCdpBrowser === cdpBrowser) scantradCdpBrowser = null;
      if (scantradContext === connectedContext) scantradContext = null;
    });
    context = connectedContext;
  } else {
    const executable = await getExecutableAndArgs();
    const userAgent = await resolveScantradUserAgent(executable.executablePath, config.userAgent);
    context = await chromium.launchPersistentContext(config.userDataDir, {
      headless: config.headless,
      ...executable,
      proxy: config.proxy,
      ...(userAgent ? { userAgent } : {}),
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      extraHTTPHeaders: {
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    context.on('close', () => {
      if (scantradContext === context) scantradContext = null;
    });
  }

  try {
    if (cookies.length > 0) await context.addCookies(cookies);
  } catch (error) {
    if (scantradCdpBrowser) {
      const cdpBrowser = scantradCdpBrowser;
      scantradCdpBrowser = null;
      await cdpBrowser.close().catch(() => undefined);
    } else {
      await context.close().catch(() => undefined);
    }
    throw error;
  }
  scantradContext = context;
  console.log(config.cdpUrl
    ? `[BrowserPool] Scantrad connected to local Chrome (${config.cdpUrl})`
    : `[BrowserPool] Scantrad persistent profile launched (${config.userDataDir})`);
  return context;
}

async function getScantradContext(): Promise<BrowserContext> {
  if (closePromise) {
    throw new Error('Le profil Scantrad est en cours de fermeture.');
  }
  if (scantradContext) return scantradContext;
  if (!scantradContextPromise) {
    scantradContextPromise = launchScantradContext().finally(() => {
      scantradContextPromise = null;
    });
  }
  return scantradContextPromise;
}

/**
 * Creates a page in Scantrad's persistent profile. Close the page after use,
 * but do not close its context: the context owns the reusable profile session.
 */
export function createScantradPage(): Promise<Page> {
  const operation = (async () => {
    const context = await getScantradContext();
    if (closePromise) {
      throw new Error('Le profil Scantrad est en cours de fermeture.');
    }
    return context.newPage();
  })();
  scantradPagePromises.add(operation);
  void operation.then(
    () => scantradPagePromises.delete(operation),
    () => scantradPagePromises.delete(operation),
  );
  return operation;
}

export async function closeBrowser(): Promise<void> {
  if (!closePromise) {
    const operation = Promise.resolve().then(async () => {
      await Promise.allSettled([...scantradPagePromises]);
      let context = scantradContext;
      if (scantradContextPromise) {
        try {
          context = await scantradContextPromise;
        } catch {
          // A failed launch has no context left to close.
        }
      }
      if (context) {
        if (scantradContext === context) scantradContext = null;
        if (scantradCdpBrowser) {
          const cdpBrowser = scantradCdpBrowser;
          scantradCdpBrowser = null;
          await cdpBrowser.close();
          console.log('[BrowserPool] Scantrad disconnected from local Chrome');
        } else {
          await context.close();
          console.log('[BrowserPool] Scantrad persistent profile closed');
        }
      }

      let sharedBrowser = browser;
      if (browserPromise) {
        try {
          sharedBrowser = await browserPromise;
        } catch {
          // A failed launch has no browser left to close.
        }
      }
      if (sharedBrowser) {
        if (browser === sharedBrowser) browser = null;
        await sharedBrowser.close();
        console.log('[BrowserPool] Chromium closed');
      }
    });
    closePromise = operation.finally(() => {
      closePromise = null;
    });
  }
  await closePromise;
}
