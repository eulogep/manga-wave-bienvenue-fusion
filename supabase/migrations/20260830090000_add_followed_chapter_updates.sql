-- T-3013: durable per-user state for newly detected logical chapters.
-- Detection is in-app; outbound notifications remain outside this ticket.

create table if not exists public.user_followed_chapter_state (
  user_id uuid not null,
  manga_id bigint not null,
  canonical_chapter_key text not null,
  chapter_number text not null,
  chapter_title text,
  provider text not null,
  provider_manga_id text not null,
  provider_chapter_id text not null,
  language text not null default 'und',
  first_seen_at timestamptz not null default now(),
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, manga_id, canonical_chapter_key),
  foreign key (user_id, manga_id)
    references public.user_favorites(user_id, manga_id)
    on delete cascade
);

create index if not exists user_followed_chapter_state_unread_idx
on public.user_followed_chapter_state (user_id, first_seen_at desc)
where read_at is null;

drop trigger if exists user_followed_chapter_state_set_updated_at
on public.user_followed_chapter_state;
create trigger user_followed_chapter_state_set_updated_at
before update on public.user_followed_chapter_state
for each row execute function public.set_updated_at();

alter table public.user_followed_chapter_state enable row level security;
grant select, insert, update, delete on public.user_followed_chapter_state to authenticated;

create policy "Followed chapter state is visible to its owner"
on public.user_followed_chapter_state for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Followed chapter state is created by its owner"
on public.user_followed_chapter_state for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Followed chapter state is updated by its owner"
on public.user_followed_chapter_state for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Followed chapter state is deleted by its owner"
on public.user_followed_chapter_state for delete to authenticated
using ((select auth.uid()) = user_id);
