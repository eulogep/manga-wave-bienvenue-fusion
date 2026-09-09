import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
const serviceKey = env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SECRET_SUPABASE;
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = '';
let email = '';
let password = '';

async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.beforeAll(async () => {
  const suffix = crypto.randomUUID();
  email = `codex-p2-final-${suffix}@example.invalid`;
  password = `P2-${crypto.randomBytes(18).toString('base64url')}!`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const loginResult = await client.auth.signInWithPassword({ email, password });
  if (loginResult.error) throw loginResult.error;
  const writes = [
    client.from('user_favorites').insert({ user_id: userId, manga_id: 110 }),
    client.from('user_follows').insert({ user_id: userId, canonical_manga_id: 110 }),
  ];
  for (const write of writes) { const result = await write; if (result.error) throw result.error; }
  const state = await client.from('user_followed_chapter_state').insert({
    user_id: userId, manga_id: 110, canonical_chapter_key: '999', chapter_number: '999',
    provider: 'originmanga', provider_manga_id: '656de8df-4b6c-483a-b1e0-4fe0aee8eafb',
    provider_chapter_id: 'p2-final-notification', language: 'fr', read_at: null,
  });
  if (state.error) throw state.error;
});

test.afterAll(async () => {
  if (!userId) return;
  let result = await service.auth.admin.deleteUser(userId);
  for (let attempt = 0; result.error?.name === 'AuthRetryableFetchError' && attempt < 2; attempt += 1) result = await service.auth.admin.deleteUser(userId);
  if (result.error) throw result.error;
  userId = '';
});

test('fresh context rehydrates Solo Leveling chapter 5 page 2 and isolates another account', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const providerMangaId = '656de8df-4b6c-483a-b1e0-4fe0aee8eafb';
  const chapterId = 'p2-final-chapter-5';
  const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#345"/></svg>');
  const installReaderFixture = async (target: Page) => {
    await target.route('**/api/extract/detail/originmanga/**', route => route.fulfill({ json: { manga: {
      id: providerMangaId, title: 'Solo Leveling', coverUrl: null, author: null, status: 'ongoing', genres: [], synopsis: '',
      chapters: [{ id: chapterId, chapterNumber: '5', title: null, date: new Date().toISOString(), language: 'fr', url: '' }],
    } } }));
    await target.route('**/api/extract/pages/originmanga/**', route => route.fulfill({ json: { images: Array.from({ length: 6 }, () => svg) } }));
  };

  await installReaderFixture(page);
  await login(page);
  await page.goto(`/read/originmanga/${providerMangaId}/${chapterId}?lang=fr&page=1&title=Solo%20Leveling`);
  await expect(page.getByText('Page 2 / 6')).toBeVisible();
  await expect.poll(async () => {
    const result = await service.from('user_canonical_reading_progress').select('canonical_manga_id,manga_title,chapter_number,page_index').eq('user_id', userId).eq('manga_title', 'Solo Leveling').maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }).toEqual({ canonical_manga_id: 110, manga_title: 'Solo Leveling', chapter_number: '5', page_index: 1 });

  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await installReaderFixture(fresh);
  await fresh.goto('/auth');
  expect(await fresh.evaluate(() => localStorage.getItem('manga_wave_reading_history_v1'))).toBeNull();
  await fresh.getByLabel('Email').fill(email);
  await fresh.getByLabel('Mot de passe').fill(password);
  await fresh.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(fresh).toHaveURL(/\/$/);
  const continueSection = fresh.locator('section', { has: fresh.getByRole('heading', { name: 'Continuer la lecture', exact: true }) });
  const soloCard = continueSection.getByRole('article').filter({ hasText: 'Solo Leveling' });
  await expect(soloCard).toHaveCount(1);
  await expect(soloCard).toContainText('Chapitre 5');
  await expect(soloCard).toContainText('Page 2/6');
  await soloCard.getByRole('link', { name: 'Reprendre', exact: true }).click();
  await expect(fresh).toHaveURL(new RegExp(`/read/originmanga/${providerMangaId}/${chapterId}\\?.*page=1`));
  await expect(fresh.getByText('Page 2 / 6')).toBeVisible();
  await freshContext.close();

  const isolatedEmail = `codex-p2-final-isolation-${crypto.randomUUID()}@example.invalid`;
  const isolatedPassword = `P2-${crypto.randomBytes(18).toString('base64url')}!`;
  const isolated = await service.auth.admin.createUser({ email: isolatedEmail, password: isolatedPassword, email_confirm: true });
  if (isolated.error) throw isolated.error;
  try {
    const isolatedContext = await browser.newContext();
    const isolatedPage = await isolatedContext.newPage();
    await isolatedPage.goto('/auth');
    expect(await isolatedPage.evaluate(() => localStorage.getItem('manga_wave_reading_history_v1'))).toBeNull();
    await isolatedPage.getByLabel('Email').fill(isolatedEmail);
    await isolatedPage.getByLabel('Mot de passe').fill(isolatedPassword);
    await isolatedPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(isolatedPage).toHaveURL(/\/$/);
    const isolatedSection = isolatedPage.locator('section', { has: isolatedPage.getByRole('heading', { name: 'Continuer la lecture', exact: true }) });
    await expect(isolatedSection.getByRole('article').filter({ hasText: 'Solo Leveling' })).toHaveCount(0);
    await expect(isolatedSection.getByText('Aucune lecture récente')).toBeVisible();
    await isolatedContext.close();
  } finally {
    const deleted = await service.auth.admin.deleteUser(isolated.data.user.id);
    expect(deleted.error).toBeNull();
  }
});

