import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.VIDEO_BASE_URL || 'https://manga-wave-bienvenue-fusion.vercel.app';
const route = '/read/crunchyscan/one-punch-man/one-punch-man-309?lang=fr&page=0&title=One+Punch-Man&author=ONE';
const recordings = path.resolve('video-kit/recordings/production');
const screenshots = path.resolve('video-kit/screenshots/audit-production');
await Promise.all([
  fs.mkdir(recordings, { recursive: true }),
  fs.mkdir(path.join(screenshots, 'desktop'), { recursive: true }),
  fs.mkdir(path.join(screenshots, 'mobile'), { recursive: true }),
]);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: recordings, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.getByText(/Page 1 \/ 15/).waitFor({ state: 'visible', timeout: 60_000 });
await page.getByRole('img', { name: 'Page 1', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
await page.getByRole('img', { name: 'Page 1', exact: true }).evaluate((image) => image.decode());
await page.screenshot({ path: path.join(screenshots, 'desktop', '08-reader.png'), animations: 'disabled' });
await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
await page.getByText(/Page 2 \/ 15/).waitFor({ state: 'visible', timeout: 15_000 });
await page.waitForTimeout(850);
await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
await page.getByText(/Page 3 \/ 15/).waitFor({ state: 'visible', timeout: 15_000 });
await page.waitForTimeout(2000);
const video = page.video();
await context.close();
if (video) await fs.rename(await video.path(), path.join(recordings, '16x9-reader-navigation-raw.webm'));

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const mobilePage = await mobile.newPage();
await mobilePage.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await mobilePage.getByText(/Page 1 \/ 15/).waitFor({ state: 'visible', timeout: 60_000 });
await mobilePage.getByRole('img', { name: 'Page 1', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
await mobilePage.getByRole('img', { name: 'Page 1', exact: true }).evaluate((image) => image.decode());
await mobilePage.screenshot({ path: path.join(screenshots, 'mobile', '04-reader-390x844.png'), animations: 'disabled' });
await mobile.close();
await browser.close();
console.log(JSON.stringify({ status: 'PASS', route, pagesVerified: [1, 2, 3] }));
