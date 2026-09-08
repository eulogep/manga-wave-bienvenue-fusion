import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Chapter = {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  language: string;
  url: string;
};

type Detail = {
  manga: {
    id: string;
    title: string;
    chapters: Chapter[];
    [key: string]: unknown;
  };
};

// QA_MANGA_A/B/C/D reuse the deterministic fixtures already trusted by T-3013/T-3014.
// D is the manga used for the unread-update lifecycle (it has a live provider mapping
// whose chapter list can be mocked); A/B/C only need canonical DB rows.
const QA_MANGA_A = 110; // Favorite only
const QA_MANGA_D = 110; // Followed + unread update (same canonical manga, different signal)
const QA_PROVIDER = 'originmanga';
const QA_PROVIDER_MANGA_ID = '656de8df-4b6c-483a-b1e0-4fe0aee8eafb';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://manga-wave-bienvenue-fusion.vercel.app';

const loadEnv = () => {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
};

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || env.VITE_SUPABASE_PUBLISHABLE_KEY
  || env.API_KEY_ANONYME_SUPABASE;
const serviceKey = process.env.API_KEY_SERVICE_SUPABASE
  || env.API_KEY_SERVICE_SUPABASE
  || env.API_KEY_SECRET_SUPABASE;

const requireConfiguration = () => {
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase QA T-3017 absente');
};

const signInClient = async (email: string, password: string) => {
  const client = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
};

const login = async (page: Page, email: string, password: string) => {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
};

