# Manga Wave V3 — T-3008 Source Resolution Engine

STATUS: PASS

SOURCE_SCORE: PASS

AVAILABILITY_SIGNAL: PASS

LATENCY_SIGNAL: PASS

LANGUAGE_SIGNAL: PASS

CHAPTER_COVERAGE_SIGNAL: PASS

IMAGE_QUALITY_SIGNAL: PASS

ERROR_RATE_SIGNAL: PASS

LAST_SUCCESS_SIGNAL: PASS

DETERMINISTIC_RANKING: PASS

EXPLAINABLE_BREAKDOWN: PASS

DATABASE_RPC: PASS

READER_ALTERNATIVE_RANKING: PASS

AUTOMATED_TESTS: PASS — 5/5 T-3008, 11/11 P1

DATABASE_LINT: PASS

REST_CONTRACT: PASS

T-3009_AUTO_FALLBACK: NOT_STARTED

## Implemented contract

- `SOURCE_SCORE` is a 0–100 weighted score built from availability/circuit state, latency, preferred language, chapter coverage, image quality, error rate and last successful request.
- Each score exposes a component breakdown; unavailable or open-circuit sources are ineligible and score zero.
- Missing observations receive neutral values rather than an unjustified perfect score.
- Equal scores use a stable source-id tie-break. No provider is hard-coded as globally preferred.
- The Supabase RPC `rank_canonical_manga_sources` ranks persisted mappings for a canonical manga and preferred language.
- Reader source alternatives now use the same domain scoring and display the recommended available source and score after a source error.
- The engine does not switch sources automatically. That behavior remains isolated to T-3009.

## Verification evidence

- `npm run test:sources`: 5 passed, 0 failed.
- `npm run test:p1`: 11 passed, 0 failed.
- Remote RPC test: HTTP 200 with eligible ranked source and score breakdown.
- Supabase database lint: no schema errors.
