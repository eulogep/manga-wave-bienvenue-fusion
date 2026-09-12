-- T-3022: canonical Trending — recent relative activity, computed from real,
-- already-deduped user-activity tables (T-3013/T-3014/T-3019/P1).
--
-- Design notes (see MANGA_WAVE_V3_T3022_REPORT.md for full rationale):
--   * No new activity table. `mangas.views` is explicitly NOT used (never
--     incremented anywhere in the application — a frozen seed value is not a
--     real trend signal).
--   * Signals: user_reading_history (T-3019 per-chapter session log, already
--     collapses rapid page turns on the same chapter within 30 minutes into
--     one row), user_follows (T-3014, unique per user+manga by constraint)
--     and user_favorites (P1, unique per user+manga by constraint). All three
--     are structurally incapable of duplicate-event spam per user per manga
--     except user_reading_history, which can still accumulate many distinct
--     *sessions* from one binge-reading user — bounded below.
--   * Cross-user aggregation requires bypassing RLS (a browser client must
--     never read another user's raw activity rows). This function is
--     SECURITY DEFINER, owned by the migration role (not subject to the
--     private tables' RLS), and returns only anonymous aggregate counts per
--     canonical manga — no user_id, no email, no individual event ever
--     leaves this function.
--   * Chosen architecture: a live SQL aggregation (option A), not a stored/
--     materialized table refreshed on a schedule (option B). Current activity
--     volume is tiny (low tens of rows across all three tables), so an
--     on-demand aggregate is both simpler and always fresh, avoiding a cron
--     job and a staleness window for no real benefit at this scale. If
--     volume grows enough that this query becomes expensive, the same
--     `get_trending_manga` contract can be swapped for a table-backed
--     implementation refreshed by `pg_cron` (already used by
--     `daily_mangadex_catalog_sync.sql`) without changing any caller.

-- Supporting indexes for the time-window scans this function performs.
-- Existing indexes on these tables are all (user_id, ...)-first, which does
-- not help a global "all users, recent window, group by canonical manga"
-- scan.
create index if not exists user_reading_history_window_idx
  on public.user_reading_history (read_at, canonical_manga_id, user_id);

create index if not exists user_follows_window_idx
  on public.user_follows (created_at, canonical_manga_id);

create index if not exists user_favorites_window_idx
  on public.user_favorites (created_at, manga_id);

create or replace function public.get_trending_manga(
  window_days integer default 7,
  result_limit integer default 20,
  max_sessions_per_user integer default 5
)
returns table (
  canonical_manga_id bigint,
  score numeric,
  unique_readers integer,
  reading_sessions integer,
  new_follows integer,
  new_favorites integer,
  rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select now() - make_interval(days => greatest(1, least(coalesce(window_days, 7), 90))) as since
  ),
  reading_per_user as (
    select
      history.canonical_manga_id,
      history.user_id,
      count(*) as sessions
    from public.user_reading_history history, bounds
    where history.read_at >= bounds.since
    group by history.canonical_manga_id, history.user_id
  ),
  reading as (
    select
      canonical_manga_id,
      count(distinct user_id)::integer as unique_readers,
      -- Bound one user's contribution so a single binge-reader cannot
      -- dominate the trend score across many distinct chapters/sessions.
      sum(least(sessions, greatest(1, coalesce(max_sessions_per_user, 5))))::integer as reading_sessions
    from reading_per_user
    group by canonical_manga_id
  ),
  follows as (
    select
      follow.canonical_manga_id,
      count(*)::integer as new_follows
    from public.user_follows follow, bounds
    where follow.created_at >= bounds.since
    group by follow.canonical_manga_id
  ),
  favorites as (
    select
      favorite.manga_id as canonical_manga_id,
      count(*)::integer as new_favorites
    from public.user_favorites favorite, bounds
    where favorite.created_at >= bounds.since
    group by favorite.manga_id
  ),
  combined as (
    select
      coalesce(reading.canonical_manga_id, follows.canonical_manga_id, favorites.canonical_manga_id) as canonical_manga_id,
      coalesce(reading.unique_readers, 0) as unique_readers,
      coalesce(reading.reading_sessions, 0) as reading_sessions,
      coalesce(follows.new_follows, 0) as new_follows,
      coalesce(favorites.new_favorites, 0) as new_favorites
    from reading
    full outer join follows on follows.canonical_manga_id = reading.canonical_manga_id
    full outer join favorites on favorites.canonical_manga_id = coalesce(reading.canonical_manga_id, follows.canonical_manga_id)
  ),
  scored as (
    select
      canonical_manga_id,
      unique_readers,
      reading_sessions,
      new_follows,
      new_favorites,
      -- Unique reach weighted highest (5), then explicit intent to keep
      -- tracking (Follow, 3), then reading engagement volume (1, already
      -- per-user bounded above), then the lighter bookmark signal
      -- (Favorite, 2). Documented in MANGA_WAVE_V3_T3022_REPORT.md; mirrored
      -- and tested in src/domain/trending.ts.
      (unique_readers * 5 + new_follows * 3 + new_favorites * 2 + reading_sessions * 1)::numeric as score
    from combined
    where canonical_manga_id is not null
  )
  select
    canonical_manga_id,
    score,
    unique_readers,
    reading_sessions,
    new_follows,
    new_favorites,
    row_number() over (order by score desc, unique_readers desc, canonical_manga_id asc)::integer as rank
  from scored
  where score > 0
  order by score desc, unique_readers desc, canonical_manga_id asc
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

comment on function public.get_trending_manga is
  'T-3022: anonymous aggregate recent-activity ranking per canonical manga. '
  'SECURITY DEFINER to read across users; returns only aggregate counts, '
  'never a user_id or individual event. Safe for anon and authenticated.';

revoke all on function public.get_trending_manga(integer, integer, integer) from public;
grant execute on function public.get_trending_manga(integer, integer, integer) to anon, authenticated;
