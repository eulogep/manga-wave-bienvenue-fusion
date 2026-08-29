-- T-3007: stabilize the existing `mangas` canonical identity and its source mappings.
-- Forward-only: no content or user-owned row is deleted.

create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_manga_title(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select trim(regexp_replace(
    lower(extensions.unaccent(coalesce(value, ''))),
    '[^[:alnum:]]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.set_manga_normalized_title()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  new.normalized_title := public.normalize_manga_title(new.title);
  return new;
end;
$$;

update public.mangas
set normalized_title = public.normalize_manga_title(title)
where normalized_title is distinct from public.normalize_manga_title(title);

drop trigger if exists mangas_set_normalized_title on public.mangas;
create trigger mangas_set_normalized_title
before insert or update of title on public.mangas
for each row execute function public.set_manga_normalized_title();

alter table public.manga_source_mappings
  add column if not exists language text not null default 'und',
  add column if not exists available boolean not null default true;

update public.manga_source_mappings
set language = coalesce(
  nullif(metadata->>'language', ''),
  nullif(metadata->>'lang', ''),
  case source_id
    when 'originmanga' then 'fr'
    when 'crunchyscan' then 'fr'
    when 'asurascans' then 'en'
    else 'multi'
  end
)
where language = 'und';

create index if not exists manga_source_mappings_availability_idx
on public.manga_source_mappings (manga_id, available, language);

create or replace view public.canonical_manga_catalog
with (security_invoker = true)
as
select
  manga.id as canonical_id,
  manga.normalized_title,
  manga.title,
  manga.aliases as alternative_titles,
  manga.author,
  manga.manga_type as type,
  manga.status,
  manga.cover_image as cover,
  manga.description,
  manga.genre as genres,
  manga.rating,
  count(mapping.id) filter (where mapping.available) as source_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider', mapping.source_id,
        'external_id', mapping.source_manga_id,
        'title', mapping.source_title,
        'language', mapping.language,
        'available', mapping.available,
        'url', mapping.source_url,
        'last_synced_at', mapping.last_synced_at
      ) order by mapping.source_id
    ) filter (where mapping.id is not null),
    '[]'::jsonb
  ) as sources
from public.mangas manga
left join public.manga_source_mappings mapping on mapping.manga_id = manga.id
group by manga.id;

grant select on public.canonical_manga_catalog to anon, authenticated;

