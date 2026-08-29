# Manga Wave V3 — P1 Hotfix Report

Date: 2026-08-29  
Production: <https://manga-wave-bienvenue-fusion.vercel.app/>  
Implementation commit: `dac343d` — `fix(p1): harden reader source recovery`

## OVERALL_STATUS

`IMPLEMENTED_AND_DEPLOYED_INTERACTIVE_QA_BLOCKED`

All identified P1 code/data defects have a targeted remediation. Automated tests, client/server TypeScript, lint, build, Supabase migration synchronization and production asset verification pass. The required interactive browser smoke test could not run because this session has no trusted in-app browser service. P1 is therefore **not declared product-approved** from static/automated evidence alone.

Code-level blockers: `0`  
Remaining critical code defects: `0`  
Remaining high code defects: `0`  
Acceptance blocker: `1` — interactive production click-through unavailable in this execution environment.

No P2 work or visual redesign was started.

## CHAPTER_MATCHING

`PASS`

- Added `src/domain/chapterMatching.ts`.
- Only explicit numeric logical chapter identities are accepted.
- Exact values and compatible decimal forms normalize safely (`5 -> 5`, `12.50 -> 12.5`).
- Empty, malformed and mismatched provider numbering returns no match.
- Provider array position, first chapter, latest chapter and Chapter 1 are never generic substitutes.
- `UniversalReader` no longer invents chapter number `1` when the active chapter is absent from the loaded list.
- Live fallback manga matching now requires exact normalized title equality. The old contains/first-result fallback was removed.
- When no reliable equivalent exists, automatic navigation stops and the Reader states: “Ce chapitre n’est pas disponible sur les autres sources.” Retry, manual source inspection and return/navigation actions remain.

Tests cover exact match, decimal match, no match, mismatched numbering and empty lists.

## ASURA_PAGE_NAVIGATION

`PASS_AUTOMATED_AND_DATA_PROBE`

- Added a shared bounded page transition function in `src/domain/readerNavigation.ts`.
- Reader Next/Previous now updates the React page state and synchronizes the zero-based `?page=` query using history replacement.
- Rendered page selection still uses `pages[currentPage]`; URL synchronization is secondary to the actual state change, not a superficial increment.
- Progress recording continues to observe `currentPage` and now records only after a reliable chapter number is present.
- Provider regression test covers page 1 → 2 → 3 → 2, image identity and query-page coherence.
- Production AsuraScans probe returned 15 distinct page URLs for tested chapter 68; the first three URLs were distinct.

Interactive clicking/indicator inspection remains part of the blocked browser smoke test.

## READER_SOURCE_SELECTOR

`PASS_AUTOMATED`

- Reused the existing `ReaderSettingsPanel`; no second selector was created.
- Added explicit open/close state transitions and `aria-expanded`.
- Raised the settings panel to `z-[60]` over its `z-50` backdrop.
- The active source/language remains visible.
- Ranked alternatives remain lazy-loaded only when Settings opens or fallback is needed.
- The top available candidate is identified as recommended.
- Score explanation now exposes availability, language and chapter-coverage components.
- Manual selection remains disabled when the exact chapter is absent.

State regression test confirms open is idempotent and close is explicit. Interactive click-through is blocked by unavailable browser tooling.

## CANONICAL_USER_STATE

`PASS`

- Added live migration `20260829060000_add_canonical_reading_progress.sql`.
- Added `public.user_canonical_reading_progress`, keyed by `(user_id, canonical_key)` with optional `canonical_manga_id` and explicit canonical chapter identity.
- Provider IDs are retained as last-source context: `last_provider`, `last_provider_manga_id`, `last_provider_chapter_id`.
- The application now upserts one canonical progress row when the same normalized manga title is read through another provider.
- Continue Reading merges local/remote state by canonical key, so AsuraScans → OriginManga for the same work produces one card.
- Authenticated writes resolve `canonical_manga_id` from `manga_source_mappings` when available.
- Favorites already key on canonical `mangas.id`; local chapter history tables were not destructively changed.

