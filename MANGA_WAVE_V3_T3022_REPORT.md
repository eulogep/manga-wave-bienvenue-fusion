# T-3022 — Trending

Date: 2026-09-12

## OVERALL_STATUS

`IMPLEMENTED_LOCALLY / VERIFIED / MIGRATION_PENDING_EXPLICIT_AUTHORIZATION`.

Trending is fully designed, implemented, unit-tested and wired into the UI (homepage + `/trending`).
Everything that does not require a remote database change has been verified: 194/194 unit tests pass
(16 new), TypeScript is clean, ESLint is 0 errors, the production bundle builds, and a live-browser
check confirms the homepage and `/trending` render their graceful "not enough data" / retry states
without crashing while the RPC doesn't exist yet.

**One step remains and requires your explicit go-ahead**: applying the additive migration
(`supabase/migrations/20260912090000_add_trending_manga_rpc.sql`) to production. `supabase db push`
was blocked by this environment's own permission layer as a "Modify Shared Resources" action — that
block is the correct behavior for a remote database change, not a bug I should route around. See
`AUTHORIZATION_REQUIRED` below.

## WHY NOT `mangas.views`

Confirmed (again) before writing any code: `views` is never incremented anywhere in the codebase —
grepped `server/`, `supabase/functions/`, and every hook. It is a frozen value from initial seeding.
Building "Trending" on it would be presenting a static number as a live signal, which conflicts with
the project's own data-honesty precedent from T-3020 ("unknown is preferable to false"). Trending
instead aggregates three real, already-tracked activity signals.

## DATA SOURCES USED

- **`user_reading_history`** (T-3019): one row per (user, canonical manga, chapter) reading session,
  with rapid page turns on the same chapter within 30 minutes already collapsed into one row by its
  existing capture trigger. This is real reading momentum, not raw page-turn noise.
- **`user_follows`** (T-3014): unique per (user, canonical manga) by a database constraint — a follow
  cannot be duplicated.
- **`user_favorites`** (P1): unique per (user, canonical manga) by a database constraint, same
  property.

No new activity table was created. No signal was invented; reader-session activity, follows and
favorites are the only real, already-audited events Manga Wave produces today.

## PRIVACY / RLS ARCHITECTURE

`private per-user activity tables → SQL aggregation (SECURITY DEFINER) → anonymous canonical
metrics → public RPC`. The three source tables keep their existing RLS untouched (verified: the
migration contains no `disable row level security` / `drop policy`). `public.get_trending_manga` is
`SECURITY DEFINER` (so it can read across users to aggregate) but its `RETURNS TABLE` clause contains
only `canonical_manga_id, score, unique_readers, reading_sessions, new_follows, new_favorites, rank`
— no `user_id`, no email, no individual event, ever. Granted `EXECUTE` to `anon` and `authenticated`
(visitors can see Trending too). Enforced by `tests/trending.test.ts`, which asserts the returns
clause never contains `user_id` or `email`.

## ARCHITECTURE CHOICE: live RPC, not a stored/refreshed table

Considered both options from the ticket. Chose **A (a `SECURITY DEFINER` SQL function)** over **B (a
materialized aggregate table refreshed by cron)**: current activity volume across all three source
tables is a handful of rows total (verified via a live read-only count before writing any code), so
an on-demand aggregate is cheap and always fresh — a cron-refreshed table would only add a staleness
window and an hourly job for no benefit at this scale. The function signature
(`get_trending_manga(window_days, result_limit, max_sessions_per_user)`) is designed so a
table-backed implementation could replace it later (reusing the existing `daily_mangadex_catalog_sync`
`pg_cron` pattern) without any caller needing to change. Supporting indexes
(`user_reading_history_window_idx`, `user_follows_window_idx`, `user_favorites_window_idx`) are added
now so the live-query approach keeps scaling as volume grows.

## SCORING MODEL (documented and tested, not a black box)

```
score = unique_readers * 5 + new_follows * 3 + new_favorites * 2 + reading_sessions * 1
```

- **Unique readers weighted highest (5)**: prevents one person from dominating the ranking; reach
  across distinct people matters more than volume from one person.
- **Follows (3)** rank above **favorites (2)**: a follow is an explicit "keep tracking new chapters"
  intent signal; a favorite is a lighter bookmark.
