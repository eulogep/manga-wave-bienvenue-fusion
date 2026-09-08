# T-3019 — Canonical reading history

Date: 2026-09-08. Base commit: `8a28869`.

## OVERALL_STATUS

**BLOCKED_PRODUCTION_DEPLOYMENT**. Implementation, additive migration, real Supabase validation and local E2E are complete. The application code is not deployed yet, so the production smoke has not run. T-3019 is not accepted in production; P2 remains open and P3 has not started.

## LEGACY_HISTORY_AUDIT

`user_history` identifies a legacy chapter through `chapter_id`; it does not provide the canonical work/chapter, saved page and session chronology required here. `user_canonical_reading_progress` is the current Resume state and cannot reconstruct past activity. A direct query after migration confirms that `user_history` remains present, readable and at its existing count of zero rows.

## DATA_MODEL

Additive `user_reading_history`: owner, canonical manga/chapter, canonical title/cover snapshot, chapter and zero-based page index, total pages, secondary provider metadata, session start and last-read timestamps. Indexes support owner chronology and matching sessions. An AFTER INSERT/UPDATE trigger on canonical progress uses the existing Reader persistence pipeline.

## MIGRATION_STRATEGY

Strategy B: preserve legacy history and introduce a canonical table. Migration: `supabase/migrations/20260908120000_add_canonical_reading_history.sql`. No destructive repurposing, guessed backfill or historical migration edits. Unknown canonical work IDs and nonnumeric chapter identities are skipped. Anonymous persistent history is outside this ticket.

The linked Supabase migration dry-run identified only this pending migration. After explicit approval, Supabase applied only `20260908120000_add_canonical_reading_history.sql`, with no seeds or role changes. A post-application migration listing shows the same version locally and remotely. `supabase db lint --linked --level warning` reports no schema errors.

## CANONICAL_IDENTITY

Owner + canonical manga + canonical chapter + session event. Provider IDs are secondary metadata. Display titles come from the canonical catalog. Reading does not require a favorite or follow. Provider requests occur only when reopening, never once per timeline item.

## SESSION_COALESCING

For the same owner/work/chapter, writes within less than 30 minutes of the previous event and on the same UTC date update that event. A later return or UTC date change appends an event. Page position is the last observed page, not the maximum reached. Duplicate/older timestamps are ignored. An advisory transaction lock serializes different provider contexts for a canonical work. Local PostgreSQL checks cover coalescing, provider aliases, chronology and timestamp behavior.

## TIMELINE

Authenticated `/history`, newest first with a deterministic timestamp/id order. French dates, canonical title, chapter, page and reopening/deletion actions. Loading, empty, error and retry states are provided. Library includes a small History link.

## SEARCH

Server-side canonical title search, debounced 250 ms, with escaped SQL wildcard characters. No provider search or alias search was introduced.

## FILTERS

Tous, Aujourd’hui, 7 derniers jours and 30 derniers jours. Date filters use local calendar boundaries; session splitting uses UTC dates as documented above.

## PAGINATION

25 entries per request with explicit load-more. No unbounded lifetime fetch. Search, date filters and pagination pass the deterministic UI fixture test.

## REOPEN

Uses existing canonical source ranking and logical chapter matching/fallback, then adds the saved page to the Reader location. Domain tests cover exact page, unavailable/ineligible providers and chapter mismatch refusal. The real Reader scenario reopens chapter 3 at saved page index 3 and verifies the visible fourth page.

## DELETE_ENTRY

Deletes only the owner’s selected history event. UI fixture, isolated SQL and real Supabase ownership/deletion checks pass. A second authenticated user cannot read or delete the owner’s event.

## CLEAR_HISTORY

Explicit confirmation dialog. Cancel and Escape preserve entries. Focus returns to the clear-history button after dialog closure; the fixture exposed and verified the fix for this focus issue. Clear deletes only the owner’s history.

## PROGRESS_SEPARATION

