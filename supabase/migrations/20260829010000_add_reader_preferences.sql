create table if not exists public.user_reader_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reading_mode text not null default 'single_page'
    check (reading_mode in ('vertical', 'webtoon', 'single_page', 'double_page', 'manga_rtl', 'comic_ltr')),
  fit_mode text not null default 'height'
    check (fit_mode in ('width', 'height', 'original')),
  zoom numeric(3, 2) not null default 1 check (zoom between 0.5 and 2),
  page_gap integer not null default 8 check (page_gap between 0 and 48),
  background text not null default 'ink' check (background in ('ink', 'night', 'paper')),
  brightness numeric(3, 2) not null default 1 check (brightness between 0.5 and 1.25),
  preload_count integer not null default 3 check (preload_count between 1 and 8),
  reading_direction text not null default 'rtl' check (reading_direction in ('rtl', 'ltr')),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_reader_preferences_set_updated_at on public.user_reader_preferences;
create trigger user_reader_preferences_set_updated_at
before update on public.user_reader_preferences
for each row execute function public.set_updated_at();

alter table public.user_reader_preferences enable row level security;
grant select, insert, update, delete on public.user_reader_preferences to authenticated;

create policy "Les préférences lecteur sont lisibles par leur propriétaire"
on public.user_reader_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Les préférences lecteur sont ajoutées par leur propriétaire"
on public.user_reader_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Les préférences lecteur sont modifiées par leur propriétaire"
on public.user_reader_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Les préférences lecteur sont supprimées par leur propriétaire"
on public.user_reader_preferences for delete to authenticated
using ((select auth.uid()) = user_id);
