create table if not exists public.user_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  source_manga_id text not null,
  source_chapter_id text not null,
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
  primary key (user_id, source_id, source_manga_id)
);

create index if not exists user_reading_progress_recent_idx
on public.user_reading_progress (user_id, read_at desc);

drop trigger if exists user_reading_progress_set_updated_at on public.user_reading_progress;
create trigger user_reading_progress_set_updated_at
before update on public.user_reading_progress
for each row execute function public.set_updated_at();

alter table public.user_reading_progress enable row level security;
grant select, insert, update, delete on public.user_reading_progress to authenticated;

create policy "Reading progress is visible to its owner"
on public.user_reading_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Reading progress is created by its owner"
on public.user_reading_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Reading progress is updated by its owner"
on public.user_reading_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Reading progress is deleted by its owner"
on public.user_reading_progress for delete to authenticated
using ((select auth.uid()) = user_id);
