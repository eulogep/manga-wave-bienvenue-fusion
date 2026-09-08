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

const loadEnv = (): Record<string, string> => {
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
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase QA T-3015 absente');
};

const signInClient = async (email: string, password: string) => {
  const client = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
};

const countRows = async (
  client: SupabaseClient,
  table: 'user_follows' | 'user_followed_chapter_state' | 'user_notifications',
  userId: string,
  unreadOnly = false,
) => {
  let query = client.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (unreadOnly) {
    query = table === 'user_followed_chapter_state' ? query.is('read_at', null) : query.eq('is_read', false);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

const login = async (page: Page, email: string, password: string) => {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
};

test.describe('T-3015 canonical in-app notifications', () => {
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
    ownerEmail = `codex-t3015-e2e-${suffix}@example.invalid`;
    ownerPassword = `T3015-${crypto.randomBytes(18).toString('base64url')}!`;
    const observerEmail = `codex-t3015-observer-${suffix}@example.invalid`;
    const observerPassword = `T3015-${crypto.randomBytes(18).toString('base64url')}!`;
    const [ownerCreation, observerCreation] = await Promise.all([
      service.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true }),
      service.auth.admin.createUser({ email: observerEmail, password: observerPassword, email_confirm: true }),
    ]);
    if (ownerCreation.error) throw ownerCreation.error;
    if (observerCreation.error) throw observerCreation.error;
    ownerId = ownerCreation.data.user?.id || '';
    observerId = observerCreation.data.user?.id || '';
    [ownerClient, observerClient] = await Promise.all([
      signInClient(ownerEmail, ownerPassword),
      signInClient(observerEmail, observerPassword),
    ]);

    const response = await fetch(`${BASE_URL}/api/extract/detail/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}`);
    if (!response.ok) throw new Error(`Détail QA indisponible (${response.status})`);
    detail = await response.json() as Detail;
    if (detail.manga.chapters.length < 3) throw new Error('Trois chapitres lisibles sont requis pour T-3015');
    const highest = Math.max(...detail.manga.chapters
      .map((chapter) => Number.parseFloat(chapter.chapterNumber))
      .filter(Number.isFinite));
    publications = detail.manga.chapters.slice(0, 3).map((chapter, index) => ({
      ...chapter,
      chapterNumber: String(Math.floor(highest) + index + 1),
      title: `Chapitre ${Math.floor(highest) + index + 1} - Fixture QA T-3015`,
    }));
  });

  test.afterAll(async () => {
    if (!service) return;
    await Promise.all([
      ownerId ? service.auth.admin.deleteUser(ownerId) : Promise.resolve(),
      observerId ? service.auth.admin.deleteUser(observerId) : Promise.resolve(),
    ]);
  });

  test('Favorite-only -> Follow baseline -> notification -> Reader -> Unfollow -> Refollow baseline', async ({ page }) => {
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

    // Favorite alone never starts T-3013 and therefore cannot create T-3015 events.
    publicationStage = 1;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    expect(await countRows(ownerClient, 'user_follows', ownerId)).toBe(0);
    expect(await countRows(ownerClient, 'user_notifications', ownerId)).toBe(0);

    // Follow at the current catalog establishes a read baseline without historical notifications.
    await page.goto(`/manga/${QA_MANGA_ID}`);
    await page.getByRole('button', { name: 'Suivre Solo Leveling' }).click();
    await expect.poll(() => countRows(ownerClient, 'user_follows', ownerId)).toBe(1);
    await page.goto('/');
    await expect.poll(() => countRows(ownerClient, 'user_followed_chapter_state', ownerId), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId)).toBe(0);
    await expect(page.getByTestId('notification-badge')).toHaveCount(0);

    publicationStage = 2;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId, true), { timeout: 60_000 }).toBe(1);
    await expect.poll(() => countRows(ownerClient, 'user_followed_chapter_state', ownerId, true)).toBe(1);
    await expect(page.getByTestId('notification-badge')).toHaveText('1');

    // Re-running the same T-3013 observation three times remains idempotent.
    for (let sync = 0; sync < 3; sync += 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId)).toBe(1);
    }

    await page.getByTestId('notification-bell').click();
    const notificationItem = page.getByTestId('notification-item');
    await expect(notificationItem).toHaveCount(1);
    await expect(notificationItem).toContainText(`Nouveau chapitre ${publications[1].chapterNumber}`);
    await notificationItem.click();
    await expect(page).toHaveURL(new RegExp('/read/[^/]+/[^/]+/[^?]+'));
    await expect(page.getByText(/Page 1 \/ \d+/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible();
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId, true), { timeout: 30_000 }).toBe(0);
    await expect.poll(() => countRows(ownerClient, 'user_followed_chapter_state', ownerId, true), { timeout: 30_000 }).toBe(0);

    // RLS hides owner rows and refuses cross-user read-state changes.
    expect(await countRows(observerClient, 'user_notifications', ownerId)).toBe(0);
    const { data: ownerRows } = await service.from('user_notifications').select('id').eq('user_id', ownerId).limit(1);
    const ownerNotificationId = ownerRows?.[0]?.id;
    if (!ownerNotificationId) throw new Error('Notification QA propriétaire absente');
    const { data: crossUpdate, error: crossUpdateError } = await observerClient
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', ownerNotificationId)
      .select('id');
    if (crossUpdateError) throw crossUpdateError;
    expect(crossUpdate).toHaveLength(0);

    // Unfollow keeps history but prevents the next publication from becoming an event.
    await page.goto(`/manga/${QA_MANGA_ID}`);
    await page.getByRole('button', { name: 'Ne plus suivre Solo Leveling' }).click();
    await expect.poll(() => countRows(ownerClient, 'user_follows', ownerId)).toBe(0);
    publicationStage = 3;
    await page.goto('/');
    await page.waitForTimeout(1_000);
    expect(await countRows(ownerClient, 'user_notifications', ownerId)).toBe(1);

    // Refollow at N+1 makes it the new baseline; a later N+2 event is tested by
    // reusing the first fixture with a fresh logical number.
    await page.goto(`/manga/${QA_MANGA_ID}`);
    await page.getByRole('button', { name: 'Suivre Solo Leveling' }).click();
    await expect.poll(() => countRows(ownerClient, 'user_follows', ownerId)).toBe(1);
    await page.goto('/');
    await expect.poll(() => countRows(ownerClient, 'user_followed_chapter_state', ownerId), { timeout: 60_000 }).toBeGreaterThan(0);
    expect(await countRows(ownerClient, 'user_notifications', ownerId)).toBe(1);

    publications.push({
      ...publications[0],
      chapterNumber: String(Number(publications[2].chapterNumber) + 1),
      title: `Chapitre ${Number(publications[2].chapterNumber) + 1} - Fixture QA T-3015`,
    });
    publicationStage = 4;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId), { timeout: 60_000 }).toBe(2);
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId, true)).toBe(1);

    // The same center remains a full-height, non-overflowing touch UI on mobile.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const mobileBell = page.getByTestId('notification-bell');
    await expect(mobileBell).toHaveText(/1/);
    const bellBox = await mobileBell.boundingBox();
    expect(bellBox?.width).toBeGreaterThanOrEqual(44);
    expect(bellBox?.height).toBeGreaterThanOrEqual(44);
    await mobileBell.click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox?.x).toBeGreaterThanOrEqual(0);
    expect(panelBox?.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
    await expect.poll(() => countRows(ownerClient, 'user_notifications', ownerId, true)).toBe(0);

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
      const { count, error } = await service
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', deletedOwnerId);
      if (error) throw error;
      return count ?? 0;
    }).toBe(0);
  });
});
