# Manga Wave — Codex implementation handoff

Last verified from the local repository: **2026-08-29 after P1 hotfix**  
Working branch: **`main`**  
HEAD implementation: **`dac343d` — `fix(p1): harden reader source recovery`**  
Git state at handoff creation: **clean; `main` aligned with `origin/main`**

> Hotfix supersession: read `MANGA_WAVE_V3_P1_HOTFIX_REPORT.md` before changing P1. It adds strict logical-chapter matching, coherent Reader page/URL state, canonical user progress, explicit language fallback, provider filtering/degradation and migration `20260829060000_add_canonical_reading_progress.sql`. Interactive product approval remains pending because the in-app browser was unavailable.

## 1. Project mission

Manga Wave is a French-first, multi-source manga/manhwa discovery and reading platform. Its product objective is to expose real catalogue content immediately, unify duplicate works coming from different providers, and keep reading usable when a provider or chapter fails.

The required user journey is:

1. Discover or search a title across multiple sources.
2. See one canonical work instead of duplicate cards where identity is certain.
3. Open a provider-backed Manga Detail page.
4. Enter the standalone Reader at `/read/:source/:mangaId/:chapterId`.
5. Preserve reading mode, exact page, chapter, language and progress.
6. If the active source fails, automatically try the best compatible source that has the exact chapter.
7. Always retain a manual source switch in Manga Detail and Reader Settings.

The current product direction is desktop-first. Mobile/tablet support is desirable and partially implemented, but responsive interactive QA is explicitly deferred and is not a gate for the completed P1 work.

## 2. Production and repository

- Production: <https://manga-wave-bienvenue-fusion.vercel.app/>
- Git repository: <https://github.com/eulogep/manga-wave-bienvenue-fusion.git>
- Default/deployment branch: `main`
- Local workspace used for this handoff: `D:\PLATEFORME MANGA`
- Supabase project ref: `ilmsomiaqthhfyvgqnsp`
- Lovable project recorded in the legacy README: `651346b8-326b-4f66-bf3f-2ea499b19397`
- Vercel preset/output: Vite, repository root `./`, `npm run build`, output `dist`

The production hostname is referenced by `docs/mangadex-integration.md` and `supabase/functions/source-sync/index.ts`. Before claiming that a new commit is deployed, verify the Vercel deployment rather than assuming every local commit is live.

## 3. Tech stack

### Client

- React 18.3 + TypeScript 5.5
- Vite 8 with SWC
- React Router 7
- TanStack Query 5
- Tailwind CSS 3.4
- shadcn/ui and Radix UI primitives
- Lucide icons
- Supabase JS 2.50 for Auth, REST/RPC and user persistence
- Local storage fallback for anonymous preferences and reading history

### Extraction and APIs

- Vercel serverless function: `api/extract.ts`
- Express/Playwright-compatible local scraper backend under `server/`
- `playwright-core` + `@sparticuz/chromium`
- Per-process source manager with timeouts, health metrics and circuit breaker
- Supabase Edge Functions for MangaDex proxying, generic manga proxying, catalogue sync, source sync and authenticated reading-progress operations

### Data and infrastructure

- Supabase Postgres, Auth and RLS
- Postgres extensions used by migrations: `pg_trgm`, `unaccent`, `pgmq`, `pg_cron`, `pg_net`
- Vercel SPA rewrite to `index.html`
- GitHub repository as source of deployment

