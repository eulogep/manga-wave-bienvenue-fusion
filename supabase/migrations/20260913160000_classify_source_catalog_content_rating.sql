-- Persist a content_rating for works synced through the generic multi-source
-- catalog pipeline (upsert_source_catalog), which today never writes this
-- column at all — only the MangaDex-specific catalog-sync function does.
-- Concretely this fixes Sushi-Scan: its own genre taxonomy already mixes
-- explicit-content tags (hentai, adulte, 18+, ...) into the general
-- catalogue, but that signal was being discarded on sync instead of
-- classifying the work. Exact-tag matching only (never substring), mirroring
-- src/domain/contentRating.ts so the client and the database agree on the
-- same marker list. This never hides or filters anything by itself — it
-- only labels, so the UI can decide what to do with the label (age-gate).
--
-- Additive and non-destructive: adds one function, replaces one function
-- with the same signature and all of its prior behaviour intact plus this
-- new classification step, touches no existing rows retroactively (a
-- one-off backfill for currently-synced sources is a separate, explicit
-- follow-up if wanted).

create or replace function public.classify_content_rating_from_genres(genres text[])
returns text
language sql
stable
set search_path = public, extensions
as $$
  select case when exists (
    select 1
    from unnest(coalesce(genres, '{}')) as g
    where lower(trim(extensions.unaccent(g))) = any (array[
      'erotique', 'erotic', 'erotica', 'hentai', 'adulte', 'adult', 'pornhwa', '18+'
    ])
  ) then 'erotica' else null end;
$$;

create or replace function public.upsert_source_catalog(
  requested_source_id text,
  items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  canonical_id bigint;
  normalized text;
  v_source_manga_id text;
  source_title text;
  source_status text;
  source_rating numeric;
  source_genres text[];
  source_content_rating text;
  processed integer := 0;
begin
  if jsonb_typeof(items) <> 'array' then
    raise exception 'items doit être un tableau JSON';
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    v_source_manga_id := nullif(item->>'id', '');
    source_title := nullif(item->>'title', '');
    if v_source_manga_id is null or source_title is null then
      continue;
    end if;

    normalized := lower(trim(regexp_replace(source_title, '[^[:alnum:]]+', ' ', 'g')));
    source_status := lower(coalesce(item->>'status', 'ongoing'));
    if source_status not in ('ongoing', 'completed', 'hiatus', 'cancelled') then
      source_status := 'ongoing';
    end if;
    source_rating := case
      when coalesce(item->>'rating', '') ~ '^[0-9]+([.][0-9]+)?$' then least((item->>'rating')::numeric, 10)
      else null
    end;
    source_genres := array(
      select jsonb_array_elements_text(coalesce(item->'genres', '[]'::jsonb))
    );
    -- Prefer an explicit signal from the extractor payload when present
    -- (e.g. a source that already exposes its own rating scale); fall back
    -- to classifying the source's own genre tags otherwise.
    source_content_rating := coalesce(
      nullif(item->>'contentRating', ''),
      public.classify_content_rating_from_genres(source_genres)
    );

    select mapping.manga_id into canonical_id
    from public.manga_source_mappings mapping
    where mapping.source_id = requested_source_id
      and mapping.source_manga_id = v_source_manga_id;

    if canonical_id is null then
      select manga.id into canonical_id
      from public.mangas manga
      where (
        manga.normalized_title = normalized
        or normalized = any (
           select lower(trim(regexp_replace(alias, '[^[:alnum:]]+', ' ', 'g')))
           from unnest(manga.aliases) alias
        )
      )
      and not exists (
        select 1
        from public.manga_source_mappings existing_mapping
        where existing_mapping.manga_id = manga.id
          and existing_mapping.source_id = requested_source_id
      )
      order by manga.id
      limit 1;
    end if;

    if canonical_id is null then
      insert into public.mangas (
        title, normalized_title, cover_image, status, genre, rating, content_rating, last_synced_at
      ) values (
        source_title,
        normalized,
        nullif(item->>'coverUrl', ''),
        source_status,
        coalesce(source_genres, '{}'),
        source_rating,
        source_content_rating,
        now()
      ) returning id into canonical_id;
    else
      -- Never overwrite an existing rating (e.g. one already set from a more
      -- authoritative source) and never clear one back to null.
      update public.mangas
      set cover_image = coalesce(cover_image, nullif(item->>'coverUrl', '')),
          genre = case when cardinality(genre) = 0 then coalesce(source_genres, '{}') else genre end,
          content_rating = coalesce(content_rating, source_content_rating),
          last_synced_at = now()
      where id = canonical_id;
    end if;

    insert into public.manga_source_mappings (
      manga_id,
      source_id,
      source_manga_id,
      source_url,
      source_title,
      normalized_source_title,
      match_confidence,
      metadata,
      last_synced_at
    ) values (
      canonical_id,
      requested_source_id,
      v_source_manga_id,
      nullif(item->>'url', ''),
      source_title,
      normalized,
      case when exists (
        select 1 from public.mangas manga
        where manga.id = canonical_id and manga.normalized_title = normalized
      ) then 1 else 0.8 end,
      item,
      now()
    )
    on conflict on constraint manga_source_mappings_source_id_source_manga_id_key do update
      set source_url = excluded.source_url,
          source_title = excluded.source_title,
          normalized_source_title = excluded.normalized_source_title,
          metadata = excluded.metadata,
          last_synced_at = now();

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.classify_content_rating_from_genres(text[]) from public, anon, authenticated;
grant execute on function public.classify_content_rating_from_genres(text[]) to service_role;