- **Reading sessions (1)**, weighted lowest, and only after being capped (`max_sessions_per_user`,
  default 5) per user — otherwise a single binge-reader working through many chapters of one manga
  could out-score real multi-reader interest.
- The SQL and the TypeScript reference implementation (`src/domain/trending.ts`,
  `aggregateTrendingEvents`) are kept behaviorally equivalent and both tested.

## ANTI-GAMING / DEDUP

Structural, not bolted on: `user_follows` and `user_favorites` physically cannot hold a duplicate row
per (user, manga) — the unique constraints from T-3014/P1 make that a database-level guarantee, not
application logic that could be bypassed. `user_reading_history`'s own 30-minute same-chapter merge
(from T-3019) already prevents raw page-turn spam; this migration adds a second cap
(`least(sessions, max_sessions_per_user)`) on top so a user cannot inflate score by reading many
*different* chapters in the window either. Verified by `tests/trending.test.ts` ("one user is capped
at DEFAULT_MAX_SESSIONS_PER_USER sessions") and by the E2E fixture (Manga A: 3 distinct readers +
1 follow outranks Manga B: 1 reader).

## RECENCY / WINDOWS

`window_days` supports 24h, 7d (product default) and 30d (`TRENDING_WINDOW_DAYS` in
`src/domain/trending.ts`; the SQL function bounds it to `[1, 90]` regardless of caller input).
Activity outside the window is excluded outright (no decay function was added — a hard window is
simpler and just as testable, and volume doesn't currently justify decay complexity). Verified: the
E2E fixture seeds one reader 60 days in the past and confirms it is absent from both the 7d and the
24h result sets.

## MINIMUM SAMPLE PROTECTION

`assessTrendingConfidence()` in `src/domain/trending.ts` requires (a) a work's combined signal
(`unique_readers + new_follows + new_favorites`) to reach at least 2, and (b) at least 3 works to
qualify, before the UI renders a ranked list at all. Below that, `TrendingSection` shows: *"Pas
encore assez d'activité récente pour établir un classement."* — never a fabricated one-click #1.
Tested directly (`minimum-sample protection excludes an isolated single-signal work`,
`confidence requires enough qualifying works, not just one strong work`).

## SIGNAL DISPLAY

No raw score is ever rendered. `trendingLabel()` maps score ranges to `Nouveau signal` / `En hausse`
/ `Très lu cette semaine`; cards show rank (`#1`), cover, title, format badge (reusing T-3021's
manga/manhwa/manhua color convention) and status — never a provider label.

## UI / HOMEPAGE INTEGRATION

- `src/components/TrendingSection.tsx`: the one shared ranking-rendering component, used both
  embedded (`limit`, no window tabs) and full-page (`showWindowTabs`) — no duplicated ranking logic.
- Homepage: **replaced** the pre-existing "Tendances" rail (personalized mode), which was
  quietly sorting by the same frozen `views`/`rating` proxy this ticket explicitly rejects, with the
  real `TrendingSection`. Everything else on the homepage (Continue Reading, `FollowedUpdatesSection`,
  "Pour vous", "Récemment mis à jour", genre rail, "Séries terminées" for logged-in users; "Dernières
  sorties", "Populaires", format browser, "Découverte aléatoire" for visitors) is untouched.
  "Populaires" (anonymous mode) was left alone: it's honestly labeled as all-time popularity, not
  presented as Trending, and broader popularity/ranking is explicitly T-3023's scope, not this one's.
  Also added a real Trending rail to the **anonymous** homepage (prominent, per the ticket), right
  after "Dernières sorties".
- New `/trending` page: full ranked list with 24h/7d/30d window tabs, reusing `TrendingSection`.
- New Header nav entry ("Tendances", `TrendingUp` icon) — appears in both the desktop nav and the
  mobile drawer since both already iterate the same shared `navLinks` array.
- Confirmed live in a local browser (RPC absent, pre-migration): the homepage and `/trending` render
  their graceful empty/retry state with **zero unhandled page errors** — the missing RPC degrades
  gracefully rather than crashing anything else on the page.

## PERFORMANCE

One RPC call (aggregate ranks only) + a join against the already-cached T-3020 canonical snapshot
(`useCanonicalSearch`, shared with Search/Command Search — no second heavy metadata query). No
per-provider network call at any point.

## TESTS — DATABASE (via targeted assertions on the migration SQL, matching this repo's existing
convention for verifying RLS/security properties of a migration file — see `tests/t3014Follow.test.ts`
for precedent)

- RETURNS TABLE clause never contains `user_id` or `email`.
- `SECURITY DEFINER` and `SET search_path = public` are present (prevents search_path hijacking).
- `GRANT EXECUTE ... TO anon, authenticated` is present (aggregate is publicly readable).
- The per-user session cap (`least(sessions, greatest(1, coalesce(max_sessions_per_user, 5)))`) is
  present.
- No `DISABLE ROW LEVEL SECURITY` / `DROP POLICY` anywhere in the migration.
- The function never reads `public.mangas` (pure activity aggregation; metadata join happens
  client-side against the already-fetched canonical snapshot).

## TESTS — DOMAIN (`tests/trending.test.ts`, 16 tests, all passing)

Newer activity in-window vs. excluded activity before the window; more unique readers outranking one
user's repeated activity; the per-user session cap; zero activity producing zero (never fabricated)
results; follow/favorite weighting; canonical dedup (one manga, one row, regardless of how many event
kinds touched it); deterministic score and tie-break ordering; both minimum-sample-protection rules;
and label-tier mapping never exposing raw precision.

## E2E FIXTURE (`tests/e2e/t3022-trending.spec.ts`)

Builds real rows through the real application path — inserts into
`user_canonical_reading_progress`, which fires T-3019's existing `capture_canonical_reading_history`
trigger to populate `user_reading_history` (no direct history-table write, no fake UI-only
injection) — for three real catalog works:

- Manga A (*Kaiju No. 8*, id 100): 3 distinct QA readers within the last few hours + 1 follow.
- Manga B (*Pick Me Up, Infinite Gacha*, id 145): 1 QA reader, recent.
- Manga C (*99 Wooden Stick*, id 173): 1 QA reader, but 60 days in the past.

Then calls `get_trending_manga` through the **anonymous** Supabase client (proving the RPC is
genuinely publicly readable, not just reachable with elevated keys), and asserts: A and B both
appear, A's score exceeds B's, C is absent from both the 7-day and 24-hour windows, and the raw RPC
response never contains a QA user id or `@example.invalid` email. Cleanup in `afterAll` deletes all
seeded rows and QA users.

Verified with `npx playwright test --list` (parses/collects correctly, 1 test).
**Not executed** — it calls `public.get_trending_manga`, which does not exist in production until
the pending migration is applied. Run via `npm run test:e2e:t3022` once the migration is live.

## AUTHORIZATION_REQUIRED

`npx supabase db push` (to apply `20260912090000_add_trending_manga_rpc.sql`) was blocked by this
environment's own auto-mode permission classifier as a "Modify Shared Resources" action requiring
explicit approval. This is exactly the kind of remote-migration gate the ticket itself calls out
("remote migrations require explicit authorization... ask only if... prepare everything before
asking"), so I did not attempt to route around it (e.g. a direct psql connection or a raw SQL-over-
REST call) — that would defeat the purpose of the gate.

Everything is prepared and locally validated:
- `DRY_RUN` equivalent: the migration is additive-only (new indexes, one new function, no `ALTER`/
  `DROP` on any existing column, table, row, or policy) — reviewed above, line by line, in this
  report.
- `NO_DESTRUCTIVE_CHANGE: PASS` — confirmed by inspection and by the "does not touch existing RLS"
  unit test.
- Local build/lint/typecheck/unit tests all pass with the migration file present (tests read it as
  a static file to verify its shape; no test requires a live database to run this migration).

**What applying it would do**: create 3 new indexes and 1 new `SECURITY DEFINER` function, grant it
`EXECUTE` to `anon`/`authenticated`. No existing data, column, row, or policy is modified or removed.

Once you authorize, the remaining steps are mechanical: `npx supabase db push` (or the earlier
direct-write path if preferred), confirm via `supabase migration list`, run
`npm run test:e2e:t3022` against production, run a full production smoke pass, and finalize this
report's `PRODUCTION_SMOKE` / `ACCEPTANCE` sections with real results.

## PRODUCTION_SMOKE

**BLOCKED_ON_MIGRATION_AUTHORIZATION.** Cannot be attempted until the RPC exists in production.
Given the current real activity in the database (verified read-only before writing any code: at most
1–2 real rows total across `user_follows`/`user_favorites`/`user_canonical_reading_progress`, all
from 2026-08-30 — outside even a 30-day window measured from 2026-09-12), the honest expectation once
the migration is live is:

```
PRODUCTION_ACTIVITY_INSUFFICIENT_FOR_MEANINGFUL_RANKING
```

The homepage and `/trending` will correctly show the "not enough recent activity" empty state rather
than a fabricated ranking — that is the intended, tested behavior of
`assessTrendingConfidence()`, not a bug to be worked around by lowering the thresholds to force a
green checkmark.

## EXISTING REGRESSIONS

- Full unit suite: **194/194 PASS** (178 pre-existing + 16 new).
- `npx tsc --noEmit -p .`: **clean**.
- `npm run lint`: **0 errors**, 61 pre-existing warnings (unchanged).
- `npm run build`: **PASS**.
- Live-browser check (local dev server, RPC intentionally absent): homepage and `/trending` render
  with **zero unhandled page errors** — confirms T-3020 (Search/canonical snapshot reuse), T-3021
  (Header nav, Command Search unaffected) and P1/P2/Reader are not disturbed by this change. Full
  production E2E re-run for T-3020/T-3021/Reader/P1/P2 was not repeated in this pass since nothing in
  those areas' code changed here beyond the additive Header nav-link entry (typechecked, linted,
  visually inspected) — they were already re-verified against production in the prior session.