create or replace function public.find_canonical_manga(candidate_title text)
returns table (
  manga_id bigint,
  title text,
  confidence numeric,
  match_reason text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with candidate as (
    select public.normalize_manga_title(candidate_title) as normalized
  )
  select
    manga.id,
    manga.title,
    case
      when manga.normalized_title = candidate.normalized then 1::numeric
      when exists (
        select 1 from unnest(manga.aliases) alias
        where public.normalize_manga_title(alias) = candidate.normalized
      ) then 0.95::numeric
      else round(similarity(manga.normalized_title, candidate.normalized)::numeric, 3)
    end,
    case
      when manga.normalized_title = candidate.normalized then 'exact_title'
      when exists (
        select 1 from unnest(manga.aliases) alias
        where public.normalize_manga_title(alias) = candidate.normalized
      ) then 'exact_alias'
      else 'fuzzy_title'
    end
  from public.mangas manga
  cross join candidate
  where manga.normalized_title = candidate.normalized
     or exists (
       select 1 from unnest(manga.aliases) alias
       where public.normalize_manga_title(alias) = candidate.normalized
     )
     or similarity(manga.normalized_title, candidate.normalized) >= 0.3
  order by 3 desc, manga.id
  limit 10;
$$;

grant execute on function public.find_canonical_manga(text) to anon, authenticated;

create or replace function public.upsert_source_catalog(requested_source_id text, items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item jsonb;
  v_canonical_id bigint;
  v_normalized text;
  v_source_manga_id text;
  v_source_title text;
  v_source_status text;
  v_source_rating numeric;
  v_source_genres text[];
  v_source_aliases text[];
  v_source_author text;
  v_source_type text;
  v_source_language text;
  v_source_available boolean;
  v_match_confidence numeric(4, 3);
  v_processed integer := 0;
begin
  if jsonb_typeof(items) <> 'array' then
    raise exception 'items doit etre un tableau JSON';
  end if;

  for v_item in select value from jsonb_array_elements(items)
  loop
    v_canonical_id := null;
    v_match_confidence := 1;
    v_source_manga_id := nullif(v_item->>'id', '');
    v_source_title := nullif(v_item->>'title', '');
    if v_source_manga_id is null or v_source_title is null then continue; end if;

    v_normalized := public.normalize_manga_title(v_source_title);
    if v_normalized = '' then continue; end if;
    perform pg_advisory_xact_lock(hashtext(v_normalized));

    v_source_status := lower(coalesce(v_item->>'status', 'ongoing'));
    if v_source_status not in ('ongoing', 'completed', 'hiatus', 'cancelled') then v_source_status := 'ongoing'; end if;
    v_source_rating := case
      when coalesce(v_item->>'rating', '') ~ '^[0-9]+([.][0-9]+)?$' then least((v_item->>'rating')::numeric, 10)
      else null
    end;
    v_source_genres := array(select jsonb_array_elements_text(coalesce(v_item->'genres', '[]'::jsonb)));
    v_source_aliases := array(select jsonb_array_elements_text(
      case
        when jsonb_typeof(v_item->'altTitles') = 'array' then v_item->'altTitles'
        when jsonb_typeof(v_item->'alternativeTitles') = 'array' then v_item->'alternativeTitles'
        else '[]'::jsonb
      end
    ));
    v_source_author := nullif(v_item->>'author', '');
    v_source_type := nullif(coalesce(v_item->>'type', v_item->>'mangaType'), '');
    v_source_language := coalesce(nullif(v_item->>'language', ''), nullif(v_item->>'lang', ''), 'und');
    v_source_available := lower(coalesce(v_item->>'available', 'true')) not in ('false', '0', 'no');

    select mapping.manga_id into v_canonical_id
    from public.manga_source_mappings mapping
    where mapping.source_id = requested_source_id
      and mapping.source_manga_id = v_source_manga_id;

    if v_canonical_id is null then
      select manga.id,
        case when manga.normalized_title = v_normalized then 1 else 0.95 end
      into v_canonical_id, v_match_confidence
      from public.mangas manga
      where (
        manga.normalized_title = v_normalized
        or exists (
          select 1 from unnest(manga.aliases) alias
          where public.normalize_manga_title(alias) = v_normalized
        )
        or exists (
          select 1 from unnest(v_source_aliases) candidate_alias
          where public.normalize_manga_title(candidate_alias) = manga.normalized_title
        )
      )
      and (v_source_author is null or manga.author is null or public.normalize_manga_title(manga.author) = public.normalize_manga_title(v_source_author))
      and (v_source_type is null or manga.manga_type is null or lower(manga.manga_type) = lower(v_source_type))
      and not exists (
        select 1 from public.manga_source_mappings existing_mapping
        where existing_mapping.manga_id = manga.id and existing_mapping.source_id = requested_source_id
      )
      order by case when manga.normalized_title = v_normalized then 0 else 1 end, manga.id
      limit 1;
    end if;

    if v_canonical_id is null then
      insert into public.mangas (
        title, normalized_title, aliases, author, manga_type, cover_image, status, genre, rating, last_synced_at
      ) values (
        v_source_title, v_normalized, coalesce(v_source_aliases, '{}'), v_source_author, v_source_type,
        nullif(v_item->>'coverUrl', ''), v_source_status, coalesce(v_source_genres, '{}'), v_source_rating, now()
      ) returning id into v_canonical_id;
      v_match_confidence := 1;
    else
      update public.mangas manga
      set aliases = array(
            select distinct alias_value
            from unnest(manga.aliases || coalesce(v_source_aliases, '{}')) alias_value
            where public.normalize_manga_title(alias_value) <> manga.normalized_title
          ),
          author = coalesce(manga.author, v_source_author),
          manga_type = coalesce(manga.manga_type, v_source_type),
          cover_image = coalesce(manga.cover_image, nullif(v_item->>'coverUrl', '')),
          genre = case when cardinality(manga.genre) = 0 then coalesce(v_source_genres, '{}') else manga.genre end,
          rating = coalesce(manga.rating, v_source_rating),
          last_synced_at = now()
      where manga.id = v_canonical_id;
    end if;

    insert into public.manga_source_mappings (
      manga_id, source_id, source_manga_id, source_url, source_title,
      normalized_source_title, match_confidence, metadata, language, available, last_synced_at
    ) values (
      v_canonical_id, requested_source_id, v_source_manga_id, nullif(v_item->>'url', ''),
      v_source_title, v_normalized, v_match_confidence, v_item, v_source_language,
      v_source_available, now()
    )
    on conflict on constraint manga_source_mappings_source_id_source_manga_id_key do update
      set source_url = excluded.source_url,
          source_title = excluded.source_title,
          normalized_source_title = excluded.normalized_source_title,
          metadata = excluded.metadata,
          language = excluded.language,
          available = excluded.available,
          last_synced_at = now();

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.upsert_source_catalog(text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_source_catalog(text, jsonb) to service_role;
