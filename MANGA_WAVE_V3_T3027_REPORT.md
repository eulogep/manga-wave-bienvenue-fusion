# T-3027 — Chapter List V2

Date: 2026-09-12

## STATUS

LOCAL_IMPLEMENTATION_COMPLETE / PRODUCTION_DEPLOYMENT_PENDING.

## ROOT CAUSE

Manga Detail maintained three almost identical chapter-list renderers for OriginManga, MangaDex,
and universal sources. Their metadata and empty/error behavior differed, large provider responses
could mount as many as 500 rows at once, and the main “Commencer la lecture” action selected a
chapter from provider array order rather than the earliest valid logical chapter number.

## IMPLEMENTATION

- One provider-neutral `ChapterListV2` now renders normalized `SourceChapter` records for every
  source while preserving exact provider chapter IDs for Reader navigation.
- Logical numeric sorting handles `001.00`, decimal chapters and specials deterministically.
  Numbered chapters remain ahead of nonnumeric extras in both directions.
- The primary start action selects the earliest logical chapter independently from provider order.
- Search covers chapter number, title and scanlation group with accent-insensitive matching.
- Forty rows render initially; additional rows appear in bounded groups of forty. MangaDex remote
  pagination remains available and keeps its existing 100-row request boundary.
- Loading, provider error, empty-language, no-result and retry states are unified and explicit.
- Chapter rows expose language, date, page count, team, direct Reader action and optional external
  source link through semantic controls of at least 44 px.
- T-3010 fallback/source override, T-3012 canonical Reader entry, T-3013 updates, T-3014 Follow,
  T-3024 Similar Works and T-3026 canonical metadata remain intact.
- No database, migration, provider adapter or lockfile change is required.

## VALIDATION

- T-3027 unit tests: **3/3 PASS**.
- Full unit suite: **253/253 PASS**.
- Controlled T-3027 E2E: **2/2 PASS** with an 85-chapter fixture.
- Real-catalog T-3027 E2E: **1/1 PASS**.
- T-3025/T-3026 controlled regression: **5 PASS**, 2 real-only cases skipped.
- TypeScript application: **PASS**.
- TypeScript server: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Production build: **PASS**, `assets/index-5-u2Ng-9.js` and `assets/index-CkN5cte7.css`.
- Real-browser error-state inspection: **PASS**, no console error.
- Mobile 390 px: **PASS**, no horizontal overflow.
- Lockfiles: **unchanged**.
- Database migrations and remote writes: **none**.
- QA accounts: **none created**.

## ACCEPTANCE

```text
UNIFIED_PROVIDER_MODEL:        PASS
STRICT_CHAPTER_IDENTITY:       PASS
NUMERIC_SORT:                  PASS
DECIMAL_CHAPTERS:              PASS
SPECIAL_CHAPTERS:              PASS
EARLIEST_START_ACTION:         PASS
SEARCH_NUMBER_TITLE_GROUP:     PASS
PROGRESSIVE_RENDERING:         PASS
MANGADEX_REMOTE_PAGINATION:    PASS
LOADING_ERROR_EMPTY_STATES:    PASS
READER_NAVIGATION:             PASS
SOURCE_FALLBACK:               PASS
MOBILE_390:                    PASS
UNIT_TESTS:                    PASS (253/253)
TYPESCRIPT:                    PASS
ESLINT:                        PASS (0 errors)
BUILD:                         PASS
DATABASE_CHANGE:               NONE
PRODUCTION_SMOKE:              PENDING_DEPLOYMENT
T3027_FINAL:                   READY_TO_DEPLOY
```

## NEXT STEP

Push the T-3026 closure report and T-3027 implementation, wait for the existing Vercel Git
deployment, then execute controlled and real-catalog production smoke. P4 work starts only after
T-3027 production acceptance passes.
