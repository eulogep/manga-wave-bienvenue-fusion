-- Relie les chapitres locaux à MangaDex sans ouvrir d’écriture catalogue aux clients.
-- Les valeurs nulles restent admises pour les anciens chapitres éventuellement créés hors MangaDex.

alter table public.chapters
  add column if not exists mangadex_id text,
  add column if not exists translated_language text,
  add column if not exists volume text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chapters'::regclass
      and conname = 'chapters_mangadex_id_key'
  ) then
    alter table public.chapters
      add constraint chapters_mangadex_id_key unique (mangadex_id);
  end if;
end;
$$;

create index if not exists chapters_manga_release_date_idx
  on public.chapters (manga_id, release_date desc);