Required public client environment variables are documented in `.env.example`:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_MANGADEX_API_PROXY_URL
VITE_MANGADEX_COVER_PROXY_URL
VITE_MANGADEX_PROXY_PUBLISHABLE_KEY
VITE_MANGA_PROXY_URL
```

Do not add a Supabase service-role key or another secret to any `VITE_*` variable; Vite embeds these values in the browser bundle. Server-side sync secrets belong in Supabase/Vercel secret storage. The scheduled source sync expects a Supabase Vault secret named `source_sync_service_role_key`.

## 4. Current architecture

### Application routes

Defined in `src/App.tsx`:

| Route | Responsibility |
|---|---|
| `/` | Editorial homepage and immediate content discovery |
| `/auth` | Authentication |
| `/search` | Provider-specific or canonicalized multi-source search |
| `/manga/:id?source=:source` | Source-backed Manga Detail |
| `/read/:source/:mangaId/:chapterId` | Canonical standalone Reader |
| `/library` | User library |
| `*` | Not found |

`QueryClientProvider`, `AuthProvider`, `TooltipProvider` and global toaster providers wrap all routes.

### Request/data flow

```text
UI page/hook
  -> source adapter in src/integrations/sources/
     -> MangaDex/OriginManga specialized clients, or
     -> /api/extract/* for browser-backed sources
        -> api/extract.ts
           -> server/src/sources/* extractor
           -> server/src/lib/source-manager.ts
              (timeout + in-memory health + circuit breaker)

Catalogue sync
  -> Supabase cron every 5 minutes
  -> source-sync Edge Function
  -> pgmq source_sync queue
  -> upsert_source_catalog(...)
  -> mangas + manga_source_mappings

Reader progress/preferences
  -> localStorage for every user
  -> authenticated Supabase owner-only tables when logged in
```

### Registered readable sources

The runtime registry in `src/integrations/sources/index.ts` contains:

- `mangadex`
- `originmanga`
- `comick`
- `crunchyscan` (displayed in parts of the UI as LelManga)
- `mangafire`
- `asurascans`

Discovery-only catalogue providers also exist through `src/integrations/catalog/providers.ts`:

- AniList
- Jikan
- Kitsu
- Shikimori

Discovery-only results are canonical candidates but are marked `readable: false` and have no internal detail route.

Every readable adapter implements `MangaSource` from `src/integrations/sources/types.ts`: `search`, `getMangaDetails`, `getChapters`, and `getPageUrls`, plus capability metadata (`supportsSearch`, `supportsChapters`, `hasDirectPages`, language and display name).

## 5. Completed P0 work

P0 tickets completed in the implementation:

- **T-3001 — Product audit:** audit recorded in `PRODUCT_AUDIT_REPORT.md`.
- **T-3002 — Immersive Reader:** independent full-viewport Reader shell.
- **T-3003 — Reader modes:** six persisted modes.
- **T-3004 — Intelligent preloading:** nearby pages and next-chapter first page are preloaded within bounds.
- **T-3005 — Robust progress:** exact page persistence locally and, when authenticated, in Supabase.
- **T-3006 — Continue Reading:** centralized resume section with cover, source, chapter, page, percentage and last-read timestamp.

Important P0 corrections:

- Removed the obsolete inline `OriginMangaReader` implementation.
- All Manga Detail reading actions now navigate to the standalone Reader.
- The Reader has no global Header or Footer.
- Reader toolbar/settings are fixed overlays and do not participate in document layout.
- Toolbar visibility responds to pointer movement, pointer interaction, touch and keyboard activity, then hides after inactivity.
- Chapter previous/next navigation remains within `/read/...`.
- Continue Reading restores the exact zero-based page via the `page` query parameter.
- Anonymous progress/preferences work from local storage; authenticated state syncs to owner-only Supabase rows.
- Shared homepage/provider cover rendering uses defensive `MangaCover` behavior.

P0 gate truth at this handoff:

```text
P0_DESKTOP = PENDING
P0_RESPONSIVE = DEFERRED
```

All deterministic P0 checks, lint and production build passed, but the required interactive desktop smoke test has not been performed with a controllable browser. Do not change `P0_DESKTOP` to `PASS` based only on lint/build.

## 6. Visual refactor

The approved V3 direction is implemented and documented in `MANGA_WAVE_V3_VISUAL_REFACTOR_REPORT.md`.

The visual system replaced the previous neon/glass SaaS presentation with:

- deep navy/ink layered surfaces;
- coral for primary action, ranking and priority;
- restrained electric blue for secondary metadata/discovery;
- Cinzel editorial display typography with Inter/Outfit for interface text;
- sharper edges, controlled borders and reduced glow;
- artwork-led hero and cards.

Homepage composition is now:

1. Featured manga hero
2. Continue Reading
3. Editorial trending ranking
4. Multi-source discovery
5. Local MangaDex selection
6. Genre territories
7. Brand footer

Major redesigned components: `HeroSection`, `MangaCard`, `ContinueReadingSection`, `OriginMangaSection`, `MultiSourceHubSection`, `FeaturedSection`, `CategoriesSection`, `Header`, `Footer`, `MangaDetail`, plus global tokens in `src/index.css` and Tailwind configuration.

The refactor deliberately preserved the standalone Reader route, progress, resume URLs, six modes and source switching.

## 7. Responsive hotfix

Commit `b424acd` and migration `20260829030000_reader_fit_width_default.sql` implemented the targeted Reader width correction.

Implemented behavior:

- Default fit is now `width` in local defaults and database defaults.
- Width fit uses all available width, automatic height and centered rendering without image overflow.
- Height fit records natural/rendered dimensions and falls back to width at viewport widths `<= 768px` when projected or observed page width is unreadable.
- Minimum readability policy is implemented in `src/components/reader/pageFit.ts` (`MIN_READABLE_WIDTH = 240`, mobile maximum width `768`).
- Double page remains selectable but renders one page at a time below `640px`.
- Mobile controls use 44 px targets.
- Mobile chapter navigation has a dedicated row.
- Reader Settings is viewport-bound, scrollable and has a sticky close control.
- Manga Detail cover remains defensive and has no global opacity/darkening override.

Status remains **PARTIAL** only because interactive checks at `768x1024`, `430x932` and `390x844` have not run.

## 8. Completed P1 tickets

### T-3007 — Canonical Manga and cross-source deduplication

Commit: `1c0805d`  
Report: `MANGA_WAVE_V3_T3007_REPORT.md`  
Status: **PASS**

Delivered:

- domain model and deterministic canonical IDs;
- accent/punctuation/case normalization;
- exact normalized-title and declared-alias grouping;
- cross-source provider mappings;
- false-merge protection;
- canonical multi-source cards in “Toutes les sources” search;
- forward-only database stabilization migration;
- canonical aggregate view and safe upsert path;
- 6/6 canonical tests passing.

### T-3008 — Source Resolution Engine

Commit: `87b37a7`  
Report: `MANGA_WAVE_V3_T3008_REPORT.md`  
Status: **PASS**

Delivered:

- explainable 0–100 source score;
- availability/circuit, latency, language, chapter coverage, image quality, error rate and freshness signals;
- deterministic tie-breaking by source ID;
- neutral values for missing observations;
- database RPC `rank_canonical_manga_sources`;
- matching client domain scorer;
- ranked Reader alternatives;
- 5/5 T-3008 tests passing.

### T-3009 — Automatic source fallback

Commit: `8ef3f83`  
Report: `MANGA_WAVE_V3_T3009_REPORT.md`  
Status: **PASS**

Delivered:

- failure detection only after page-query retries are exhausted;
- exact-chapter compatible alternative selection;
- ranked untried-source selection;
- three-source attempt budget;
- loop protection through the `tried` URL query parameter;
- preserved page/language;
- automatic route replacement;
- friendly recovery states and expandable diagnostics;
- manual recovery retained;
- 4/4 fallback tests and 15/15 combined P1 tests passing.

### T-3010 — Manual source selector

Commit: `6e94cce`  
Report: `MANGA_WAVE_V3_T3010_REPORT.md`  
Status: **PARTIAL**

Delivered:

- source selector inside Reader Settings;
- “Changer de source” panel on Manga Detail;
- active provider, language, exact-chapter availability, score and last-success metadata;
- manual Reader switch preserving page and choosing the alternative chapter language;
- lazy source discovery: alternatives are queried only when a selector opens or automatic fallback is required;
- automatic selection remains the default and manual choice is optional;
- 44 px touch targets.

The only missing acceptance item is interactive click-through/visual browser QA.

## 9. Canonical manga architecture

### Client model

`src/domain/canonicalManga.ts` defines:

- `CanonicalMangaCandidate`: raw provider candidate.
- `CanonicalSourceMapping`: provider, external ID, language, availability/readability, external URL and internal detail URL.
- `CanonicalManga`: deterministic canonical ID, normalized title, title/aliases, metadata and mappings.

`normalizeMangaTitle` performs NFKD normalization, diacritic removal, lowercasing, punctuation removal and whitespace collapse. `stableId` uses an FNV-1a-like 32-bit hash of the normalized title and returns `manga_<base36>`.

`canonicalizeMangaCandidates` uses union-find grouping. It merges candidates only if they share:

- the exact normalized primary title; or
- a normalized declared alternative title/alias.

Fuzzy similarity must never perform an automatic merge. It is allowed only as a suggestion from the database search RPC. This is intentional false-merge protection.

Provider mappings are deduplicated by provider inside a canonical group. `getPrimarySource` selects, in order:

1. available + readable + internal detail URL;
2. any available source;
3. first source;
4. `null`.

### Database model

`public.mangas` remains the canonical work table. This preserves all existing foreign keys from favorites, chapters and progress. Do not replace or drop it during future canonical work.

`public.manga_source_mappings` associates one canonical manga with provider identity. Important uniqueness constraints are:

- `(source_id, source_manga_id)` — one external identity maps once;
- `(manga_id, source_id)` — at most one mapping per provider per canonical work.

`upsert_source_catalog(requested_source_id, items)`:

- takes a transaction advisory lock based on normalized title;
- first reuses an existing exact external mapping;
- otherwise matches exact normalized titles/aliases, with author/type disambiguation;
- refuses to attach a second mapping from the same provider to the same canonical manga;
- creates a new canonical manga if no safe match exists;
- merges only missing metadata and declared aliases;
- is executable only by `service_role`.

`find_canonical_manga(text)` returns exact-title, exact-alias and fuzzy suggestions with confidence and match reason. Fuzzy results are not authoritative merge instructions.

`canonical_manga_catalog` aggregates canonical metadata, available source count and JSON source mappings for anonymous/authenticated read access.

### Current frontend/database split

Multi-source `/search` currently canonicalizes live provider results in memory with `canonicalizeMangaCandidates`; it does not use `canonical_manga_catalog` as its sole search backend. The database view/RPC supports persisted catalogue and sync workflows, while live provider search remains active. Any future consolidation must preserve provider-specific search and avoid reducing current readable coverage.

## 10. Source resolution logic

The client scorer is in `src/domain/sourceResolution.ts`; the persisted equivalent is `rank_canonical_manga_sources` in migration `20260829050000_add_source_resolution_ranking.sql`.

Maximum score: 100 points.

| Signal | Maximum | Rules |
|---|---:|---|
| Availability/circuit | 20 | unavailable = 0; half-open = 10; available/closed = 20 |
| Latency | 15 | linearly penalized through 5000 ms; unmeasured = 7.5 |
| Preferred language | 20 | exact base language = 20; `multi` = 15; `und` = 8; other = 2 |
| Chapter coverage | 20 | ratio against maximum candidate chapter count; no observed maximum = 10 |
| Image quality | 10 | normalized 0–100; unmeasured client = 5; DB metadata defaults to 50 |
| Error rate | 10 | inverse failure/request ratio; unmeasured = 5 |
| Freshness | 5 | <=24 h = 5; <=7 d = 3; older = 1; none = 0 |

A source is eligible only when `available` and its circuit is not `open`. Ineligible sources score zero. Equal scores are ordered by source ID for deterministic output. Every score includes its component breakdown.

Reader alternatives are resolved by `useChapterSourceAlternatives`:

1. Fetch extractor health from `/api/extract/health` when possible.
2. Consider only other sources supporting search, chapters and direct pages.
3. Prefer non-open circuits before fan-out.
4. Search the current manga title on each candidate.
5. Prefer exact normalized-title match, then contains match, then first result.
6. Fetch up to 500 chapters in French.
7. Require normalized chapter-number equality for `available = true`.
8. Score candidates with the T-3008 domain scorer.
9. Sort descending by score, then source ID.

This fan-out is intentionally lazy. Do not make it run during every normal Manga Detail or Reader render.

## 11. Fallback logic

Core pure logic: `src/domain/automaticFallback.ts`.

- `MAX_AUTOMATIC_SOURCE_ATTEMPTS = 3`.
- `parseTriedSources` parses/deduplicates the comma-separated `tried` query.
- `selectAutomaticFallback` excludes the active source and all tried sources.
- A candidate is selectable only when its exact chapter object is non-null.
- Remaining candidates sort by score descending, then source ID.
- When the unique tried/current set reaches the attempt budget, fallback stops.

Runtime sequence in `UniversalReader` and `Reader.tsx`:

1. `useUniversalChapterPages` retries failures while `failureCount < 2`.
2. Once the page query is in error, alternatives are enabled.
3. The best compatible untried candidate is selected.
4. A 700 ms friendly recovery state is shown.
5. Navigation uses `{ replace: true }` to the alternative `/read/...` route.
6. Query parameters preserve `lang`, zero-based `page`, append the current source to `tried`, and set `fallback=1`.
7. On arrival, the Reader confirms that an alternative source was loaded.
8. If no candidate succeeds, retry and manual source actions remain visible; raw errors are secondary expandable diagnostics.

Manual switching does not carry `tried`/`fallback`; it starts a user-directed source path while preserving the current page and using the alternative chapter language when available.

## 12. Reader behavior and invariants

Canonical route:

```text
/read/:source/:mangaId/:chapterId?lang=<language>&page=<zero-based-index>
```

Automatic fallback may additionally use:

```text
&tried=sourceA,sourceB&fallback=1
```

Six persisted modes, with exact stored values:

- `vertical`
- `webtoon`
- `single_page`
- `double_page`
- `manga_rtl`
- `comic_ltr`

Other preferences:

- fit: `width | height | original`
- zoom: `0.5..2`
- page gap: `0..48`
- background: `ink | night | paper`
- brightness: `0.5..1.25`
- preload count: `1..8`
- direction: `rtl | ltr`

Defaults: single page, width fit, 100% zoom, 8 px gap, ink background, 100% brightness, three preloaded pages and RTL.

Preferences persist immediately to `localStorage` key `manga_wave_reader_preferences_v3`; authenticated updates are debounced by 600 ms into `user_reader_preferences`.

Reading progress uses a zero-based `pageIndex`. Local writes are debounced by 500 ms; authenticated remote writes by 2000 ms. Both are flushed on `pagehide`, document hiding and cleanup. Continue Reading merges local and remote entries by `source:mangaId`, keeping the most recent timestamp, and retains at most 50 local entries under `manga_wave_reading_history_v1`.

Nearby page preload includes the previous page and the configured number ahead. Near the chapter end, the first page of the next chapter is prefetched through TanStack Query.

## 13. Supabase migrations

Migrations in forward order:

| Migration | Purpose |
|---|---|
| `20260827154000_create_manga_wave_schema.sql` | Base catalogue, chapters/pages, favorites/history/progress, RLS and updated-at trigger |
| `20260827170000_add_mangadex_catalog_metadata.sql` | MangaDex catalogue metadata |
| `20260827180000_enable_mangadex_upsert.sql` | MangaDex upsert support |
| `20260827190000_add_mangadex_chapter_identity.sql` | External MangaDex chapter identity |
| `20260828200000_add_multi_source_catalog.sql` | Canonical fields, mappings, snapshots, source health, fuzzy lookup |
| `20260828210000_add_source_sync_queue.sql` | PGMQ queue, sync-run tracking and service-role RPCs |
| `20260828213000_fix_source_catalog_upsert.sql` | First upsert correction |
| `20260828214000_disambiguate_source_catalog_upsert.sql` | SQL parameter/column disambiguation |
| `20260828220000_schedule_source_sync.sql` | Five-minute pg_cron/pg_net source-sync invocation |
| `20260829010000_add_reader_preferences.sql` | Owner-only Reader preferences |
| `20260829020000_add_universal_reading_progress.sql` | Owner-only universal source progress |
| `20260829030000_reader_fit_width_default.sql` | Changes default fit to width |
| `20260829040000_stabilize_canonical_manga.sql` | T-3007 normalization, safe canonical upsert, view and mapping metadata |
| `20260829050000_add_source_resolution_ranking.sql` | T-3008 explainable ranking RPC |
| `20260829060000_add_canonical_reading_progress.sql` | P1 hotfix canonical per-work progress with non-destructive legacy backfill |

Project reports state that hosted migration history was current and remote canonical view/ranking RPC tests passed on 2026-08-29. Re-run `supabase migration list --linked` before adding another migration; do not rely on this dated statement indefinitely.

## 14. Current database model

### Public content/catalogue tables

- `mangas`: canonical work; title, normalized title, aliases, author, description, cover, rating, views, status, genre, type and sync timestamps.
- `chapters`: local canonical manga chapter metadata, unique by manga/chapter number.
- `pages`: local chapter page URLs, unique by chapter/page number.
- `manga_source_mappings`: canonical-to-provider identity, source URL/title, confidence, verification flag, JSON metadata, language, availability and sync timestamps.
- `chapter_snapshots`: mapping-specific chapter identity, language, page URL cache, availability and expiry.
- `source_health`: persisted source circuit/latency/request/failure/success/freshness state.
- `source_sync_runs`: source queue execution audit with status, attempts, counts and error.

### User-owned tables

- `user_favorites`: user + canonical manga.
- `user_history`: user + local chapter history.
- `user_progress`: legacy/local-table chapter progress.
- `user_reader_preferences`: one row per user containing all Reader settings.
- `user_reading_progress`: universal provider progress keyed by `(user_id, source_id, source_manga_id)`.
- `user_canonical_reading_progress`: active canonical Continue Reading state keyed by `(user_id, canonical_key)`; stores optional canonical manga ID, logical chapter key and last-provider context. The application now reads/writes this table while the provider-scoped table remains as legacy archive.

### View and RPCs

- View: `canonical_manga_catalog`.
- Public read/search RPCs: `normalize_manga_title`, `find_canonical_manga`, `rank_canonical_manga_sources`.
- Service-role-only sync RPCs: `enqueue_source_sync`, `dequeue_source_sync`, `complete_source_sync`, `upsert_source_catalog`.

RLS is enabled. Catalogue/mapping/snapshot/source-health reads are public to `anon` and `authenticated`; personal tables are owner-only with `auth.uid()`; sync mutation RPCs are service-role-only.

## 15. Important files and components

| File | Responsibility |
|---|---|
| `src/App.tsx` | Route contract and global providers |
| `src/pages/Index.tsx` | Homepage composition; exactly one Footer |
| `src/pages/Search.tsx` | Provider selection and live canonical grouping |
| `src/pages/MangaDetail.tsx` | Source-backed detail, chapters, read actions, manual source panel |
| `src/pages/Reader.tsx` | Route parsing and automatic/manual source navigation |
| `src/components/UniversalReader.tsx` | Reader state, modes, toolbar, errors, fallback, progress and page rendering |
| `src/components/reader/ReaderSettingsPanel.tsx` | Preferences and manual source selector |
| `src/components/reader/pageFit.ts` | Mobile height-fit readability fallback |
| `src/components/MangaCover.tsx` | Defensive cross-provider cover loading/cropping |
| `src/components/ContinueReadingSection.tsx` | Exact resume UI |
| `src/domain/canonicalManga.ts` | Canonical identity/grouping pure domain logic |
| `src/domain/sourceResolution.ts` | Explainable client score and deterministic ranking |
| `src/domain/automaticFallback.ts` | Attempt budget, tried-source handling and fallback selection |
| `src/hooks/useMangaReader.ts` | Universal source queries and lazy alternative discovery |
| `src/hooks/useReaderPreferences.ts` | Local/Supabase Reader settings persistence |
| `src/hooks/useReadingProgress.ts` | Local/Supabase progress, merge and Continue Reading data |
| `src/hooks/useReaderPreloading.ts` | Bounded page and next-chapter preloading |
| `src/hooks/useSourceResolution.ts` | Supabase canonical ranking RPC hook |
| `src/integrations/sources/index.ts` | Runtime readable-source registry |
| `src/integrations/sources/types.ts` | Shared source adapter contract |
| `src/integrations/supabase/client.ts` | Typed public Supabase browser client |
| `src/integrations/supabase/types.ts` | Generated/maintained database contract |
| `api/extract.ts` | Vercel extraction, health and image-proxy API |
| `server/src/lib/source-manager.ts` | Timeouts, metrics and circuit breaker |
| `server/src/sources/` | Provider extractors |
| `supabase/functions/source-sync/index.ts` | Queue-driven source catalogue sync |
| `supabase/migrations/` | Forward-only database history |
| `vercel.json` | Function packaging and SPA rewrites |
| `P0_DESKTOP_SMOKE_TEST.md` | Exact uncompleted desktop gate |
| `TECHNICAL_DEBT.md` | Explicit deferred/non-blocking debt |

## 16. Latest commits

Newest first:

```text
6e94cce  2026-08-29 14:53 +02:00  feat(sources): add manual source selectors
8ef3f83  2026-08-29 14:28 +02:00  feat(reader): add automatic source fallback
87b37a7  2026-08-29 14:24 +02:00  feat(sources): add explainable source ranking
1c0805d  2026-08-29 14:16 +02:00  feat(catalog): add canonical manga model
b424acd  2026-08-29 13:32 +02:00  fix(reader): correct responsive page fitting
6b0d220  2026-08-29 12:00 +02:00  docs(product): adopt desktop-first P0 gate
ae68fb0  2026-08-29 08:38 +02:00  docs(ui): report Manga Wave V3 visual refactor
cb16dfd  2026-08-29 08:36 +02:00  feat(ui): redesign genres navigation and footer
6eb29bd  2026-08-29 08:36 +02:00  feat(ui): redesign manga cards and editorial sections
fe608bc  2026-08-29 08:36 +02:00  feat(ui): redesign homepage hero and editorial layout
4eca16a  2026-08-29 08:06 +02:00  fix(reader): unify manga detail with immersive reader route
410df60  2026-08-29 07:25 +02:00  docs(product): report P0 evolution
```

No release tags were present when this handoff was created.

## 17. QA status

### Passed deterministically

- Production homepage, Manga Detail and standalone Reader routes previously returned HTTP 200.
- Reader imports/renders neither Header nor Footer.
- Manga Detail reading actions target the canonical Reader route.
- Six modes and all preferences are registered/persisted.
- Previous/next chapter navigation preserves the standalone route.
- Continue Reading preserves source, manga, chapter and exact page.
- Canonical tests: 6/6.
- Source-resolution tests: 5/5.
- Automatic-fallback tests: 4/4.
- Combined P1 tests: 15/15.
- ESLint: 0 errors; 57 known Fast Refresh warnings in shared UI modules.
- Production build: passed; existing >500 kB chunk warning remains.
- Supabase linked database lint was reported clean.
- Remote `canonical_manga_catalog` REST and ranking RPC contract tests were reported HTTP 200.

### Not interactively verified

- Homepage desktop layout/cover crops/horizontal overflow.
- Manga Detail desktop layout/chapter actions/manual source selector.
- Reader initial standalone composition.
- Toolbar auto-hide/reveal and overlap.
- Reader Settings open/scroll/close.
- All six modes in rendered content.
- Mode switching without progress loss.
- Previous/next chapter click-through.
- Automatic fallback navigation in a real failure.
- Manual selector switching in both entry points.
- Console and network errors during these flows.
- Representative cover crops from all six readable sources.
- Required mobile/tablet viewports.

Therefore:

```text
P0_DESKTOP = PENDING
P0_RESPONSIVE = DEFERRED
P1_T3007 = PASS
P1_T3008 = PASS
P1_T3009 = PASS
P1_T3010 = PARTIAL (interactive browser QA only)
```

## 18. Known limitations and unresolved items

1. **Interactive browser QA is the primary unresolved acceptance item.** The previous environment exposed no controllable in-app browser.
2. **Responsive QA is deferred.** Validate `768x1024`, `430x932` and `390x844` later; code exists but the behavior is not accepted interactively.
3. **Production bundle exceeds the 500 kB warning threshold.** Route-level lazy loading and exclusion of heavy extractor/admin dependencies from the initial client bundle are technical debt.
4. **Legacy visual token names remain.** Names such as `manga-purple` now resolve to the coral/blue system but should eventually become semantic tokens without visual changes.
5. **Automated Reader coverage is incomplete.** Add mode-transition, exact progress/resume, canonical route/chapter navigation and Continue Reading URL tests.
6. **Canonical search is partly client-side/live.** The persisted canonical view is not yet the single search source of truth.
7. **Source matching in live fallback includes a permissive contains/first-result fallback.** Exact chapter number is required, but manga identity can still be ambiguous for similar titles. Do not weaken T-3007 database merge protections to compensate.
8. **Two health domains exist.** `/api/extract/health` is in-memory per server process/instance, while `public.source_health` is persisted. The Reader alternative path consumes extractor health; the database RPC consumes persisted health. They can diverge, especially on serverless cold starts.
9. **Source health is not durably updated by `api/extract.ts`.** The current `SourceManager` state resets with a serverless instance and is not visibly synchronized into `public.source_health` by this path.
10. **Fallback fan-out can be expensive.** It searches and fetches up to 500 chapters from every compatible alternative. It is correctly lazy but may still hit provider timeouts/rate limits when activated.
11. **Canonical progress uses normalized title as its conflict-safe key.** `canonical_manga_id` is populated from mappings when available, but works known only through different non-equivalent aliases can still require a future verified-key reconciliation. Provider-scoped legacy progress remains intact as an archive.
12. **Provider artwork varies.** `MangaCover` protects loading/cropping, but focal-position metadata does not exist for individual cover outliers.
13. **Legacy README is generic Lovable boilerplate.** Use this handoff and the ticket reports for current architecture, not the README alone.
14. **Production deployment of HEAD must be checked.** Git is aligned with `origin/main`, but the exact Vercel deployment SHA was not proven by this handoff.

## 19. Strict do-not-break constraints

The next agent must preserve all of the following unless the user explicitly authorizes a product change:

1. Keep `/read/:source/:mangaId/:chapterId` as the single canonical Reader route.
2. Never reintroduce an inline Reader into Manga Detail.
3. Never render the global Header or Footer inside the standalone Reader.
4. Preserve all six mode values exactly; database checks and local preferences depend on the strings.
5. Preserve zero-based page indexing in URLs, Reader state and `user_reading_progress`.
6. Preserve source, manga ID, chapter ID, language and exact page across resume/navigation.
7. Automatic fallback must require the exact chapter, exclude tried/current sources and stop at three source attempts.
8. Automatic fallback must use route replacement; manual user selection may push a new history entry.
9. Keep manual Retry and source selection available after automatic recovery is exhausted.
10. Do not eagerly fan out to every provider on ordinary Manga Detail/Reader loads.
11. Never make fuzzy title similarity perform a destructive canonical merge.
12. Keep `public.mangas` as the canonical table unless a separately planned migration safely preserves every dependent FK and user row.
13. Never delete user-owned progress, preference, favorite or history rows as part of canonical/source migrations.
14. Keep migrations forward-only after they have reached hosted Supabase; correct with a new migration.
15. Keep personal tables protected by owner-only RLS.
16. Never expose service-role credentials in browser code, `.env.example`, Git or `VITE_*` variables.
17. Preserve defensive cross-source cover rendering and `object-cover` framing.
18. Preserve the current editorial navy/coral/blue visual direction during functional work.
19. Do not mark visual/interactive QA as PASS from unit tests, lint, build or static inspection alone.
20. Do not start unrelated P2 retention work until the P1 interactive smoke test is completed and P1 is accepted.

## 20. Exact next recommended step

**Run a read-only interactive P1/P0 desktop smoke test against production; do not modify code during the run.**

Use the built-in browser at `1440x900` and `1280x800` first:

1. Open the homepage and inspect horizontal overflow, editorial layout and representative cover crops.
2. Search a known title using “Toutes les sources”; verify one canonical card, provider count and readable primary navigation.
3. Open Manga Detail; verify chapters and “Changer de source”. Open the selector and confirm provider, language, availability, score and last-success states.
4. Start a chapter and confirm the URL is `/read/:source/:mangaId/:chapterId` and no Header/Footer appears.
5. Reveal/hide the toolbar; open, scroll and close Settings.
6. Exercise vertical, webtoon, single page, double page, manga RTL and comic LTR. Confirm images remain visible and current page/progress does not reset.
7. Navigate previous/next chapter and confirm the Reader remains standalone.
8. Trigger or reproduce an unavailable chapter/source. Verify friendly loading state, exact-chapter automatic fallback, page/language preservation, `tried` chain and maximum attempt protection.
9. Use the Reader Settings manual source selector and confirm page preservation.
10. Inspect console errors, failed network requests, image rendered width, toolbar overlap and document horizontal overflow.

Then record evidence in the reports and set statuses only if supported:

```text
P0_DESKTOP = PASS or FAIL
P0_RESPONSIVE = DEFERRED
P1_T3010 = PASS or FAIL
```

After desktop acceptance, optionally execute the deferred responsive matrix at `768x1024`, `430x932` and `390x844`. Do not let that deferred matrix retroactively block accepted desktop P1.

## 21. Validation commands

Run from repository root:

```powershell
npm ci
npm run test:canonical
npm run test:sources
npm run test:p1
npx tsc -b --pretty false
npm run lint
npm run build
```

Expected current results:

- canonical: 6 passed;
- sources: 5 passed;
- P1 combined: 15 passed;
- TypeScript: no error;
- ESLint: 0 errors, known Fast Refresh warnings may remain;
- build: success with the known chunk-size warning.

Supabase checks, with the CLI authenticated/linked:

```powershell
npx supabase migration list --linked
npx supabase db lint --linked --project-ref ilmsomiaqthhfyvgqnsp --level error
```

Local full-stack development:

```powershell
npm run dev:full
```

This starts Vite on port `8080` and the local extractor server on port `3001`; Vite proxies `/api/extract` to the extractor.

Basic production probes:

```powershell
Invoke-WebRequest -Method Head https://manga-wave-bienvenue-fusion.vercel.app/
Invoke-RestMethod https://manga-wave-bienvenue-fusion.vercel.app/api/extract/health
```

Do not treat HTTP 200 probes as visual QA.

## 22. Rollback guidance

### Application rollback

Prefer a Git revert and normal Vercel redeployment so history stays auditable. Do not use `git reset --hard` on shared `main`.

P1 dependency order is:

```text
T-3007 1c0805d -> T-3008 87b37a7 -> T-3009 8ef3f83 -> T-3010 6e94cce
```

To remove only T-3010 while retaining automatic fallback/ranking/canonicalization:

```powershell
git revert 6e94cce
```

To roll back all P1 application commits, revert newest to oldest:

```powershell
git revert 6e94cce
git revert 8ef3f83
git revert 87b37a7
git revert 1c0805d
```

Resolve conflicts without deleting unrelated user changes, run the full validation suite, then push `main` to trigger Vercel. Alternatively, use Vercel’s deployment rollback for an urgent frontend-only incident, then create the Git revert so repository and production converge.

### Database rollback

Applied Supabase migrations are forward-only. Never delete or edit an already-applied migration file and never drop user tables to “undo” a feature.

- For T-3008 RPC defects, add a new migration with `create or replace function rank_canonical_manga_sources(...)` containing the corrected/previous implementation.
- For T-3007 upsert defects, add a new migration replacing `normalize_manga_title`, `find_canonical_manga`, `upsert_source_catalog` or `canonical_manga_catalog` as needed.
- Do not remove `mangas`, `manga_source_mappings`, preferences or progress tables; they contain or anchor durable data.
- Before any corrective migration, export/backup affected canonical mappings and inspect duplicate candidates.
- Keep client-generated Supabase types aligned after schema/RPC changes.

If frontend code is rolled back while database additions remain, the additive T-3007/T-3008 schema can safely remain in place; older frontend code does not need to consume the view/RPC. Re-run database lint and REST/RPC smoke checks after any corrective migration.
