-- Référencement durable des entrées synchronisées depuis MangaDex.
-- Cette migration est idempotente et ne modifie aucune donnée utilisateur.

alter table public.mangas
  add column if not exists mangadex_id text,
  add column if not exists artist text,
  add column if not exists content_rating text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_synced_at timestamptz;

create unique index if not exists mangas_mangadex_id_key
  on public.mangas (mangadex_id)
  where mangadex_id is not null;

create index if not exists mangas_last_synced_at_idx
  on public.mangas (last_synced_at desc);
