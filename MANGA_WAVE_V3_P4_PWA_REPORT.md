# P4 — Installable App Shell and Offline Navigation

Date: 2026-09-12

## STATUS

LOCAL_VALIDATED / PRODUCTION_DEPLOYMENT_PENDING.

## OBSERVED GAP

The production application exposed no Web App Manifest and registered no service worker. Manga
Wave could therefore neither present an installable application identity nor reopen its client
shell when connectivity disappeared.

This first offline capability is intentionally limited to application code and public branding.
Manga pages, provider responses, API calls, authentication data and reading content remain outside
the cache.

## IMPLEMENTATION

- A French `manifest.webmanifest` defines the Manga Wave application name, standalone display,
  theme colors, scope and start URL.
- Dedicated 192 px and maskable 512 px PNG icons use the established dark navy and coral wave mark.
- Production startup registers a same-origin service worker after the page load event.
- Installation precaches the root document, its hashed CSS/JavaScript assets, the manifest and the
  two public icons.
- Navigation uses network-first behavior and falls back to the cached SPA shell only when the
  network is unavailable.
- Hashed shell assets use cache-first behavior. The asset cache is bounded and old Manga Wave cache
  versions are removed without touching unrelated origin caches.
- API paths, external images, provider traffic, manga chapters and user data are never cached by
  this worker.
- Document metadata now declares French content, Manga Wave descriptions, theme color, manifest,
  application icon and product-owned social metadata.
- No dependency, lockfile, database, migration or remote configuration changed.

## VALIDATION

- PWA unit tests: **3/3 PASS**.
- Offline Chromium E2E: **1/1 PASS**; `/search` reopens with the correct client route while the
  browser context is offline.
- Combined P4 browser regression: **3/3 PASS**.
- Full unit suite: **256/256 PASS**.
- TypeScript application: **PASS**.
- TypeScript server build: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Production application build: **PASS**, `assets/index-6TQLAZAj.js` and
  `assets/index-CkN5cte7.css`.
- Built manifest, worker and 192/512 px icons: **PASS**.
- PWA icon visual inspection: **PASS**.
- Lockfiles: **unchanged**.
- Database and remote writes: **none**.

## ACCEPTANCE

```text
PWA_BASELINE_REPRODUCED:       PASS
WEB_APP_MANIFEST:              PASS
APPLICATION_IDENTITY:          PASS
ICON_192:                      PASS
ICON_512_MASKABLE:             PASS
SERVICE_WORKER_REGISTRATION:   PASS
APP_SHELL_PRECACHE:            PASS
OFFLINE_CLIENT_ROUTE:          PASS
API_CACHE_EXCLUSION:           PASS
PRIVATE_DATA_CACHE_EXCLUSION:  PASS
BOUNDED_ASSET_CACHE:           PASS
P4_BROWSER_REGRESSION:         PASS (3/3)
UNIT_TESTS:                    PASS (256/256)
TYPESCRIPT:                    PASS
ESLINT:                        PASS (0 errors)
BUILD:                         PASS
LOCKFILES:                     PRESERVED
PRODUCTION_SMOKE:              PENDING_DEPLOYMENT
P4_PWA_FINAL:                  READY_TO_DEPLOY
```

## NEXT STEP

Commit this isolated PWA foundation, push only after explicit authorization, then verify manifest,
service-worker control and offline route recovery against the deployed production origin. Continue
P4 with performance and accessibility measurements after production acceptance.
