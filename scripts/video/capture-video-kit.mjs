import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const baseURL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:8080';
const profile = process.env.VIDEO_PROFILE || 'candidate';
const outputRoot = path.resolve(root, process.env.VIDEO_OUTPUT_DIR || 'video-kit');
const screenshotsRoot = path.join(outputRoot, 'screenshots', profile === 'candidate' ? '' : profile);
const recordingsRoot = path.join(outputRoot, 'recordings', profile);
const createTempAccount = process.env.VIDEO_CREATE_TEMP_ACCOUNT === '1';
const captureVideo = process.env.VIDEO_CAPTURE_VIDEO !== '0' && profile === 'candidate';
const captureScreensEnabled = process.env.VIDEO_CAPTURE_SCREENSHOTS !== '0';

const env = {};
try {
  const raw = await fs.readFile(path.join(root, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) env[line.slice(0, index)] = line.slice(index + 1).trim();
  }
} catch { /* Public captures do not require local credentials. */ }

await Promise.all([
  fs.mkdir(path.join(screenshotsRoot, 'desktop'), { recursive: true }),
  fs.mkdir(path.join(screenshotsRoot, 'mobile'), { recursive: true }),
  fs.mkdir(recordingsRoot, { recursive: true }),
]);

const browser = await chromium.launch({ headless: true });
const waitForStablePage = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts?.ready);
};
const goto = async (page, route) => {
  await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForStablePage(page);
};
const shot = async (page, folder, name, fullPage = true) => {
  await page.screenshot({ path: path.join(screenshotsRoot, folder, name), fullPage, animations: 'disabled' });
};

let demo = null;
let admin = null;
const cleanup = async () => {
  if (!demo?.id || !admin) return;
  const result = await admin.auth.admin.deleteUser(demo.id);
  if (result.error) throw result.error;
};

const createDemoAccount = async () => {
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
  const service = env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SECRET_SUPABASE;
  if (!url || !anon || !service) throw new Error('Supabase QA variables are unavailable.');
  admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `mw-video-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.invalid`;
  const password = `Mw!${crypto.randomBytes(16).toString('base64url')}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error || new Error('Demo account creation failed.');
  const id = created.data.user.id;
  const works = [
    { id: 7, title: 'One Punch-Man', cover: 'https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/mangadex-proxy/cover/d8a959f7-648e-4c8d-8f23-f1f3f8e129f3/511fc404-e6b4-4204-bb10-e4a28f7b5271.jpg.256.jpg', source: 'crunchyscan', sourceId: 'one-punch-man', chapter: '211' },
    { id: 51, title: 'Dandadan', cover: 'https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/mangadex-proxy/cover/68112dc1-2b80-4f20-beb8-2f2a8716a430/971f79d4-ae64-4e9f-a874-2d2995eafafa.jpg.256.jpg', source: 'crunchyscan', sourceId: 'dandadan', chapter: '201' },
    { id: 100, title: 'Kaiju No. 8', cover: 'https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/mangadex-proxy/cover/237d527f-adb5-420e-8e6e-b7dd006fbe47/f48790fc-547c-4a10-8bef-56a373ddbb1c.jpg.256.jpg', source: 'crunchyscan', sourceId: 'kaiju-no-8', chapter: '129' },
  ];
  const now = Date.now();
  const progress = works.map((work, index) => ({
    user_id: id, canonical_key: `work:${work.id}`, canonical_manga_id: work.id,
    canonical_chapter_key: work.chapter, last_provider: work.source,
    last_provider_manga_id: work.sourceId, last_provider_chapter_id: `video-${work.id}-${work.chapter}`,
    language: 'fr', manga_title: work.title, manga_author: null, cover_image: work.cover,
    chapter_number: work.chapter, chapter_title: null, page_index: 7 - index,
    total_pages: 18, progress_percentage: 44 - index * 7,
    read_at: new Date(now - index * 86_400_000).toISOString(),
  }));
  const writes = await Promise.all([
    admin.from('user_favorites').insert(works.map(({ id: manga_id }) => ({ user_id: id, manga_id }))),
    admin.from('user_follows').insert(works.slice(0, 2).map(({ id: canonical_manga_id }) => ({ user_id: id, canonical_manga_id }))),
    admin.from('user_canonical_reading_progress').insert(progress),
  ]);
  const failed = writes.find(({ error }) => error);
  if (failed?.error) throw failed.error;
  return { id, email, password };
};

const login = async (page) => {
  if (!demo) return;
  await goto(page, '/auth');
  await page.getByLabel('Email').fill(demo.email);
  await page.getByLabel('Mot de passe').fill(demo.password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL(new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`), { timeout: 30_000 });
  await waitForStablePage(page);
};

