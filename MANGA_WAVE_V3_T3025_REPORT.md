# T-3025 — Random Discovery

Date: 2026-09-12

## STATUS

LOCAL_IMPLEMENTATION_COMPLETE / PRODUCTION_DEPLOYMENT_PENDING.

T-3025 adds a canonical random-discovery route without a database migration, runtime metadata
provider, or user-data dependency. The implementation reuses the T-3020 catalog snapshot already
shared by Search, Command Search, Trending, Ranking, and Recommendations.

## PRODUCT BEHAVIOR

- `/random` selects one work from the complete canonical catalog.
- The selected canonical id is stored in the URL (`?id=`), so reload and browser history preserve
  the exact result rather than silently drawing a different work.
- “Une autre” and “Relancer la vague” exclude the current work whenever at least two eligible works
  exist. A one-work pool remains usable instead of showing a false empty state.
- Format (`manga`, `manhwa`, `manhua`) and status filters use AND semantics and round-trip through
  the URL. Unsupported values are discarded.
- An actually empty pool produces an explicit empty state and a reset action.
- The duplicated desktop “Découvrir” link to `/search` is replaced by “Surprise” → `/random`.
  Random is also reachable from Command Search and the existing mobile menu.

## RANDOMNESS AND IDENTITY

The pure `selectRandomWork` domain function deduplicates by canonical numeric id before drawing.
The browser uses `crypto.getRandomValues` when available and a bounded fallback otherwise. Tests
inject deterministic values to prove the first, middle, and final pool positions are reachable.
Random never merges works by title or alias and never calls chapter/reader providers.

## ACCESSIBILITY AND MOBILE

The page has one named main heading, a named filter region, native labelled selects, 44 px controls,
explicit loading/error/empty states, and canonical detail links. Browser inspection at 390×844
found the known Header group extending 6.7 px beyond the viewport. The cause was the mobile padding
on “Connexion”; changing it from 16 px to 8 px below the `sm` breakpoint removes the overflow while
keeping every control visible. The T-3025 mobile test now passes with no horizontal overflow.

## PRE-EXISTING TYPE CONTRACT DEFECTS FIXED

The complete TypeScript check exposed two real defects in already-deployed code:

1. Command Search destructured `items` from a TanStack Query result even though
   `useContinueReading` returns its list as `data`. It now consumes `data`.
2. The checked-in Supabase database types did not declare the already-deployed
   `manga_trending_scores` view or `get_manga_ranking` RPC. Their existing migration-defined
   contracts are now represented in `Database`, removing the unsafe “unknown relation/function”
   compiler failures without changing Trending or Ranking behavior.

No migration or remote database write is part of T-3025.

## VALIDATION

- T-3025 unit tests: **8/8 PASS**.
- Full unit suite: **247/247 PASS**.
- Synthetic T-3025 E2E: **3/3 PASS**.
- Real-catalog T-3025 smoke: **1/1 PASS**; Manga, Manhwa, and Manhua each produced a canonical
  result and a different id after reroll, with zero `/api/extract` provider requests.
- Local visual browser verification: **PASS**; meaningful content, no Vite overlay, expected
  navigation/filter/result controls present.
- T-3020/T-3021/T-3024 local regression: **16 PASS**, 2 real-catalog-only scenarios skipped in the
  synthetic run.
- TypeScript application: **PASS**.
- TypeScript server: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Build: **PASS**, `assets/index-DAjc44xE.js` and `assets/index-BogRH1xc.css`.
- Lockfiles: **unchanged**.
- Database migrations: **none**.
- QA accounts: **none created**.

## ACCEPTANCE

```text
CANONICAL_CATALOG_ONLY:       PASS
UNIFORM_POOL_SELECTION:       PASS
NO_IMMEDIATE_REPEAT:          PASS
URL_EXACT_STATE:              PASS
FILTERS:                      PASS
EMPTY_STATE:                  PASS
MANGA_REAL_DATA:              PASS
MANHWA_REAL_DATA:             PASS
MANHUA_REAL_DATA:             PASS
NO_PROVIDER_RUNTIME_CALL:     PASS
MOBILE_390:                   PASS
ACCESSIBILITY:                PASS
T3020_REGRESSION:             PASS
T3021_REGRESSION:             PASS
T3022_FROZEN:                 PASS
T3024_REGRESSION:             PASS
UNIT_TESTS:                   PASS (247/247)
TYPESCRIPT:                   PASS
ESLINT:                       PASS (0 errors)
BUILD:                        PASS
DATABASE_CHANGE:              NONE
PRODUCTION_SMOKE:             PENDING_DEPLOYMENT
T3025_FINAL:                  READY_TO_DEPLOY
```

## NEXT STEP

Push the prepared T-3025 commit to `origin/main`, let the existing Vercel deployment complete, then
run the production real-catalog smoke and regressions. T-3026 starts only after T-3025 production
acceptance passes.
