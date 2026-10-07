-- Rend l’identifiant MangaDex utilisable par l’upsert PostgREST.
-- PostgreSQL autorise plusieurs valeurs NULL dans une contrainte UNIQUE, ce qui
-- préserve les entrées éventuellement créées hors MangaDex.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mangas'::regclass
      and conname = 'mangas_mangadex_id_key'
  ) then
    drop index if exists public.mangas_mangadex_id_key;
    alter table public.mangas
      add constraint mangas_mangadex_id_key unique (mangadex_id);
  end if;
end;
$$;
