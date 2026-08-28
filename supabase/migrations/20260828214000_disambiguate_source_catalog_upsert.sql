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
  v_processed integer := 0;
begin
  if jsonb_typeof(items) <> 'array' then
    raise exception 'items doit etre un tableau JSON';
  end if;

  for v_item in select value from jsonb_array_elements(items)
  loop
    v_canonical_id := null;
    v_source_manga_id := nullif(v_item->>'id', '');
    v_source_title := nullif(v_item->>'title', '');
    if v_source_manga_id is null or v_source_title is null then
      continue;
    end if;

    v_normalized := lower(trim(regexp_replace(v_source_title, '[^[:alnum:]]+', ' ', 'g')));
    v_source_status := lower(coalesce(v_item->>'status', 'ongoing'));
    if v_source_status not in ('ongoing', 'completed', 'hiatus', 'cancelled') then
      v_source_status := 'ongoing';
    end if;
    v_source_rating := case
      when coalesce(v_item->>'rating', '') ~ '^[0-9]+([.][0-9]+)?$' then least((v_item->>'rating')::numeric, 10)
      else null
    end;
    v_source_genres := array(
      select jsonb_array_elements_text(coalesce(v_item->'genres', '[]'::jsonb))
    );

    select mapping.manga_id into v_canonical_id
    from public.manga_source_mappings mapping
    where mapping.source_id = requested_source_id
      and mapping.source_manga_id = v_source_manga_id;

    if v_canonical_id is null then
      select manga.id into v_canonical_id
      from public.mangas manga
      where (
        manga.normalized_title = v_normalized
        or v_normalized = any (
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

    if v_canonical_id is null then
      insert into public.mangas (
        title, normalized_title, cover_image, status, genre, rating, last_synced_at
      ) values (
        v_source_title, v_normalized, nullif(v_item->>'coverUrl', ''),
        v_source_status, coalesce(v_source_genres, '{}'), v_source_rating, now()
      ) returning id into v_canonical_id;
    else
      update public.mangas
      set cover_image = coalesce(cover_image, nullif(v_item->>'coverUrl', '')),
          genre = case when cardinality(genre) = 0 then coalesce(v_source_genres, '{}') else genre end,
          last_synced_at = now()
      where id = v_canonical_id;
    end if;

    insert into public.manga_source_mappings (
      manga_id, source_id, source_manga_id, source_url, source_title,
      normalized_source_title, match_confidence, metadata, last_synced_at
    ) values (
      v_canonical_id, requested_source_id, v_source_manga_id, nullif(v_item->>'url', ''),
      v_source_title, v_normalized,
      case when exists (
        select 1 from public.mangas manga
        where manga.id = v_canonical_id and manga.normalized_title = v_normalized
      ) then 1 else 0.8 end,
      v_item, now()
    )
    on conflict on constraint manga_source_mappings_source_id_source_manga_id_key do update
      set source_url = excluded.source_url,
          source_title = excluded.source_title,
          normalized_source_title = excluded.normalized_source_title,
          metadata = excluded.metadata,
          last_synced_at = now();

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.upsert_source_catalog(text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_source_catalog(text, jsonb) to service_role;
