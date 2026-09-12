-- T-3022 (re-architecture): canonical Trending as a scheduled, materialized,
-- time-decayed aggregate — replacing the live hard-window RPC
-- (public.get_trending_manga) as Trending's read path, per explicit product
-- direction. get_trending_manga and public._canonical_activity_window are
-- left in place unchanged (T-3023 Ranking still depends on them); nothing
-- here drops or alters them.
--
-- Design (see MANGA_WAVE_V3_T3022_REPORT.md for the full write-up):
--   * Real activity only: user_follows (T-3014), user_favorites (P1),
--     user_reading_history (T-3019 session log) and, newly, per-manga
--     "still being read" evidence from user_canonical_reading_progress's
--     updated_at. mangas.views is never read here — it is dead, never
--     incremented anywhere in the app.
--   * Time-decayed, not a hard cutoff: every qualifying event contributes
--     `event_weight * recency_multiplier`, where recency_multiplier is
--     1.0 inside the last 24h, 0.5 inside the last 7d, 0.15 inside the last
--     30d, and 0 (excluded) beyond 30d. Event weights: follow 3.0,
--     favorite 2.0, reading session 1.5, progress update 1.0.
--   * Reading sessions are capped at 5 per (user, canonical manga) within
--     the 30-day window before decay is even applied, so one binge-reading
--     user cannot dominate the way raw event volume would allow.
--   * Materialized, refreshed hourly by pg_cron — not computed live on
--     every read. The view stores only anonymous aggregates (canonical
--     manga id, decayed score, distinct user count, raw per-signal counts,
--     computed_at) — no user_id, no email, no individual event ever
--     appears in it.
--   * A companion refresh function is granted to `service_role` only (never
--     anon/authenticated), so deterministic tests can force an immediate
--     refresh instead of waiting up to an hour for the schedule.

create materialized view public.manga_trending_scores as
with events as (
  select
    follow.canonical_manga_id,
    follow.user_id,
    follow.created_at as occurred_at,
    3.0::numeric as event_weight,
    'follow'::text as kind
  from public.user_follows follow
  where follow.created_at >= now() - interval '30 days'

  union all

  select
    favorite.manga_id as canonical_manga_id,
    favorite.user_id,
    favorite.created_at as occurred_at,
    2.0::numeric as event_weight,
    'favorite'::text as kind
  from public.user_favorites favorite
  where favorite.created_at >= now() - interval '30 days'

  union all

  select
    capped_sessions.canonical_manga_id,
    capped_sessions.user_id,
    capped_sessions.occurred_at,
    1.5::numeric as event_weight,
    'reading_session'::text as kind
  from (
    select
      history.canonical_manga_id,
      history.user_id,
      history.read_at as occurred_at,
      row_number() over (
        partition by history.canonical_manga_id, history.user_id
        order by history.read_at desc
      ) as session_rank
    from public.user_reading_history history
    where history.read_at >= now() - interval '30 days'
  ) capped_sessions
  where capped_sessions.session_rank <= 5

  union all

  select
    progress.canonical_manga_id,
    progress.user_id,
    progress.updated_at as occurred_at,
    1.0::numeric as event_weight,
    'progress_update'::text as kind
  from public.user_canonical_reading_progress progress
  where progress.canonical_manga_id is not null
    and progress.updated_at >= now() - interval '30 days'
),
decayed as (
  select
    canonical_manga_id,
    user_id,
    kind,
    event_weight,
    case
      when occurred_at >= now() - interval '24 hours' then 1.0
      when occurred_at >= now() - interval '7 days' then 0.5
      when occurred_at >= now() - interval '30 days' then 0.15
      else 0
    end as recency_multiplier
  from events
)
select
  canonical_manga_id,
  round(sum(event_weight * recency_multiplier)::numeric, 4) as score,
  count(distinct user_id)::integer as unique_users,
  count(*) filter (where kind = 'follow')::integer as follow_events,
  count(*) filter (where kind = 'favorite')::integer as favorite_events,
  count(*) filter (where kind = 'reading_session')::integer as reading_session_events,
  count(*) filter (where kind = 'progress_update')::integer as progress_update_events,
  now() as computed_at
from decayed
where canonical_manga_id is not null
group by canonical_manga_id
having sum(event_weight * recency_multiplier) > 0;

-- Required for `refresh materialized view concurrently` (avoids locking
-- readers out during the hourly refresh).
create unique index manga_trending_scores_manga_id_idx
  on public.manga_trending_scores (canonical_manga_id);

create index manga_trending_scores_score_idx
  on public.manga_trending_scores (score desc, canonical_manga_id asc);

comment on materialized view public.manga_trending_scores is
  'T-3022: scheduled (hourly), time-decayed, canonical Trending aggregate. '
  'Only anonymous per-manga aggregates -- no user_id, no email, no '
  'individual event. mangas.views is never read here. Refreshed by '
  'public.refresh_manga_trending_scores() via pg_cron.';

revoke all on public.manga_trending_scores from public;
grant select on public.manga_trending_scores to anon, authenticated;

create or replace function public.refresh_manga_trending_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.manga_trending_scores;
end;
$$;

comment on function public.refresh_manga_trending_scores is
  'Recomputes manga_trending_scores. Scheduled hourly via pg_cron; also '
  'callable on demand by service_role (e.g. deterministic QA fixtures) so '
  'tests do not have to wait for the schedule. Never exposed to '
  'anon/authenticated -- it performs no row-level filtering of its own.';

revoke all on function public.refresh_manga_trending_scores() from public, anon, authenticated;
grant execute on function public.refresh_manga_trending_scores() to service_role;

do $$
declare
  scheduled_job bigint;
begin
  select jobid into scheduled_job from cron.job where jobname = 'manga-trending-scores-hourly';
  if scheduled_job is not null then
    perform cron.unschedule(scheduled_job);
  end if;
end;
$$;

select cron.schedule(
  'manga-trending-scores-hourly',
  '7 * * * *',
  $$select public.refresh_manga_trending_scores();$$
);