const captureScreens = async () => {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  await goto(page, '/'); await shot(page, 'desktop', '01-home-discovery.png');
  await goto(page, '/search?browse=1'); await shot(page, 'desktop', '02-catalogue.png');
  await goto(page, '/search?q=Solo%20Leveling'); await shot(page, 'desktop', '03-search-results.png');
  await goto(page, '/trending'); await shot(page, 'desktop', '04-trending.png');
  await goto(page, '/ranking'); await shot(page, 'desktop', '05-ranking.png');
  await goto(page, '/manga/7'); await shot(page, 'desktop', '06-manga-detail.png');
  await goto(page, '/auth'); await shot(page, 'desktop', '07-auth.png');
  if (demo) {
    await login(page);
    await goto(page, '/'); await shot(page, 'desktop', '08-home-continue-reading.png');
    await goto(page, '/library'); await shot(page, 'desktop', '09-library.png');
    await goto(page, '/history'); await shot(page, 'desktop', '10-history.png');
  }
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await goto(mobilePage, '/'); await shot(mobilePage, 'mobile', '01-home-390x844.png');
  await goto(mobilePage, '/search?browse=1'); await shot(mobilePage, 'mobile', '02-catalogue-390x844.png');
  await goto(mobilePage, '/manga/7'); await shot(mobilePage, 'mobile', '03-manga-detail-390x844.png');
  if (demo) {
    await login(mobilePage);
    await goto(mobilePage, '/library'); await shot(mobilePage, 'mobile', '04-library-390x844.png');
    await goto(mobilePage, '/history'); await shot(mobilePage, 'mobile', '05-history-390x844.png');
  }
  await mobile.close();
};

const record = async ({ name, viewport, route, action, authenticated = false }) => {
  let storageState;
  if (authenticated) {
    const authContext = await browser.newContext({ viewport });
    const authPage = await authContext.newPage();
    await login(authPage);
    storageState = await authContext.storageState();
    await authContext.close();
  }
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width < 600,
    storageState,
    recordVideo: { dir: recordingsRoot, size: viewport },
  });
  const page = await context.newPage();
  await goto(page, route);
  await action(page);
  await page.waitForTimeout(1200);
  const video = page.video();
  await context.close();
  if (!video) return;
  const original = await video.path();
  await fs.rename(original, path.join(recordingsRoot, `${name}.webm`));
};

const captureRecordings = async () => {
  await record({ name: '16x9-home-carousel', viewport: { width: 1440, height: 900 }, route: '/', action: async (page) => {
    const next = page.getByRole('button', { name: 'Œuvre suivante' });
    for (let i = 0; i < 3; i += 1) { await next.click(); await page.waitForTimeout(850); }
  }});
  await record({ name: '16x9-catalogue-discovery', viewport: { width: 1440, height: 900 }, route: '/search?browse=1', action: async (page) => {
    await page.mouse.wheel(0, 620); await page.waitForTimeout(900); await page.mouse.wheel(0, 420);
  }});
  await record({ name: '16x9-search-to-detail', viewport: { width: 1440, height: 900 }, route: '/search?q=One%20Punch-Man', action: async (page) => {
    const link = page.getByRole('link', { name: /One Punch-Man/i }).first();
    if (await link.isVisible()) { await link.click(); await waitForStablePage(page); }
  }});
  if (demo) await record({ name: '16x9-library-to-history', viewport: { width: 1440, height: 900 }, route: '/library', authenticated: true, action: async (page) => {
    await page.mouse.wheel(0, 450); await page.waitForTimeout(700); await goto(page, '/history');
  }});
  await record({ name: '9x16-home-swipe', viewport: { width: 390, height: 844 }, route: '/', action: async (page) => {
    const stage = page.getByTestId('spotlight-stage');
    const box = await stage.boundingBox();
    if (box) { await page.touchscreen.tap(box.x + box.width * 0.78, box.y + box.height / 2); await page.waitForTimeout(900); }
    const next = page.getByRole('button', { name: 'Œuvre suivante' });
    if (await next.isVisible()) await next.click();
  }});
};

try {
  if (createTempAccount) demo = await createDemoAccount();
  if (captureScreensEnabled) await captureScreens();
  if (captureVideo) await captureRecordings();
  console.log(JSON.stringify({ status: 'PASS', profile, baseURL, temporaryAccount: Boolean(demo) }));
} finally {
  await browser.close();
  await cleanup();
}
