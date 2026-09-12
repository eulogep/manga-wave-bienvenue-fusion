import { expect, test } from '@playwright/test';

const catalog = [
  {
    id: 110,
    title: 'Solo Leveling',
    aliases: ['Only I Level Up', '나 혼자만 레벨업', 'Ore dake Level Up na Ken'],
    author: 'Chugong',
    genre: ['Action', 'Fantasy'],
    manga_type: 'manhwa',
    status: 'completed',
    rating: 9.2,
    views: 15000,
    created_at: '2026-01-01T00:00:00Z',
    cover_image: null,
  },
  {
    id: 111,
    title: 'Solo Leveling Ragnarok',
    aliases: ['Na Honjaman Rebeleop: Ragnarok'],
    author: 'Daul',
    genre: ['Action', 'Fantasy'],
    manga_type: 'manhwa',
    status: 'ongoing',
    rating: 8.5,
    views: 8000,
    created_at: '2026-01-02T00:00:00Z',
    cover_image: null,
  },
  {
    id: 112,
    title: 'One Piece',
    aliases: ['OP'],
    author: 'Eiichiro Oda',
    genre: ['Action', 'Adventure'],
    manga_type: 'manga',
    status: 'ongoing',
    rating: 9.8,
    views: 50000,
    created_at: '2026-01-01T00:00:00Z',
    cover_image: null,
  },
  {
    id: 113,
    title: 'Tales of Demons and Gods',
    aliases: ['Yao Shen Ji'],
    author: 'Mad Snail',
    genre: ['Action', 'Martial Arts'],
    manga_type: 'manhua',
    status: 'ongoing',
    rating: 8.4,
    views: 9500,
    created_at: '2026-01-03T00:00:00Z',
    cover_image: null,
  },
];

let providerRequests = 0;

test.beforeEach(async ({ page }) => {
  providerRequests = 0;
  // Provider endpoints should never be contacted by command search
  await page.route('**/api/extract/**', (route) => {
    providerRequests++;
    return route.fulfill({ status: 503, json: { error: 'Provider unavailable' } });
  });

  // Mock canonical catalog endpoint
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mangas')) {
      const after = Number(url.searchParams.get('id')?.replace('gt.', '') || 0);
      return route.fulfill({ json: catalog.filter((work) => work.id > after) });
    }
    if (url.pathname.endsWith('/canonical_manga_catalog')) {
      return route.fulfill({
        json: {
          ...catalog[0],
          canonical_id: 110,
          cover: null,
          genres: catalog[0].genre,
          type: 'manhwa',
          description: 'Aventure fantastique.',
          source_count: 0,
          sources: [],
        },
      });
    }
    return route.fulfill({ json: [] });
  });
});

test('Header button opens Command Palette with empty query shortcuts and navigates to catalog', async ({ page }) => {
  await page.goto('/');

  const searchButton = page.getByTestId('header-command-search-button');
  await expect(searchButton).toBeVisible();
  await searchButton.click();

  const dialog = page.getByTestId('command-search-dialog');
  await expect(dialog).toBeVisible();

  // Check empty state sections
  await expect(page.getByTestId('command-nav-home')).toBeVisible();
  await expect(page.getByTestId('command-nav-search')).toBeVisible();
  await expect(page.getByTestId('command-filter-manhwa')).toBeVisible();
  await expect(page.getByTestId('command-filter-manhua')).toBeVisible();
  await expect(page.getByTestId('command-filter-manga')).toBeVisible();

  // Click on "Explorer le catalogue complet"
  await page.getByTestId('command-nav-search').click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/search$/);
});

test('Keyboard shortcut (Meta+K / Ctrl+K) toggles Command Palette and Esc dismisses', async ({ page }) => {
  await page.goto('/search');

  // Open with Meta+K or Control+K
  const isMac = await page.evaluate(() => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
  await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');

  const dialog = page.getByTestId('command-search-dialog');
  await expect(dialog).toBeVisible();

  const input = page.getByTestId('command-search-input');
  await expect(input).toBeFocused();

  // Press Escape to dismiss
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('Instant search matches canonical title and opens canonical detail', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-command-search-button').click();
  providerRequests = 0;
  const input = page.getByTestId('command-search-input');

  await input.fill('Solo Leveling');

  // Should display matching items
  const item110 = page.getByTestId('command-item-manga-110');
  await expect(item110).toBeVisible();
  await expect(item110).toContainText('Solo Leveling');
  await expect(item110).toContainText('manhwa');

  // Click navigates to canonical detail
  await item110.click();
  await expect(page).toHaveURL(/\/manga\/110$/);
  expect(providerRequests).toBe(0);
});

test('Instant search matches alternate title / alias', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-command-search-button').click();
  const input = page.getByTestId('command-search-input');

  // Search by English alias
  await input.fill('Only I Level Up');

  const item110 = page.getByTestId('command-item-manga-110');
  await expect(item110).toBeVisible();
  await expect(item110).toContainText('Solo Leveling');
  await expect(item110).toContainText('Alias : Only I Level Up');
});

test('Instant search matches typos via fuzzy distance without provider request', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-command-search-button').click();
  providerRequests = 0;
  const input = page.getByTestId('command-search-input');

  // Typo: 'solo levling'
  await input.fill('solo levling');

  const item110 = page.getByTestId('command-item-manga-110');
  await expect(item110).toBeVisible();
  await expect(item110).toContainText('Solo Leveling');
  expect(providerRequests).toBe(0);
});

test('Empty match offers full catalog search fallback', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-command-search-button').click();
  const input = page.getByTestId('command-search-input');

  await input.fill('xyzunknown');

  await expect(page.getByText('Aucune œuvre trouvée pour « xyzunknown »')).toBeVisible();
  const fallbackBtn = page.getByRole('button', { name: /Lancer une recherche avancée/ });
  await expect(fallbackBtn).toBeVisible();

  await fallbackBtn.click();
  await expect(page).toHaveURL(/\/search\?q=xyzunknown$/);
});

test('Reader route guard prevents Command Palette from opening during active reading', async ({ page }) => {
  // Navigate to reader route
  await page.goto('/read/mangadex/110/ch1');

  // Attempt to trigger shortcut
  const isMac = await page.evaluate(() => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
  await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');

  const dialog = page.getByTestId('command-search-dialog');
  await expect(dialog).not.toBeVisible();
});
