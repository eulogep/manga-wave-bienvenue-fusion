import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:8080';
const profile = process.env.VIDEO_AUDIT_PROFILE || 'candidate';
const routes = ['/', '/search?browse=1', '/search?q=Solo%20Leveling', '/manga/7', '/auth'];
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  for (const route of routes) {
    const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1800);
    const checks = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const label = (element) => element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim();
      const interactive = [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(visible);
      return {
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        imagesWithoutAlt: [...document.querySelectorAll('img:not([alt])')].filter(visible).length,
        unlabeledInteractive: interactive.filter((element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
            return !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !element.id?.trim() && !element.closest('label');
          }
          return !label(element);
        }).length,
        smallTouchTargets: window.innerWidth < 600 ? interactive.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        }).length : null,
        h1Count: document.querySelectorAll('h1').length,
      };
    });
    results.push({ route, viewport, status: response?.status() ?? null, ...checks });
  }
  await context.close();
}
await browser.close();
await fs.mkdir('video-kit/docs', { recursive: true });
await fs.writeFile(`video-kit/docs/capture-audit-${profile}.json`, `${JSON.stringify({ generatedAt: new Date().toISOString(), baseURL, results }, null, 2)}\n`);
const failed = results.filter((result) => result.status !== 200 || result.horizontalOverflow || result.imagesWithoutAlt || result.unlabeledInteractive);
console.log(JSON.stringify({ status: failed.length ? 'REVIEW' : 'PASS', checks: results.length, failed: failed.length }));
