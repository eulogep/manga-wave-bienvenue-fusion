# Manga Wave V3 - T-3014 Follow

Date: 2026-08-30

## OVERALL_STATUS

`T3014_FOLLOW = PASS`

`T3015 = NOT_STARTED`

T-3014 adds an explicit subscription relationship between an authenticated user and a canonical manga. It does not add browser push, email, SMS, service workers, notification permissions, or notification preferences.

## DATA_MODEL

Migration: `20260830130000_add_canonical_follows.sql`

New table: `public.user_follows`

Fields:

- `id bigint` identity primary key
- `user_id uuid` referencing `auth.users(id)` with cascade delete
- `canonical_manga_id bigint` referencing `public.mangas(id)` with cascade delete
- `created_at timestamptz`
- `updated_at timestamptz`

Invariant:

```text
UNIQUE(user_id, canonical_manga_id)
```

No provider manga id is stored in Follow. Viewing or reading through another provider still resolves to the same canonical follow row.

## RLS

RLS is enabled on `user_follows`.

Authenticated users may:

- select their own rows
- insert their own rows
- delete their own rows

Every policy compares `auth.uid()` to `user_id`. There is no cross-user update or service-key path in the consumer UI.

Real Supabase validation used two temporary authenticated users:

- owner Follow count: `1`
- observer visibility of owner rows: `0`
- observer delete attempt left owner Follow unchanged

Result: `RLS = PASS`

## FOLLOW_UI

Primary interaction: canonical Manga Detail.

States:

- `Suivre`
- `Suivi`

Accessible action labels:

- `Suivre <manga title>`
- `Ne plus suivre <manga title>`

No provider name appears in the Follow identity or button.

The Library shows a subtle `Suivi` indicator on favorite cards that are also followed. It does not introduce Library V2 filtering or redesign.

Anonymous Follow sends the user through the existing `/auth` page with a safe internal return path. After login, the user returns to the canonical Manga Detail and can complete the Follow action.

## UNFOLLOW

Unfollow deletes the canonical `user_follows` row. The T-3013 per-chapter detection state is linked to that row and is removed by database cascade.

Policy:

- future monitoring stops immediately
- pending unread update state is cleared
- canonical reading progress and reading history are preserved
- no provider or catalog data is deleted

The mutation is idempotent.

## FAVORITE_VS_FOLLOW

Final product behavior:

| State | Kept in Library | Monitored for new chapters |
| --- | --- | --- |
| Favorite only | Yes | No |
| Follow only | No | Yes |
| Favorite + Follow | Yes | Yes |
| Neither | No | No |

Backward compatibility strategy:

1. At migration time only, existing favorites are inserted into `user_follows` with `ON CONFLICT DO NOTHING`.
2. Existing T-3013 chapter state is preserved during the foreign-key transition.
3. New favorites created after the migration do not automatically create Follow rows.
4. The T-3013 engine now reads `user_follows`, not `user_favorites`.

This avoids an abrupt loss of monitoring for existing users while preserving the long-term conceptual distinction.

## BASELINE

The T-3013 reconciliation semantics remain unchanged:

- first synchronization after Follow stores the observed chapters as read baseline
- current historical catalog produces `0` unread updates
- only a later logical chapter produces an unread update

Real database validation:

```text
baselineUnread = 0
```

## T3013_INTEGRATION

`useFollowedChapterUpdates` now receives canonical mangas from `useFollows`.

Flow:

```text
Follow canonical manga
-> fetch canonical source mappings
-> detect logical chapters through existing providers
-> reconcile against user_followed_chapter_state
-> show Homepage and Library update UI
-> Reader progress marks the exact logical chapter read
```

The existing deterministic T-3013 fixture was updated to create an explicit Follow and still passes against production:

```text
T-3013 deterministic smoke: 1/1 PASS
scenario duration: 26.9s
total duration: 31.8s
```

## REFOLLOW

Unfollow removes detection state but preserves reading history. Therefore Refollow sees no old monitoring state and establishes a fresh baseline from the currently available catalog.

Validated sequence:

```text
Follow -> baseline 200 -> unread 0
Unfollow -> chapter 201 appears -> no monitoring state
Refollow -> baseline includes 201 -> unread 0
chapter 202 appears -> unread 1
```

Real Supabase evidence:

```text
stateAfterUnfollow = 0
refollowUnread = 0
unreadAfterNextPublication = 1
```

## MULTI_SOURCE

Follow identity is `(user_id, canonical_manga_id)`.

The deterministic E2E follows `Solo Leveling` from canonical Manga Detail, then opens the direct OriginManga view. The UI still reports the same `Suivi` state and the database still contains exactly one Follow row.

Result: `NO_PROVIDER_DUPLICATE = PASS`

