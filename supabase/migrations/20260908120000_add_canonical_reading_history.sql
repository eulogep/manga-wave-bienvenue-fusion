-- T-3019: chronology is separate from current Resume progress. Legacy history is retained.
create table public.user_reading_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_manga_id bigint not null references public.mangas(id) on delete cascade,
  canonical_chapter_key text not null,
  chapter_number text not null,
  manga_title text not null,
  manga_author text,
  cover_image text,
  page_index integer not null check (page_index >= 0),
  total_pages integer not null check (total_pages > 0),
  provider text not null,
  provider_manga_id text not null,
  provider_chapter_id text not null,
  language text not null,
  started_at timestamptz not null,
  read_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index user_reading_history_recent_idx on public.user_reading_history(user_id, read_at desc, id desc);
create index user_reading_history_session_idx on public.user_reading_history(user_id, canonical_manga_id, canonical_chapter_key, read_at desc);
alter table public.user_reading_history enable row level security;
revoke all on public.user_reading_history from anon, authenticated;
grant select, delete on public.user_reading_history to authenticated;
create policy "Read own history" on public.user_reading_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Delete own history" on public.user_reading_history for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.capture_canonical_reading_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous public.user_reading_history;
  work public.mangas;
begin
  -- Unverified work/chapter identities must not become guessed history entries.
  if new.canonical_manga_id is null or new.canonical_chapter_key !~ '^\d+(\.\d+)?$' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.read_at <= old.read_at then return new; end if;
  -- Serialize aliases/provider contexts of one work, not only one progress PK.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.canonical_manga_id::text, 3019));
  select * into work from public.mangas where id = new.canonical_manga_id;
  select * into previous from public.user_reading_history
    where user_id = new.user_id and canonical_manga_id = new.canonical_manga_id
      and canonical_chapter_key = new.canonical_chapter_key
    order by read_at desc, id desc limit 1 for update;
  if previous.id is not null and new.read_at <= previous.read_at then return new; end if;
  if previous.id is not null and new.read_at - previous.read_at < interval '30 minutes'
    and (new.read_at at time zone 'UTC')::date = (previous.read_at at time zone 'UTC')::date then
    update public.user_reading_history set
      manga_title = work.title, manga_author = work.author, cover_image = work.cover_image,
      chapter_number = new.canonical_chapter_key,
      page_index = new.page_index, total_pages = new.total_pages,
      provider = new.last_provider, provider_manga_id = new.last_provider_manga_id,
      provider_chapter_id = new.last_provider_chapter_id, language = new.language,
      read_at = new.read_at, updated_at = now()
    where id = previous.id;
  else
    insert into public.user_reading_history (
      user_id, canonical_manga_id, canonical_chapter_key, chapter_number,
      manga_title, manga_author, cover_image, page_index, total_pages,
      provider, provider_manga_id, provider_chapter_id, language, started_at, read_at
    ) values (
      new.user_id, new.canonical_manga_id, new.canonical_chapter_key, new.canonical_chapter_key,
      work.title, work.author, work.cover_image, new.page_index, new.total_pages,
      new.last_provider, new.last_provider_manga_id, new.last_provider_chapter_id,
      new.language, new.read_at, new.read_at
    );
  end if;
  return new;
end;
$$;
revoke all on function public.capture_canonical_reading_history() from public, anon, authenticated;
create trigger capture_canonical_reading_history
after insert or update on public.user_canonical_reading_progress
for each row execute function public.capture_canonical_reading_history();
-- No backfill: current progress cannot reconstruct past sessions. No legacy rows removed.
