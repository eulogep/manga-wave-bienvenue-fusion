-- P1 hotfix: one durable Continue Reading state per canonical manga.
-- The legacy user_reading_progress table is intentionally preserved intact.

create table if not exists public.user_canonical_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_key text not null,
  canonical_manga_id bigint references public.mangas(id) on delete set null,
  canonical_chapter_key text not null,
  last_provider text not null,
  last_provider_manga_id text not null,
  last_provider_chapter_id text not null,
  language text not null default 'und',
  manga_title text not null,
  manga_author text,
  cover_image text,
  chapter_number text not null,
  chapter_title text,
  page_index integer not null default 0 check (page_index >= 0),
  total_pages integer not null default 1 check (total_pages > 0),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, canonical_key)
);

create index if not exists user_canonical_reading_progress_recent_idx
on public.user_canonical_reading_progress (user_id, read_at desc);

create index if not exists user_canonical_reading_progress_manga_idx
on public.user_canonical_reading_progress (canonical_manga_id)
where canonical_manga_id is not null;

drop trigger if exists user_canonical_reading_progress_set_updated_at
on public.user_canonical_reading_progress;
create trigger user_canonical_reading_progress_set_updated_at
before update on public.user_canonical_reading_progress
for each row execute function public.set_updated_at();

alter table public.user_canonical_reading_progress enable row level security;
grant select, insert, update, delete on public.user_canonical_reading_progress to authenticated;

create policy "Canonical reading progress is visible to its owner"
on public.user_canonical_reading_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Canonical reading progress is created by its owner"
on public.user_canonical_reading_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Canonical reading progress is updated by its owner"
on public.user_canonical_reading_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Canonical reading progress is deleted by its owner"
on public.user_canonical_reading_progress for delete to authenticated
using ((select auth.uid()) = user_id);

-- Deterministic, non-destructive backfill. The latest legacy row supplies the
-- active provider/chapter. For duplicates on that same logical chapter, the
-- highest recorded page/progress is retained. All legacy rows remain archived
-- in user_reading_progress and can be inspected or restored.
with legacy as (
  select
    progress.*,
    'title:' || public.normalize_manga_title(progress.manga_title) as canonical_key,
    coalesce(mapping.manga_id, title_match.id) as canonical_manga_id,
    lower(trim(progress.chapter_number)) as canonical_chapter_key,
    row_number() over (
      partition by progress.user_id, public.normalize_manga_title(progress.manga_title)
      order by progress.updated_at desc, progress.read_at desc, progress.source_id
    ) as position_rank
  from public.user_reading_progress progress
  left join public.manga_source_mappings mapping
    on mapping.source_id = progress.source_id
   and mapping.source_manga_id = progress.source_manga_id
  left join lateral (
    select manga.id
    from public.mangas manga
    where manga.normalized_title = public.normalize_manga_title(progress.manga_title)
       or exists (
         select 1 from unnest(manga.aliases) alias
         where public.normalize_manga_title(alias) = public.normalize_manga_title(progress.manga_title)
       )
    order by manga.id
    limit 1
  ) title_match on true
), latest as (
  select * from legacy where position_rank = 1
), same_chapter_high_water as (
  select
    candidate.user_id,
    candidate.canonical_key,
    candidate.canonical_chapter_key,
    max(candidate.page_index) as page_index,
    max(candidate.total_pages) as total_pages,
    max(candidate.progress_percentage) as progress_percentage
  from legacy candidate
  join latest selected
    on selected.user_id = candidate.user_id
   and selected.canonical_key = candidate.canonical_key
   and selected.canonical_chapter_key = candidate.canonical_chapter_key
  group by candidate.user_id, candidate.canonical_key, candidate.canonical_chapter_key
)
insert into public.user_canonical_reading_progress (
  user_id, canonical_key, canonical_manga_id, canonical_chapter_key,
  last_provider, last_provider_manga_id, last_provider_chapter_id, language,
  manga_title, manga_author, cover_image, chapter_number, chapter_title,
  page_index, total_pages, progress_percentage, read_at, updated_at
)
select
  latest.user_id,
  latest.canonical_key,
  latest.canonical_manga_id,
  latest.canonical_chapter_key,
  latest.source_id,
  latest.source_manga_id,
  latest.source_chapter_id,
  'und',
  latest.manga_title,
  latest.manga_author,
  latest.cover_image,
  latest.chapter_number,
  latest.chapter_title,
  greatest(latest.page_index, high_water.page_index),
  greatest(latest.total_pages, high_water.total_pages),
  greatest(latest.progress_percentage, high_water.progress_percentage),
  latest.read_at,
  latest.updated_at
from latest
join same_chapter_high_water high_water
  on high_water.user_id = latest.user_id
 and high_water.canonical_key = latest.canonical_key
 and high_water.canonical_chapter_key = latest.canonical_chapter_key
on conflict (user_id, canonical_key) do update
set canonical_manga_id = coalesce(excluded.canonical_manga_id, user_canonical_reading_progress.canonical_manga_id),
    canonical_chapter_key = excluded.canonical_chapter_key,
    last_provider = excluded.last_provider,
    last_provider_manga_id = excluded.last_provider_manga_id,
    last_provider_chapter_id = excluded.last_provider_chapter_id,
    language = excluded.language,
    manga_title = excluded.manga_title,
    manga_author = excluded.manga_author,
    cover_image = excluded.cover_image,
    chapter_number = excluded.chapter_number,
    chapter_title = excluded.chapter_title,
    page_index = excluded.page_index,
    total_pages = excluded.total_pages,
    progress_percentage = excluded.progress_percentage,
    read_at = excluded.read_at;