## E2E

Command:

```sh
npm run test:e2e:t3014
```

Production URL:

`https://manga-wave-bienvenue-fusion.vercel.app`

Final production bundle:

`assets/index-BAGTvmzG.js`

Final deterministic Chromium result:

```text
Favorite only -> Follow -> update/read -> Unfollow -> Refollow baseline -> next update
1 passed
scenario duration: 1.1m
total duration: 1.2m
```

The scenario verifies:

- favorite-only creates no monitoring state
- canonical Follow UI and database row
- optimistic UI success state
- removing Favorite preserves Follow
- initial baseline unread `0`
- simulated publication unread `1`
- Homepage update visible once without duplicate
- direct Reader opens real provider pages
- Reader clears unread to `0`
- Unfollow removes monitoring state
- publication while unfollowed stays unmonitored
- Refollow establishes a new baseline at `0`
- direct provider view resolves the same Follow
- later publication produces one unread update
- RLS observer sees no owner Follow
- QA accounts are deleted

The optional integrated interactive browser was unavailable in this Codex session (`0` connected browsers). This does not replace or invalidate the project Playwright Chromium runs above, which executed the real production UI and interactions.

## SUPABASE_REAL_TEST

Command:

```sh
npm run verify:t3014:db -- --allow-temporary-users
```

Result:

```json
{
  "favoriteOnlyFollowCount": 0,
  "uniqueFollowCount": 1,
  "followOnlyCount": 1,
  "rlsObserverVisible": 0,
  "baselineUnread": 0,
  "unreadBeforeRead": 1,
  "unreadAfterRead": 0,
  "stateAfterUnfollow": 0,
  "refollowUnread": 0,
  "unreadAfterNextPublication": 1,
  "temporaryUsersDeleted": true
}
```

Remote migration status:

```text
20260830130000 local = remote
```

## REGRESSIONS

- P1: `41/41 PASS`
- P2 aggregate: `9/9 PASS`
- T-3012 functional hotfix: `5/5 PASS`
- T-3013: `7/7 PASS`
- T-3014: `12/12 PASS`
- deterministic T-3013 E2E: `1/1 PASS`
- deterministic T-3014 E2E: `1/1 PASS`
- Reader behavior: protected by P1 and both production E2E flows

## TYPESCRIPT

```text
npx tsc --noEmit
PASS
```

## LINT

```text
npm run lint -- --quiet
0 errors
```

## BUILD

```text
npm run build
PASS
```

Build output before deployment:

- JavaScript: `701.01 kB`, gzip `205.82 kB`
- CSS: `88.55 kB`, gzip `16.31 kB`

The previously deferred chunk-size warning remains non-blocking and was not expanded into T-3014.

## DEPLOYMENT

- Supabase migration applied successfully.
- GitHub `main` updated.
- Vercel production bundle verified.
- Final T-3014 smoke passed on the deployed bundle.

## COMMITS

- `bbe56a7` - `feat: add canonical manga follows`
- `8a80fa1` - `fix: always roll back failed follow updates`

## QA_CLEANUP

- Real Supabase validation: two temporary users deleted.
- T-3013 E2E: temporary QA users deleted.
- T-3014 E2E initial run: temporary QA users deleted.
- T-3014 final run: temporary QA users deleted.
- Account deletion cascaded Follow and detection rows.
- No permanent provider, canonical manga, mapping, favorite, Follow, unread, or progress fixture data remains.

## ACCEPTANCE_GATE

| Gate | Status |
| --- | --- |
| `CANONICAL_FOLLOW` | PASS |
| `FOLLOW_UI` | PASS |
| `UNFOLLOW` | PASS |
| `FAVORITE_FOLLOW_DISTINCTION` | PASS |
| `INITIAL_BASELINE` | PASS |
| `FOLLOWED_UPDATE` | PASS |
| `UNFOLLOW_STOPS_FUTURE_UPDATES` | PASS |
| `REFOLLOW_BASELINE` | PASS |
| `RLS` | PASS |
| `NO_PROVIDER_DUPLICATE` | PASS |
| `T3013_INTEGRATION` | PASS |
| `DETERMINISTIC_E2E` | PASS |
| `QA_CLEANUP` | PASS |
| `P1_REGRESSION` | PASS |
| `P2_REGRESSION` | PASS |
| `TYPESCRIPT` | PASS |
| `LINT` | 0 ERRORS |
| `BUILD` | PASS |

## FINAL_PRODUCT_RULE

Favorite answers: `Do I want to keep this manga?`

Follow answers: `Do I want Manga Wave to watch this manga for new chapters?`

T-3014 provides the canonical subscription signal. T-3015 may later consume it for outbound notifications without changing Follow identity.
