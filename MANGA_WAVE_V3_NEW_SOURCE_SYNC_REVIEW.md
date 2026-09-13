# MangaPill and Sushi-Scan Source Sync Review

Date: 2026-09-13

## REVIEWED COMMIT

`306b81e` — `feat: wire MangaPill and Sushi-Scan into source-sync`

The commit has the right product intent and contains only two source-sync changes. It adds the two
source identifiers to the Edge Function gate and prepares two initial queue jobs. No destructive
SQL, lockfile or unrelated product change is present.

## BLOCKERS FOUND

1. The seed migration was named `20260913150000`, but remote Supabase already contains
   `20260914090000`. Applying it would require an out-of-order migration path.
2. The Sushi-Scan homepage parser allowed one anchor match to cross into the following card. A
   production response proved that `La Servante Secrète`, `Martial Peak` and `Just Friends` received
   the next manga's cover. Enabling canonical sync would have persisted those incorrect mappings.
3. The source documentation still described canonical source sync as unimplemented.
4. No regression test covered the source allowlist, additive seed or title/cover association.

## CORRECTIONS

- Renamed the unapplied seed to `20260914100000_seed_new_source_sync_jobs.sql`, after the latest
  remote migration.
- Restricted Sushi-Scan parsing to one complete anchor at a time and ignored text-only anchors.
- Added exact regression fixtures for title/cover binding and HTML entity decoding.
- Added static source-sync and additive migration tests.
- Documented the required deployment order and updated the new-source report.

## VERIFIED DEPLOYMENT ORDER

1. Push the parser/source-sync commits and wait for the Vercel extractor deployment.
2. Smoke both `/api/extract/popular/...` endpoints and verify representative title/cover pairs.
3. Deploy the updated Supabase `source-sync` Edge Function.
4. Apply only `20260914100000_seed_new_source_sync_jobs.sql`.
5. Verify successful sync runs, canonical mappings, continuing queue jobs and source health.

Applying step 4 before step 3 can cause the current Edge Function to archive both messages as
unknown sources.

## VALIDATION

```text
ORIGINAL_COMMIT_SCOPE:         PASS
ORIGINAL_SQL_ADDITIVE:         PASS
ORIGINAL_MIGRATION_ORDER:      FAIL
ORIGINAL_SUSHISCAN_MAPPING:    FAIL
CORRECTED_MIGRATION_ORDER:     PASS
CORRECTED_SUSHISCAN_MAPPING:   PASS
TARGETED_TESTS:                PASS (12/12)
FULL_UNIT_TESTS:               PASS (271/271)
TYPESCRIPT:                    PASS
SERVER_BUILD:                  PASS
APP_BUILD:                     PASS
ESLINT:                        PASS (0 errors)
REMOTE_MIGRATION_APPLIED:      NO
SOURCE_SYNC_FUNCTION_DEPLOYED: NO
NEW_SOURCE_SYNC_FINAL:         READY_FOR_ORDERED_DEPLOYMENT
```

## LOCAL PROTOTYPES

The untracked Python/TypeScript bridge files remain outside Git. They are incomplete, depend on
missing modules or types, and include browser/TLS impersonation and chapter-download behavior that
is outside the accepted provider policy. They are not part of the source-sync implementation.