test('canonical search returns one primary Solo Leveling result', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/search?q=Solo%20Leveling');
  const canonical = page.getByRole('region', { name: 'Résultats Manga Wave' });
  await expect(canonical).toBeVisible({ timeout: 90_000 });
  const titles = await canonical.locator('article h3').allTextContents();
  console.log(`P2_FINAL_SEARCH_TITLES=${JSON.stringify(titles)}`);
  expect(titles.filter(title => title.trim().toLowerCase() === 'solo leveling')).toHaveLength(1);
  await expect(canonical).not.toContainText('MangaFire');
});

test('mobile layouts and accessibility inventory', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await login(page);
  const results: Array<{ viewport: string; surface: string; overflow: number; violations: Array<{ id: string; impact: string | null; nodes: number }> }> = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    for (const surface of ['/', '/library', '/history']) {
      await page.goto(surface); await page.waitForLoadState('domcontentloaded');
      if (surface === '/library') await expect(page.getByRole('heading', { name: 'Ma bibliothèque' })).toBeVisible();
      if (surface === '/history') await expect(page.getByRole('heading', { name: 'Historique de lecture' })).toBeVisible();
      await page.addScriptTag({ path: process.env.AXE_CORE_PATH! });
      const audit = await page.evaluate(async () => (window as unknown as { axe: { run: () => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe.run());
      results.push({ viewport: `${viewport.width}x${viewport.height}`, surface, overflow: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })) });
    }
    await page.goto('/'); await page.getByTestId('notification-bell').click();
    const dialog = page.getByRole('dialog', { name: 'Notifications' }); await expect(dialog).toBeVisible();
    await page.addScriptTag({ path: process.env.AXE_CORE_PATH! });
    const audit = await page.evaluate(async () => (window as unknown as { axe: { run: (context: Element) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe.run(document.querySelector('[role="dialog"]')!));
    const box = await dialog.boundingBox(); expect(box?.width).toBeLessThanOrEqual(viewport.width);
    results.push({ viewport: `${viewport.width}x${viewport.height}`, surface: 'notifications', overflow: 0, violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })) });
  }
  console.log(`P2_FINAL_UI_AUDIT=${JSON.stringify(results)}`);
  await testInfo.attach('p2-final-ui-audit', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