## TYPESCRIPT

PASS: `npx tsc --noEmit -p .` clean.

## ESLINT

PASS: 0 errors, 61 historical warnings (unchanged).

## BUILD

PASS. Local candidate asset `assets/index-CRMqgZ5r.js`.

## ACCEPTANCE

```
TRENDING_DATA_REAL:              PASS (reading sessions, follows, favorites — never views)
USES_CANONICAL_IDS:               PASS
RAW_USER_DATA_EXPOSED:            NO
RLS:                              PASS (private tables untouched; RPC returns aggregates only)
RECENCY_WINDOW:                   PASS (24h / 7d / 30d)
UNIQUE_USER_WEIGHTING:            PASS (weighted highest; verified by test + E2E fixture)
ANTI_SPAM_DEDUP:                  PASS (structural constraints + explicit per-user session cap)
CANONICAL_DEDUP:                  PASS
LOW_ACTIVITY_STATE:               PASS (tested; never fabricates a ranking)
HOMEPAGE_INTEGRATION:             PASS (replaces the mislabeled fake rail; adds a real one for visitors)
MOBILE:                           NOT YET VERIFIED (needs the live RPC to render real ranked cards;
                                   empty/loading states confirmed non-crashing pre-migration)
ACCESSIBILITY:                    PARTIAL (labeled tabs/links/headings in place; no axe pass yet —
                                   deferred to the same post-migration validation pass as MOBILE)
T3020_REGRESSION:                 PASS (unit; canonical snapshot reused, no live re-run this pass)
T3021_REGRESSION:                 PASS (unit; Header nav change typechecked/linted, no live re-run)
P1_REGRESSION:                    PASS (unit)
P2_REGRESSION:                    PASS (unit)
READER:                           PASS (untouched; no code path shared)
TYPESCRIPT:                       PASS
ESLINT:                           0 ERRORS
BUILD:                            PASS
PRODUCTION_SMOKE:                 BLOCKED_ON_MIGRATION_AUTHORIZATION
FINAL:                            FIX_T3022_BEFORE_T3023 — pending only the migration authorization
                                   and its post-apply validation pass; no code defect is open.
```

## NEXT STEP

Awaiting explicit authorization to run `npx supabase db push` for
`20260912090000_add_trending_manga_rpc.sql`. Once granted: apply, verify via
`supabase migration list`, run `npm run test:e2e:t3022` and a full production smoke pass (including
MOBILE at 390×844/430×932 and an axe scan) against the live RPC, update this report's
`PRODUCTION_SMOKE`/`MOBILE`/`ACCESSIBILITY`/`ACCEPTANCE` sections with real results, commit, and only
then continue autonomously to T-3023 per the standing directive.
