import { expect, test } from '@playwright/test';

const REAL_CATALOG = process.env.T3026_REAL_CATALOG === '1';
let providerRequests = 0;

const canonicalManga = {
  id: 42,
  aliases: ['Na Honjaman Level Up', '나 혼자만 레벨업'],
  artist: 'Dubu',
  author: 'Chugong',
  content_rating: null,
  country_of_origin: 'KR',
  cover_image: null,
  created_at: '2026-01-01T00:00:00Z',
  description: 'Un chasseur autrefois faible obtient un pouvoir qui change son destin.',
  genre: ['Action', 'Fantasy'],
  last_synced_at: '2026-09-10T00:00:00Z',
  manga_type: 'manhwa',
  mangadex_id: null,
  metadata_confidence: 'EXACT',
  metadata_external_id: '121496',
  metadata_source: 'jikan',
  metadata_updated_at: '2026-09-10T12:00:00Z',
  normalized_title: 'solo leveling',
  rating: 8.7,
  source_updated_at: '2026-09-10T00:00:00Z',
  status: 'completed',
  title: 'Solo Leveling',
  updated_at: '2026-09-10T12:00:00Z',
  views: 1000,
};

test.beforeEach(async ({ page }) => {
  providerRequests = 0;
  await page.route('**/api/extract/**', (route) => {
    providerRequests += 1;
    return route.fulfill({ status: 503, json: { error: 'Provider unavailable' } });
  });
  if (REAL_CATALOG) return;

  await page.route('**/rest/v1/mangas**', (route) => {
    const url = new URL(route.request().url());
    const exactId = url.searchParams.get('id')?.replace('eq.', '');
    if (exactId) return route.fulfill({ json: exactId === '42' ? [canonicalManga] : [] });
    return route.fulfill({ json: [canonicalManga] });
  });
  await page.route('**/rest/v1/manga_source_mappings**', (route) => route.fulfill({ json: [{
    available: true,
    created_at: '2026-01-01T00:00:00Z',
    id: 1,
    language: 'fr',
    last_synced_at: null,
    manga_id: 42,
    manually_verified: true,
    match_confidence: 1,
    metadata: {},
    normalized_source_title: 'solo leveling',
    source_id: 'originmanga',
    source_manga_id: 'fixture-solo-leveling',
    source_title: 'Solo Leveling',
    source_url: null,
    updated_at: '2026-01-01T00:00:00Z',
  }] }));
  await page.route('**/rest/v1/rpc/rank_canonical_manga_sources', (route) => route.fulfill({ json: [] }));
});

test('canonical metadata remains complete when every reading provider is unavailable', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Controlled provider-outage fixture');
  await page.goto('/manga/42');
  const detail = page.getByTestId('manga-detail-v2');
  await expect(detail.getByRole('heading', { name: 'Solo Leveling', exact: true })).toBeVisible();
  await expect(detail.getByText('Manhwa', { exact: true })).toBeVisible();
  await expect(detail.getByText('Corée du Sud', { exact: true })).toBeVisible();
  await expect(detail.getByTestId('canonical-aliases')).toContainText('Na Honjaman Level Up');
  await expect(detail.getByText('8.7 / 10', { exact: true })).toBeVisible();
  await expect(detail.getByTestId('canonical-source-count')).toHaveText('1');
  await expect(detail.getByTestId('canonical-provenance')).toContainText('MyAnimeList / Jikan · confiance EXACT');
  await expect(detail.getByText(/aucun chapitre ne peut être chargé/i)).toBeVisible();
  expect(providerRequests).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('an unknown canonical id has an honest recovery state', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Controlled not-found fixture');
  await page.goto('/manga/999999');
  await expect(page.getByRole('heading', { name: 'Fiche manga indisponible' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revenir à la recherche' })).toHaveAttribute('href', '/search');
  expect(providerRequests).toBe(0);
});

test('a real enriched canonical record renders independently from provider availability', async ({ page }) => {
  test.skip(!REAL_CATALOG, 'Real production catalog only');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('/manga/2', { waitUntil: 'domcontentloaded' });
  const detail = page.getByTestId('manga-detail-v2');
  await expect(detail).toBeVisible({ timeout: 30_000 });
  await expect(detail.getByRole('heading', { level: 1 })).toContainText('Sono Bisque Doll wa Koi o Suru');
  await expect(detail.getByTestId('canonical-aliases')).toBeVisible();
  await expect(detail.getByTestId('canonical-provenance')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
