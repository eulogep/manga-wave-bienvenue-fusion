/**
 * Playwright Browser Pool for local Node and Vercel Functions.
 * Reuses a single Chromium instance across all requests.
 * Each request gets its own isolated BrowserContext (separate cookies/cache).
 */
import serverlessChromium from '@sparticuz/chromium';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { existsSync } from 'node:fs';

const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  const windowsCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter((value): value is string => Boolean(value));
  const localExecutable = process.platform === 'win32'
    ? windowsCandidates.find((candidate) => existsSync(candidate))
    : undefined;
  browser = await chromium.launch({
    headless: true,
    executablePath: localExecutable || await serverlessChromium.executablePath(),
    args: localExecutable
      ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      : serverlessChromium.args,
  });
  console.log('[BrowserPool] Chromium launched');
  return browser;
}

/**
 * Creates an isolated browser context with ordinary browser headers.
 * Always close the context after use to free memory.
 */
export async function createBrowserContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  const ctx = await b.newContext({
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
  });

  return ctx;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[BrowserPool] Chromium closed');
  }
}
