# T-3021 — Command Search (Cmd+K / Ctrl+K Palette)

Date: 2026-09-10

## OVERALL_STATUS

`PASS / DELIVERED / ZERO_REGRESSION`

T-3021 is fully implemented, verified, and integrated into Manga Wave. It provides a universal, keyboard-first Command Palette (`Cmd+K` on macOS, `Ctrl+K` on Windows/Linux) across all main platform views, instant search into the canonical catalog powered by the T-3020 snapshot cache, direct quick navigation actions, category and format filters, and 1-click "Continue Reading" resume capability, while strictly adhering to Reader autonomy invariants.

All 178 unit tests pass (including 7 new domain & lifecycle tests), 7/7 Playwright E2E scenarios pass with zero provider requests, TypeScript typecheck passes with 0 errors, ESLint passes with 0 errors, and the production Vite bundle builds cleanly.

---

## ARCHITECTURE & COMPONENTS

1. **Pure Domain Layer** ([`src/domain/commandSearch.ts`](file:///Users/eulogemabiala/Desktop/Developer/PLATEFORME%20MANGA/src/domain/commandSearch.ts)):
   - `isPlatformMac(userAgent, platform)`: Deterministic platform detection for Mac/iOS vs Windows/Linux/Android.
   - `getShortcutLabel(userAgent, platform)`: Returns `⌘K` on Mac and `Ctrl+K` on other platforms.
   - `shouldEnableCommandSearch(pathname)`: Reader route isolation guard (`!pathname.startsWith('/read')`).

2. **State & Keyboard Hook** ([`src/hooks/useCommandSearch.tsx`](file:///Users/eulogemabiala/Desktop/Developer/PLATEFORME%20MANGA/src/hooks/useCommandSearch.tsx)):
   - Global `CommandSearchContext` and `useCommandSearch()` hook.
   - Listens to `keydown` for `(metaKey || ctrlKey) && key === 'k'`, preventing default browser URL focus and toggling the palette.
   - Automatically closes the palette on route transitions.
   - Fully disabled when on `/read/*`.

3. **Command Palette UI** ([`src/components/CommandSearchDialog.tsx`](file:///Users/eulogemabiala/Desktop/Developer/PLATEFORME%20MANGA/src/components/CommandSearchDialog.tsx)):
   - Built with `cmdk` and Radix UI dialog primitives with glassmorphic dark design (`#0b131f/95`, backdrop blur, coral accents).
   - Fully accessible: `DialogTitle` and `DialogDescription` included, accessible name on inputs and buttons, keyboard arrow navigation (`↑`/`↓`), `Enter` to navigate, `Escape` to close.
   - Lazy-hydrates the cached canonical snapshot from `useCanonicalSearch` upon opening.

4. **Header Integration** ([`src/components/Header.tsx`](file:///Users/eulogemabiala/Desktop/Developer/PLATEFORME%20MANGA/src/components/Header.tsx)):
   - Desktop: sleek search trigger button with `Rechercher un manga...` and `<kbd>{shortcutLabel}</kbd>`.
   - Mobile: compact search trigger button with `aria-label="Recherche rapide (⌘K)"`.
   - Mobile Drawer: quick search action item with icon and shortcut badge.

5. **Global Application Mounting** ([`src/App.tsx`](file:///Users/eulogemabiala/Desktop/Developer/PLATEFORME%20MANGA/src/App.tsx)):
   - Mounted inside `BrowserRouter` within `CommandSearchProvider`, making the palette globally available across the application.

---

## CANONICAL SEARCH CAPABILITY

- Uses `searchCanonicalWorks` from `src/domain/canonicalSearch.ts` directly with `shouldFilter={false}` on `cmdk` to maintain exact deterministic ranking:
  1. Exact canonical titles
  2. Alternate titles and aliases (Korean, Japanese, Chinese romanizations)
  3. Prefix and substring matches
  4. Bounded Levenshtein typos (e.g. `solo levling` -> `Solo Leveling`)
  5. Author matches
  6. Genre matches
- Displays top 8 ranked canonical results:
  - High quality cover thumbnail (`MangaCover`)
  - Primary title
  - Matched alias highlight if the match originated from an alternate title
  - Format badges: `manga` (purple), `manhwa` (sky), `manhua` (amber)
  - Publication status badge
  - Author and top genres
  - Selecting a result navigates directly to `/manga/:id`.
- Zero provider requests: relies exclusively on the locally cached canonical snapshot, never issuing calls to external scrapers during search.
- Empty query fallback: displays an action to launch full catalog search at `/search?q={query}`.

---

## QUICK ACTIONS & READING CONTINUATION

- **Continuer la lecture**: Reads recent reading progress via `useContinueReading()`. Displays the last read work, chapter, and page with direct 1-click resumption.
- **Navigation rapide**:
  - Accueil (`/`)
  - Explorer le catalogue complet (`/search`)
  - Ma bibliothèque (`/library`)
  - Historique de lecture (`/history`)
- **Explorer par format**:
  - 🇰🇷 Manhwas (Corée du Sud) (`/search?type=manhwa`)
  - 🇨🇳 Manhuas (Chine) (`/search?type=manhua`)
  - 🇯🇵 Mangas (Japon) (`/search?type=manga`)
- **Découverte**:
  - Derniers ajouts (`/search?sort=recent`)
  - Les mieux notés (`/search?sort=rating`)
  - Les plus populaires (`/search?sort=popularity`)

---

## READER INVARIANT PRESERVATION

- Invariant: *absence de Header/Footer et isolation stricte dans le Reader autonome*.
- Verified: On any route matching `/read/*`, `shouldEnableCommandSearch` returns `false`.
- Pressing `Meta+K` / `Control+K` inside `/read/*` will not open the command dialog.
- Reader keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `Space`, fullscreen, settings) remain completely untouched and uninhibited.

---

## VALIDATION RESULTS

1. **Unit Tests**:
   - `tests/commandSearch.test.ts`: **7 / 7 PASS**
   - Total test suite (`tests/*.test.ts`): **178 / 178 PASS** (0 regressions across all P1/P2/T-3013/T-3014/T-3015/T-3017/T-3019/T-3020 suites)

2. **Playwright E2E Scenarios** (`tests/e2e/t3021-command-search.spec.ts`):
   - Header button opens Command Palette with empty query shortcuts and navigates to catalog: **PASS**
   - Keyboard shortcut (`Meta+K` / `Ctrl+K`) toggles Command Palette and `Esc` dismisses: **PASS**
   - Instant search matches canonical title and opens canonical detail: **PASS**
   - Instant search matches alternate title / alias: **PASS**
   - Instant search matches typos via fuzzy distance without provider request: **PASS**
   - Empty match offers full catalog search fallback: **PASS**
   - Reader route guard prevents Command Palette from opening during active reading: **PASS**
   - Result: **7 / 7 PASS** (4.2s execution)

3. **Regression E2E**:
   - `tests/e2e/t3020-search.spec.ts`: **7 / 7 PASS**

4. **Static Analysis & Build**:
   - `tsc --noEmit`: **0 errors**
   - `eslint`: **0 errors**
   - `vite build`: **PASS** (`dist/assets/index-BuYMArlA.js`, 755ms)

---

## DEPLOYMENT (2026-09-12)

This work was fully implemented and locally verified on 2026-09-10 but left uncommitted — `origin/main`
and production were still serving the pre-T-3021 Header. Committed as `5784e29` (paired with the
T-3020 metadata pipeline in `07c62c5`), pushed (fast-forward, no `--force`), and confirmed deployed:
Vercel served `assets/index-BuYMArlA.js`, byte-identical to this commit's local build hash, HTTP 200.

Re-ran the full suite against that live production build:
- E2E: `t3021-command-search.spec.ts` 7/7 PASS, `t3020-search.spec.ts` 7/7 PASS (2 real-catalog-only
  cases correctly skip without `T3020_REAL_CATALOG=1`), `reader-p1.spec.ts` 4/4 PASS (Reader route
  guard confirmed live: the palette does not open on `/read/*`).
- With `T3020_REAL_CATALOG=1` against production: 7/9 PASS, 2 skipped (synthetic-only cases) —
  confirms the command palette's instant search surfaces the real enriched Manhwa/Manhua/alias data
  from the T-3020 metadata pipeline, not just fixtures.
- Unit: full suite 178/178 PASS.

## NEXT STEP ON ROADMAP

T-3021 is closed and deployed. According to the autonomous roadmap directive:
Next ticket: **T-3022 — Trending (Agrégation de tendances et scoring de popularité)**.