Existing duplicate strategy:

1. The most recently updated legacy row wins active provider/chapter position.
2. For legacy rows on that same logical chapter, the highest page, total pages and progress percentage are retained.
3. Legacy `user_reading_progress` rows are not deleted; the old table remains an inspection/rollback archive.

Local and remote tests confirm provider A → B leaves one latest canonical entry.

## LANGUAGE_FALLBACK

`PASS`

- Alternative discovery now receives the actual requested language.
- Ranking uses the matched chapter language when provided, not only the provider-wide language label.
- Automatic selection partitions candidates so a same-base-language exact chapter wins before any cross-language candidate.
- Cross-language fallback is allowed only when no same-language exact chapter exists.
- Automatic and manual navigation set `lang` to the alternative chapter’s actual language.
- Actual language is persisted in canonical progress and restored by Continue Reading.

## FALLBACK_NOTIFICATION

`PASS`

- Automatic fallback URLs carry the previous provider and previous language.
- The non-blocking success notice names the failed and replacement sources.
- If the language changes, it explicitly reports the transition, for example: “OriginManga est indisponible. Passage temporaire de FR à EN via AsuraScans.”
- Internal stack/error details remain outside the primary notice.

## MANGAFIRE_FILTER

`PASS`

- Added normalized relevance scoring in `src/domain/providerRelevance.ts`.
- Results are checked against primary title/aliases when available.
- Exact, prefix/suffix subtitle and strong token evidence are accepted.
- Weak partial overlap and unrelated browse results are rejected below `0.78`.
- The server extractor no longer returns the first ten browse results when a query has no relevant match.
- The frontend filters again defensively in case a stale server response contains unrelated rows.

Regression test rejects an unrelated title for “Solo Leveling” while retaining “Solo Leveling” and “Solo Leveling: Ragnarok”.

## COMICK

`SAFELY_DEGRADED`

- The former request included a deterministic-invalid parameter combination and could trigger repeated 400s.
- Search request construction was reduced to the documented `q` contract and deterministic 4xx statuses were classified non-retryable.
- TanStack retry is disabled for Comick search.
- Live endpoint probes on 2026-08-29 found `api.comick.io` returning 404 and the other configured public hosts unreachable.
- Because no reliable endpoint was available, Comick search is explicitly disabled (`COMICK_SEARCH_ENABLED = false`, `supportsSearch = false`) and returns an empty result without issuing a failing request.
- Other providers and whole-search rendering continue normally.

This satisfies the acceptance option “provider safely degraded” and prevents blind retry/noise. Re-enable only after a verified stable API contract exists.

## ASURA_METADATA

`PASS`

- `AsuraScansSource.getMangaDetails` derives `lastChapter` from the highest valid normalized chapter number.
- Malformed provider summary/order and chapter `0` no longer override a parsed list containing chapters 199/200.
- Regression test verifies `0, 199, 200 -> 200`.
- Production probe derived chapter 68 from a 68-chapter AsuraScans result.

## ANTI_LOOP_REGRESSION

`PASS`

- `tried` provider tracking is unchanged.
- Current and attempted providers remain excluded.
- Automatic fallback remains bounded to three unique source attempts.
- Same-language preference does not bypass the attempt budget.
- Existing and added tests cover exclusion, budget and no-source termination.

## NO_SOURCE_REGRESSION

`PASS`

- All candidates without the exact logical chapter return no automatic target.
- No fallback to Chapter 1, first, latest or array-equivalent occurs.
- Controlled state, retry, manual alternatives and return path remain available.

## DIRECT_URL_REGRESSION

`PASS_STATIC_AND_AUTOMATED`

