-- Seed the initial SYNC_SOURCE queue jobs for the two newly-added sources
-- (WeebCentral, MangaKatana), mirroring
-- 20260914100000_seed_new_source_sync_jobs.sql (the MangaPill/Sushi-Scan
-- seed) for the same reason: the source-sync queue is self-perpetuating
-- only after a source's first successful run, so a brand-new source needs
-- one explicit initial enqueue. Purely additive: inserts two rows into the
-- existing source_sync_queue via the existing enqueue_source_sync()
-- function, no schema changes.
-- Deployment order: publish the Vercel extractors, deploy source-sync with
-- both new ids added to SOURCE_IDS, then apply this migration. Applying it
-- before source-sync is deployed would archive the jobs as unknown sources.
select public.enqueue_source_sync(
  jsonb_build_object('type', 'SYNC_SOURCE', 'source', source_id),
  ((position - 1) * 20)::integer
)
from unnest(array['weebcentral', 'mangakatana'])
  with ordinality as initial_jobs(source_id, position);