test.describe('T-3017 canonical Library V2 deterministic smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let service: SupabaseClient;
  let ownerClient: SupabaseClient;
  let ownerId = '';
  let ownerEmail = '';
  let ownerPassword = '';
  let detail: Detail;
  let publications: Chapter[];

  test.beforeAll(async () => {
    requireConfiguration();
    service = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const suffix = crypto.randomUUID();
    ownerEmail = `codex-t3017-e2e-${suffix}@example.invalid`;
    ownerPassword = `T3017-${crypto.randomBytes(18).toString('base64url')}!`;
    const creation = await service.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true });
    if (creation.error) throw creation.error;
    ownerId = creation.data.user?.id || '';
    ownerClient = await signInClient(ownerEmail, ownerPassword);

    const response = await fetch(`${BASE_URL}/api/extract/detail/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}`);
    if (!response.ok) throw new Error(`Detail QA indisponible (${response.status})`);
    detail = await response.json() as Detail;
    if (detail.manga.chapters.length < 6) throw new Error('Six chapitres lisibles sont requis pour T-3017');
    const highest = Math.max(...detail.manga.chapters.map((chapter) => Number.parseFloat(chapter.chapterNumber)).filter(Number.isFinite));
    publications = detail.manga.chapters.slice(0, 2).map((chapter, index) => ({
      ...chapter,
      chapterNumber: String(Math.floor(highest) + index + 1),
      title: `Chapitre ${Math.floor(highest) + index + 1} - Fixture QA T-3017`,
    }));
  });

  test.afterAll(async () => {
    if (!service) return;
    await service.from('user_canonical_reading_progress').delete().eq('user_id', ownerId);
    await service.from('user_favorites').delete().eq('user_id', ownerId);
    await service.from('user_follows').delete().eq('user_id', ownerId);
    if (ownerId) await service.auth.admin.deleteUser(ownerId);
  });

  test('canonical library aggregates Favorite, Follow, Progress and Updates into one item and clears state on read', async ({ page }) => {
    let publicationStage = 0;
    await page.route(`**/api/extract/detail/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}`, async (route) => {
      const published = publications.slice(0, publicationStage);
      const replacedIds = new Set(published.map((chapter) => chapter.id));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...detail,
          manga: {
            ...detail.manga,
            chapters: [...published, ...detail.manga.chapters.filter((chapter) => !replacedIds.has(chapter.id))],
          },
        }),
      });
    });

    // Deterministic state: Favorite (§29 Manga A) + reading progress at chapter 5 page 2.
    const { error: favoriteError } = await ownerClient.from('user_favorites').insert({ user_id: ownerId, manga_id: QA_MANGA_A });
    if (favoriteError) throw favoriteError;
    const { error: progressError } = await ownerClient.from('user_canonical_reading_progress').insert({
      user_id: ownerId,
      canonical_key: 'title:solo leveling',
      canonical_manga_id: QA_MANGA_A,
      canonical_chapter_key: '5',
      last_provider: QA_PROVIDER,
      last_provider_manga_id: QA_PROVIDER_MANGA_ID,
      last_provider_chapter_id: detail.manga.chapters[0].id,
      language: 'fr',
      manga_title: 'Solo Leveling',
      chapter_number: '5',
      page_index: 2,
      total_pages: 10,
      progress_percentage: 30,
    });
    if (progressError) throw progressError;

    // Two more real catalog rows, backdated, for Terminés / Search / Sort coverage —
    // no invented fixtures, both already exist in the public read-only catalog.
    const QA_MANGA_COMPLETED = 100; // Kaiju No. 8 — canonical status = completed
    const QA_MANGA_OTHER = 145; // Pick Me Up, Infinite Gacha — ongoing, distinct title
    const { error: completedFavoriteError } = await ownerClient.from('user_favorites').insert({
      user_id: ownerId,
      manga_id: QA_MANGA_COMPLETED,
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    if (completedFavoriteError) throw completedFavoriteError;
    const { error: otherFavoriteError } = await ownerClient.from('user_favorites').insert({
      user_id: ownerId,
      manga_id: QA_MANGA_OTHER,
      created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    if (otherFavoriteError) throw otherFavoriteError;

    await login(page, ownerEmail, ownerPassword);
    await page.goto('/library');

    // Terminés uses canonical series status only (§7 interpretation A).
    await page.getByRole('tab', { name: /Terminés/ }).click();
    await expect(page.locator('article', { hasText: 'Kaiju No. 8' })).toHaveCount(1);
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(0);

    // Library search matches by title across the whole set.
    await page.getByRole('tab', { name: /Tous/ }).click();
    await expect(page.locator('article')).toHaveCount(3);
    const searchBox = page.getByPlaceholder('Rechercher dans votre bibliothèque');
    await searchBox.fill('kaiju');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article', { hasText: 'Kaiju No. 8' })).toHaveCount(1);
    await searchBox.fill('aucun-titre-ne-correspond-zzz');
    await expect(page.getByText('Aucun titre ne correspond à ce filtre')).toBeVisible();
    await searchBox.fill('');

    // Sort: Titre A–Z orders Kaiju No. 8 < Pick Me Up... < Solo Leveling.
    await page.getByRole('combobox').filter({ hasText: /Activité récente|Trier/ }).click();
    await page.getByRole('option', { name: 'Titre A–Z' }).click();
    await expect.poll(() => page.locator('article').allTextContents()).toEqual(
      expect.arrayContaining([expect.stringContaining('Kaiju No. 8')]),
    );
    const titlesAZ = await page.locator('article').allTextContents();
    expect(titlesAZ[0]).toContain('Kaiju No. 8');
    expect(titlesAZ[2]).toContain('Solo Leveling');

    // Sort: Activité récente (default) surfaces the most recently touched item —
    // Solo Leveling (just favorited/progressed) ahead of the two backdated favorites.
    await page.getByRole('combobox').filter({ hasText: 'Titre A–Z' }).click();
    await page.getByRole('option', { name: 'Activité récente' }).click();
    const titlesRecent = await page.locator('article').allTextContents();
    expect(titlesRecent[0]).toContain('Solo Leveling');

    // One canonical card renders every aggregated state (favorite + progress); no
    // duplicate appears across the "Tous" section (§16 dedup rule).
    await expect(page.getByRole('tab', { name: /Tous/ })).toBeVisible();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(1);

    await page.getByRole('tab', { name: /Favoris/ }).click();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(1);
    await page.getByRole('tab', { name: /Suivis/ }).click();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(0);

    await page.getByRole('tab', { name: /En cours/ }).click();
    const resumeLink = page.getByRole('link', { name: /Reprendre Solo Leveling au chapitre 5/ });
    await expect(resumeLink).toBeVisible();
    await resumeLink.click();
    await expect(page).toHaveURL(new RegExp(`/read/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}/${detail.manga.chapters[0].id}\\?.*page=2`));

    // Now establish Follow + unread update on the same canonical manga (Manga D, §29).
    await page.goto(`/manga/${QA_MANGA_D}`);
    const followButton = page.getByRole('button', { name: 'Suivre Solo Leveling' });
    await expect(followButton).toBeVisible({ timeout: 60_000 });
    await followButton.click();
    await expect(page.getByRole('button', { name: 'Ne plus suivre Solo Leveling' })).toBeVisible();

    await page.goto('/library');
    await page.getByRole('tab', { name: /Suivis/ }).click();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(1);

    await expect.poll(async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      return ownerClient.from('user_followed_chapter_state').select('*', { count: 'exact', head: true }).eq('user_id', ownerId)
        .then(({ count }) => count ?? 0);
    }, { timeout: 60_000 }).toBeGreaterThan(0);

    publicationStage = 1;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /Nouveautés/ }).click();
    await expect.poll(() => (
      ownerClient.from('user_followed_chapter_state').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).is('read_at', null)
        .then(({ count }) => count ?? 0)
    ), { timeout: 60_000 }).toBe(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const updateLink = page.getByRole('link', { name: /Lire le nouveau chapitre/ });
    await expect(updateLink).toBeVisible();

    // Still exactly one canonical card in "Tous" after gaining a third signal (follow + update).
    await page.getByRole('tab', { name: /Tous/ }).click();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(1);

    await page.getByRole('tab', { name: /Nouveautés/ }).click();
    await page.getByRole('link', { name: /Lire le nouveau chapitre/ }).click();
    await expect(page.getByText(/Page 1 \/ \d+/)).toBeVisible({ timeout: 60_000 });

    // The read acknowledgement is debounced (750ms) and flushed on pagehide/unmount;
    // wait for the durable DB write before asserting on the UI, same pattern as the
    // trusted T-3013/T-3014 suites (avoids a race, not a product behavior change).
    await expect.poll(() => (
      ownerClient.from('user_followed_chapter_state').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).is('read_at', null)
        .then(({ count }) => count ?? 0)
    ), { timeout: 30_000 }).toBe(0);

    await page.goto('/library');
    await page.getByRole('tab', { name: /Nouveautés/ }).click();
    await expect(page.locator('article', { hasText: 'Solo Leveling' })).toHaveCount(0);
  });
});
