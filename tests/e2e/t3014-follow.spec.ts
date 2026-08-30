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

const QA_MANGA_ID = 110;
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
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase QA T-3014 absente');
};

const signInClient = async (email: string, password: string) => {
  const client = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
};

const count = async (
  client: SupabaseClient,
  table: 'user_follows' | 'user_followed_chapter_state',
  userId: string,
  unreadOnly = false,
) => {
  let query = client.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (unreadOnly && table === 'user_followed_chapter_state') query = query.is('read_at', null);
  const { count: result, error } = await query;
  if (error) throw error;
  return result ?? 0;
};

const login = async (page: Page, email: string, password: string) => {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
};

test.describe('T-3014 canonical Follow deterministic smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let service: SupabaseClient;
  let ownerClient: SupabaseClient;
  let observerClient: SupabaseClient;
  let ownerId = '';
  let observerId = '';
  let ownerEmail = '';
  let ownerPassword = '';
  let detail: Detail;
  let publications: Chapter[];

  test.beforeAll(async () => {
    requireConfiguration();
    service = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const suffix = crypto.randomUUID();
    ownerEmail = `codex-t3014-e2e-${suffix}@example.invalid`;
    ownerPassword = `T3014-${crypto.randomBytes(18).toString('base64url')}!`;
    const observerEmail = `codex-t3014-observer-${suffix}@example.invalid`;
    const observerPassword = `T3014-${crypto.randomBytes(18).toString('base64url')}!`;
    const [ownerCreation, observerCreation] = await Promise.all([
      service.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true }),
      service.auth.admin.createUser({ email: observerEmail, password: observerPassword, email_confirm: true }),
    ]);
    ownerId = ownerCreation.data.user?.id || '';
    observerId = observerCreation.data.user?.id || '';
    if (ownerCreation.error) throw ownerCreation.error;
    if (observerCreation.error) throw observerCreation.error;
    [ownerClient, observerClient] = await Promise.all([
      signInClient(ownerEmail, ownerPassword),
      signInClient(observerEmail, observerPassword),
    ]);

    const response = await fetch(`${BASE_URL}/api/extract/detail/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}`);
    if (!response.ok) throw new Error(`Detail QA indisponible (${response.status})`);
    detail = await response.json() as Detail;
    if (detail.manga.chapters.length < 3) throw new Error('Trois chapitres lisibles sont requis pour T-3014');
    const highest = Math.max(...detail.manga.chapters.map((chapter) => Number.parseFloat(chapter.chapterNumber)).filter(Number.isFinite));
    publications = detail.manga.chapters.slice(0, 3).map((chapter, index) => ({
      ...chapter,
      chapterNumber: String(Math.floor(highest) + index + 1),
      title: `Chapitre ${Math.floor(highest) + index + 1} - Fixture QA T-3014`,
    }));
  });

  test.afterAll(async () => {
    if (!service) return;
    await Promise.all([
      ownerId ? service.auth.admin.deleteUser(ownerId) : Promise.resolve(),
      observerId ? service.auth.admin.deleteUser(observerId) : Promise.resolve(),
    ]);
  });

  test('Favorite only -> Follow -> update/read -> Unfollow -> Refollow baseline -> next update', async ({ page }) => {
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

    await login(page, ownerEmail, ownerPassword);
    const { error: favoriteError } = await ownerClient.from('user_favorites').insert({
      user_id: ownerId,
      manga_id: QA_MANGA_ID,
    });
    if (favoriteError) throw favoriteError;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    expect(await count(ownerClient, 'user_follows', ownerId)).toBe(0);
    expect(await count(ownerClient, 'user_followed_chapter_state', ownerId)).toBe(0);
    await expect(page.getByRole('heading', { name: 'Nouveaux chapitres', exact: true })).toHaveCount(0);

    await page.goto(`/manga/${QA_MANGA_ID}`);
    const followButton = page.getByRole('button', { name: 'Suivre Solo Leveling' });
    await expect(followButton).toBeVisible({ timeout: 60_000 });
    await followButton.click();
    await expect(page.getByRole('button', { name: 'Ne plus suivre Solo Leveling' })).toBeVisible();
    await expect.poll(() => count(ownerClient, 'user_follows', ownerId)).toBe(1);

    // Follow and Favorite are independent: removing Favorite keeps the canonical Follow.
    const { error: favoriteDeleteError } = await ownerClient
      .from('user_favorites')
      .delete()
      .eq('user_id', ownerId)
      .eq('manga_id', QA_MANGA_ID);
    if (favoriteDeleteError) throw favoriteDeleteError;
    await expect.poll(() => count(ownerClient, 'user_follows', ownerId)).toBe(1);

    await page.goto('/');
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId, true)).toBe(0);
    await expect(page.getByRole('heading', { name: 'Nouveaux chapitres', exact: true })).toHaveCount(0);

    publicationStage = 1;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId, true), { timeout: 60_000 }).toBe(1);
    const updates = page.getByRole('region', { name: 'Nouveaux chapitres' });
    await expect(updates.getByText('Solo Leveling', { exact: true })).toHaveCount(1);
    await updates.getByRole('link', { name: /Lire maintenant/ }).click();
    await expect(page.getByText(/Page 1 \/ \d+/)).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId, true), { timeout: 30_000 }).toBe(0);

    await page.goto(`/manga/${QA_MANGA_ID}`);
    const unfollowButton = page.getByRole('button', { name: 'Ne plus suivre Solo Leveling' });
    await expect(unfollowButton).toBeVisible({ timeout: 60_000 });
    await unfollowButton.click();
    await expect(page.getByRole('button', { name: 'Suivre Solo Leveling' })).toBeVisible();
    await expect.poll(() => count(ownerClient, 'user_follows', ownerId)).toBe(0);
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId)).toBe(0);

    publicationStage = 2;
    await page.goto('/');
    await page.waitForTimeout(1_000);
    expect(await count(ownerClient, 'user_followed_chapter_state', ownerId)).toBe(0);
    await expect(page.getByRole('heading', { name: 'Nouveaux chapitres', exact: true })).toHaveCount(0);

    await page.goto(`/manga/${QA_MANGA_ID}`);
    await page.getByRole('button', { name: 'Suivre Solo Leveling' }).click();
    await expect.poll(() => count(ownerClient, 'user_follows', ownerId)).toBe(1);
    await page.goto('/');
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId, true)).toBe(0);

    // Direct provider view resolves to the same single canonical Follow.
    await page.goto(`/manga/${QA_PROVIDER_MANGA_ID}?source=${QA_PROVIDER}`);
    await expect(page.getByRole('button', { name: 'Ne plus suivre Solo Leveling' })).toBeVisible({ timeout: 60_000 });
    expect(await count(ownerClient, 'user_follows', ownerId)).toBe(1);
    expect(await count(observerClient, 'user_follows', ownerId)).toBe(0);

    publicationStage = 3;
    await page.goto('/');
    await expect.poll(() => count(ownerClient, 'user_followed_chapter_state', ownerId, true), { timeout: 60_000 }).toBe(1);
    await expect(page.getByRole('region', { name: 'Nouveaux chapitres' }).getByText('Solo Leveling', { exact: true })).toHaveCount(1);

    const deletedOwnerId = ownerId;
    const deletedObserverId = observerId;
    const [ownerDeletion, observerDeletion] = await Promise.all([
      service.auth.admin.deleteUser(deletedOwnerId),
      service.auth.admin.deleteUser(deletedObserverId),
    ]);
    if (ownerDeletion.error) throw ownerDeletion.error;
    if (observerDeletion.error) throw observerDeletion.error;
    ownerId = '';
    observerId = '';
    await expect.poll(async () => {
      const { count: remaining, error } = await service
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', deletedOwnerId);
      if (error) throw error;
      return remaining ?? 0;
    }).toBe(0);
  });
});
