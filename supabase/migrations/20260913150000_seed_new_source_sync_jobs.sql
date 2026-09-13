-- Seed the initial SYNC_SOURCE queue jobs for the two newly-added sources
-- (MangaPill, Sushi-Scan). The source-sync queue is self-perpetuating only
-- after a source's first successful run (see source-sync/index.ts), so a
-- brand-new source needs one explicit initial enqueue the same way the
-- original six sources were seeded at the tail of
-- 20260828210000_add_source_sync_queue.sql. Purely additive: inserts two
-- rows into the existing source_sync_queue via the existing
-- enqueue_source_sync() function, no schema changes.
select public.enqueue_source_sync(
  jsonb_build_object('type', 'SYNC_SOURCE', 'source', source_id),
  ((position - 1) * 20)::integer
)
from unnest(array['mangapill', 'sushiscan'])
  with ordinality as initial_jobs(source_id, position);