History is never the Resume source of truth. Deleting history does not write progress, favorites, follows or notification state. Isolated SQL and real Supabase E2E verify that canonical progress survives deletion/clear and that Library Resume still opens the saved page. No synthetic historical entries are recreated until subsequent actual reading persistence.

## LIBRARY_COHERENCE

Existing T-3017 E2E passes. The real-history test confirms Library membership and Resume survive history deletion.

## NOTIFICATION_COHERENCE

Existing T-3015 E2E passes. Real integration coverage opens a notification through Reader and confirms its read state plus history through the same persistence pipeline.

## UPDATE_COHERENCE

Existing T-3013 E2E passes after replacing obsolete pre-T3017 Library selectors with current accessible labels; product behavior was unchanged by that test correction. Real history integration coverage also confirms unread-update clearing.

## RLS

RLS enabled, authenticated owner-only SELECT/DELETE. Direct client INSERT/UPDATE prohibited. Trigger function uses an empty search path and revoked client execution privileges. Isolated PostgreSQL and real Supabase user-A/user-B ownership/deletion checks pass.

## MOBILE

PASS_LOCAL_FIXTURE at 390×844 and 430×932: no History-specific overflow, readable entries, usable filters and tested action heights of at least 44 px. Playwright captures `history-390.png` and `history-430.png` in the History fixture result directory. No claim of production mobile validation.

## ACCESSIBILITY

PASS_LOCAL_FIXTURE: axe-core reports no violations within the History main region; named actions, heading, labeled filters, keyboard dialog dismissal and focus restoration tested. This is not a site-wide accessibility certification; previously documented shared-header/contrast debt is outside this change.

## E2E

- History UI fixture: **1/1 PASS**, real temporary authentication with mocked history REST responses.
- Real Supabase ownership/session/deletion scenario: **PASS**.
- Reader persistence/provider-switch/reopen/coherence scenario: **PASS** using canonical manga 154, which the real mapping table confirms has both OriginManga and AsuraScans sources.
- Final grouped run: **3/3 PASS**.
- Isolated PostgreSQL migration/integration checks: **20/20 PASS** using PGlite outside repository dependencies.

## PRODUCTION_SMOKE

**NOT RUN / BLOCKED**. Supabase has the additive migration, but the application code is not yet on production.

## QA_CLEANUP

**PASS**. One temporary account left by an earlier network timeout was identified and removed. After the final grouped run, a paginated Auth listing found zero `codex-t3019-…@example.invalid` accounts. Other accounts were not removed. Auth-user cascade also removed their T-3019 rows.

## REGRESSIONS

Unit suites: **109/109 PASS** (P1 41, P2 9, T3012 hotfix 5, T3013 7, T3014 12, T3015 12, T3017 11, T3019 12).

Existing E2Es: Reader **4/4 PASS**, T3013 **PASS** on corrected-selector rerun, T3014 **PASS**, T3015 **PASS**, T3017 **PASS**. The initial combined run was 7/8 because of the obsolete T3013 Library selector; its separate rerun passed. No claim of a single combined 8/8 run.

## TYPESCRIPT

**PASS**: application TypeScript check and server compilation.

## ESLINT

**0 ERRORS**, 57 existing warnings.

## BUILD

**PASS**: frontend production build and server build. Frontend retains a bundle-size warning.

## DEPLOYMENT

Database migration complete. Application deployment not performed. Required next steps: push the prepared T-3019 application commit to the existing `origin/main` Vercel pipeline, wait for the matching production asset, then run the production smoke and cleanup. No unrelated migration, database reset or force push.

## COMMITS

The implementation and this report are prepared as one local T-3019 commit on top of `8a28869`; its hash is recorded in Git history after report generation. Historical end-of-line differences remain unstaged; `package-lock.json` has no semantic diff. No lockfile or historical migration was edited for this ticket. `mac recuperer.txt` was absent when this task began and was not removed by this work.
