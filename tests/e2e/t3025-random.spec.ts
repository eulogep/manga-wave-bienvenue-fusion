import { expect, test } from '@playwright/test';

const catalog = [
  { id: 1, title: 'Manga One', aliases: [], author: 'Auteur A', genre: ['Action'], manga_type: 'manga', status: 'ongoing', cover_image: null, rating: null, views: 0, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, title: 'Manga Two', aliases: [], author: 'Auteur B', genre: ['Romance'], manga_type: 'manga', status: 'completed', cover_image: null, rating: null, views: 0, created_at: '2026-01-02T00:00:00Z' },
  { id: 3, title: 'Manhwa Three', aliases: [], author: null, genre: ['Fantasy'], manga_type: 'manhwa', status: 'ongoing', cover_image: null, rating: null, views: 0, created_at: '2026-01-03T00:00:00Z' },
  { id: 4, title: 'Manhua Four', aliases: [], author: 'Auteur D', genre: ['Adventure'], manga_type: 'manhua', status: 'ongoing', cover_image: null, rating: null, views: 0, created_at: '2026-01-04T00:00:00Z' },
];

let providerRequests = 0;
const REAL_CATALOG = process.env.T3025_REAL_CATALOG === '1';

test.beforeEach(async ({ page }) => {
  providerRequests = 0;
  await page.route('**/api/extract/**', (route) => {
    providerRequests += 1;
    return route.fulfill({ status: 503, json: { error: 'Provider unavailable' } });
  });
  if (REAL_CATALOG) return;
  await page.route('**/rest/v1/mangas**', (route) => {
    const url = new URL(route.request().url());
    const after = Number(url.searchParams.get('id')?.replace('gt.', '') || 0);
    return route.fulfill({ json: catalog.filter((work) => work.id > after) });
  });
});

test('a URL-selected canonical work survives reload and reroll never repeats it', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Synthetic URL persistence fixture');
  await page.goto('/random?id=2');
  await expect(page.getByRole('heading', { name: 'Manga Two' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/random\?id=2$/);
  await expect(page.getByRole('heading', { name: 'Manga Two' })).toBeVisible();

  await page.getByTestId('random-reroll').click();
  await expect(page).not.toHaveURL(/(?:\?|&)id=2(?:&|$)/);
  await expect(page.locator('[data-testid^="random-result-"]')).toBeVisible();
  expect(providerRequests).toBe(0);
});

test('format and status filters are canonical, URL-backed, and expose an honest empty state', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Synthetic empty-state fixture');
  await page.goto('/random');
  await page.getByLabel('Filtrer le tirage par format').selectOption('manhua');
  await expect(page).toHaveURL(/type=manhua/);
  await expect(page).toHaveURL(/id=4/);
  await expect(page.getByRole('heading', { name: 'Manhua Four' })).toBeVisible();

  await page.getByLabel('Filtrer le tirage par statut').selectOption('completed');
  await expect(page.getByRole('heading', { name: 'Aucune œuvre pour ces filtres' })).toBeVisible();
  await expect(page).toHaveURL(/type=manhua/);
  await expect(page).toHaveURL(/status=completed/);
  expect(providerRequests).toBe(0);
});

test('Header and Command Search expose Random on desktop and mobile without overflow', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Synthetic navigation fixture');
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Surprise/i })).toBeVisible();
  await page.getByTestId('header-command-search-button').click();
  await expect(page.getByTestId('command-nav-random')).toBeVisible();
  await page.getByTestId('command-nav-random').click();
  await expect(page).toHaveURL(/\/random/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const control of [page.getByLabel('Filtrer le tirage par format'), page.getByLabel('Filtrer le tirage par statut'), page.getByTestId('random-reroll')]) {
    const box = await control.boundingBox();
    expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  }
});

test('the real enriched catalog draws Manga, Manhwa and Manhua without provider traffic', async ({ page }) => {
  test.skip(!REAL_CATALOG, 'Real-catalog smoke only');
  for (const type of ['manga', 'manhwa', 'manhua']) {
    await page.goto(`/random?type=${type}`);
    await expect(page).toHaveURL(new RegExp(`type=${type}.*id=\\d+`));
    const result = page.locator('[data-testid^="random-result-"]');
    await expect(result).toBeVisible();
    await expect(result.getByText(new RegExp(`^${type}$`, 'i'))).toBeVisible();
    const firstId = new URL(page.url()).searchParams.get('id');
    await page.getByTestId('random-reroll').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('id')).not.toBe(firstId);
  }
  expect(providerRequests).toBe(0);
});
