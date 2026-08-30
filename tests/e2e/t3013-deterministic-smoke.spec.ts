import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ExtractedChapter = {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  language: string;
  url: string;
};

type ExtractedDetail = {
  manga: {
    id: string;
    title: string;
    chapters: ExtractedChapter[];
    [key: string]: unknown;
  };
};

const QA_MANGA_ID = 110;
const QA_PROVIDER = 'originmanga';
const QA_PROVIDER_MANGA_ID = '656de8df-4b6c-483a-b1e0-4fe0aee8eafb';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://manga-wave-bienvenue-fusion.vercel.app';

const readEnv = (): Record<string, string> => {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
};

const localEnv = readEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || localEnv.VITE_SUPABASE_PUBLISHABLE_KEY
  || localEnv.API_KEY_ANONYME_SUPABASE;
const serviceKey = process.env.API_KEY_SERVICE_SUPABASE
  || localEnv.API_KEY_SERVICE_SUPABASE
  || localEnv.API_KEY_SECRET_SUPABASE;

const requireQaConfiguration = () => {
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error('Configuration Supabase QA absente. VITE_SUPABASE_URL, cle anon et cle service sont requises.');
  }
};

const admin = () => createClient(supabaseUrl!, serviceKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const authenticatedClient = async (email: string, password: string) => {
  const client = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
};

const unreadCount = async (client: SupabaseClient, userId: string) => {
  const { count, error } = await client
    .from('user_followed_chapter_state')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('manga_id', QA_MANGA_ID)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
};

const stateCount = async (client: SupabaseClient, userId: string) => {
  const { count, error } = await client
    .from('user_followed_chapter_state')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('manga_id', QA_MANGA_ID);
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

test.describe('T-3013 deterministic production-equivalent smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let qaEmail = '';
  let qaPassword = '';
  let qaUserId = '';
  let observerUserId = '';
  let qaClient: SupabaseClient;
  let observerClient: SupabaseClient;
  let detail: ExtractedDetail;
  let simulatedChapter: ExtractedChapter;
  let service: SupabaseClient;

  test.beforeAll(async () => {
    requireQaConfiguration();
    service = admin();
    const suffix = crypto.randomUUID();
    qaEmail = `codex-t3013-smoke-${suffix}@example.invalid`;
    qaPassword = `T3013-${crypto.randomBytes(18).toString('base64url')}!`;
    const observerEmail = `codex-t3013-observer-${suffix}@example.invalid`;
    const observerPassword = `T3013-${crypto.randomBytes(18).toString('base64url')}!`;

    const [qaCreation, observerCreation] = await Promise.all([
      service.auth.admin.createUser({ email: qaEmail, password: qaPassword, email_confirm: true }),
      service.auth.admin.createUser({ email: observerEmail, password: observerPassword, email_confirm: true }),
    ]);
    qaUserId = qaCreation.data.user?.id || '';
    observerUserId = observerCreation.data.user?.id || '';
    if (qaCreation.error) throw qaCreation.error;
    if (observerCreation.error) throw observerCreation.error;
    [qaClient, observerClient] = await Promise.all([
      authenticatedClient(qaEmail, qaPassword),
      authenticatedClient(observerEmail, observerPassword),
    ]);

    const detailResponse = await fetch(
      `${BASE_URL}/api/extract/detail/${QA_PROVIDER}/${encodeURIComponent(QA_PROVIDER_MANGA_ID)}`,
    );
    if (!detailResponse.ok) throw new Error(`Chapitre QA indisponible (${detailResponse.status})`);
    detail = await detailResponse.json() as ExtractedDetail;
    const readableChapter = detail.manga.chapters[0];
    if (!readableChapter) throw new Error('Le manga QA ne contient aucun chapitre lisible');
    const highest = Math.max(...detail.manga.chapters.map((chapter) => Number.parseFloat(chapter.chapterNumber)).filter(Number.isFinite));
    simulatedChapter = {
      ...readableChapter,
      chapterNumber: String(Math.floor(highest) + 1),
      title: `Chapitre ${Math.floor(highest) + 1} - Fixture QA T-3013`,
    };
  });

  test.afterAll(async () => {
    if (!service) return;
    await Promise.all([
      qaUserId ? service.auth.admin.deleteUser(qaUserId) : Promise.resolve(),
      observerUserId ? service.auth.admin.deleteUser(observerUserId) : Promise.resolve(),
    ]);
  });

  test('baseline 0 -> simulated update 1 -> real Reader progress -> unread 0', async ({ page }) => {
    let exposeSimulatedUpdate = false;
    let interceptedDetailRequests = 0;
    const detailPattern = `**/api/extract/detail/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}`;
    await page.route(detailPattern, async (route) => {
      interceptedDetailRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...detail,
          manga: {
            ...detail.manga,
            chapters: exposeSimulatedUpdate
              ? [simulatedChapter, ...detail.manga.chapters]
              : detail.manga.chapters,
          },
        }),
      });
    });

    await login(page, qaEmail, qaPassword);
    const { error: favoriteError } = await qaClient.from('user_favorites').insert({
      user_id: qaUserId,
      manga_id: QA_MANGA_ID,
    });
    if (favoriteError) throw favoriteError;
    const { error: followError } = await qaClient.from('user_follows').insert({
      user_id: qaUserId,
      canonical_manga_id: QA_MANGA_ID,
    });
    if (followError) throw followError;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => stateCount(qaClient, qaUserId), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(() => unreadCount(qaClient, qaUserId)).toBe(0);
    expect(interceptedDetailRequests).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Nouveaux chapitres', exact: true })).toHaveCount(0);

    await page.goto('/library');
    await expect(page.getByText('Solo Leveling', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^1 nouveau$/)).toHaveCount(0);

    exposeSimulatedUpdate = true;
    await page.goto('/');
    await expect.poll(() => unreadCount(qaClient, qaUserId), { timeout: 60_000 }).toBe(1);
    const updates = page.getByRole('region', { name: 'Nouveaux chapitres' });
    await expect(updates).toBeVisible();
    await expect(updates.getByText('Solo Leveling', { exact: true })).toHaveCount(1);
    await expect(updates.getByText('1 nouveau', { exact: true })).toBeVisible();

    await page.goto('/library');
    await expect(page.getByText(/^1 nouveau$/)).toHaveCount(1);
    const directReaderLink = page.getByRole('link', { name: `Lire le chapitre ${simulatedChapter.chapterNumber}` });
    await expect(directReaderLink).toBeVisible();
    await directReaderLink.click();

    await expect(page).toHaveURL(new RegExp(`/read/${QA_PROVIDER}/${QA_PROVIDER_MANGA_ID}/`));
    await expect(page.getByText(/Page 1 \/ \d+/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible();
    await expect.poll(() => unreadCount(qaClient, qaUserId), { timeout: 30_000 }).toBe(0);

    // A second authenticated account must not see the QA user's rows (RLS ownership).
    await expect.poll(() => stateCount(observerClient, qaUserId)).toBe(0);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Nouveaux chapitres', exact: true })).toHaveCount(0);
    await page.goto('/library');
    await expect(page.getByText(/^1 nouveau$/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: `Lire le chapitre ${simulatedChapter.chapterNumber}` })).toHaveCount(0);

    const deletedQaId = qaUserId;
    const deletedObserverId = observerUserId;
    const [qaDeletion, observerDeletion] = await Promise.all([
      service.auth.admin.deleteUser(deletedQaId),
      service.auth.admin.deleteUser(deletedObserverId),
    ]);
    if (qaDeletion.error) throw qaDeletion.error;
    if (observerDeletion.error) throw observerDeletion.error;
    qaUserId = '';
    observerUserId = '';

    await expect.poll(async () => {
      const { count, error } = await service
        .from('user_followed_chapter_state')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', deletedQaId);
      if (error) throw error;
      return count ?? 0;
    }).toBe(0);
  });
});
