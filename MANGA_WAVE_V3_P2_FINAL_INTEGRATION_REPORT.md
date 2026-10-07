# Manga Wave V3 — P2 final integration review

Date: 2026-09-09
Production: `https://manga-wave-bienvenue-fusion.vercel.app/`
Reviewed commit: `c9c1e7f19fa8716a42e2fd98e7a320b4dd95a808`
Production asset: `assets/index-eyQJ5YgK.js`
Hotfix: deployed

## OVERALL_STATUS

**PASS.** The Continue Reading hydration defect is fixed and verified in production. A fresh authenticated browser context with empty local storage rehydrates canonical Supabase progress and resumes Solo Leveling at chapter 5, page 2. A second account receives no progress from the first account.

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

**PASS.** Reader, canonical progress, Homepage Continue Reading, Library Resume and History agree on chapter/page in both the current session and a completely fresh browser context. The production smoke persisted and restored chapter 5, page index 1 (displayed page 2).

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

**PASS.** Context A persisted Solo Leveling chapter 5, page 2. Context B started without the Manga Wave local progress key, logged into the same account, displayed the correct Continue Reading card and reopened the exact Reader state. Context C used another account and displayed no inherited progress.

## DIRECT_REFRESH

**PASS.** Reader, Library, History and Homepage survive direct navigation/refresh, including fresh-session Homepage hydration.

## MOBILE

**PASS for this production run.** At 390×844 and 430×932, Homepage, Library, History and Notification center reported zero document overflow; the Notification panel remained within viewport width. The previously documented 13 px Header overflow was not reproduced in this seeded run and remains listed as historical tech debt rather than treated as fixed.

## ACCESSIBILITY

**PRE_EXISTING_ONLY.** No critical violations. The Notification dialog had zero axe violations. Homepage, Library and History reproduced the known shared `color-contrast` rule on 2/4/2 nodes respectively. Authenticated Homepage also reports `page-has-heading-one` (moderate); Git history shows the personalized branch without an H1 dates to the approved T-3011 implementation, not this review. No new critical/high accessibility regression was introduced during review.

## QA_CLEANUP

**PASS for this review.** All `codex-p2-final-*` accounts and every temporary account created by the executed T-3013/T-3014/T-3015/T-3017/T-3019 runs were deleted. A pre-existing `codex-t3015-*` account created at `2026-09-08T09:25:23Z` remains; it predates this final-review run and was deliberately not deleted because the brief classifies old QA accounts as known debt.

## REGRESSION EVIDENCE

- Production deterministic E2E baseline: **11/11 PASS** in one run (Reader 4, T3013 1, T3014 1, T3015 1, T3017 1, T3019 3).
- Strengthened same-account P2 retention loop: **PASS 3/3 locally** after installing the existing deterministic Reader page fixture in the fresh context; production fresh-session Resume is also PASS.
- Canonical Search: **PASS**.
- Mobile and axe inventory: **PASS**, findings classified above.
- Real six-table RLS integration: **PASS**.
- Unit regression suites: **131/131 PASS**.
- TypeScript application check: **PASS**.
- Server TypeScript build: **PASS**.
- ESLint: **0 errors, 57 known warnings**.
- Production build: **PASS**, matching production JS asset hash; existing bundle-size warning remains.

## SEVERITY

**CRITICAL: 0**