- The canonical route remains `/read/:source/:mangaId/:chapterId`.
- Direct refresh still derives state from route and query parameters.
- Page changes update `?page=` with replacement, so browser Back is not polluted by every page turn.
- Automatic fallback continues to use `{ replace: true }`.
- Manual source switching continues to push a user-directed navigation entry.
- Header/Footer remain absent from the Reader.

Interactive browser Back verification remains blocked by unavailable browser tooling.

## TESTS

`PASS — 31/31`

Command:

```text
npm run test:p1
```

Coverage added for all twelve requested hotfix cases:

1. no chapter match → no fallback to chapter 1;
2. exact and decimal chapter match;
3. language-preserving fallback;
4. cross-language fallback notice/state;
5. canonical Continue Reading merge;
6. provider A → B same canonical manga;
7. AsuraScans next/previous page state, image and URL;
8. Reader Settings/source-selector open state;
9. MangaFire irrelevant result rejection;
10. Comick 400 no-retry/safe degradation;
11. anti-loop budget/tried-source regression;
12. controlled no-source regression.

## TYPESCRIPT

`PASS`

```text
npx tsc -b --pretty false
npm --prefix server run build
```

Both client and extractor server compile successfully. Pre-existing homepage skeleton inference errors were corrected without changing the visual design.

## LINT

`PASS — 0 errors`

`npm run lint` completes with 57 pre-existing Fast Refresh warnings in shared UI modules.

## BUILD

`PASS`

`npm run build` completes successfully. Current production JS asset: `assets/index-CHn515K4.js` (687.60 kB; 201.68 kB gzip). The existing >500 kB warning remains deferred technical debt and did not block P1.

## SUPABASE

`PASS`

- Migration `20260829060000_add_canonical_reading_progress.sql` applied to project `ilmsomiaqthhfyvgqnsp`.
- Local and remote migration histories are synchronized through `20260829060000`.
- `supabase db lint --linked --project-ref ilmsomiaqthhfyvgqnsp --level error`: no schema errors.
- Migration is additive and legacy provider-scoped rows remain intact.
- New user table has owner-only RLS for select/insert/update/delete.

## DEPLOYMENT

`PASS`

- Commit `dac343d` pushed to `origin/main`.
- Vercel production serves `assets/index-CHn515K4.js`, exactly matching the validated local build.
- Production extraction probe succeeded for AsuraScans search → detail → pages.

## COMMIT

Implementation: `dac343d` — `fix(p1): harden reader source recovery`

## MANUAL_SMOKE_CHECK

`BLOCKED`

The in-app browser connection failed with: `Browser use requires a trusted Node REPL browser service`.

Consequently, the following cannot honestly be declared interactively verified in this session:

- click Next/Previous and observe the rendered Reader;
- open/close Settings and click a source candidate;
- run source A → B on the same chapter in the live UI;
- force a provider failure and observe the notification/no-loop behavior;
- confirm browser Back visually.

Automated state-path tests and production data/API probes pass, but they are not substituted for interactive evidence.

## ACCEPTANCE_GATE

```text
CHAPTER_MATCHING = PASS
ASURA_PAGE_NAVIGATION = PASS_AUTOMATED_AND_DATA_PROBE
READER_SOURCE_SELECTOR = PASS_AUTOMATED
CANONICAL_USER_STATE = PASS
LANGUAGE_FALLBACK = PASS
MANGAFIRE_FILTER = PASS
COMICK = SAFELY_DEGRADED
ANTI_LOOP = PASS
NO_SOURCE_STATE = PASS
CODE_BLOCKERS = 0
CRITICAL_CODE_DEFECTS = 0
HIGH_CODE_DEFECTS = 0
INTERACTIVE_QA = BLOCKED
P1_PRODUCT_APPROVAL = PENDING_INTERACTIVE_SMOKE
```

Exact next step: activate the built-in Browser, then run the production Solo Leveling source-switch/failure smoke matrix from the original hotfix brief. Do not start P2 until that evidence is recorded.
