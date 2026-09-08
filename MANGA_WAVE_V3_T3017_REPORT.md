# Manga Wave V3 — T-3017 Library V2

## FINAL VALIDATION ADDENDUM (post-deployment)

This addendum supersedes the "not run" caveats in the original report below: the commit was pushed,
deployed, and the E2E suite + a production accessibility scan were actually executed against
production with real QA credentials in a follow-up pass.

- Pushed `9498142` → `origin/main` (fast-forward, no `--force`) and confirmed Vercel served
  `assets/index-CNYLccDw.js`, byte-identical to the local build hash of that commit (HTTP 200).
- Ran `tests/e2e/t3017-library.spec.ts` against production: it caught one real test race (asserted
  the "Nouveautés" card was gone before the 750ms debounced read-acknowledgement had flushed — the
  same debounce T-3013/T-3014 already account for) — fixed in the test, not the product.
- Extended the same spec with two more real, pre-existing catalog rows (Kaiju No. 8 = completed,
  Pick Me Up Infinite Gacha) to actually exercise Terminés, in-library search, both sort orders, and
  post-follow Suivis — previously only unit-tested.
- Ran an axe-core scan of the authenticated, populated `/library` page. It found one violation
  attributable to this ticket's new markup: the sort `<Select>` trigger had no accessible name
  (`button-name`, critical). Fixed with `aria-label="Trier la bibliothèque"`.
- Committed both fixes as `b52c8ad`, pushed (fast-forward), confirmed the new deploy
  (`assets/index-D2JmEsEo.js`, byte-identical to the local build, HTTP 200), and re-ran the E2E spec
  against that final production build: **pass**.
- Ran a Chromium viewport check of `/library` at 390×844 and 430×932. Found a 13px horizontal
  overflow at 390×844 — traced it to the site-wide `<Header>` (icon row), reproduced identically on
  the homepage (untouched by this ticket) as a control, and confirmed via `git log -p` that Library's
  own markup does not introduce it. Pre-existing, out of scope for T-3017.
- Cleaned up all QA accounts this session created (`t3017` prefix): confirmed zero remain.

See the PASS/FAIL table at the end of this file for the final per-item gate result.

## OVERALL_STATUS (original, pre-deployment)

Implemented and verified locally (unit tests, typecheck, lint, build, and all P1/P2/T-3013/T-3014/T-3015
regression suites). Live E2E execution and production smoke were **not run in this session** — no
browser runtime or QA Supabase credentials are available here. A deterministic Playwright spec was
authored and verified to list/parse correctly; it needs to be run from an environment holding the
existing QA secrets (the same ones `test:e2e:t3013`/`test:e2e:t3014` already use).

*(Superseded — see the addendum above: this was in fact run in a follow-up pass of this same session.)*

## LIBRARY_MODEL

Library V2 stays canonical: `mangas.id` (already the canonical primary key from P1) is the aggregation
key. New domain module `src/domain/libraryItem.ts` defines `LibraryItem` and a pure
`aggregateLibraryItems()` function that merges Favorite (`user_favorites`), Follow (`user_follows`),
reading progress (`user_canonical_reading_progress`) and unread updates (T-3013's
`useFollowedChapterUpdates`) onto one row per canonical manga. No new provider-shaped types were
introduced; no per-provider identity is part of the key.

## CANONICAL_AGGREGATION

`src/hooks/useLibraryItems.ts` reads the four Supabase signals (all already RLS-scoped to
`auth.uid()` by existing migrations — no schema changes were needed) and calls
`aggregateLibraryItems()`. This is the only query surface the Library page reads from; no
per-provider network calls happen while rendering cards (§23/§24 respected).

## SECTIONS

`Library.tsx` now exposes: **Tous, En cours, Favoris, Suivis, Nouveautés, Terminés** as a single
tab bar (`role="tablist"`) driven by `LibrarySectionId`. "À lire" was intentionally not added —
no distinct user state exists for it yet, and equating Favorite with "to read" would have been
scope creep per §8.

## FILTERS

Implemented as the section tabs themselves (Tous/En cours/Terminés as status, Favoris/Suivis as
relationship, Nouveautés as update) rather than a separate filter panel — this matches §13's
"do not build a complex enterprise filter panel" while still covering every recommended filter.

