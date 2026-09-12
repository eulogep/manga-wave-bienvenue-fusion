-- T-3023: canonical Ranking — broader sustained popularity, distinct from
-- T-3022 Trending's recent-acceleration signal. Shares the same private
-- activity tables and the same anonymous-aggregate architecture.
--
-- AUDIT (see MANGA_WAVE_V3_T3023_REPORT.md for the full write-up) performed
-- before writing this migration:
--   * `mangas.views`: confirmed (again) never incremented anywhere in the
--     app. Not a real activity signal. Kept ONLY as an explicit, clearly
--     flagged legacy fallback (see `legacy_fallback` output column) used
--     solely to fill remaining result slots when real activity cannot,
--     never blended silently into a real score.
--   * `mangas.rating`: read back from production — 145 of 343 rows are
--     exactly 4.8, 36 are exactly 4.9, 5 are exactly 5, all provider-scraper
--     hardcoded constants (OriginManga/CrunchyScan always write 4.8,
--     MangaFire always writes 4.9, AsuraScans falls back to 4.8 on parse
--     failure — see server/src/sources/*.ts). This is not a trustworthy
--     quality signal for most of the catalog and is excluded entirely from
--     Ranking, not just deprioritized.
--
-- Shared aggregation: `_canonical_activity_window` factors out the same
-- reading/follow/favorite aggregation T-3022's `get_trending_manga` already
-- used, so this migration also refactors `get_trending_manga` to delegate to
-- it instead of duplicating the joins a third time (Ranking would otherwise
-- be the third near-identical copy). `get_trending_manga`'s signature,
-- output shape and scoring formula are unchanged — this is an internal
-- refactor, not a behavior change, and is re-verified by the existing
-- T-3022 unit tests and E2E fixture before/after.

-- Legacy-fallback support index (mangas.views is only ever read here, never written).
create index if not exists mangas_views_fallback_idx
  on public.mangas (views desc, id asc)
  where views > 0;

-- Internal shared aggregate. Not exposed directly: revoked from every role
-- immediately below. Only callable from within another SECURITY DEFINER
-- function owned by the same (migration) role, which is how
-- get_trending_manga and get_manga_ranking use it.
create or replace function public._canonical_activity_window(
  window_days integer,
  max_sessions_per_user integer default 5
)
returns table (
  canonical_manga_id bigint,
  unique_readers integer,
  reading_sessions integer,
  distinct_active_days integer,
  new_follows integer,
  new_favorites integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select case
      when window_days is null then '-infinity'::timestamptz
      else now() - make_interval(days => greatest(1, least(window_days, 3650)))
    end as since
  ),
  reading_per_user as (
    select
      history.canonical_manga_id,
      history.user_id,
      count(*) as sessions,
      -- Distinct calendar days this user read this manga in the window:
      -- the "repeat readership" signal Ranking weights heavily. Capped
      -- per user below so one person reading daily for a month cannot
      -- single-handedly outrank broad, genuinely shared engagement.
      count(distinct (history.read_at at time zone 'UTC')::date) as active_days
    from public.user_reading_history history, bounds
    where history.read_at >= bounds.since
    group by history.canonical_manga_id, history.user_id
  ),
  reading as (
    select
      canonical_manga_id,
      count(distinct user_id)::integer as unique_readers,
      sum(least(sessions, greatest(1, coalesce(max_sessions_per_user, 5))))::integer as reading_sessions,
      sum(least(active_days, greatest(1, coalesce(max_sessions_per_user, 5))))::integer as distinct_active_days
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
  )
  select
    coalesce(reading.canonical_manga_id, follows.canonical_manga_id, favorites.canonical_manga_id) as canonical_manga_id,
    coalesce(reading.unique_readers, 0) as unique_readers,
    coalesce(reading.reading_sessions, 0) as reading_sessions,
    coalesce(reading.distinct_active_days, 0) as distinct_active_days,
    coalesce(follows.new_follows, 0) as new_follows,
    coalesce(favorites.new_favorites, 0) as new_favorites
  from reading
  full outer join follows on follows.canonical_manga_id = reading.canonical_manga_id
  full outer join favorites on favorites.canonical_manga_id = coalesce(reading.canonical_manga_id, follows.canonical_manga_id)
  where coalesce(reading.canonical_manga_id, follows.canonical_manga_id, favorites.canonical_manga_id) is not null;
$$;

revoke all on function public._canonical_activity_window(integer, integer) from public, anon, authenticated;

-- T-3022, refactored to delegate to the shared helper. Signature, output
-- columns and scoring formula are byte-for-byte identical to the version
-- this replaces; only the internal join implementation moved.
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
  with scored as (
    select
      canonical_manga_id,
      unique_readers,
      reading_sessions,
      new_follows,
      new_favorites,
      (unique_readers * 5 + new_follows * 3 + new_favorites * 2 + reading_sessions * 1)::numeric as score
    from public._canonical_activity_window(window_days, max_sessions_per_user)
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
  'never a user_id or individual event. Safe for anon and authenticated. '
  'Delegates to _canonical_activity_window (T-3023 refactor); behavior unchanged.';

revoke all on function public.get_trending_manga(integer, integer, integer) from public;
grant execute on function public.get_trending_manga(integer, integer, integer) to anon, authenticated;

-- T-3023: broader sustained popularity. Weights repeat readership
-- (distinct_active_days) highest, since a manga read across many different
-- days by real people is the clearest evidence of durable interest — the
-- one property that most distinguishes "Ranking" from "Trending" (a
-- one-day spike scores low here even if it scored high in Trending).
-- Followed by unique reach, then durable intent (Follow > Favorite), then
-- raw session volume last (already per-user capped upstream).
--
-- `mangas.views` is NEVER blended into `score`. It only fills remaining
-- slots, marked `legacy_fallback = true`, when real activity cannot supply
-- `result_limit` rows and the caller has not opted out
-- (`include_legacy_fallback = false`). Callers MUST render legacy rows
-- distinctly (see src/components/RankingSection.tsx) rather than presenting
-- them as equivalent to a real ranking.
create or replace function public.get_manga_ranking(
  window_days integer default null,
  result_limit integer default 20,
  max_sessions_per_user integer default 5,
  include_legacy_fallback boolean default true
)
returns table (
  canonical_manga_id bigint,
  score numeric,
  unique_readers integer,
  reading_sessions integer,
  distinct_active_days integer,
  new_follows integer,
  new_favorites integer,
  legacy_fallback boolean,
  rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with capped_limit as (
    select greatest(1, least(coalesce(result_limit, 20), 500)) as value
  ),
  scored as (
    select
      canonical_manga_id,
      unique_readers,
      reading_sessions,
      distinct_active_days,
      new_follows,
      new_favorites,
      (
        distinct_active_days * 6
        + unique_readers * 4
        + new_follows * 3
        + new_favorites * 2
        + reading_sessions * 1
      )::numeric as score
    from public._canonical_activity_window(window_days, max_sessions_per_user)
  ),
  real_ranked as (
    select
      canonical_manga_id, score, unique_readers, reading_sessions, distinct_active_days,
      new_follows, new_favorites, false as legacy_fallback
    from scored
    where score > 0
  ),
  real_count as (select count(*)::integer as n from real_ranked),
  legacy as (
    select
      work.id as canonical_manga_id,
      work.views::numeric as score,
      0 as unique_readers,
      0 as reading_sessions,
      0 as distinct_active_days,
      0 as new_follows,
      0 as new_favorites,
      true as legacy_fallback
    from public.mangas work, real_count, capped_limit
    where include_legacy_fallback
      and work.views > 0
      and real_count.n < capped_limit.value
      and not exists (select 1 from real_ranked where real_ranked.canonical_manga_id = work.id)
    order by work.views desc, work.id asc
    limit greatest(0, (select capped_limit.value - real_count.n from capped_limit, real_count))
  ),
  merged as (
    select * from real_ranked
    union all
    select * from legacy
  )
  select
    canonical_manga_id,
    score,
    unique_readers,
    reading_sessions,
    distinct_active_days,
    new_follows,
    new_favorites,
    legacy_fallback,
    row_number() over (
      order by legacy_fallback asc, score desc, unique_readers desc, canonical_manga_id asc
    )::integer as rank
  from merged
  order by legacy_fallback asc, score desc, unique_readers desc, canonical_manga_id asc
  limit (select value from capped_limit);
$$;

comment on function public.get_manga_ranking is
  'T-3023: anonymous aggregate sustained-popularity ranking per canonical '
  'manga, distinct from T-3022 Trending (which measures recent '
  'acceleration). Weights repeat readership over raw session volume. '
  'mangas.views never contributes to the real score; it only fills unmet '
  'result slots as an explicitly flagged legacy_fallback row. '
  'mangas.rating is never used (see migration header comment: the bulk of '
  'stored ratings are provider-scraper hardcoded constants, not a '
  'trustworthy quality signal). SECURITY DEFINER to read across users; '
  'returns only aggregate counts, never a user_id or individual event.';

revoke all on function public.get_manga_ranking(integer, integer, integer, boolean) from public;
grant execute on function public.get_manga_ranking(integer, integer, integer, boolean) to anon, authenticated;
