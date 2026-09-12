# P4 — Route-Level JavaScript Delivery

Date: 2026-09-12

## STATUS

PRODUCTION_VALIDATED / APPROVED.

## MEASURED BOTTLENECK

The production application delivered every page through one 803.21 kB JavaScript file
(`assets/index-6TQLAZAj.js`, 233.83 kB gzip). The initial route therefore parsed Reader, Manga
Detail, Library, History, Search, Ranking, Trending, Random, Auth, Not Found and Command Search code
before the user requested any of those surfaces.

## IMPLEMENTATION

- The homepage remains eager to preserve its immediate rendering path.
- Ten secondary pages now use route-level `React.lazy` imports behind one accessible `Suspense`
  status boundary.
- Command Search mounts and downloads only after its provider state opens through the Header button
  or keyboard shortcut.
- Vite HTML module preloads are disabled. Chromium proved that those generated preload requests
  failed during a full offline reopen even when their responses existed in Cache Storage. Native ES
  imports remain split and the service worker now serves them correctly after document control.
- The offline test now proves a previously visited lazy Search route reopens without network, all
  application assets resolve from cache, and neither REST nor extractor API requests enter Cache
  Storage.
- No dependency, lockfile, database, migration or remote configuration changed.

## BUILD RESULT

- Previous single JavaScript bundle: **803.21 kB raw / 233.83 kB gzip**.
- New entry chunk: **153.39 kB raw / 44.06 kB gzip**.
- Entry chunk reduction: **80.9% raw / 81.2% gzip**.
- Fresh Chromium homepage transfer: **195,959 encoded JavaScript bytes**.
- Reader: deferred **33.78 kB** chunk.
- Manga Detail: deferred **33.29 kB** chunk.
- Command Search: deferred **49.04 kB** chunk.
- Search, Library, History, Auth, Trending, Ranking, Random and Not Found each load on demand.

The entry-chunk reduction is separate from shared modules required by the homepage. The browser
measurement accounts for the actual initial script graph and confirms that all named secondary
chunks are absent until their route or interaction is requested.

## VALIDATION

- Route-splitting unit tests: **3/3 PASS**.
- Full unit suite: **259/259 PASS**.
- Route and performance E2E: **2/2 PASS**, covering six lazy routes plus deferred Command Search.
- Combined P4 and T-3021 E2E: **12/12 PASS**.
- Command Search regression: **7/7 PASS**.
- Offline previously visited route: **PASS**.
- MangaCard desktop/mobile regression: **2/2 PASS**.
- TypeScript application: **PASS**.
- TypeScript build configuration: **PASS**.
- TypeScript server build: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Production application build: **PASS**, `assets/index-BAQZBuH0.js` and
  `assets/index-CXOkOY9i.css`.
- Remote `origin/main`: **PASS**, `e5f99690c5fc751d742722c9f1aa6dee2b8feaa6`.
- Production asset: **PASS**, `assets/index-BAQZBuH0.js`.
- Production initial JavaScript transfer: **203,529 encoded bytes**.
- Production route and regression smoke: **12/12 PASS**.
- Lockfiles: **unchanged**.
- Database and remote writes: **none**.

## ACCEPTANCE

```text
MONOLITHIC_BUNDLE_REPRODUCED:  PASS
ROUTE_LEVEL_SPLITTING:         PASS
HOMEPAGE_EAGER_PATH:           PASS
SECONDARY_ROUTES_DEFERRED:     PASS
COMMAND_SEARCH_DEFERRED:       PASS
ACCESSIBLE_LOADING_STATE:      PASS
LOCAL_INITIAL_JS_BYTES:        195959
PROD_INITIAL_JS_BYTES:         203529
ENTRY_CHUNK_RAW_REDUCTION:     80.9%
ENTRY_CHUNK_GZIP_REDUCTION:    81.2%
OFFLINE_LAZY_ROUTE:            PASS
API_CACHE_EXCLUSION:           PASS
ROUTE_E2E:                     PASS (2/2)
P4_T3021_REGRESSION:           PASS (12/12)
UNIT_TESTS:                    PASS (259/259)
TYPESCRIPT:                    PASS
ESLINT:                        PASS (0 errors)
BUILD:                         PASS
LOCKFILES:                     PRESERVED
PRODUCTION_ASSET:              assets/index-BAQZBuH0.js
PRODUCTION_SMOKE:              PASS (12/12)
P4_PERFORMANCE_FINAL:          APPROVED
```

## NEXT STEP

Continue P4 accessibility measurement. Any later production push remains subject to explicit
authorization.
