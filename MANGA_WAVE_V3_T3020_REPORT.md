# T-3020 — Search V2

Date: 2026-09-09

## OVERALL_STATUS

LOCAL_VALIDATION_PASS / PRODUCTION_VALIDATION_BLOCKED.
Search V2 is implemented and tested against deterministic canonical catalog responses. Real catalog and production smoke remain unverified: the execution environment cannot resolve the production hostname, including outside the sandbox. No deployment was performed. No T-3021 or P4 work was started.

The prior P2 hotfix `c9c1e7f` remains locally committed with its real multi-session/production acceptance pending. This report does not close P2 or reinterpret its pending gates as PASS. The explicit T-3020 request supplies the scope for this new work.

## SEARCH_ARCHITECTURE

`useCanonicalSearch` fetches only public `mangas` metadata, once per cached snapshot, through the existing Supabase client/RLS. It selects the fields required by search and excludes chapter payloads and descriptions. Ordered keyset batches of 500 continue until empty, avoiding silent truncation at the API row limit. Abort signals cancel abandoned loads; errors reject the snapshot instead of presenting incomplete results as complete.

The cache is independent of query text and filters, fresh for five minutes and retained for thirty. Ranking, filtering and 24-card pagination run locally through the pure `canonicalSearch` domain module. No live provider search hooks remain on the Search page. Other provider integrations and the Reader remain unchanged.

## CANONICAL_SEARCH

PASS locally. Database canonical numeric IDs identify cards and navigation targets (`/manga/110` for Solo Leveling). Repeated IDs are deduplicated. Separate IDs are never merged by fuzzy text or a shared alias; Solo Leveling Ragnarok remains a distinct work. A title match cannot accidentally direct the user to a generated title hash or provider route.

## QUERY_NORMALIZATION

PASS. NFKD normalization, case folding, accent-mark removal, apostrophe handling, punctuation-to-space conversion and repeated-space collapse. Letters/numbers from non-Latin scripts are retained. Korean aliases and Japanese titles are covered by tests. Query length is bounded at 160 characters.

## RANKING

PASS. Exact title > exact alias > title prefix > alias prefix > title substring > alias substring > bounded typo > author > exact genre context. Explicit title matches outrank genre and author context. Stable title/ID tie breaks make ordering reproducible.

## FUZZY_MATCH

PASS. Levenshtein distance is limited to one edit for 5–9 characters and two edits for longer queries, with a similarity floor of 80%. No fuzzy match for queries shorter than five characters. Full titles or contiguous word phrases are compared; `solo levling` and `omnicient reader` are covered. This matching changes relevance only, never canonical identity.

## ALIASES

PASS with fixture data. Searches of declared alternate titles return the original canonical ID and expose alternate titles as secondary card text. No alias is invented or imported from live providers. Actual completeness of the existing `mangas.aliases` column could not be measured without network access; works with empty aliases remain searchable by title and metadata.

## AUTHOR

PASS. Normalized author substrings participate below title/alias/fuzzy matches. Missing authors produce an explicit neutral label.

## GENRE

PASS. An exact normalized genre query is contextual relevance. The genre selector combines with all other filters. Available catalog genres populate the selector after loading; Action/Fantasy/Romance provide initial discovery choices. Missing genre metadata cannot satisfy a genre filter.

## FILTERS

PASS. Type (Manga, Manhwa, Manhua), status (ongoing, completed, hiatus, cancelled), and genre apply conjunctively to data. Active filters are visible and can be cleared together. Unknown types never satisfy an active type filter. Empty text with active filters intentionally enables filtered browsing; empty text without filters shows a helpful prompt and does not initiate catalog loading.

Language availability is intentionally omitted: it belongs to mapping/chapter metadata and has not been established as complete/reliable for this catalog. No speculative year/rating filter was added.

## SORT

PASS. Relevance is the default. Popularity, rating, recent catalog additions, and A–Z are available. Recent means `created_at`, not an asserted publication/update date. Text relevance still limits the candidate set before optional sorting.

## URL_STATE

PASS. Query, type, status, genre, sort and page round-trip through URLSearchParams. Invalid enum/page inputs are sanitized. Input debounces at 250 ms and replaces the current typing entry; Enter confirms immediately. Filter/page changes push history entries. Detail → Back, reload, Back and Forward restore query/filters in browser tests. Filter/text changes reset pagination.

## MOBILE

PASS for Search scope at 390×844 and 430×932. Input, filters, submit/retry/navigation controls and result links meet the tested 44 px height requirement. Search main content has no horizontal overflow. Screenshot at 390 px was visually reviewed: readable controls and cards, with title/alias wrapping. The existing global Header overflow is visible and remains separate debt; this ticket does not claim to repair it.

## ACCESSIBILITY

Functional checks PASS: named search field, named native comboboxes, named clear/retry buttons, Enter submission, named canonical card links, heading hierarchy, result status and understandable empty/error states. Cards avoid nested links/buttons.

