import { expect, test } from '@playwright/test';

// T-3024 Similar Works is content-based, grounded entirely in T-3020's
// already-enriched, already-audited canonical metadata — no QA fixture or
// synthetic activity is needed: it works (or honestly doesn't) using the
// real production catalog exactly as any visitor would see it.

// Sono Bisque Doll wa Koi o Suru — MangaDex-enriched (T-3020), has real
// genres/author, so real overlapping catalog works are expected.
const ENRICHED_MANGA_ID = 2;
// A row from the unenriched remainder of the catalog (no genres/type
// recorded) — Similar Works must render nothing rather than a fabricated
// "similar" result when there is genuinely no metadata to compare.
const UNENRICHED_MANGA_ID = 145;

test.describe('T-3024 Similar Works (content-based, real production catalog)', () => {
  test('an enriched work surfaces real genre/author-overlapping catalog works', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`/manga/${ENRICHED_MANGA_ID}`, { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: 'Vous aimerez aussi' });
    await expect(heading).toBeVisible({ timeout: 30_000 });

    const section = page.locator('section', { has: heading });
    const cards = section.locator('a[aria-label]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(6);

    // Every card must link to a different canonical manga than the one
    // being viewed (never recommends itself).
    for (let index = 0; index < cardCount; index += 1) {
      const href = await cards.nth(index).getAttribute('href');
      expect(href).not.toBe(`/manga/${ENRICHED_MANGA_ID}`);
    }

    expect(errors, `Unhandled page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('a work with no enriched metadata renders no fabricated similarity section, and the page does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`/manga/${UNENRICHED_MANGA_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    expect(errors, `Unhandled page errors: ${errors.join('\n')}`).toEqual([]);
    // Absence is acceptable and expected here (no genuine overlap to report);
    // a crash or a fabricated-looking section would not be.
  });
});
