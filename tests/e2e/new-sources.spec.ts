import { expect, test } from '@playwright/test';

// Two new sources added to the existing multi-source architecture:
// MangaPill (EN aggregator, plain HTTP, no Cloudflare/JS challenge observed)
// and Sushi-Scan (FR, Madara/WordPress — same CMS family as the existing
// "crunchyscan" adapter). Both are reached only via direct provider
// navigation (?source=...) today; they are not yet part of the canonical
// catalog sync (see the accompanying report for what that would still
// require). No QA fixture is needed: this exercises the real live sites.

const MANGAPILL_ID = '2/one-piece';
const SUSHISCAN_ID = 'emperor-of-solo-play';

test.describe('New sources: MangaPill and Sushi-Scan', () => {
  test('MangaPill: detail loads, a chapter opens, and the page image genuinely renders (not just present in the DOM)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`/manga/${encodeURIComponent(MANGAPILL_ID)}?source=mangapill`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'One Piece' })).toBeVisible({ timeout: 20_000 });

    const chapterButton = page.getByRole('button', { name: /Lire le chapitre/i }).first();
    await expect(chapterButton).toBeVisible({ timeout: 20_000 });
    await chapterButton.click();
    await expect(page).toHaveURL(/\/read\/mangapill\//, { timeout: 20_000 });

    const image = page.locator('img').first();
    await expect(image).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    expect(errors, `Unhandled page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('Sushi-Scan: detail loads, a chapter opens, and the page image genuinely renders', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`/manga/${SUSHISCAN_ID}?source=sushiscan`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Emperor of Solo Play' })).toBeVisible({ timeout: 20_000 });

    const chapterButton = page.getByRole('button', { name: /Lire le chapitre/i }).first();
    await expect(chapterButton).toBeVisible({ timeout: 20_000 });
    await chapterButton.click();
    await expect(page).toHaveURL(/\/read\/sushiscan\//, { timeout: 20_000 });

    const image = page.locator('img').first();
    await expect(image).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    expect(errors, `Unhandled page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
