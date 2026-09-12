import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Deterministic QA fixture per the T-3022 ticket: build real rows through the
// same tables/triggers the application uses (user_canonical_reading_progress
// insert fires the T-3019 capture_canonical_reading_history trigger; no
// history row is ever written directly), then read the public RPC exactly as
// an anonymous browser client would. No fake UI-only injection.
//
// Manga A: three distinct recent readers + a follow -> strongest recent signal.
// Manga B: one recent reader -> present, but weaker than A.
// Manga C: one reader, but 60 days ago -> outside every supported window.
const MANGA_A = 100; // Kaiju No. 8
const MANGA_B = 145; // Pick Me Up, Infinite Gacha
const MANGA_C = 173; // 99 Wooden Stick

const loadEnv = (): Record<string, string> => {
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

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
const serviceKey = process.env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SECRET_SUPABASE;

const requireConfiguration = () => {
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase QA T-3022 absente');
};

type TrendingRow = {
  canonical_manga_id: number;
  score: number;
  unique_readers: number;
  reading_sessions: number;
  new_follows: number;
  new_favorites: number;
  rank: number;
};

test.describe('T-3022 canonical Trending deterministic smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let service: SupabaseClient;
  let anon: SupabaseClient;
  const userIds: string[] = [];

  const createQaUser = async () => {
    const suffix = crypto.randomUUID();
    const email = `codex-t3022-e2e-${suffix}@example.invalid`;
    const password = `T3022-${crypto.randomBytes(18).toString('base64url')}!`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const id = created.data.user!.id;
    userIds.push(id);
    return id;
  };

  const seedReadingProgress = async (userId: string, canonicalMangaId: number, readAt: string, title: string) => {
    const { error } = await service.from('user_canonical_reading_progress').insert({
      user_id: userId,
      canonical_key: `trending-qa:${userId}:${canonicalMangaId}`,
      canonical_manga_id: canonicalMangaId,
      canonical_chapter_key: '1',
      last_provider: 'originmanga',
      last_provider_manga_id: `qa-${canonicalMangaId}`,
      last_provider_chapter_id: `qa-${canonicalMangaId}-1`,
      language: 'fr',
      manga_title: title,
      chapter_number: '1',
      page_index: 0,
      total_pages: 1,
      progress_percentage: 100,
      read_at: readAt,
    });
    if (error) throw error;
  };

  test.beforeAll(async () => {
    requireConfiguration();
    service = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  test.afterAll(async () => {
    if (!service) return;
    await service.from('user_canonical_reading_progress').delete().in('user_id', userIds);
    await service.from('user_reading_history').delete().in('user_id', userIds);
    await service.from('user_follows').delete().in('user_id', userIds);
    await Promise.all(userIds.map((id) => service.auth.admin.deleteUser(id)));
  });

  test('recent multi-reader activity outranks weaker recent activity, and old activity is excluded', async () => {
    const now = Date.now();
    const recent = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
    const longAgo = new Date(now - 60 * 86_400_000).toISOString();

    const readersA = await Promise.all([createQaUser(), createQaUser(), createQaUser()]);
    const readerB = await createQaUser();
    const readerC = await createQaUser();

    await Promise.all(readersA.map((userId, index) => seedReadingProgress(userId, MANGA_A, recent(index + 1), 'Kaiju No. 8')));
    const { error: followError } = await service.from('user_follows').insert({ user_id: readersA[0], canonical_manga_id: MANGA_A });
    if (followError) throw followError;

    await seedReadingProgress(readerB, MANGA_B, recent(2), 'Pick Me Up, Infinite Gacha');
    await seedReadingProgress(readerC, MANGA_C, longAgo, '99 Wooden Stick');

    // Give the AFTER INSERT trigger a moment to land the history row (same
    // transaction, but PostgREST caches schemas briefly after heavy writes).
    await expect.poll(async () => {
      const { count } = await service.from('user_reading_history').select('*', { count: 'exact', head: true }).in('user_id', [...readersA, readerB]);
      return count ?? 0;
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);

    const { data, error } = await anon.rpc('get_trending_manga', { window_days: 7, result_limit: 50 });
    if (error) throw error;
    const rows = (data || []) as TrendingRow[];

    const rowA = rows.find((row) => row.canonical_manga_id === MANGA_A);
    const rowB = rows.find((row) => row.canonical_manga_id === MANGA_B);
    const rowC = rows.find((row) => row.canonical_manga_id === MANGA_C);

    expect(rowA, 'Manga A must appear with recent multi-reader activity').toBeTruthy();
    expect(rowB, 'Manga B must appear with weaker recent activity').toBeTruthy();
    expect(rowC, 'Manga C must be excluded: its only activity is 60 days old').toBeFalsy();

    expect(rowA!.unique_readers).toBe(3);
    expect(rowA!.new_follows).toBe(1);
    expect(rowB!.unique_readers).toBe(1);
    expect(rowA!.score).toBeGreaterThan(rowB!.score);

    // No raw user_id or email ever leaves the RPC.
    expect(JSON.stringify(rows)).not.toMatch(readersA[0]);
    expect(JSON.stringify(rows)).not.toContain('@example.invalid');

    // 24h window: reader seeded at recent(1)/(2)/(3) hours ago all still inside 24h,
    // but the 60-day-old Manga C reader stays excluded there too.
    const { data: shortWindowData, error: shortWindowError } = await anon.rpc('get_trending_manga', { window_days: 1, result_limit: 50 });
    if (shortWindowError) throw shortWindowError;
    const shortRows = (shortWindowData || []) as TrendingRow[];
    expect(shortRows.find((row) => row.canonical_manga_id === MANGA_C)).toBeFalsy();
  });
});