## SORT

`LibrarySortOption`: `activity` (default, §14), `lastRead`, `lastUpdated`, `title`. Implemented in
`sortLibraryItems()` and unit-tested.

## SEARCH

Lightweight in-library search by (normalized) title via `searchLibraryItems()`, using the existing
`normalizeMangaTitle` from the canonical manga domain (accent/case-insensitive). No provider search
was added.

## FAVORITE

Unchanged semantics/table (`user_favorites`); `useFavorites().toggleFavorite` is reused from the
existing hook, now also invalidating the new `favorites-detailed` / `library-items` query keys so
the Library page stays in sync with the rest of the app.

## FOLLOW

Unchanged semantics/table (`user_follows`, T-3014); `useCanonicalFollow` is reused as-is from the
Library card's overflow menu ("Suivre" / "Ne plus suivre"). Follow and Favorite remain fully
independent — covered by dedicated unit tests.

## PROGRESS

Reads `user_canonical_reading_progress` (P1's canonical continue-reading table) directly instead of
the local-storage/legacy path used by the old "Historique" tab. "En cours" = has progress AND
`canonicalStatus !== 'completed'` (§3).

## UPDATES

Reuses T-3013's `useFollowedChapterUpdates` unread-detection engine unchanged — no second updates
engine was built (§6). "Nouveautés" section = items with `unreadUpdate.count > 0`. Reading a new
chapter goes through the existing Reader/progress-write path, which already acknowledges
`user_followed_chapter_state.read_at` and invalidates `followed-chapter-updates` — Library's badge
clears through the same signal instead of a duplicate one (§20).

## COMPLETED

`isCompleted(item) = item.canonicalStatus === 'completed'`, i.e. interpretation **A** (series status)
from §7 only. **DOCUMENTED_LIMITATION**: "Lecture terminée" (user finished the final chapter) is not
modeled — there's no reliable canonical "last chapter" fact plumbed here yet — so "Terminés" only
ever reflects the series' own status, never inferred from progress. This should be revisited once/if
a real completion signal exists; mixing the two silently was explicitly disallowed by the ticket.

## RESUME

`item.resume` carries the canonical `{source, providerMangaId, chapterId, language, pageIndex}` from
the latest `user_canonical_reading_progress` row, run through the existing `buildReaderLocation()` —
same function P1/T-3012 already use, so source abstraction and Reader navigation are untouched.
`aria-label="Reprendre {title} au chapitre {n}"` per §27's example.

## DEDUP

`aggregateLibraryItems()` keys by `canonicalMangaId` (falling back to a title-based canonical key only
when a progress row lacks one, which is a pre-existing edge case unrelated to T-3017). Favorite +
Follow + Progress + Update on the same manga always collapse into a single `LibraryItem`. Covered by
a dedicated unit test ("canonical dedup: same canonical manga discovered through two provider
contexts renders once").

## NOTIFICATION_COHERENCE

No second notification/read-state table was introduced. Library's unread badge and T-3015's
notification badge both read the same `user_followed_chapter_state.read_at` acknowledgement written
by `useRecordReading`, so reading a chapter clears both consistently (§20).

## MOBILE

**PASS for Library's own markup**, with one pre-existing, out-of-scope finding disclosed rather than
hidden. Actually run in Chromium at both required viewports against production:

- 430×932: 0px horizontal overflow.
- 390×844: 13px horizontal overflow — traced with an element-by-element scan to the site-wide
  `<Header>` icon row (`right: 403` vs `clientWidth: 390`), not to anything in Library.tsx. Reproduced
  the identical 13px overflow on the untouched homepage as a control, and confirmed via
  `git log -p -- src/pages/Library.tsx` that this predates T-3017. Not fixed here (out of scope: a
  site-wide Header layout issue, not a Library regression) — flagged for a separate ticket.
- Card grid stays 2-column at both widths, quick actions and tabs are `min-h-11` (44px), no provider
  metadata takes card space.

## ACCESSIBILITY

**PASS**, after fixing the one violation this ticket's markup actually introduced. Ran an axe-core
scan of the authenticated, populated `/library` page (production, then re-confirmed on the fixed
local build):

- Fixed: the sort `<Select>` trigger had no accessible name (`button-name`, critical) — added
  `aria-label="Trier la bibliothèque"`.
- Left undisturbed (pre-existing, confirmed via `git log -p` on the old `Library.tsx`, same tokens
  used site-wide): `color-contrast` on the active-tab pill (`bg-manga-purple`/`text-white`) and on the
  footer copyright line. Neither was introduced by T-3017; flagged for the design system, not fixed
  under this ticket's scope.
- Section tabs use `role="tablist"`/`role="tab"`/`aria-selected` and are plain `<button>`s (keyboard
  reachable).
- Cards expose accessible names via `aria-label` on the cover link, the overflow-menu trigger
  (`Actions pour {title}`), and the Resume/Update links (`Reprendre {title} au chapitre {n}`,
  `Lire le nouveau chapitre {n} de {title}`).
- Badges (Suivi/Favori/Nouveau) pair an icon with text, not color alone.

## RLS

No new tables/columns were added, so no new RLS surface was introduced. Library reads exclusively
from tables whose RLS policies already restrict rows to `auth.uid()` (`user_favorites`,
`user_follows`, `user_canonical_reading_progress`, `user_followed_chapter_state` via
`useFollowedChapterUpdates`) — all four migrations were inspected in this session and enforce
owner-only `select`/`insert`/`update`/`delete`. Live network verification (a second user seeing zero
rows) was **not** re-run here since it isn't new code; it's already covered by
`scripts/verify-t3014-db.mjs` and the T-3013/T-3014 E2E suites' `observerClient` isolation checks.

## E2E

**PASS.** `tests/e2e/t3017-library.spec.ts`, modeled on the T-3013/T-3014 Playwright fixtures
(temporary QA user, deterministic provider-chapter mocking, cleanup in `afterAll`), run against
production (`https://manga-wave-bienvenue-fusion.vercel.app`) with the same `.env` QA/Supabase
secrets T-3013/T-3014/T-3015 already use. Two real bugs in the *test* were found and fixed along the
way (a premature assertion racing the 750ms debounced read-ack, and a brittle locator for the
title-sort check) — the product code needed no change beyond the accessible-name fix under
ACCESSIBILITY. Final run, against the final deployed commit (`b52c8ad`, asset `index-D2JmEsEo.js`):
**1 passed**. Coverage in this one spec: one canonical card across Tous/Favoris/Suivis/Terminés,
Favorite-only vs. Follow-only vs. both, Resume to the exact saved chapter/page, Follow + unread
update appearing in Nouveautés and clearing after it's read, in-library search (match + no-match),
both sort orders (Titre A–Z and Activité récente), and no duplicate card at any point.
`npm run test:e2e:t3017` runs it.

## PRODUCTION_SMOKE

**PASS.** Executed live against production with the QA account, covering every item on the required
checklist:

- login compte QA: PASS
- Library ouverte: PASS
- Tous: PASS (3 items, one per canonical manga, no duplicates)
- En cours: PASS (Resume link visible and correct)
- Favoris: PASS
- Suivis: PASS (0 before follow, 1 after)
- Nouveautés: PASS (appears after publication, CTA visible)
- Terminés: PASS (canonical `status = completed`, interpretation A only — documented limitation
  above still applies to "Lecture terminée")
- recherche bibliothèque: PASS (title match narrows to 1, non-match shows the empty-filter state)
- tri activité récente: PASS (most recently touched item first); Titre A–Z also verified
- un seul item par manga canonique: PASS
- Favorite et Follow indépendants: PASS
- Resume ouvre le bon chapitre/page: PASS (URL asserted: exact chapter id + `page=2`)
- ouverture d'une nouveauté: PASS
- lecture de la nouveauté → état Nouveau disparaît: PASS (DB `read_at` confirmed cleared, then UI)
- Notifications / Updates cohérents: PASS by construction — both read the same
  `user_followed_chapter_state.read_at` acknowledgement; not separately re-clicked in the bell UI
  this pass, but no second read-state was introduced
- aucun doublon provider: PASS (no provider identity rendered anywhere on the cards; verified by the
  existing unit test plus visual confirmation during the E2E run)

## QA_CLEANUP

**PASS.** The E2E spec's `afterAll` deletes its temporary user and rows. Verified via the Supabase
Admin API after both E2E runs: zero `t3017`-prefixed QA users remain. Two extra QA users were created
manually in this session for the axe-core scan (a throwaway script, not the tracked spec) and were
not auto-cleaned because the first script run errored before reaching its cleanup step; found and
deleted manually — confirmed zero remain. One unrelated leftover QA user from an earlier T-3015
session was noticed incidentally (`codex-t3015-e2e-...`); it predates this session and is outside
T-3017's scope, so it was left alone rather than acted on without being asked.

## REGRESSIONS

All run locally in this session:

- `npm run test:p1` → **41/41 PASS**
- `npm run test:p2` → **9/9 PASS**
- `npm run test:t3013` → **7/7 PASS** (one assertion updated to match Library V2's new card
  architecture — see note below)
- `npm run test:t3014` → **12/12 PASS**
- `npm run test:t3015` → **12/12 PASS**
- `npm run test:t3017` (new) → **11/11 PASS**

Note on the T-3013 suite: `tests/followedChapterUpdates.test.ts` had one assertion literally matching
the old `<MangaCard newChapterCount={update?.newChapterCount} />` JSX in `Library.tsx`. Library V2
replaced that bespoke card usage with its own `LibraryCard` driven by `LibraryItem.unreadUpdate`. The
assertion was updated to check the equivalent new wiring (`useFollowedChapterUpdates` inside
`useLibraryItems.ts`, and `item.unreadUpdate` inside `Library.tsx`) rather than removed — the
underlying behavior (unread badge + "read now" link sourced from T-3013's engine) is unchanged and
still covered end-to-end by the rest of that suite.

Re-run again after the `b52c8ad` follow-up fix, all still green: P1 41/41, P2 9/9, T3013 7/7,
T3014 12/12, T3015 12/12, T3017 11/11.

E2E suites `reader-p1`, `t3013-deterministic-smoke`, `t3014-follow`, `t3015-notifications` were
**not re-run live** in this pass; nothing in this change touches the Reader, source resolution, or
the notification engine's logic, only how Library reads and renders their already canonical state,
and `t3017-library.spec.ts` (which was run live) exercises the same shared read-acknowledgement path
those suites depend on.

## TYPESCRIPT

`npx tsc --noEmit` → clean, no errors.

## ESLINT

`npm run lint` → **0 errors** (57 pre-existing warnings, all in files this ticket did not touch —
`react-refresh/only-export-components` on shared UI primitives).

## BUILD

`npm run build` → succeeds.

## DEPLOYMENT

Pushed to `origin/main` (fast-forward both times, no `--force`) and deployed by the project's
existing Vercel pipeline — no manual deploy trigger was used. Confirmed by matching the served
`assets/index-*.js` hash to the local build hash of the pushed commit, twice:

- `9498142` → `assets/index-CNYLccDw.js` (HTTP 200)
- `b52c8ad` → `assets/index-D2JmEsEo.js` (HTTP 200)

## COMMITS

- `9498142` — feat: add canonical Library V2
- `b52c8ad` — fix: T-3017 QA follow-up — sort combobox name + broaden E2E coverage

Both on `origin/main`, HEAD at `b52c8ad` as of this report.

## FINAL GATE

```
T3017_E2E:                      PASS
PRODUCTION_SMOKE:                PASS
CANONICAL_DEDUP:                 PASS
FAVORITE_FOLLOW_INDEPENDENCE:    PASS
RESUME:                          PASS
UPDATE_CLEAR:                    PASS
NOTIFICATION_COHERENCE:          PASS
SEARCH:                          PASS
SORT:                            PASS
MOBILE:                          PASS (Library markup) — 13px Header overflow at 390×844 is
                                  pre-existing/out-of-scope, reproduced identically on the
                                  untouched homepage; not a T-3017 regression
ACCESSIBILITY:                   PASS (1 real finding fixed: sort control accessible name;
                                  2 pre-existing color-contrast tokens flagged, not fixed —
                                  out of scope, predate this ticket)
QA_CLEANUP:                      PASS

T3017_FINAL: APPROVED
```

No T-3019 work was started.
