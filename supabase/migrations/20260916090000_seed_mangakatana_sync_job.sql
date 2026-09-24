-- Seed the initial SYNC_SOURCE queue job for the newly-added MangaKatana
-- source, mirroring 20260914100000_seed_new_source_sync_jobs.sql (the
-- MangaPill/Sushi-Scan seed) for the same reason: the source-sync queue is
-- self-perpetuating only after a source's first successful run, so a
-- brand-new source needs one explicit initial enqueue. Purely additive:
-- inserts one row into the existing source_sync_queue via the existing
-- enqueue_source_sync() function, no schema changes.
--
-- WeebCentral was evaluated alongside MangaKatana and built the same way,
-- but production verification (from Vercel's IP ranges, not this
-- developer's own) found it is in fact behind Cloudflare and silently
-- blocks non-residential origins — invisible during initial research from
-- a residential IP, which never tripped it. That extractor was removed
-- rather than shipped non-functional or worked around with a proxy, so
-- only MangaKatana (verified working end-to-end in production) is seeded
-- here.
--
-- Deployment order: publish the Vercel extractor, deploy source-sync with
-- mangakatana added to SOURCE_IDS, then apply this migration. Applying it
-- before source-sync is deployed would archive the job as an unknown source.
select public.enqueue_source_sync(
  jsonb_build_object('type', 'SYNC_SOURCE', 'source', 'mangakatana'),
  0
);
