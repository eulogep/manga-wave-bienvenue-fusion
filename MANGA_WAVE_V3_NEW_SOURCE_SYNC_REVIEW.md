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

## DEPLOYMENT

The required order was followed:

1. Commits `306b81e` and `fe21a7f` were pushed to `origin/main`.
2. The Vercel deployment served both new extractors and passed the production E2E smoke (2/2).
3. Supabase `source-sync` version 4 was deployed with both source identifiers.
4. Only `20260914100000_seed_new_source_sync_jobs.sql` was applied.
5. Local and remote migration histories were confirmed aligned.
6. The initial queue jobs completed on attempt 1: MangaPill synced 10 items and Sushi-Scan synced
   24 items.
7. The resulting canonical mappings were read back from Supabase. The sensitive Sushi-Scan pairs
   remained correct: `La Servante Secrète` / `La-Servante-Secrete-.png`, `Martial Peak` /
   `martial-peak.png`, and `Just Friends` / `JustFriends.jpg`.
8. Each successful run scheduled exactly one new job with a 15-minute delay (`7273` for MangaPill,
   `7274` for Sushi-Scan), both with `read_ct = 0`.

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
LOCAL_REMOTE_ALIGNMENT:        PASS
SOURCE_SYNC_FUNCTION_DEPLOYED: PASS (version 4, ACTIVE)
MANGAPILL_REAL_SYNC:           PASS (10 items, attempt 1)
SUSHISCAN_REAL_SYNC:           PASS (24 items, attempt 1)
CANONICAL_MAPPINGS:            PASS (34 mappings)
SOURCE_HEALTH:                 PASS (closed, no consecutive failures)
QUEUE_CONTINUATION:            PASS (one delayed job per new source)
REMOTE_MIGRATION_APPLIED:      PASS
NEW_SOURCE_SYNC_FINAL:         APPROVED
```

## LOCAL PROTOTYPES

The untracked Python/TypeScript bridge files remain outside Git. They are incomplete, depend on
missing modules or types, and include browser/TLS impersonation and chapter-download behavior that
is outside the accepted provider policy. They are not part of the source-sync implementation.
