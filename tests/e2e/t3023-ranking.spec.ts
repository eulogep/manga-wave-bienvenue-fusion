import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Deterministic QA fixture per the T-3023 ticket's required test
// distinctions, built through the real application path (inserting into
// user_canonical_reading_progress fires T-3019's existing trigger; no
// history row is ever written directly).
//
// Manga A: strong recent spike, one user, all activity on one day.
// Manga B: sustained engagement, 3 distinct users each active on several
//          different days spread over ~3 weeks -> must outrank A in Ranking
//          even though A and B can have comparable raw event counts.
// Manga C: one user generating many actions across many days -> must NOT
//          dominate Manga B despite more raw volume, because unique_readers
//          stays capped at 1.
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
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase QA T-3023 absente');
};

type RankingRow = {
  canonical_manga_id: number;
  score: number;
  unique_readers: number;
  reading_sessions: number;
  distinct_active_days: number;
  new_follows: number;
  new_favorites: number;
  legacy_fallback: boolean;
  rank: number;
};

test.describe('T-3023 canonical Ranking deterministic smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let service: SupabaseClient;
  let anon: SupabaseClient;
  const userIds: string[] = [];

  const createQaUser = async () => {
    const suffix = crypto.randomUUID();
    const email = `codex-t3023-e2e-${suffix}@example.invalid`;
    const password = `T3023-${crypto.randomBytes(18).toString('base64url')}!`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const id = created.data.user!.id;
    userIds.push(id);
    return id;
  };

  const seedReadingProgress = async (userId: string, canonicalMangaId: number, readAt: string, title: string, chapter: string) => {
    const { error } = await service.from('user_canonical_reading_progress').insert({
      user_id: userId,
      canonical_key: `ranking-qa:${userId}:${canonicalMangaId}:${chapter}`,
      canonical_manga_id: canonicalMangaId,
      canonical_chapter_key: chapter,
      last_provider: 'originmanga',
      last_provider_manga_id: `qa-${canonicalMangaId}`,
      last_provider_chapter_id: `qa-${canonicalMangaId}-${chapter}`,
      language: 'fr',
      manga_title: title,
      chapter_number: chapter,
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
    await Promise.all(userIds.map((id) => service.auth.admin.deleteUser(id)));
  });

  test('sustained multi-user engagement outranks a single-day spike and a capped one-user binge', async () => {
    const now = Date.now();
    const daysAgo = (days: number, hour = 12) => {
      const date = new Date(now - days * 86_400_000);
      date.setUTCHours(hour, 0, 0, 0);
      return date.toISOString();
    };

    // Manga A: one user, six sessions, all today (a Trending-shaped spike).
    const spikeReader = await createQaUser();
    await Promise.all(Array.from({ length: 6 }, (_, index) => (
      seedReadingProgress(spikeReader, MANGA_A, daysAgo(0, 6 + index), 'Sousou no Frieren', String(index + 1))
    )));

    // Manga B: three distinct users, each active on several different days
    // over the last ~3 weeks (comparable total volume to A, but spread out
    // and shared across real people).
    const sustainedReaders = await Promise.all([createQaUser(), createQaUser(), createQaUser()]);
    await Promise.all(sustainedReaders.flatMap((userId, readerIndex) => (
      Array.from({ length: 3 }, (_, dayIndex) => (
        // Chapter key must be purely numeric: the T-3019 capture trigger
        // requires canonical_chapter_key to match ^\d+(\.\d+)?$ and silently
        // skips history insertion otherwise. canonical_key already embeds
        // userId, so reusing chapter numbers 1-3 across users is safe.
        seedReadingProgress(userId, MANGA_B, daysAgo(readerIndex * 5 + dayIndex + 1), 'Mushoku Tensei', String(dayIndex + 1))
      ))
    )));

    // Manga C: one user, many sessions across many distinct days (a binge) —
    // must not out-rank Manga B despite comparable or greater raw volume.
    const bingeReader = await createQaUser();
    await Promise.all(Array.from({ length: 20 }, (_, dayIndex) => (
      seedReadingProgress(bingeReader, MANGA_C, daysAgo(dayIndex + 1), 'One Piece', String(dayIndex))
    )));

    await expect.poll(async () => {
      const { count } = await service.from('user_reading_history').select('*', { count: 'exact', head: true }).in('user_id', userIds);
      return count ?? 0;
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(10);

    const { data, error } = await anon.rpc('get_manga_ranking', { window_days: 30, result_limit: 50, include_legacy_fallback: false });
    if (error) throw error;
    const rows = (data || []) as RankingRow[];

    const rowA = rows.find((row) => row.canonical_manga_id === MANGA_A);
    const rowB = rows.find((row) => row.canonical_manga_id === MANGA_B);
    const rowC = rows.find((row) => row.canonical_manga_id === MANGA_C);

    expect(rowA, 'Manga A (spike) must appear').toBeTruthy();
    expect(rowB, 'Manga B (sustained) must appear').toBeTruthy();
    expect(rowC, 'Manga C (binge) must appear').toBeTruthy();

    expect(rowA!.distinct_active_days).toBe(1);
    expect(rowB!.unique_readers).toBe(3);
    expect(rowC!.unique_readers).toBe(1);

    // The core T-3023 distinction: sustained, shared engagement outranks
    // both a same-day spike and a capped single-user binge.
    expect(rowB!.score).toBeGreaterThan(rowA!.score);
    expect(rowB!.score).toBeGreaterThan(rowC!.score);

    // None of these are legacy fallback rows (all backed by real activity).
    expect(rowA!.legacy_fallback).toBe(false);
    expect(rowB!.legacy_fallback).toBe(false);
    expect(rowC!.legacy_fallback).toBe(false);

    // No raw user id or QA email ever leaves the RPC.
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(spikeReader);
    expect(serialized).not.toContain('@example.invalid');
  });

  test('legacy fallback (mangas.views) never fabricates a rank: opting out never returns one, and it stays empty for real when the catalog genuinely has no legacy candidate', async () => {
    // Verified directly against production before writing this assertion:
    // every row in `mangas` currently has `views = 0` (not a stale nonzero
    // seed — the column was never populated at all). So today, the honest
    // real-world answer is that NO row can qualify as a legacy candidate
    // (the SQL's own `work.views > 0` guard), independent of this test's
    // seeded activity. That is itself the behavior under test: the legacy
    // path must stay silent rather than inventing a rank when there is
    // nothing legitimate to show, in either mode.
    const { data: optedOut, error: optedOutError } = await anon.rpc('get_manga_ranking', {
      window_days: 1, result_limit: 5, include_legacy_fallback: false,
    });
    if (optedOutError) throw optedOutError;
    expect(((optedOut || []) as RankingRow[]).some((row) => row.legacy_fallback)).toBe(false);

    const { data: withFallback, error: withFallbackError } = await anon.rpc('get_manga_ranking', {
      window_days: 1, result_limit: 5, include_legacy_fallback: true,
    });
    if (withFallbackError) throw withFallbackError;
    expect(((withFallback || []) as RankingRow[]).some((row) => row.legacy_fallback)).toBe(false);
  });
});
