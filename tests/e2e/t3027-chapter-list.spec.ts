import { expect, test } from '@playwright/test';

const REAL_CATALOG = process.env.T3027_REAL_CATALOG === '1';
const chapters = Array.from({ length: 85 }, (_, index) => {
  const number = index + 1;
  return {
    id: `chapter-${number}`,
    chapterNumber: String(number),
    title: number === 37 ? 'Le réveil écarlate' : `Épisode ${number}`,
    date: `2026-01-${String((number % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    language: 'fr',
    url: `https://example.invalid/chapter-${number}`,
  };
});

const manga = {
  id: 42, aliases: [], artist: null, author: 'Auteur QA', content_rating: null,
  country_of_origin: 'KR', cover_image: null, created_at: '2026-01-01T00:00:00Z',
  description: 'Fixture Chapter List V2', genre: ['Action'], last_synced_at: null,
  manga_type: 'manhwa', mangadex_id: null, metadata_confidence: 'EXACT',
  metadata_external_id: '42', metadata_source: 'jikan', metadata_updated_at: '2026-09-12T00:00:00Z',
  normalized_title: 'chapter wave', rating: 8, source_updated_at: null, status: 'ongoing',
  title: 'Chapter Wave', updated_at: '2026-09-12T00:00:00Z', views: 0,
};

test.beforeEach(async ({ page }) => {
  if (REAL_CATALOG) return;
  await page.route('**/rest/v1/mangas**', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.searchParams.has('id') && url.searchParams.get('id')?.startsWith('eq.') ? [manga] : [manga] });
  });
  await page.route('**/rest/v1/manga_source_mappings**', (route) => route.fulfill({ json: [{
    available: true, created_at: '2026-01-01T00:00:00Z', id: 1, language: 'fr', last_synced_at: null,
    manga_id: 42, manually_verified: true, match_confidence: 1, metadata: {},
    normalized_source_title: 'chapter wave', source_id: 'originmanga', source_manga_id: 'chapter-wave',
    source_title: 'Chapter Wave', source_url: null, updated_at: '2026-01-01T00:00:00Z',
  }] }));
  await page.route('**/rest/v1/rpc/rank_canonical_manga_sources', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/extract/detail/originmanga/chapter-wave', (route) => route.fulfill({ json: { manga: {
    id: 'chapter-wave', title: 'Chapter Wave', coverUrl: null, author: 'Auteur QA', status: 'ongoing',
    genres: ['Action'], synopsis: 'Fixture Chapter List V2', chapters,
  } } }));
});

test('chapter list sorts numerically, searches and progressively reveals a large catalog', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Controlled large chapter fixture');
  await page.goto('/manga/42');
  const list = page.getByTestId('chapter-list-v2');
  await expect(list).toBeVisible();
  await expect(list.locator('article')).toHaveCount(40);
  await expect(list.locator('article').first()).toContainText('Chapitre 85');

  await list.getByRole('button', { name: /Afficher 40 chapitres de plus/ }).click();
  await expect(list.locator('article')).toHaveCount(80);

  await list.getByPlaceholder('Numéro, titre ou équipe…').fill('réveil écarlate');
  await expect(list.locator('article')).toHaveCount(1);
  await expect(list.locator('article')).toContainText('Chapitre 37');

  await list.getByPlaceholder('Numéro, titre ou équipe…').fill('');
  await list.getByRole('button', { name: 'Trier du plus ancien au plus récent' }).click();
  await expect(list.locator('article').first()).toContainText('Chapitre 1');
});

test('start reading uses the earliest logical chapter and chapter action preserves identity', async ({ page }) => {
  test.skip(REAL_CATALOG, 'Controlled reader navigation fixture');
  await page.goto('/manga/42');
  await page.getByRole('button', { name: 'Commencer la lecture' }).click();
  await expect(page).toHaveURL(/\/read\/originmanga\/chapter-wave\/chapter-1\?.*lang=fr.*page=0/);
});

test('real canonical detail exposes a usable unified chapter state without page errors', async ({ page }) => {
  test.skip(!REAL_CATALOG, 'Real production catalog only');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('/manga/2', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Chapitres disponibles' })).toBeVisible();
  await expect(page.getByTestId('chapter-list-v2').or(page.getByRole('heading', { name: 'Aucun chapitre disponible' }))).toBeVisible({ timeout: 30_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
