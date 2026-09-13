import { expect, test } from '@playwright/test';

const explicitWork = {
  id: 913,
  title: 'Explicit Fixture',
  aliases: [],
  author: 'Fixture Author',
  artist: null,
  genre: ['Erotique', 'Pornhwa'],
  manga_type: 'manhwa',
  status: 'ongoing',
  rating: null,
  views: 0,
  created_at: '2026-01-01',
  cover_image: null,
  content_rating: 'erotica',
  normalized_title: 'explicit fixture',
  description: 'Contenu de test qui ne doit apparaître qu’après confirmation.',
  country_of_origin: 'kr',
  metadata_source: null,
  metadata_confidence: null,
  metadata_updated_at: null,
  source_updated_at: null,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/extract/**', route => route.fulfill({ status: 503, json: { error: 'Provider unavailable' } }));
  await page.route('**/rest/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mangas')) {
      const idFilter = url.searchParams.get('id') || '';
      if (idFilter.startsWith('eq.')) {
        return route.fulfill({ json: Number(idFilter.slice(3)) === explicitWork.id ? [explicitWork] : [] });
      }
      const after = Number(idFilter.replace('gt.', '') || 0);
      return route.fulfill({ json: explicitWork.id > after ? [explicitWork] : [] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('mw-adult-confirmed'));
});

test('explicit catalog navigation and direct detail both require one persistent confirmation', async ({ page }) => {
  await page.goto('/search?q=Explicit+Fixture');
  await expect(page.getByText('Contenu 18+', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Découvrir Explicit Fixture' }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.getByRole('alertdialog')).toContainText('Contenu réservé aux adultes');
  await page.getByRole('button', { name: 'J’ai 18 ans ou plus' }).click();

  await expect(page).toHaveURL(/\/manga\/913$/);
  await expect(page.getByRole('heading', { name: 'Explicit Fixture', level: 1 })).toBeVisible();

  await page.evaluate(() => localStorage.removeItem('mw-adult-confirmed'));
  await page.reload();
  await expect(page.getByTestId('manga-detail-adult-gate')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Explicit Fixture', level: 1 })).toHaveCount(0);
  await page.getByRole('button', { name: 'J’ai 18 ans ou plus' }).click();
  await expect(page.getByRole('heading', { name: 'Explicit Fixture', level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('manga-detail-adult-gate')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Explicit Fixture', level: 1 })).toBeVisible();
});
