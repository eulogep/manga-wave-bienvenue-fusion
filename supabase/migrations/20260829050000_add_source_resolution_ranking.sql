-- T-3008: explainable source ranking. This does not switch Reader sources and
-- intentionally does not implement the automatic fallback reserved for T-3009.

create or replace function public.rank_canonical_manga_sources(
  requested_canonical_id bigint,
  preferred_language text default 'fr'
)
returns table (
  mapping_id bigint,
  source_id text,
  source_manga_id text,
  language text,
  source_url text,
  eligible boolean,
  source_score numeric,
  score_breakdown jsonb,
  last_successful_request timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with metrics as (
    select
      mapping.id as mapping_id,
      mapping.source_id,
      mapping.source_manga_id,
      mapping.language,
      mapping.source_url,
      mapping.available,
      coalesce(health.circuit_state, 'closed') as circuit_state,
      coalesce(health.average_latency_ms, 0) as average_latency_ms,
      coalesce(health.request_count, 0) as request_count,
      coalesce(health.failure_count, 0) as failure_count,
      health.last_success_at,
      count(snapshot.id)::numeric as chapter_count,
      case
        when coalesce(mapping.metadata->>'imageQualityScore', '') ~ '^[0-9]+([.][0-9]+)?$'
          then least(greatest((mapping.metadata->>'imageQualityScore')::numeric, 0), 100)
        else 50::numeric
      end as image_quality_score
    from public.manga_source_mappings mapping
    left join public.source_health health on health.source_id = mapping.source_id
    left join public.chapter_snapshots snapshot
      on snapshot.mapping_id = mapping.id and snapshot.available
    where mapping.manga_id = requested_canonical_id
    group by mapping.id, health.source_id
  ), coverage as (
    select metrics.*, max(chapter_count) over () as maximum_chapter_count
    from metrics
  ), components as (
    select
      coverage.*,
      (available and circuit_state <> 'open') as eligible,
      case
        when not available then 0::numeric
        when circuit_state = 'half-open' then 10::numeric
        else 20::numeric
      end as availability_points,
      case
        when request_count > 0 then 15 * (1 - least(average_latency_ms, 5000)::numeric / 5000)
        else 7.5::numeric
      end as latency_points,
      case
        when split_part(replace(lower(language), '_', '-'), '-', 1)
          = split_part(replace(lower(coalesce(nullif(preferred_language, ''), 'fr')), '_', '-'), '-', 1) then 20::numeric
        when lower(language) = 'multi' then 15::numeric
        when lower(language) in ('und', '') then 8::numeric
        else 2::numeric
      end as language_points,
      case
        when maximum_chapter_count > 0 then 20 * least(chapter_count / maximum_chapter_count, 1)
        else 10::numeric
      end as coverage_points,
      10 * image_quality_score / 100 as image_quality_points,
      case
        when request_count > 0 then 10 * (1 - least(failure_count::numeric / request_count, 1))
        else 5::numeric
      end as error_rate_points,
      case
        when last_success_at >= now() - interval '24 hours' then 5::numeric
        when last_success_at >= now() - interval '7 days' then 3::numeric
        when last_success_at is not null then 1::numeric
        else 0::numeric
      end as freshness_points
    from coverage
  )
  select
    components.mapping_id,
    components.source_id,
    components.source_manga_id,
    components.language,
    components.source_url,
    components.eligible,
    case
      when components.eligible then round((
        availability_points + latency_points + language_points + coverage_points
        + image_quality_points + error_rate_points + freshness_points
      )::numeric, 2)
      else 0::numeric
    end as source_score,
    jsonb_build_object(
      'availability', round(availability_points, 2),
      'latency', round(latency_points, 2),
      'language', round(language_points, 2),
      'chapterCoverage', round(coverage_points, 2),
      'imageQuality', round(image_quality_points, 2),
      'errorRate', round(error_rate_points, 2),
      'freshness', round(freshness_points, 2)
    ) as score_breakdown,
    components.last_success_at
  from components
  order by eligible desc, source_score desc, source_id;
$$;

grant execute on function public.rank_canonical_manga_sources(bigint, text) to anon, authenticated;
