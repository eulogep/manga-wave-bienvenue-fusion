# T-3024 — Recommendations

Date: 2026-09-14

## OVERALL_STATUS

`APPROVED / LIVE`. No database migration was required for this ticket — everything is additive
application code reusing existing, already-live infrastructure. 233/233 unit tests pass (12 new),
TypeScript clean, ESLint 0 errors, build passes, and both the feature and the full regression suite
have been verified against the deployed production build.

## COMMITS / DEPLOYMENT

- `552025d` — feat: add canonical Recommendations (T-3024)

Pushed to `origin/main` (fast-forward, no `--force`), deployed by the existing Vercel pipeline.
Confirmed: production serves `assets/index-C9M9FAfM.js`, byte-identical to the local build of
`552025d` (rebuilt and diffed the filename directly).

## 1. ROADMAP / TICKET DEFINITION

`docs/product-roadmap.md` predates the T-302x sequence entirely (it still describes P0–P3 work
already shipped) and does not mention Recommendations by that name — the authoritative sequence for
this ticket is the roadmap stated earlier in this session: T-3021 Command Search → T-3022 Trending →
T-3023 Ranking → **T-3024 Recommendations** → T-3025 Random → T-3026 Manga Detail V2 → T-3027
Chapter List V2. No more specific spec than "Recommendations" was given for T-3024 in this session
(unlike T-3022/T-3023, which arrived with detailed requirement lists), so this report also documents
the scoping decision made below.

## 2. PRODUCTION CODE / SCHEMA INSPECTED BEFORE WRITING ANY CODE

- `src/domain/homePersonalization.ts` — the existing "Pour vous" (personalized homepage)
  recommendation logic: genre-affinity ranking from the user's favorites, with a fallback/tie-break
  pool.
- `src/pages/MangaDetail.tsx` — confirmed there is no existing "similar works" / "related manga"
  surface anywhere on the detail page.
- `src/hooks/useCanonicalMangaEntry.ts` — confirmed `canonical_manga_catalog` (a public read-only
  view) and `canonicalFollowIdentity` (via `useCanonicalMangaId`) are the reliable way to get a
  page's canonical numeric manga id in **both** view modes (canonical route and direct
  `?source=` provider route) — the same identity Follow already uses.
- `src/hooks/useCanonicalSearch.ts` — the T-3020 cached canonical snapshot (`id, title, aliases,
  author, genre, manga_type, status, cover_image, rating, views, created_at`), already shared by
  Search, Command Search, Trending, and Ranking. Chosen as Recommendations' data source too, to
  avoid a second full-catalog query.
- `server/src/sources/*.ts` and the live `mangas` table — re-confirmed (this was already established
  in T-3022/T-3023, re-verified rather than assumed) that `views` is never incremented anywhere and
  most `rating` values are provider-hardcoded constants. Neither is used here either.

## 3. DEPENDENCY VERIFICATION (T-3020 / T-3021 / T-3022 / T-3023)

- **T-3020** (canonical metadata): Recommendations' entire content-based signal (genres, author,
  type) depends on this being trustworthy. Re-confirmed via the same `useCanonicalSearch` snapshot
  already used elsewhere — no new query, no new trust assumption.
- **T-3021** (Command Search): untouched. `SimilarWorksSection` is a new, independent component; it
  does not share state with `CommandSearchDialog` beyond both reading the same read-only cached
  snapshot.
