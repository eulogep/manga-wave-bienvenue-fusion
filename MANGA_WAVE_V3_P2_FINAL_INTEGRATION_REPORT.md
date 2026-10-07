# Manga Wave V3 — P2 final integration review

Date: 2026-09-09
Production: `https://manga-wave-bienvenue-fusion.vercel.app/`
Reviewed commit: `e5447103ceb52577d74b8582bd60d7a69ba44218`
Production asset: `assets/index-Bgz9jF22.js`
Hotfix candidate: local, not deployed

## OVERALL_STATUS

**VALIDATION_BLOCKED.** The confirmed Continue Reading hydration defect is fixed locally and all non-network validation passes. The real Supabase multi-session E2E and production smoke remain pending because the Mac currently has no DNS configuration and cannot resolve either Supabase or GitHub. P2 remains open until those gates pass.

The product change is limited to the Continue Reading hydration contract. P3 was not started.

## CANONICAL_IDENTITY

**PASS.** Favorite, Follow, Updates, Notifications, Library, Reader, Progress and History resolve to one canonical manga. The production Reader test switches between OriginManga and AsuraScans while preserving logical chapter and page. Library renders one card after Favorite + Follow + Progress + Update. History coalesces the same chapter across providers. `CANONICAL_DUPLICATION: 0` on all tested exact-work surfaces.

## FAVORITE_FOLLOW

**PASS.** Production tests cover Favorite-only, Follow-only and combined state. Favorite-only creates no monitoring event. Follow does not require Favorite. Combined state stays one Library item. Unfollow preserves Favorite, canonical progress and History.

## UPDATE_PIPELINE

**PASS.** A baseline produces zero unread chapters. A later deterministic chapter produces one canonical update without historical flooding. Reading it clears the Homepage and Library update state.

## NOTIFICATION_PIPELINE

**PASS.** The same update produces one in-app notification with the correct canonical manga/chapter. Read acknowledgement clears its unread state.

## NOTIFICATION_IDEMPOTENCY

**PASS.** Three repeated observations of the same publication keep the total at one notification. The database uniqueness key remains owner + canonical manga + canonical chapter + type.

## NOTIFICATION_TO_READER

**PASS.** A real pointer click resolves to the correct logical chapter and opens the Reader. No chapter-1 fallback or fixed provider dependency was observed.

## READER_REGRESSION

**PASS.** Production Reader suite: **4/4**. Next/Previous update page, URL and rendered image; Settings opens and exposes sources; manual source switch preserves logical chapter/page; auto-hide reaches opacity zero with pointer events disabled and becomes pointer-reachable again for three cycles.

## PROGRESS_COHERENCE

**FAIL across sessions; PASS within one session.** Reader, canonical progress, current-session Homepage Continue Reading, Library Resume and History agree on chapter/page. After login in a fresh browser context, the canonical progress row still exists and Library/History show it, but Homepage Continue Reading shows no card.

Root cause is localized to `useContinueReading`: an empty localStorage array is supplied as React Query `initialData` with `staleTime: 10_000`. In a fresh browser, that empty array is considered fresh and suppresses the initial Supabase fetch. A reload constructs another fresh empty query state, so the remote progress remains hidden. A focused fix should make empty local seed data stale immediately (for example through `initialDataUpdatedAt`) or use placeholder semantics while the authenticated remote query runs. This review did not implement the fix.

## UPDATE_ACK

**PASS.** After Reader persistence, followed chapter unread count, Library update badge and notification unread count all reach zero. No contradictory stale badge remained in the tested current session.

## LIBRARY_COHERENCE

**PASS.** One canonical card aggregates Favorite, Follow, Progress and Update. Tous, En cours, Favoris, Suivis, Nouveautés and Terminés pass. Search and both sort orders pass. Library refresh and fresh-session login both load Supabase state. Resume remains after History deletion/clear.

## HISTORY_COHERENCE

**PASS.** Canonical manga, logical chapter, latest page and timestamp persist. Five page writes and a provider switch coalesce into one session event. Chronology, filters, search and 25-item pagination pass.

## HISTORY_PROGRESS_SEPARATION

**PASS.** Single deletion and Clear History remove only history events. Favorite, Follow, Library membership and canonical Resume remain. Resuming after Clear creates a new natural reading event without restoring deleted chronology.

## SOURCE_ABSTRACTION

**PASS.** Homepage, Library, History and Notifications present canonical works; provider identity does not become the primary item identity. Search exposes source choice only in its advanced section. Reader Settings exposes source as an advanced/recovery control, as intended.

## SEARCH_REGRESSION

