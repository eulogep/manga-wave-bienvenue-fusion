import { expect, test } from '@playwright/test';

test('homepage defers secondary routes and command search until interaction', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Recherche rapide/ })).toBeVisible();

  const initialScripts = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/assets/') && entry.name.endsWith('.js'))
    .map((entry) => ({ name: new URL(entry.name).pathname, bytes: (entry as PerformanceResourceTiming).encodedBodySize })));
  const deferred = ['Search-', 'MangaDetail-', 'Reader-', 'Library-', 'History-', 'CommandSearchDialog-'];
  expect(initialScripts.some((script) => deferred.some((chunk) => script.name.includes(`/assets/${chunk}`)))).toBe(false);
  console.log(`P4_INITIAL_JS_ENCODED_BYTES=${initialScripts.reduce((sum, script) => sum + script.bytes, 0)}`);

  await page.getByRole('button', { name: /Recherche rapide/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => new URL(entry.name).pathname.includes('/assets/CommandSearchDialog-')))).toBe(true);
});

test('secondary routes load their own production chunks and remain navigable', async ({ page }) => {
  const scripts = new Set<string>();
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/assets/') && path.endsWith('.js')) scripts.add(path);
  });

  const routes = [
    { path: '/auth', heading: 'Bienvenue', chunk: 'Auth-' },
    { path: '/search', heading: 'Trouvez votre prochaine lecture', chunk: 'Search-' },
    { path: '/trending', heading: 'Tendances', chunk: 'Trending-' },
    { path: '/ranking', heading: 'Classement', chunk: 'Ranking-' },
    { path: '/random', heading: 'Surprends-moi', chunk: 'Random-' },
    { path: '/route-inconnue', heading: '404', chunk: 'NotFound-' },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
    expect([...scripts].some((script) => script.includes(`/assets/${route.chunk}`))).toBe(true);
  }
});