**HIGH: 0**

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
PROGRESS_COHERENCE:              PASS
UPDATE_ACK:                      PASS
LIBRARY_COHERENCE:               PASS
HISTORY_COHERENCE:               PASS
HISTORY_PROGRESS_SEPARATION:     PASS
SOURCE_ABSTRACTION:              PASS
SEARCH_REGRESSION:               PASS
RLS:                             PASS
MULTI_SESSION:                   PASS
DIRECT_REFRESH:                  PASS
MOBILE:                          PASS
ACCESSIBILITY:                   PRE_EXISTING_ONLY
QA_CLEANUP:                      PASS
CRITICAL:                        0
HIGH:                            0
```

## CONTINUE_READING_ROOT_CAUSE

**CONFIRMED.** `useContinueReading` supplied the local array as React Query `initialData` while keeping a ten-second `staleTime`. A clean authenticated context therefore treated local `[]` as fresh data and did not run the initial Supabase query.

## REACT_QUERY_FIX

**PRODUCTION PASS.** The hook waits only while authentication is unresolved, keys authenticated queries by `user.id`, and no longer installs local data as authenticated `initialData`. Anonymous sessions may use local progress as `placeholderData`; authenticated sessions always execute the canonical Supabase query.

## LOCAL_REMOTE_POLICY

**UNIT PASS.** Supabase is authoritative after successful authenticated hydration. Remote progress replaces stale local progress, and remote `[]` clears stale local progress instead of resurrecting it. Anonymous sessions continue to use local progress. An authenticated remote error remains an error and does not expose unscoped local data from another account.

## AUTH_HYDRATION

**UNIT PASS.** While auth is loading the query is disabled and publishes no placeholder. Once auth resolves, the query switches to either the anonymous local key or the authenticated user-scoped key.

## ACCOUNT_ISOLATION

**PASS.** Query keys differ by authenticated `user.id`, and authenticated queries receive no unscoped local placeholder. The production browser scenario logged a second empty account into a clean context and confirmed that User A's Solo Leveling progress was absent.

## MULTI_SESSION_E2E

**PASS locally and in production.** Context A reads Solo Leveling chapter 5 page 2 and waits for the canonical row. Context B proves the local progress key is absent, logs into the same account, asserts the visible Continue Reading card, and clicks Resume. Context C verifies account isolation. The strengthened T-3019 retention loop also passes 3/3 locally.

## FRESH_CONTEXT_RESUME

**PASS.** The production Homepage visibly restored Solo Leveling, chapter 5, page 2, and its Resume link opened the Reader at the same chapter and page.

## REGRESSIONS

- Unit suites: **131/131 PASS** (including 6 hydration-policy tests).
- TypeScript application: **PASS**.
- TypeScript server build: **PASS**.
- ESLint: **0 errors, 57 historical warnings**.
- Production build: **PASS**; candidate asset `assets/index-eyQJ5YgK.js`.
- P2 production-equivalent suites: T-3013, T-3014, T-3015 and T-3017 **PASS**; one transient T-3017 cache delay passed on isolated rerun.
- Local T-3019: **3/3 PASS**.
- Production Reader: **4/4 PASS**.
- Production Continue Reading multi-session/account isolation smoke: **PASS**.

## PRODUCTION_SMOKE

**PASS.** The reviewed hotfix is `c9c1e7f19fa8716a42e2fd98e7a320b4dd95a808`; its production asset was `assets/index-eyQJ5YgK.js`, and the fresh-session Resume/account-isolation smoke passed. `origin/main` subsequently advanced to the independently validated T-3020 commit `2aa549c3ac39c430beda9d5945d6f5535a3f41eb`.

## FINAL_STATUS

```text
LOCAL_EMPTY_REMOTE_PROGRESS:    PASS (unit)
REMOTE_REHYDRATION:             PASS
REMOTE_NEWER_THAN_LOCAL:        PASS (unit)
REMOTE_EMPTY_AUTHORITATIVE:     PASS (unit)
ACCOUNT_ISOLATION:              PASS
CONTINUE_READING_FRESH_SESSION: PASS
RESUME_FRESH_SESSION:           PASS
PROGRESS_COHERENCE:             PASS
MULTI_SESSION:                  PASS
LIBRARY_REGRESSION:             PASS
HISTORY_REGRESSION:             PASS
P1_REGRESSION:                  PASS
P2_REGRESSION:                  PASS
TYPESCRIPT:                     PASS
ESLINT:                         0 ERRORS
BUILD:                          PASS
PRODUCTION_SMOKE:               PASS
CRITICAL:                       0
HIGH:                           0
```

## FINAL_RECOMMENDATION

**CLOSE_P2.** All P2 closure gates now pass locally and in production. P3 may be considered open, but no P3 or T-3021 work was started during this validation.