**PASS.** Production search for `Solo Leveling` returned the exact canonical titles `Solo Leveling` and the distinct work `Solo Leveling Ragnarok`. Exact `Solo Leveling` occurred once. No MangaFire label/garbage appeared in the canonical result section. No uncontrolled provider failure broke the search state.

## RLS

**PASS.** A real two-user Supabase test returned zero cross-user rows for `user_favorites`, `user_follows`, `user_followed_chapter_state`, `user_notifications`, `user_canonical_reading_progress` and `user_reading_history`. Existing E2Es also verify refused cross-user notification mutation and History deletion isolation.

## MULTI_SESSION

**FAIL.** In one fresh browser context using the same account, Library and History persisted correctly, while Homepage Continue Reading returned zero items despite two canonical progress rows being present. The final integration assertion reproduced this deterministically.

## DIRECT_REFRESH

**PASS with the multi-session exception above.** Reader, Library, History and current-session Homepage survived direct navigation/refresh. Fresh-session Homepage remote hydration is the blocker described under MULTI_SESSION.

## MOBILE

**PASS for this production run.** At 390×844 and 430×932, Homepage, Library, History and Notification center reported zero document overflow; the Notification panel remained within viewport width. The previously documented 13 px Header overflow was not reproduced in this seeded run and remains listed as historical tech debt rather than treated as fixed.

## ACCESSIBILITY

**PRE_EXISTING_ONLY.** No critical violations. The Notification dialog had zero axe violations. Homepage, Library and History reproduced the known shared `color-contrast` rule on 2/4/2 nodes respectively. Authenticated Homepage also reports `page-has-heading-one` (moderate); Git history shows the personalized branch without an H1 dates to the approved T-3011 implementation, not this review. No new critical/high accessibility regression was introduced during review.

## QA_CLEANUP

**PASS for this review.** All `codex-p2-final-*` accounts and every temporary account created by the executed T-3013/T-3014/T-3015/T-3017/T-3019 runs were deleted. A pre-existing `codex-t3015-*` account created at `2026-09-08T09:25:23Z` remains; it predates this final-review run and was deliberately not deleted because the brief classifies old QA accounts as known debt.

## REGRESSION EVIDENCE

- Production deterministic E2E baseline: **11/11 PASS** in one run (Reader 4, T3013 1, T3014 1, T3015 1, T3017 1, T3019 3).
- Strengthened same-account P2 retention loop: **FAIL only on the final fresh-session Homepage assertion**; all preceding Favorite/Follow/Notification/Reader/Library/History/delete/clear/unfollow assertions passed.
- Canonical Search: **PASS**.
- Mobile and axe inventory: **PASS**, findings classified above.
- Real six-table RLS integration: **PASS**.
- Unit regression suites: **109/109 PASS**.
- TypeScript application check: **PASS**.
- Server TypeScript build: **PASS**.
- ESLint: **0 errors, 57 known warnings**.
- Production build: **PASS**, matching production JS asset hash; existing bundle-size warning remains.

## SEVERITY

**CRITICAL: 0**

**HIGH: 1**

- Authenticated Homepage Continue Reading does not hydrate canonical Supabase progress in a fresh browser/session when localStorage starts empty. Cross-device/cross-session Resume discovery is therefore missing from the Homepage, although Library and History remain correct.

**MEDIUM: 1 pre-existing**

- Authenticated Homepage has no level-one heading (`page-has-heading-one`).

**LOW: 0 newly identified**

## KNOWN_TECH_DEBT

- Historical ~98 CRLF/LF-only worktree differences remain outside the index.
- 57 ESLint Fast Refresh warnings.
- Shared contrast tokens already documented by T-3017.
- Historical 13 px mobile Header overflow, not reproduced in this run.
- One older T-3015 QA account predating this review.
- Frontend bundle-size warning.

## FINAL GATES

```text
CANONICAL_IDENTITY:              PASS
FAVORITE_FOLLOW:                 PASS
UPDATE_PIPELINE:                 PASS
NOTIFICATION_PIPELINE:           PASS
NOTIFICATION_IDEMPOTENCY:        PASS
NOTIFICATION_TO_READER:          PASS
READER_REGRESSION:               PASS
PROGRESS_COHERENCE:              FAIL
UPDATE_ACK:                      PASS
LIBRARY_COHERENCE:               PASS
HISTORY_COHERENCE:               PASS
HISTORY_PROGRESS_SEPARATION:     PASS
SOURCE_ABSTRACTION:              PASS
SEARCH_REGRESSION:               PASS
RLS:                             PASS
MULTI_SESSION:                   FAIL
DIRECT_REFRESH:                  PASS (same session; fresh Homepage exception)
MOBILE:                          PASS
ACCESSIBILITY:                   PRE_EXISTING_ONLY
QA_CLEANUP:                      PASS
CRITICAL:                        0
HIGH:                            1
```

