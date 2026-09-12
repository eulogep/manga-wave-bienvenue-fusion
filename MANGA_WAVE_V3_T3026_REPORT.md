# T-3026 — Manga Detail V2

Date: 2026-09-12

## STATUS

LOCAL_IMPLEMENTATION_COMPLETE / PRODUCTION_DEPLOYMENT_PENDING.

## ROOT CAUSE

The canonical detail route still loaded `canonical_manga_catalog`, a view created before the
T-3020 enrichment migration. That view does not expose origin, metadata provenance, enrichment
confidence, artist, content rating, or metadata freshness. The page consequently displayed a
weaker record and filled several fields from the currently resolved reading provider. A provider
outage could therefore remove useful detail even though the canonical database remained healthy.

## IMPLEMENTATION

- The source-less `/manga/:id` route now reads the canonical `mangas` record and its verified
  `manga_source_mappings` directly. These two bounded queries replace the stale view read.
- Reading-source ranking, strict identity, fallback, Follow, Reader navigation, direct provider
  routes, chapter loading, and manual source selection remain unchanged.
- The overview now presents the validated publication type, origin, canonical aliases, rating,
  available-edition count, and subtle metadata provenance/confidence.
- Provider failure is isolated to chapter availability. Canonical title, cover, synopsis and
  enrichment remain visible with an honest retry state.
- The hero uses the existing Manga Wave visual language, artwork-led composition, responsive
  wrapping and native semantic labels. The chapter-list architecture is intentionally left for
  T-3027.
- Checked-in Supabase types now include the five additive T-3020 columns already deployed on
  `mangas`. There is no schema or database write in T-3026.

## VALIDATION

- T-3026 unit tests: **3/3 PASS**.
- Full unit suite: **250/250 PASS**.
- Controlled T-3026 E2E: **2/2 PASS** (provider outage and unknown canonical id).
- Real-catalog T-3026 E2E: **1/1 PASS**.
- T-3024/T-3025 E2E regression: **5 PASS**, 1 real-only scenario skipped.
- TypeScript application: **PASS**.
- TypeScript server: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Production build: **PASS**, `assets/index-ti5Q81B8.js` and `assets/index-CYDPpfSu.css`.
- Real browser visual check: **PASS**, no console error.
- Mobile 390 px: **PASS**, no horizontal overflow.
- Lockfiles: **unchanged**.
- Database migrations and remote writes: **none**.
- QA accounts: **none created**.

## ACCEPTANCE

```text
CANONICAL_IDENTITY:             PASS
CANONICAL_METADATA_PRIMARY:    PASS
ALIASES:                       PASS
MANGA_MANHWA_MANHUA_LABEL:     PASS
ORIGIN:                        PASS
METADATA_PROVENANCE:           PASS
PROVIDER_OUTAGE_ISOLATION:     PASS
READ_ACTION:                   PASS
FOLLOW:                        PASS
SOURCE_FALLBACK:               PASS
SOURCE_OVERRIDE_SECONDARY:     PASS
SIMILAR_WORKS:                 PASS
NOT_FOUND_STATE:               PASS
MOBILE_390:                    PASS
UNIT_TESTS:                    PASS (250/250)
TYPESCRIPT:                    PASS
ESLINT:                        PASS (0 errors)
BUILD:                         PASS
DATABASE_CHANGE:               NONE
PRODUCTION_SMOKE:              PENDING_DEPLOYMENT
T3026_FINAL:                   READY_TO_DEPLOY
```

## NEXT STEP

Push the prepared T-3025 closure report and T-3026 implementation, let the existing Vercel Git
deployment complete, then run the controlled and real-catalog production smoke. T-3027 begins only
after T-3026 production acceptance passes.
