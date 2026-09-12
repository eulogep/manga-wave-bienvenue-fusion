-- T-3020: additive provenance fields for offline canonical metadata enrichment.
-- No existing catalog or user-owned data is rewritten by this migration.

alter table public.mangas
  add column if not exists country_of_origin text,
  add column if not exists metadata_source text,
  add column if not exists metadata_external_id text,
  add column if not exists metadata_confidence text,
  add column if not exists metadata_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mangas'::regclass and conname = 'mangas_country_of_origin_format'
  ) then
    alter table public.mangas add constraint mangas_country_of_origin_format
      check (country_of_origin is null or country_of_origin ~ '^[A-Z]{2}$') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mangas'::regclass and conname = 'mangas_metadata_confidence_values'
  ) then
    alter table public.mangas add constraint mangas_metadata_confidence_values
      check (metadata_confidence is null or metadata_confidence in ('EXACT', 'HIGH')) not valid;
  end if;
end;
$$;

create unique index if not exists mangas_metadata_external_identity_key
  on public.mangas (metadata_source, metadata_external_id)
  where metadata_source is not null and metadata_external_id is not null;

comment on column public.mangas.country_of_origin is
  'ISO 3166-1 alpha-2 origin supplied by a reviewed canonical metadata provider.';
comment on column public.mangas.metadata_source is
  'Provider responsible for the current canonical enrichment fields.';
comment on column public.mangas.metadata_external_id is
  'Stable identifier at metadata_source; never a reading-provider chapter identifier.';
comment on column public.mangas.metadata_confidence is
  'Automatic enrichment confidence. Only EXACT and HIGH may be persisted.';
