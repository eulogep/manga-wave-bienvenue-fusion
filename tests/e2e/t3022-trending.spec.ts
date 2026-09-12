import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Deterministic QA fixture for T-3022's scheduled, materialized,
// time-decayed Trending aggregate. Real rows through the real application
// path (user_canonical_reading_progress insert fires T-3019's existing
// capture_canonical_reading_history trigger; no history row is ever written
// directly), then an on-demand refresh via the service-role-only
// refresh_manga_trending_scores() RPC (so this test does not have to wait
// up to an hour for the pg_cron schedule), then read back through the
// ANONYMOUS client exactly as a visitor would.
//
// Manga A: one recent follow (real, strongest decay tier).
// Manga B: one older, lower-weight favorite (weaker decay tier) -> must
//          score below A.
// Manga C: one user, many reading sessions (binge) -> capped before decay.
const MANGA_A = 6;  // Sousou no Frieren
const MANGA_B = 9;  // Mushoku Tensei: Isekai Ittara Honki Dasu
const MANGA_C = 22; // One Piece

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
  unique_users: number;
  follow_events: number;
  favorite_events: number;
  reading_session_events: number;
  progress_update_events: number;
  computed_at: string;
};

test.describe('T-3022 canonical Trending (materialized, decayed) deterministic smoke', () => {
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

  const refreshScores = async () => {
    const { error } = await service.rpc('refresh_manga_trending_scores');
    if (error) throw error;
  };

  test.beforeAll(async () => {
    requireConfiguration();
    service = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  test.afterAll(async () => {
    if (!service) return;
    await service.from('user_follows').delete().in('user_id', userIds);
    await service.from('user_favorites').delete().in('user_id', userIds);
    await service.from('user_canonical_reading_progress').delete().in('user_id', userIds);
    await service.from('user_reading_history').delete().in('user_id', userIds);
    await Promise.all(userIds.map((id) => service.auth.admin.deleteUser(id)));
    // Remove this fixture's contribution from the materialized snapshot
    // rather than leaving it to the next hourly schedule.
    await refreshScores();
  });

  test('the refresh RPC is unreachable by anon/authenticated (service_role only)', async () => {
    const { error } = await anon.rpc('refresh_manga_trending_scores');
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toContain('permission denied');
  });

  test('anonymous reads of manga_trending_scores never expose a user id or email', async () => {
    const { data, error } = await anon.from('manga_trending_scores').select('*').limit(5);
    if (error) throw error;
    const serialized = JSON.stringify(data ?? []);
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(serialized).not.toContain('@example.invalid');
    expect(serialized).not.toContain('@');
  });

  test('a recent follow outranks an older, lower-weight favorite, and a capped binge does not dominate', async () => {
    const now = Date.now();
    const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
    const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

    // Manga A: one follow, one hour ago (strongest decay tier, highest weight).
    const followUser = await createQaUser();
    const { error: followError } = await service.from('user_follows').insert({
      user_id: followUser, canonical_manga_id: MANGA_A, created_at: hoursAgo(1),
    });
    if (followError) throw followError;

    // Manga B: one favorite, 20 days ago (weak decay tier, lower weight).
    const favoriteUser = await createQaUser();
    const { error: favoriteError } = await service.from('user_favorites').insert({
      user_id: favoriteUser, manga_id: MANGA_B, created_at: daysAgo(20),
    });
    if (favoriteError) throw favoriteError;

    // Manga C: one user, 20 reading sessions (a binge) -> capped at 5 before decay.
    const bingeUser = await createQaUser();
    await Promise.all(Array.from({ length: 20 }, (_, index) => (
      service.from('user_canonical_reading_progress').insert({
        user_id: bingeUser,
        canonical_key: `trending-qa:${bingeUser}:${MANGA_C}:${index}`,
        canonical_manga_id: MANGA_C,
        canonical_chapter_key: String(index + 1),
        last_provider: 'originmanga',
        last_provider_manga_id: `qa-${MANGA_C}`,
        last_provider_chapter_id: `qa-${MANGA_C}-${index}`,
        language: 'fr',
        manga_title: 'One Piece',
        chapter_number: String(index + 1),
        page_index: 0,
        total_pages: 1,
        progress_percentage: 100,
        read_at: hoursAgo(index),
      })
    )));

    await expect.poll(async () => {
      const { count } = await service.from('user_reading_history').select('*', { count: 'exact', head: true }).eq('user_id', bingeUser);
      return count ?? 0;
    }, { timeout: 30_000 }).toBeGreaterThan(0);

    await refreshScores();

    const { data, error } = await anon.from('manga_trending_scores').select('*').in('canonical_manga_id', [MANGA_A, MANGA_B, MANGA_C]);
    if (error) throw error;
    const rows = (data || []) as TrendingRow[];
    const rowA = rows.find((row) => row.canonical_manga_id === MANGA_A);
    const rowB = rows.find((row) => row.canonical_manga_id === MANGA_B);
    const rowC = rows.find((row) => row.canonical_manga_id === MANGA_C);

    expect(rowA, 'Manga A (recent follow) must appear').toBeTruthy();
    expect(rowB, 'Manga B (old favorite) must appear').toBeTruthy();
    expect(rowC, 'Manga C (capped binge) must appear').toBeTruthy();

    // Recent follow (weight 3, decay 1.0 = 3.0) outranks an old favorite
    // (weight 2, decay 0.15 = 0.3).
    expect(rowA!.score).toBeGreaterThan(rowB!.score);

    // The binge is capped at 5 sessions before decay, not 20.
    expect(rowC!.reading_session_events).toBeLessThanOrEqual(5);
    expect(rowC!.unique_users).toBe(1);

    expect(rowA!.follow_events).toBe(1);
    expect(rowB!.favorite_events).toBe(1);
  });
});
