# P4 — Provider Request Resilience

Date: 2026-09-13

## STATUS

LOCAL_VALIDATED / READY_FOR_REVIEW.

## SCOPE

The proposed implementation was split between reliability controls that belong in Manga Wave and
anti-bot bypass mechanisms that do not. Manga Wave now gains bounded caching, pacing and retry
behavior without adding TLS impersonation, CAPTCHA solving, stealth browser plugins or robots.txt
overrides.

## IMPLEMENTATION

- Added one server-side `ProviderHttpClient` for compatible HTML providers.
- Added per-origin request pacing with a two-second default interval.
- Coalesced identical concurrent requests and cached successful responses for five minutes.
- Bounded the cache to 200 entries.
- Retried only transient `408`, `429` and `5xx` responses, at most twice.
- Honored `Retry-After` and capped backoff at 30 seconds.
- Treated `403` and deterministic client errors as terminal.
- Required HTTPS and used a stable, identifiable Manga Wave User-Agent.
- Migrated OriginManga, MangaPill and Sushi-Scan HTML requests to the shared client.
- Added no dependency and changed no lockfile, migration or remote configuration.

## PROVIDER DECISIONS

- Webtoon: public series metadata is available, but chapter-viewer scraping is explicitly restricted
  for scraping agents. Keep as a future metadata/link adapter, not an integrated reader source.
- Tapas: public series pages are available, while episode scraping is restricted. Keep as a future
  metadata/link adapter, not an integrated reader source.
- Mangakakalot: returned Cloudflare `522` during verification. Leave disabled and rely on existing
  source fallback.

Declaring Webtoon or Tapas in the current `SourceExtractor` registry would falsely promise
`getPages()` support. A future adapter belongs in the canonical metadata layer and should navigate
users to the official reader.

## VALIDATION

- Provider request policy unit tests: **7/7 PASS**.
- Full unit suite: **266/266 PASS**.
- Application and Node TypeScript configurations: **PASS**.
- Server TypeScript build: **PASS**.
- ESLint: **PASS**, 0 errors and 61 historical Fast Refresh warnings.
- Production application build: **PASS**.
- Low-volume live extraction: **PASS** — MangaPill 10, OriginManga 20 and Sushi-Scan 24
  popular results.

## ACCEPTANCE

```text
REQUEST_COALESCING:            PASS
CACHE_BOUNDED:                 PASS
PER_ORIGIN_PACING:             PASS
RETRY_AFTER:                   PASS
TRANSIENT_RETRY_BOUND:         PASS
HTTP_403_FAILS_CLOSED:         PASS
HTTPS_ONLY:                    PASS
WEBTOON_METADATA_ONLY:         CONFIRMED
TAPAS_METADATA_ONLY:           CONFIRMED
MANGAKAKALOT_READER_SOURCE:    REJECTED_UNAVAILABLE
ANTI_BOT_BYPASS:               NOT_IMPLEMENTED
LOCKFILES:                     PRESERVED
UNIT_TESTS:                    PASS (266/266)
TYPESCRIPT:                    PASS
SERVER_BUILD:                  PASS
APP_BUILD:                     PASS
ESLINT:                        PASS (0 errors)
LIVE_COMPATIBLE_SOURCES:       PASS (3/3)
P4_PROVIDER_RESILIENCE_FINAL:  READY_FOR_REVIEW
```
