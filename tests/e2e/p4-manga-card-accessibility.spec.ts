import { expect, test } from '@playwright/test';

test('manga cards keep the full-card link without nested interactive content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('article.manga-card').first()).toBeVisible({ timeout: 90_000 });

  const cards = page.locator('article.manga-card');
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(page.locator('a a')).toHaveCount(0);

  const firstCard = cards.first();
  await expect(firstCard.getByRole('link', { name: /^Ouvrir la fiche de / })).toHaveCount(1);
  await expect(firstCard.getByRole('link', { name: /^Découvrir / })).toHaveCount(1);
  await expect(firstCard.getByRole('button', { name: /favoris$/ })).toHaveCount(1);
});

test('manga card layout remains contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('article.manga-card').first()).toBeVisible({ timeout: 90_000 });

  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator('a a')).toHaveCount(0);
});
