# Manga Wave V3 — T-3017 Library V2

## OVERALL_STATUS

Implemented and verified locally (unit tests, typecheck, lint, build, and all P1/P2/T-3013/T-3014/T-3015
regression suites). Live E2E execution and production smoke were **not run in this session** — no
browser runtime or QA Supabase credentials are available here. A deterministic Playwright spec was
authored and verified to list/parse correctly; it needs to be run from an environment holding the
existing QA secrets (the same ones `test:e2e:t3013`/`test:e2e:t3014` already use).

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

Not verified against an actual 390×844/430×932 viewport in this session (no browser runtime here) —
**INCONCLUSIVE**, honestly reported per §26. The layout was built mobile-first with that in mind:
2-column card grid down to small screens, `min-h-11` (44px) touch targets on tabs and quick actions,
no provider metadata anywhere on the card, and no fixed-width elements that would force horizontal
scroll. This needs a real/emulated viewport pass before sign-off.

## ACCESSIBILITY

- Section tabs use `role="tablist"`/`role="tab"`/`aria-selected` and are plain `<button>`s (keyboard
  reachable, no custom key handling removed).
- Cards expose accessible names via `aria-label` on the cover link, the overflow-menu trigger
  (`Actions pour {title}`), and the Resume/Update links (`Reprendre {title} au chapitre {n}`,
  `Lire le nouveau chapitre {n} de {title}`).
- Badges (Suivi/Favori/Nouveau) pair an icon with text, not color alone.
- Not run through an automated a11y checker in this session — recommend an axe pass alongside the
  mobile viewport check.

## RLS

No new tables/columns were added, so no new RLS surface was introduced. Library reads exclusively
from tables whose RLS policies already restrict rows to `auth.uid()` (`user_favorites`,
`user_follows`, `user_canonical_reading_progress`, `user_followed_chapter_state` via
`useFollowedChapterUpdates`) — all four migrations were inspected in this session and enforce
owner-only `select`/`insert`/`update`/`delete`. Live network verification (a second user seeing zero
rows) was **not** re-run here since it isn't new code; it's already covered by
`scripts/verify-t3014-db.mjs` and the T-3013/T-3014 E2E suites' `observerClient` isolation checks.

## E2E

Added `tests/e2e/t3017-library.spec.ts`, modeled on the existing T-3013/T-3014 Playwright fixtures
(temporary QA user, deterministic provider-chapter mocking, cleanup in `afterAll`). It exercises:
one canonical card across sections, Favorite-only visibility in "Favoris" but not "Suivis", Resume to
the exact saved chapter/page, Follow + unread update appearing in "Nouveautés", the update clearing
after it's read, and no duplicate card appearing at any point. Verified with
`npx playwright test --list` (parses/collects correctly). **Not executed** — requires
`VITE_SUPABASE_URL` / anon key / service key and a reachable deployment, none of which are available
in this sandboxed session. Added `npm run test:e2e:t3017` to match the existing script convention.

## PRODUCTION_SMOKE

**Not run** — same constraint as above (no network/browser/credentials in this environment). This
must be run against the deployed URL with the QA account before this ticket is considered fully
closed, using `npm run test:e2e:t3017` once secrets are available in that environment.

## QA_CLEANUP

The new E2E spec deletes its temporary user and all rows it created in `afterAll` (mirroring
T-3014's pattern), but since it wasn't executed, no live QA data was created or needs cleanup from
this session.

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

E2E suites (`reader-p1`, `t3013`, `t3014`, `t3015`) were **not re-run live** in this session (same
credential/browser constraint as above); nothing in this change touches the Reader, source
resolution, or the notification engine's logic, only how Library reads and renders their already
canonical state.

## TYPESCRIPT

`npx tsc --noEmit` → clean, no errors.

## ESLINT

`npm run lint` → **0 errors** (57 pre-existing warnings, all in files this ticket did not touch —
`react-refresh/only-export-components` on shared UI primitives).

## BUILD

`npm run build` → succeeds.

## DEPLOYMENT

Not deployed from this session. No infrastructure/deploy access was exercised here; deployment
should follow the project's existing pipeline once this branch is reviewed.

## COMMITS

See the repository log for the commit(s) accompanying this report.
