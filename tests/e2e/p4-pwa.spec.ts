import { expect, test } from '@playwright/test';

test('installed shell reopens a client route while offline without caching API data', async ({ page, context }) => {
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
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

  await page.goto('/search');
  await expect(page.getByRole('heading', { name: 'Trouvez votre prochaine lecture', exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const requests = (await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()))).flat();
    return requests.some((request) => new URL(request.url).pathname.startsWith('/assets/Search-'));
  })).toBe(true);
  await page.goto('/');

  await context.setOffline(true);
  try {
    await page.goto('/search');
    await page.waitForTimeout(1_000);
    await expect(page.getByRole('heading', { name: 'Trouvez votre prochaine lecture', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/search$/);
    expect(pageErrors).toEqual([]);
    expect(requestFailures.filter((failure) => failure.includes('/assets/'))).toEqual([]);
    const cachedRequests = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      return (await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()))).flat().map((request) => request.url);
    });
    expect(cachedRequests.some((url) => url.includes('/rest/v1/') || url.includes('/api/'))).toBe(false);
  } finally {
    await context.setOffline(false);
  }
});