- **T-3022** (Trending): **explicitly frozen per instruction**. Verified zero diff on
  `src/domain/trending.ts`, `src/hooks/useTrending.ts`, `src/components/TrendingSection.tsx`,
  `src/pages/Trending.tsx`, its migration, and its tests (`git diff --stat` on each returns empty
  before this ticket's commit). Its scoring model, materialized view, privacy boundary, refresh
  schedule, anti-spam logic, and low-activity behavior are all unmodified.
- **T-3023** (Ranking): untouched code-wise. Considered reusing `get_manga_ranking`/
  `_canonical_activity_window` as a popularity tie-break for "Pour vous", but decided against adding
  a new live query dependency to the homepage for this pass (see §4) — real catalog recency was
  used instead, which was already computed and already real.

## 4. HIDDEN ASSUMPTIONS / DEAD DATA FOUND (per the "unknown preferable to false" rule)

Found while re-reading `homePersonalization.ts` with T-3022/T-3023's audit standard in mind:

1. **`trending`/`popular` fields were still using the discredited `views + rating * 1000` proxy**
   for their sort order — the exact same dead/untrustworthy signal T-3022 removed from the *UI*
   under those names, but which had silently survived as the **internal tie-break** for the
   `forYou` cold-start recommendation pool (used when a user has no favorites yet). Fixed: both
   fields are now ordered by real catalog recency (`source_updated_at`/`created_at`), the same
   honest basis `recent`/`newChapters`/`recentlyUpdated` already use. Neither field is rendered
   under a "Trending"/"Popular" label anywhere in the UI any more (confirmed via `grep` — T-3022/
   T-3023 already removed those call sites), so this is purely an internal correctness fix, not a
   visible ranking change users would perceive as "Trending" or "Popular" moving.
2. **Follows were never counted toward genre affinity or exclusion** — only `user_favorites` fed
   `rankFavoriteGenres`/the recommendation exclusion set, silently ignoring `user_follows` (T-3014),
   an equally real, already-tracked signal of interest. Fixed additively: both
   `rankFavoriteGenres()` and `buildPersonalizedHomeCatalog()` now accept an optional `followedIds`
   parameter (default `[]`, fully backward compatible — every existing 2-arg/3-arg call site and
   test still passes unmodified) that merges with favorites for both affinity ranking and exclusion.
   `HomeCatalogSections.tsx` now passes real follow data (`useFollows()`) through.

Both are documented here rather than fixed silently, per the instruction to surface hidden
assumptions explicitly.

## 5. SCOPING DECISION: content-based similarity now, not collaborative filtering

Considered building a "users who favorited/followed X also favorited/followed Y" collaborative
signal (a natural extension of T-3023's shared `_canonical_activity_window` pattern — an anonymous,
aggregate, co-occurrence materialized view would be architecturally straightforward). **Decided
against it for this pass**: real cross-user engagement volume in production is still negligible
(T-3022/T-3023's own production verification already established this — on the order of 1–2 real
users' worth of activity total), so a collaborative signal would launch with
`PASS_WITH_INSUFFICIENT_ORGANIC_ACTIVITY` on day one, adding new infrastructure (another
materialized view, another refresh schedule) to carry a signal that cannot be meaningfully populated
yet. Content-based similarity, by contrast, is grounded entirely in T-3020's already-enriched
metadata and works today, for every enriched catalog work, regardless of activity volume — the
better first Recommendations deliverable given the actual state of the data. A collaborative layer
remains a natural, low-risk future addition once real engagement volume justifies it, and could
reuse the exact `_canonical_activity_window` pattern already proven in T-3022/T-3023.

## 6. WHAT WAS BUILT

### "Vous aimerez aussi" (Similar Works) — `src/domain/recommendations.ts`

Pure, deterministic content-based similarity over the already-cached canonical snapshot:

```
score = sharedGenres.length × 2   (strongest — the real, audited signal)
      + (sameAuthor ? 3 : 0)      (a named, matching author is strong evidence)
      + (sameType   ? 1 : 0)      (matching manga/manhwa/manhua — a light tie-breaker only)
```

Excludes the target itself and anything scoring zero — no fabricated "similar" result when nothing
genuinely overlaps. Author matching is accent/case-normalized (reusing `normalizeQuery` from
`canonicalSearch.ts`) but never fuzzy across different people. Deterministic tie-break by canonical
manga id. Never reads `mangas.rating` or `mangas.views` (verified by a test asserting the candidate
shape has neither field).

`src/components/SimilarWorksSection.tsx` renders it on `MangaDetail.tsx` (both the canonical-route
and direct-provider-route view modes, via the same `canonicalFollowIdentity` Follow already
resolves) — reusing the shared `useCanonicalSearch` cache, so **no extra query** beyond what the
page (and Search/Command Search/Trending/Ranking) already load. Renders nothing when the target
isn't in the enriched snapshot or nothing overlaps, rather than an empty-looking placeholder.

### Homepage "Pour vous" correctness fixes — `src/domain/homePersonalization.ts`

See §4. Both fixes are additive/backward-compatible; `HomeCatalogSections.tsx` now supplies real
follow data.

## 7. NO DATABASE MIGRATION

This ticket required none: Similar Works reads only the already-cached T-3020 snapshot; the
homepage fix reads only already-fetched favorites/follows/catalog data. No new table, view,
function, or RLS surface was introduced. This keeps the "additive architecture, no regression" bar
trivially satisfiable for the database layer — there is nothing new to regress.

## 8. TESTS

- `tests/recommendations.test.ts` (9 tests): never recommends the target itself; a shared genre
  produces a correctly-weighted match; more shared genres score higher; a same named author is a
  strong signal even with zero shared genres; author matching is accent/case-insensitive but never
  fuzzy across different people; matching format is a light tie-breaker only; no overlap at all is
  excluded entirely (never fabricated); results are limited and deterministic with id-based tie
  breaks; the candidate shape has no `rating`/`views` field at all.
- `tests/homePersonalization.test.ts` (+3 tests, 7 total, all passing including the 4 pre-existing):
  the cold-start pool is now recency-ordered (a deliberately views/rating-skewed fixture proves the
  recent, unrated work now wins); follows contribute to genre affinity; follows are excluded from
  recommendations alongside favorites.
- `tests/e2e/t3024-recommendations.spec.ts` (2 scenarios, real production catalog, no QA fixture
  needed since this feature isn't activity-dependent): an enriched work (Sono Bisque Doll, id 2)
  surfaces real overlapping catalog works, never itself, at most the configured limit; an
  unenriched work (id 145) renders no section and the page does not crash.

## 9. REGRESSIONS

- Full unit suite: **233/233 PASS** (221 pre-existing + 12 new).
- `npx tsc --noEmit -p .`: clean.
- `npm run lint`: 0 errors, 61 pre-existing warnings (unchanged).
- `npm run build`: PASS.
- **T-3022 frozen-file diff check**: `git diff --stat` on every T-3022 source/migration/test file
  returns empty prior to this ticket's own commit — confirmed untouched.
- Local browser check (dev server, real database): `/manga/2` renders real Similar Works (6 cards,
  zero page errors); `/manga/145` (unenriched) renders no section and no crash.

## 10. PRODUCTION SMOKE — all PASS

- **Deployment verified**: `assets/index-C9M9FAfM.js` live, byte-identical to the local build.
- **E2E** (`npm run test:e2e:t3024`, against production): **2/2 PASS**. `/manga/2` (Sono Bisque
  Doll, real MangaDex-enriched metadata) shows "Vous aimerez aussi" with real overlapping catalog
  works (never itself, at most 6); `/manga/145` (unenriched) renders no section and no page error.
- **Homepage** (production, real browser): anonymous homepage renders normally after the
  `homePersonalization.ts` fix (no visible change was expected or observed — the fix only changed
  the internal cold-start tie-break basis, which isn't separately labeled in the UI); zero page
  errors.
- **QA cleanup**: not applicable — this feature is content-based, not activity-based, so no QA
  fixture/account was created. Verified directly: zero `t3024`-prefixed accounts exist (none were
  ever created).
- **Regression** (production): `t3020-search.spec.ts` 7/7 PASS (+2 correctly skipped),
  `t3021-command-search.spec.ts` 7/7 PASS, **`t3022-trending.spec.ts` 3/3 PASS** (the explicitly
  frozen ticket — confirmed still fully correct live, not just untouched in git), `t3023-ranking.spec.ts`
  2/2 PASS, `reader-p1.spec.ts` 4/4 PASS.
- **Frozen-file check re-confirmed** against the final deployed commit: `git diff --stat` on every
  T-3022 source/migration/test file between `9445c36` (T-3022's last commit) and `552025d`
  (T-3024's commit) is empty.

## ACCEPTANCE

```
CONTENT_BASED_SIMILARITY:      PASS (genre/author/type, never rating/views)
NO_FABRICATED_RESULTS:         PASS (zero-overlap excluded entirely; unenriched work -> no section)
NO_NEW_MIGRATION_NEEDED:       PASS (reuses T-3020 cached snapshot + already-fetched user data)
HIDDEN_ASSUMPTIONS_FIXED:      PASS (dead views/rating tie-break -> recency; follows -> now counted)
T3020_DEPENDENCY:              PASS (canonical snapshot reused, not re-derived)
T3021_REGRESSION:               PASS (production E2E 7/7)
T3022_FROZEN:                   PASS (zero diff; production E2E 3/3 confirms live behavior intact)
T3023_REGRESSION:               PASS (production E2E 2/2)
READER_REGRESSION:              PASS (production E2E 4/4)
UNIT_TESTS:                     PASS (233/233, 12 new)
TYPESCRIPT:                     PASS
ESLINT:                         0 ERRORS
BUILD:                          PASS
PRODUCTION_E2E:                 PASS (2/2)
PRODUCTION_SMOKE:                PASS
QA_CLEANUP:                     PASS (no accounts created)
FINAL:                          APPROVE_T3024
```

## NEXT STEP

T-3024 is closed. Per the standing instruction, **not** advancing to T-3025 automatically —
stopping here for review.
