# Manga Wave V3 - T-3013 Deterministic Smoke Fixture

Date: 2026-08-30

## Scope

Mode: `QA_FIXTURE_ONLY`

- No consumer-facing UI or product behavior changed.
- No T-3014 work started.
- No permanent provider, canonical manga, mapping, or production-user data changed.
- The fixture exercises the production T-3013 synchronization and Reader progress paths.

## Fixture design

The Playwright fixture uses canonical manga `110` (`Solo Leveling`) and its sole active mapping:

- provider: `originmanga`
- provider manga id: `656de8df-4b6c-483a-b1e0-4fe0aee8eafb`

At runtime it:

1. Creates a confirmed temporary QA account and a second temporary RLS observer account.
2. Logs the QA account into the real application.
3. Adds manga `110` to that account's favorites through an authenticated Supabase client.
4. Intercepts only the browser request for the mapped provider's manga detail.
5. Returns the real provider chapter list to establish the baseline.
6. Confirms the baseline creates durable state but no unread rows.
7. Adds one later logical chapter to the intercepted provider response.
8. Re-enters the Homepage so the normal `useFollowedChapterUpdates` synchronization detects and persists it.
9. Verifies the Homepage entry, Library badge, canonical manga identity, lack of duplicates, and direct Reader link.
10. Opens the direct link. The synthetic logical chapter reuses a real provider chapter id, so the Reader loads real pages through the normal provider page endpoint.
11. Lets `useRecordReading` acknowledge the exact logical chapter through the normal progress flow.
12. Verifies unread `1 -> 0` in Supabase and in Homepage/Library UI.
13. Deletes both temporary accounts and verifies the QA followed-chapter rows were cascade-deleted.

The fixture never manually inserts the synthetic unread row. That row is produced by the same reconciliation and authenticated insert used for a real publication.

## Files

- `tests/e2e/t3013-deterministic-smoke.spec.ts`
- `tests/followedChapterUpdates.test.ts`
- `package.json`
- `.gitignore`

## Command

```sh
npm run test:e2e:t3013
```

Required environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `API_KEY_ANONYME_SUPABASE`
- `API_KEY_SERVICE_SUPABASE` or `API_KEY_SECRET_SUPABASE`
- optional `PLAYWRIGHT_BASE_URL` (defaults to production)

The script is not started by the application, build, deploy, or normal test commands. The service key remains Node-side and is never injected into the browser.

## Executed smoke evidence

Command executed against `https://manga-wave-bienvenue-fusion.vercel.app`:

```text
Running 1 test using 1 worker
ok T-3013 deterministic production-equivalent smoke
1 passed (26.3s)
```

The final browser scenario completed in 22.1 seconds.

## Acceptance gate

| Check | Status | Evidence |
| --- | --- | --- |
| `BASELINE_NO_FALSE_HISTORY` | PASS | Baseline state exists and authenticated unread count is 0; Homepage update heading absent. |
| `NEW_CHAPTER_DETECTED` | PASS | Later chapter is added only to the provider response; normal sync creates unread count 1. |
| `HOMEPAGE_UPDATES_VISIBLE` | PASS | `Nouveaux chapitres` region becomes visible. |
| `LIBRARY_BADGE_1` | PASS | Library renders exactly one `1 nouveau` badge. |
| `CORRECT_MANGA` | PASS | Update is displayed for canonical manga `110`, title `Solo Leveling`. |
| `NO_DUPLICATE` | PASS | The Homepage update region contains exactly one matching manga. |
| `DIRECT_NEW_CHAPTER_OPEN` | PASS | Library direct link opens the mapped `originmanga` Reader route and renders Page 1. |
| `READ_STATE_RECORDED` | PASS | Reader's normal debounced canonical progress path acknowledges the exact chapter. |
| `UNREAD_1_TO_0` | PASS | Authenticated database polling observes 1 before Reader and 0 after Reader. |
| `LIBRARY_BADGE_0` | PASS | Badge and direct update link are absent after returning to Library. |
| `RLS` | PASS | A different authenticated account sees zero rows belonging to the QA user. |
| `CLEANUP` | PASS | Both temporary accounts deleted; QA followed state count verified as 0. |
| `P1_REGRESSION` | PASS | 41/41 tests passed. |
| `P2_REGRESSION` | PASS | 9/9 tests passed. |

Additional checks:

- T-3013 unit tests: 7/7 PASS.
- TypeScript: PASS.
- ESLint errors: 0.
- Production build: PASS.
- Existing non-blocking JavaScript chunk warning remains unchanged.

## Safety and cleanup

- The fixture targets one explicit canonical manga and one explicit provider mapping.
- No wildcard delete operation exists.
- Cleanup operates only on the two UUIDs returned when the temporary users are created.
- Authentication-user deletion cascades the QA favorite, followed state, and progress rows.
- `afterAll` attempts account deletion if the scenario fails before its explicit cleanup stage.
- Playwright output is ignored through `test-results/`.

## Result

`T3013_DETERMINISTIC_SMOKE_FIXTURE = PASS`

`T3013 = APPROVABLE`

`T3014 = NOT_STARTED`