## CONTINUE_READING_ROOT_CAUSE

**CONFIRMED.** `useContinueReading` supplied the local array as React Query `initialData` while keeping a ten-second `staleTime`. A clean authenticated context therefore treated local `[]` as fresh data and did not run the initial Supabase query.

## REACT_QUERY_FIX

**LOCAL PASS.** The hook now waits only while authentication is unresolved, keys authenticated queries by `user.id`, and no longer installs local data as authenticated `initialData`. Anonymous sessions may use local progress as `placeholderData`; authenticated sessions always execute the canonical Supabase query.

## LOCAL_REMOTE_POLICY

**UNIT PASS.** Supabase is authoritative after successful authenticated hydration. Remote progress replaces stale local progress, and remote `[]` clears stale local progress instead of resurrecting it. Anonymous sessions continue to use local progress. An authenticated remote error remains an error and does not expose unscoped local data from another account.

## AUTH_HYDRATION

**UNIT PASS.** While auth is loading the query is disabled and publishes no placeholder. Once auth resolves, the query switches to either the anonymous local key or the authenticated user-scoped key.

## ACCOUNT_ISOLATION

**UNIT PASS; REAL E2E PENDING NETWORK.** Query keys differ by authenticated `user.id`, and authenticated queries receive no unscoped local placeholder. The new real-browser scenario logs a second empty account into a clean context and asserts that User A's Solo Leveling progress is absent.

## MULTI_SESSION_E2E

**IMPLEMENTED; EXECUTION BLOCKED BY DNS.** Context A reads Solo Leveling chapter 5 page 2 and waits for the canonical row. Context B proves the local progress key is absent, logs into the same account, asserts the visible Continue Reading card, and clicks Resume. Context C verifies account isolation. A second assertion strengthens the existing T-3019 retention loop in the same way.

The attempted real run stopped in `beforeAll` because `ilmsomiaqthhfyvgqnsp.supabase.co` could not resolve. A control request to `github.com` failed identically, and `scutil --dns` reported `No DNS configuration available`. No product assertion failed in that run.

## FRESH_CONTEXT_RESUME

**PENDING NETWORK.** The required visible Homepage and exact Reader assertions are present for chapter 5, page 2, but cannot be marked PASS until the real Supabase run completes.

## REGRESSIONS

- Unit suites: **115/115 PASS** (109 baseline + 6 hydration-policy tests).
- TypeScript application: **PASS**.
- TypeScript server build: **PASS**.
- ESLint: **0 errors, 57 historical warnings**.
- Production build: **PASS**; candidate asset `assets/index-eyQJ5YgK.js`.
- E2E files compile/list: **6/6 scenarios discovered** across the strengthened P2 review and T-3019 files.
- Real Reader/P1/P2 ticket E2E reruns: **PENDING NETWORK**.

## PRODUCTION_SMOKE

**PENDING DEPLOYMENT AND NETWORK.** The hotfix has not been pushed or deployed. Existing production remains `e544710` / `assets/index-Bgz9jF22.js`.

## FINAL_STATUS

```text
LOCAL_EMPTY_REMOTE_PROGRESS:    PASS (unit)
REMOTE_REHYDRATION:             PENDING REAL E2E
REMOTE_NEWER_THAN_LOCAL:        PASS (unit)
REMOTE_EMPTY_AUTHORITATIVE:     PASS (unit)
ACCOUNT_ISOLATION:              PASS (unit) / PENDING REAL E2E
CONTINUE_READING_FRESH_SESSION: PENDING REAL E2E
RESUME_FRESH_SESSION:           PENDING REAL E2E
PROGRESS_COHERENCE:             PENDING REAL E2E
MULTI_SESSION:                  PENDING REAL E2E
LIBRARY_REGRESSION:             PENDING RERUN
HISTORY_REGRESSION:             PENDING RERUN
P1_REGRESSION:                  PASS (unit) / PENDING E2E
P2_REGRESSION:                  PASS (unit) / PENDING E2E
TYPESCRIPT:                     PASS
ESLINT:                         0 ERRORS
BUILD:                          PASS
PRODUCTION_SMOKE:               PENDING
CRITICAL:                       0 CONFIRMED
HIGH:                           0 IN LOCAL CODE / 1 AWAITING REAL RETEST
```

## FINAL_RECOMMENDATION

**KEEP_P2_OPEN_PENDING_NETWORK_RETEST.** Restore DNS, run the real local multi-session acceptance and regression suites, deploy only after explicit push authorization, then run production smoke. P3 remains blocked.
