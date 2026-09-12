# T-3023 — Ranking

Date: 2026-09-13

## OVERALL_STATUS

`APPROVED / LIVE`. Ranking is fully designed, implemented, unit-tested, deployed and verified
against production. 212/212 unit tests pass (18 new), TypeScript is clean, ESLint is 0 errors, the
production bundle builds, and `public.get_manga_ranking` has been exercised both by a
database-backed E2E fixture and by direct production reads.

## MIGRATION APPLICATION (authorized and completed)

Explicit authorization was given to run `npx supabase db push` for
`20260913090000_add_manga_ranking_rpc.sql`, scoped to exactly what was reviewed in this report (1
index, 1 shared helper revoked from client roles, 1 refactored function, 1 new function). Applied
directly this time (`supabase db push` succeeded on the first attempt, no async-approval surprise
like T-3022's). Verified independently, not assumed:

- `supabase migration list`: every local migration now has a matching `remote` timestamp, including
  `20260913090000`.
- `_canonical_activity_window` called directly with the anon key: `401`,
  `"permission denied for function _canonical_activity_window"` — confirms it is genuinely
  unreachable by clients, exactly as designed.
- `get_trending_manga` and `get_manga_ranking` both called directly with the anon key: `200`, correct
  shapes, matching the same real pre-existing activity (canonical manga 142: 1 follow + 1 favorite
  from 2026-08-30) that T-3022's report already established as the only real signal in production.

## CORRECTION TO THIS REPORT'S EARLIER DRAFT

The pre-authorization draft of this report (and a comment in the original E2E fixture) stated
"Kaiju No. 8 (id 100) has real production views" as the basis for a legacy-fallback test scenario.
That was wrong, and was caught during this validation pass, not before: a direct query
(`mangas?select=id&views=gt.0`) returns **zero rows** — every single row in production currently has
`views = 0`. It is not a stale-but-nonzero seed as assumed; the column was apparently never
populated with any baseline number at all. This makes today's real-world state even more honest
than what was designed for: the `work.views > 0` guard in `get_manga_ranking` means the legacy
fallback path cannot fire at all right now, for any query, confirmed live (see PRODUCTION_SMOKE). The
E2E fixture's second scenario was rewritten to assert exactly that, rather than a candidate that
cannot exist.

## AUDIT — every existing "Popular" / "Top" / rating-based surface

Performed before writing any migration, as required:

| Surface | What it actually showed | Verdict |
|---|---|---|
| Homepage (personalized) "Tendances" rail | `views + rating*1000` proxy, labeled Trending | **Already fixed in T-3022** (replaced with real Trending data). |
| Homepage (anonymous) "Populaires" rail | Same `views + rating*1000` proxy, labeled Popular | **Fixed in this ticket** — replaced with real `RankingSection` (see HOMEPAGE_INTEGRATION). |
| Search V2 "Popularité" sort (`src/domain/canonicalSearch.ts`) | Raw `mangas.views` only | **Left unchanged, explicitly documented as deferred** — see SEARCH_SORT_NOT_TOUCHED below. Not silently ignored. |
| `mangas.rating` (used inside the `views+rating*1000` proxy above, and shown as a star rating on cards) | See RATING_AUDIT below | **Excluded entirely from Ranking's score.** Left as-is on cards (a separate, pre-existing display concern, out of scope for a ranking-signal ticket) but never used as a ranking input. |
| `mangas.views` | Never incremented anywhere (re-confirmed) | **Never part of the real score.** Kept only as an explicitly flagged `legacy_fallback` row, per the ticket's own allowance ("must not magically rank highly unless that field is explicitly accepted as a legacy/popularity fallback and clearly documented"). |

## RATING_AUDIT

Read directly from production before writing the migration (1000-row sample, 343 actual rows):

```
5:    5    (AsuraScans regex-parse ceiling clamp)
4.9: 36    (MangaFire: server/src/sources/mangafire.ts hardcodes rating: 4.9 for every title)
4.8: 145   (OriginManga + CrunchyScan: both hardcode rating: 4.8 for every title;
            AsuraScans also falls back to 4.8 on regex-parse failure)
null: 92   (MangaDex: explicitly sets rating: null, never fabricates one)
...remaining 65 rows: a long tail of varied values (Comick's real bayesian_rating,
            and AsuraScans' successfully-parsed regex extractions)
```

**186 of 343 rows (54%) are exactly one of three provider-hardcoded constants.** This is not noise
around a real signal — it is the signal for most of the catalog, and it carries zero information:
every OriginManga title is 4.8 whether or not real readers found it good. `mangas.rating` is
therefore excluded entirely from `get_manga_ranking`'s score (not just down-weighted), documented in
the migration's header comment and enforced by a unit test scanning the function bodies for the
literal word `rating`.

## SEARCH_SORT_NOT_TOUCHED (documented, not silently deferred)

Search V2's "Popularité" sort option (`src/domain/canonicalSearch.ts`, `sort === 'popularity'`) still
orders by raw `mangas.views`. This was **not** changed in this ticket. Reasoning: T-3020's Search
architecture is a client-side, cached-snapshot sort with zero extra queries per keystroke/filter
change — a deliberate, already-approved, already-tested design. Wiring live ranking data into it
would mean either (a) fetching a second full-catalog ranking snapshot on every Search page load, or
(b) a deeper refactor of how Search's cached snapshot is assembled — both are real, non-trivial
changes to an already-shipped, regression-sensitive surface, and are out of proportion to what this
ticket asked for. This is flagged here as a known follow-up, not swept under the rug: Search's
"Popularité" sort is honestly still a `views`-based ordering today, and should eventually read from
the same `get_manga_ranking` aggregate (cached once per session, the same way `useCanonicalSearch`
is), tracked as a small T-3023 follow-up rather than done speculatively now.

## ARCHITECTURE

```
private per-user activity tables (user_reading_history, user_follows, user_favorites)
        ↓
public._canonical_activity_window(window_days, max_sessions_per_user)   -- SECURITY DEFINER, revoked
        |                                                                  from every client role
        ├──> public.get_trending_manga(...)     -- T-3022, unchanged behavior, refactored internals
        └──> public.get_manga_ranking(...)       -- T-3023, new
                ↓
        anonymous per-canonical-manga aggregate rows (unique_readers, reading_sessions,
        distinct_active_days, new_follows, new_favorites, score, legacy_fallback, rank)
                ↓
        useTrendingRanking / useRankingList (React Query) join against the T-3020 cached
        canonical snapshot for display metadata
                ↓
        TrendingSection / RankingSection (shared badge/status helpers in
        src/domain/discoveryPresentation.ts, extracted from CommandSearchDialog in this pass
        to avoid a third copy)
```

`_canonical_activity_window` is the single shared aggregation layer the ticket asked for — one
generic function serving both T-3022 and T-3023, with T-3024 Recommendations able to call it
directly (or add a thin wrapper) instead of recomputing joins or scraping the UI. It is `REVOKE ALL`
from `public`/`anon`/`authenticated` (verified by a unit test) so it can never be called directly by
a client — only from within another `SECURITY DEFINER` function.

**`get_trending_manga` was refactored**, not left duplicated: it now delegates to
`_canonical_activity_window` instead of repeating the same three-table join a third time. Its
signature, output columns and scoring formula are byte-for-byte unchanged — verified by re-running
every existing T-3022 unit test and its full E2E fixture against this refactor before considering it
safe (see REGRESSIONS below).

## SCORING MODEL — deliberately distinct from Trending

```
score = distinct_active_days * 6
      + unique_readers        * 4
      + new_follows           * 3
      + new_favorites         * 2
      + reading_sessions      * 1
```

vs. Trending's `unique_readers*5 + new_follows*3 + new_favorites*2 + reading_sessions*1`. The
defining difference: **Ranking weights `distinct_active_days` (repeat readership) highest**, a
signal Trending doesn't have at all. A manga read by the same handful of people on many different
days over weeks scores far higher here than a manga that got a lot of same-day attention once — the
exact "sustained popularity vs. recent acceleration" distinction the ticket requires. Both
`reading_sessions` and `distinct_active_days` are capped per user at `max_sessions_per_user` (default
5) so one person cannot dominate either metric.

## LEGACY FALLBACK (mangas.views)

`get_manga_ranking(include_legacy_fallback default true)`: real ranked results always come first;
`mangas.views`-ordered rows fill only the remaining unmet slots, exclusively when
`include_legacy_fallback = true`, and are always returned with `legacy_fallback: true`. The UI
(`RankingSection.tsx`) renders these with a visibly different, dimmer label
(`rankingLabel()` returns `"Populaire (historique)"` instead of a real tier), and shows a
low-confidence disclosure banner whenever fewer than 3 real works qualify — never blending a
seeded, frozen number into what looks like a real ranking.

## REQUIRED TEST DISTINCTIONS

All five are covered, in both the pure domain model (`tests/ranking.test.ts`) and a real
database-backed E2E fixture (`tests/e2e/t3023-ranking.spec.ts`):

1. **Strong recent spike, weak history** — `sustained engagement across many distinct days outranks
   an equal-volume single-day spike` (unit); Manga A in the E2E fixture (one user, 6 sessions, all
   today).
2. **Sustained engagement over weeks ranks strongly** — same test; Manga B in the E2E fixture (3
   distinct users, each active on 3 different days over ~3 weeks) — asserted to outscore both the
   spike and the binge live.
3. **One user must not dominate** — `one user reading every day for a month is capped` and `several
   distinct users... outrank one capped binge-user` (unit); Manga C in the E2E fixture (1 user, 20
   distinct days) — asserted to score below Manga B despite comparable/greater raw volume.
4. **`mangas.views` must not magically rank highly** — `legacy views fallback only fills unmet slots,
   always explicitly flagged` + `legacy fallback is skipped entirely when the caller opts out` +
   `legacy fallback rows never count toward confidence` (unit); a second E2E scenario confirms a
   real production work with only frozen `views` and zero seeded activity either doesn't appear
   (when the caller opts out) or appears explicitly flagged `legacy_fallback: true` with
   `unique_readers: 0` (when allowed).
5. **Ties: deterministic ordering** — `score is deterministic and ties break by canonical manga id`
   (unit, run twice against identical input and diffed).

## SECURITY / RLS

No RLS policy on `user_reading_history`, `user_follows`, or `user_favorites` was touched (unit-test
enforced: no `disable row level security` / `drop policy` anywhere in the migration). Both exposed
functions are `SECURITY DEFINER` with `SET search_path = public` (prevents search_path hijacking) and
`RETURNS TABLE` clauses containing no `user_id` or `email` (unit-test enforced by parsing the actual
clause, not just grepping the whole file). `_canonical_activity_window` is revoked from every client
role. Client-side aggregation across users never happens — `useRankingList`/`useTrendingRanking` only
ever receive the pre-aggregated RPC response.

## HOMEPAGE_INTEGRATION

- Anonymous homepage: the "Populaires" rail (previously `anonymous.popular`, the fake proxy) is
  replaced with a real `RankingSection` (30-day window, 6 items), under a new "Popularité durable"
  eyebrow, with a "Voir tout" link to `/ranking`.
- Personalized (logged-in) homepage: unchanged in this ticket — it never had a "Populaires" rail to
  begin with (T-3022 already replaced its "Tendances" rail); Continue Reading, Updates,
  personalization, "Récemment mis à jour", genre rail and "Séries terminées" are all untouched.
- Also added a matching "Voir tout" link on both homepage Trending rails (a small, honest UX
  completion noticed while working in this file, not scope creep — no new data/logic).
- New `/ranking` page (window tabs: 24h / 7d / 30d / Tout, default 30d) reusing `RankingSection`;
  cross-linked with `/trending` in both directions.
- No Header nav entry was added for Ranking (avoiding nav clutter — `/trending` already added one
  entry in T-3022; `/ranking` is reachable via the homepage rail, the "Voir tout" links, and the
  cross-link from `/trending`).

## DEDUPLICATION (mechanical refactor, not scope creep)

Extracted `src/domain/discoveryPresentation.ts` (status label map + manga/manhwa/manhua badge color
convention) out of `CommandSearchDialog.tsx` and `TrendingSection.tsx`, since `RankingSection.tsx`
would otherwise have been a third copy-paste of the same three lines. All three call sites updated
and re-verified (`npx tsc --noEmit`, targeted `eslint`, full unit suite).

## PRODUCTION_SMOKE

**PASS_WITH_INSUFFICIENT_ORGANIC_ACTIVITY** — the honest, pre-registered expectation, confirmed live,
not a fabricated green checkmark:

- `get_manga_ranking(window_days=30)` (anon key, direct REST): one real row (canonical manga 142,
  `score: 5, unique_readers: 0, new_follows: 1, new_favorites: 1, legacy_fallback: false`) — the same
  genuine 2026-08-30 activity T-3022 already found. `legacy_fallback` correctly `false` (it's real
  activity, just not reading-based).
- `get_manga_ranking(window_days=1, include_legacy_fallback=true)`: **zero rows** — confirms live
  that the legacy-views path cannot fire today (every `mangas.views` is 0; see CORRECTION above).
- **Deterministic E2E fixture** (`tests/e2e/t3023-ranking.spec.ts`) run against production, twice
  (once caught a real test bug, fixed, re-run clean): **2/2 PASS**. Built 5 real QA users across 3
  real catalog works, seeded rows through the real `user_canonical_reading_progress` insert path
  (firing T-3019's trigger), read back via the **anonymous** client, and confirmed live: a
  same-day spike (1 user, 6 sessions, 1 distinct day) and a 20-day one-user binge (capped at
  `distinct_active_days = 5`) both score below sustained engagement from 3 distinct users each
  active on 3 different days over ~3 weeks — the core T-3023 distinction, proven end-to-end, not
  just in unit tests. No QA user id or `@example.invalid` email ever appeared in either RPC's
  response. QA cleanup verified: zero `t3023`-prefixed accounts remain.
- **Homepage** (anonymous, production): "Populaires" rail renders the one real low-confidence result
  alongside the honest disclosure banner ("Classement basé sur une activité récente encore
  limitée…") — never presented as a confident top ranking. "Voir tout" links on both the Trending
  and Ranking homepage rails verified to point to `/trending` and `/ranking` respectively.
- **`/ranking`** (production): all four window tabs (24h/7d/30d/Tout) exercised live — 24h and 7d
  correctly show the full empty state (zero real activity in those shorter windows); 30d and Tout
  show the one real result with the low-confidence banner. Zero unhandled page errors.
- **Mobile** (390×844, 430×932, production): 7px and 0px horizontal overflow respectively — the 7px
  is the pre-existing, already-documented site-wide Header overflow (same as T-3017/T-3022's
  findings), not added by Ranking.
- **Accessibility** (axe-core scan of `/ranking`'s `<main>`): found and fixed two real issues before
  finalizing this report — a status-label contrast violation (`text-white/40` → `/70`) and an
  unlabeled cross-page link relying on hover-only underline (now always underlined). Re-scanned
  clean: only the single pre-existing, already-documented `bg-manga-purple` tab-pill contrast token
  remains (same one flagged in the T-3017 and T-3022 reports, not introduced here).
- **Regression** (production): `t3022-trending.spec.ts` **1/1 PASS** (proves the `get_trending_manga`
  refactor is behavior-preserving live, not just in unit tests), `t3020-search.spec.ts` **7/7 PASS**
  (+2 correctly skipped), `t3021-command-search.spec.ts` **7/7 PASS**, `reader-p1.spec.ts`
  **4/4 PASS**.

## RLS / PRIVACY VERIFICATION (live)

Direct anonymous REST reads against the three private activity tables all return zero rows (either
an empty array, for tables where the anon role has no matching RLS policy, or an explicit `401`
"permission denied" for `user_reading_history`, which additionally revokes the anon grant entirely) —
confirmed live, not just via the existing T-3013/T-3014 test suites (unchanged, not touched by this
migration). `_canonical_activity_window` is confirmed unreachable directly (`401`). Both public RPCs'
actual live responses contain only aggregate integers/booleans — no `user_id`, no email, verified by
inspecting the real JSON, not just the `RETURNS TABLE` clause.

## REGRESSIONS

- Full unit suite: **212/212 PASS** (194 pre-existing + 18 new).
- T-3022 regression (critical, since `get_trending_manga` was internally refactored):
  `npm run test:t3022` — **16/16 PASS** unit, **1/1 PASS** E2E against production, unchanged.
- `npx tsc --noEmit -p .`: **clean**.
- `npm run lint`: **0 errors**, 61 pre-existing warnings (unchanged).
- `npm run build`: **PASS**.
- Production E2E: T-3020 7/7, T-3021 7/7, T-3022 1/1, T-3023 2/2, Reader 4/4 — all re-run against the
  live `3b929fa` deployment.

## TYPESCRIPT

PASS.

## ESLINT

PASS: 0 errors.

## BUILD

PASS. Deployed asset `assets/index-DBYZanw6.js`, byte-identical to the local build of `3b929fa`.

## DEPLOYMENT

Committed as `2ba9e73` (feature) and `3b929fa` (accessibility follow-up), pushed to `origin/main`
(fast-forward, no `--force` either time), deployed by the existing Vercel pipeline. Migration
`20260913090000_add_manga_ranking_rpc.sql` applied directly via `npx supabase db push` under the
explicit authorization above; confirmed via `supabase migration list` and live RPC calls (see
MIGRATION APPLICATION above).

## ACCEPTANCE

```
TRENDING_DISTINCT_FROM_RANKING:   PASS (different weighting: recency+volume vs. repeat-readership)
SHARED_AGGREGATION_LAYER:         PASS (_canonical_activity_window; get_trending_manga refactored
                                   to use it, not duplicated; confirmed unreachable directly)
RATING_AUDITED_AND_EXCLUDED:      PASS (186/343 rows are provider-hardcoded constants; excluded
                                   entirely, not down-weighted)
VIEWS_LEGACY_FALLBACK_ONLY:       PASS (explicitly flagged, opt-out supported, never blended;
                                   confirmed live that it correctly never fires today since every
                                   mangas.views is 0 in production)
ANTI_SPAM_DEDUP:                  PASS (per-user session AND active-day cap; proven live in the
                                   E2E fixture, not just unit tests)
CANONICAL_DEDUP:                  PASS
RLS:                              PASS (private tables untouched; verified live that anon direct
                                   reads return zero rows; both RPCs' live responses contain no
                                   user_id/email)
REQUIRED_TEST_DISTINCTIONS_1-5:   PASS (unit + live production E2E fixture)
HOMEPAGE_INTEGRATION:             PASS (replaces the mislabeled fake "Populaires" rail; verified
                                   live, including the low-confidence disclosure banner)
MOBILE:                           PASS (390×844 7px / 430×932 0px; the 7px is the pre-existing
                                   sitewide Header issue, not added by Ranking)
ACCESSIBILITY:                    PASS (found and fixed 2 real issues during this validation pass;
                                   only the pre-existing, already-documented bg-manga-purple token
                                   remains)
T3020_REGRESSION:                 PASS (production E2E 7/7, +2 correctly skipped)
T3021_REGRESSION:                 PASS (production E2E 7/7)
T3022_REGRESSION:                 PASS (16/16 unit + 1/1 production E2E, confirming the
                                   get_trending_manga refactor is behavior-preserving live)
READER:                           PASS (production E2E 4/4)
TYPESCRIPT:                       PASS
ESLINT:                           0 ERRORS
BUILD:                            PASS
T3023_DATABASE:                   APPLIED
T3023_PRODUCTION:                 PASS
PRODUCTION_SMOKE:                 PASS_WITH_INSUFFICIENT_ORGANIC_ACTIVITY
QA_CLEANUP:                       PASS (zero t3023-prefixed accounts remain)
FINAL:                            APPROVE_T3023
```

## NEXT STEP

T-3023 is closed. Continuing autonomously to **T-3024 — Recommendations** per the standing directive,
which can now consume `_canonical_activity_window` directly (or a thin wrapper over it) for
canonical popularity/engagement features instead of scraping the UI or recomputing joins — the
shared-aggregation-layer groundwork this ticket was asked to lay.
