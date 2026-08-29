# Manga Wave V3 — T-3007 Canonical Manga

STATUS: PASS

CANONICAL_MODEL: PASS

TITLE_NORMALIZATION: PASS

ALIAS_MATCHING: PASS

CROSS_SOURCE_DEDUPLICATION: PASS

FALSE_MERGE_PROTECTION: PASS

SOURCE_MAPPINGS: PASS

DATABASE_MIGRATION: PASS

DATABASE_LINT: PASS

REST_CONTRACT: PASS

AUTOMATED_TESTS: PASS — 6/6

LINT: PASS — 0 error

BUILD: PASS

P0_REGRESSION: PASS

T-3008: NOT_STARTED

T-3009: NOT_STARTED

## Implemented contract

- One `CanonicalManga` represents one work and contains deterministic identity, normalized title, aliases, metadata and distinct source mappings.
- Automatic merging is deliberately limited to exact normalized titles and declared aliases. Fuzzy results remain suggestions in the database RPC and never trigger a destructive merge.
- Search with “Toutes les sources” renders one canonical card and reports the number of readable providers. Provider-specific searches remain available.
- A readable mapping is selected deterministically only to keep the existing detail navigation functional. No health scoring or Source Resolution Engine behavior was introduced in T-3007.
- The existing `mangas` table remains the canonical catalogue so favorites, chapters and progress foreign keys remain valid.
- The forward-only migration adds normalized-title enforcement, explicit mapping language/availability, a public canonical aggregate view, author/type disambiguation, and a transaction advisory lock preventing concurrent duplicate creation.
- No content or user-owned row was deleted.

## Verification evidence

- `npm run test:canonical`: 6 passed, 0 failed.
- `npm run lint`: 0 errors; 57 existing Fast Refresh warnings.
- `npm run build`: successful; existing bundle-size warning remains deferred.
- `supabase db lint --linked --project-ref ilmsomiaqthhfyvgqnsp --level error`: no schema errors.
- `canonical_manga_catalog` REST read: HTTP 200 with canonical rows and aggregated source counts.
- Interactive browser QA was unavailable in the current environment; no visual PASS is claimed from lint/build alone.