AXE: NOT RUN — no local axe-core installation was found and network access prevents acquiring it. The E2E accepts `AXE_CORE_PATH` for a subsequent audit of Search main content. Full automated accessibility compliance remains INCONCLUSIVE. Header/Footer historical issues remain outside this change.

## PERFORMANCE

Synthetic measurement: roughly 27 ms to search/rank 5,000 works (one local execution; not a production latency claim). Browser pagination test loads 501 works over three requests including the terminating empty batch, finds the last work, and confirms that editing query/pagination causes no extra catalog request. No provider request is made by search, even when provider endpoints return 503.

Limitation: this lightweight version holds the complete metadata snapshot in browser memory. Actual catalog size, network payload and cold-load latency could not be measured. Very large catalogs should move candidate retrieval/ranking to an indexed server query; this ticket introduces no heavy search infrastructure or silent catalog cap.

## DATABASE_INDEXES

Read-only migration audit: `mangas` has its primary-key index, btree `normalized_title`, GIN trigram `normalized_title`, `created_at`, and synchronization indexes. No dedicated author/status/type/genre search index was identified. This implementation scans selected metadata ordered by the indexed primary key and applies ranking/filters locally, so additional filter indexes would not accelerate its current request pattern. No migration, index change, data write, alias backfill, or remote configuration change was made.

## E2E

PASS: 7/7 deterministic local browser scenarios (six main scenarios in one run, then the added pagination/cache case).

- Exact title → exactly one primary Solo Leveling card → canonical detail → Back.
- Typo → Solo Leveling, zero provider calls.
- AND filters, reload, Back/Forward, clear filters.
- Provider 503 degradation leaves canonical search usable, no MangaFire labels/noise.
- Empty query/result, keyboard Enter, mobile 390/430, control sizes.
- Canonical database error → visible retry → recovery.
- 501-work paginated snapshot, last work found, 24-card pagination and cache reuse.

Fixtures intercept public catalog responses only. They do not prove production catalog contents or production deployment. `T3020_REAL_CATALOG=1` disables catalog fixtures for a later smoke; synthetic error/pagination cases then skip. No QA accounts were created.

## PRODUCTION_SMOKE

BLOCKED / NOT RUN. The read-only production HEAD request failed DNS resolution (`Could not resolve host: manga-wave-bienvenue-fusion.vercel.app`). Existing production has not received Search V2. After real regression validation and authorized deployment, run the real-catalog exact/typo/filter/detail/Back smoke and audit aliases and cold-load performance.

## REGRESSIONS

- All unit suites: 131/131 PASS (115 baseline plus 16 Search V2 tests).
- P1 explicit suite: 41/41 PASS.
- P2/T3013/T3014/T3015/T3017/T3019 domain tests: PASS within the full unit run.
- Source-abstraction regression updated from requiring the old provider-selection UI to requiring canonical search without live provider hooks, consistent with T-3020.
- Real Reader and P2 ticket E2E reruns: BLOCKED by network; their historical results are not counted as fresh validation.
- P2 fresh-session hotfix: still pending real acceptance, unchanged by T-3020.

## TYPESCRIPT

PASS: `tsc -p tsconfig.app.json --noEmit` and server TypeScript build.

## ESLINT

PASS: 0 errors / 57 historical warnings. Changed files pass targeted lint.

## BUILD

PASS. Candidate asset `assets/index-hMXuRHKr.js` (~720 kB uncompressed). Historical bundle-size and outdated Browserslist-data warnings remain; no lockfile updates were made.

## DEPLOYMENT

NOT DEPLOYED. No push or production mutation. P2 production acceptance and T-3020 real validation remain open.

## COMMITS

Base: `c9c1e7f` (P2 hydration hotfix), following `e544710` (T-3019).
T-3020 changes are limited to Search page, its canonical domain/hook, targeted tests, package test commands and this report. The existing visual-refactor report edit and historical CRLF/LF files are excluded. Lockfiles and migrations are preserved.

## ACCEPTANCE

```text
CANONICAL_SEARCH: PASS (local)
EXACT_MATCH: PASS
ALIAS_MATCH: PASS (declared fixture aliases; real coverage unverified)
FUZZY_MATCH: PASS
AUTHOR_SEARCH: PASS
GENRE_SEARCH: PASS
FILTERS: PASS
COMBINED_FILTERS: PASS
RELEVANCE_SORT: PASS
CANONICAL_DEDUP: PASS
MANGAFIRE_REGRESSION: PASS
COMICK_DEGRADATION: PASS
URL_STATE: PASS
MOBILE: PASS (Search scope)
ACCESSIBILITY: FUNCTIONAL_PASS / AXE_INCONCLUSIVE
E2E: 7/7 LOCAL PASS
PRODUCTION_SMOKE: BLOCKED
P1_REGRESSION: 41/41 UNIT PASS / REAL E2E BLOCKED
P2_REGRESSION: UNIT PASS / REAL E2E BLOCKED
TYPESCRIPT: PASS
ESLINT: 0 ERRORS
BUILD: PASS
FINAL: KEEP_OPEN_PENDING_REAL_VALIDATION
```
