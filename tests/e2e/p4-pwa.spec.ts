import { expect, test } from '@playwright/test';

test('installed shell reopens a client route while offline without caching API data', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Manga Wave/ })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
  try {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Trouvez votre prochaine lecture', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/search$/);
  } finally {
    await context.setOffline(false);
  }
});
