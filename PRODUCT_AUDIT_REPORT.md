# Manga Wave V3 — Product Audit Report

Date: 2026-08-29  
Scope: T-3001, audit before P0 implementation  
Baseline: `npm run lint` PASS, `npm run build` PASS

## Executive summary

Manga Wave already has a working React/Vite application, Supabase authentication, a multi-source provider layer, a universal reader, local reading history, partial authenticated synchronization, source health scoring and automatic source alternatives after a reader failure. The architecture can evolve without a rewrite.

The main P0 gaps are concentrated in the reading experience: the reader still renders the global header/footer, supports only two coarse modes, renders every webtoon image at once, writes progress on every page transition through a mutation, and only synchronizes page `1` remotely for MangaDex. Continue Reading is useful and correctly ordered, but its remote merge is MangaDex-only and its deletion actions lack confirmation for global clearing.

## Inventory and classification

| Area | Classification | Evidence | Decision |
| --- | --- | --- | --- |
| Routes | KEEP | `/`, `/auth`, `/search`, `/manga/:id`, `/read/:source/:mangaId/:chapterId`, `/library` exist in `src/App.tsx`. | Preserve routes; isolate the reader at its existing URL. |
| Application shell | IMPROVE | Header/Footer are duplicated per page and are also mounted inside `Reader`. | Remove global chrome from Reader only; avoid a broad routing rewrite during P0. |
| UniversalReader | REFACTOR | Working page navigation, fullscreen, chapter controls, webtoon mode and failure alternatives exist. Toolbar is permanently visible and the component loads/renders the full chapter. | Keep source/chapter logic; split preferences, viewport loading and shell behavior into focused hooks/components. |
| Reader source fallback | KEEP | `useChapterSourceAlternatives` ranks compatible providers with source health and exposes manual alternatives after failure. | Preserve for P0; automatic source resolution belongs to P1. |
| Provider interface | KEEP | UI consumes normalized `MangaSource`, `SourceManga`, `SourceChapter` and page URLs. | No provider-specific logic should be added to the new reader UI. |
| React Query | IMPROVE | Reader queries have stable keys and useful stale times, but the root `QueryClient` has no shared policy and next-chapter prefetch is absent. | Add targeted reader prefetch now; global query policy remains a later ticket. |
| Anonymous progress | IMPROVE | Local history stores source, manga, chapter, zero-based page, total pages, percentage and timestamp; it deduplicates per source+manga. | Keep local-first behavior; throttle writes and flush on page/chapter exit. |
| Authenticated progress | REFACTOR | The Edge Function accepts MangaDex UUIDs only and writes page `1` with `ignoreDuplicates`; remote history reports completed progress instead of exact position. | Add a forward-only universal progress model and secure owner RLS; retain old tables for compatibility. |
| Continue Reading | IMPROVE | Shows cover, chapter, page X/Y, percentage, last read and resume CTA; sorted most recent first. | Make it visually central, include all active sources, confirm global clearing, and improve accessible controls. |
| Homepage | IMPROVE | Hero and Continue Reading are useful; `MultiSourceHubSection` remains provider-first. | P0 changes Continue Reading only. Source invisibility/home personalization belong to P1/P2. |
| Manga Detail | IMPROVE | Existing detail page supports normalized providers, chapters and reader entry. | Preserve during P0; visual V2 is P3. |
| Search | KEEP | Multi-provider search, filters and provider catalog integrations already exist. | No P0 rewrite. |
| Library | IMPROVE | Favorites and history exist with filters, sorting and resume links; data model does not yet represent reading/paused/dropped states. | Preserve during P0; Library V2 is P2. |
| Authentication | KEEP | Supabase session listener, signup, login and logout are implemented. | Reuse current session for secure progress sync. |
| Supabase RLS | KEEP / IMPROVE | Existing personal tables use owner policies. Canonical/source health tables are public read-only. | Add owner-only policies for universal progress; no destructive migration. |
| Security | IMPROVE | No service-role key is referenced by frontend code. Reader image proxy validates allowed hosts. Edge progress endpoint validates sessions. | Maintain server-only keys; validate universal progress payloads and identifiers. |
| Design system | REFACTOR | Tokens exist but use purple/pink/cyan and extensive gradients/glows; official V3 calls for dark neutral + rare coral + electric blue. | Introduce V3 semantic tokens and apply them to P0 reader/continue-reading without restyling the whole product at once. |
| Typography | IMPROVE | Inter/Outfit/Noto Sans are loaded; no editorial display face is present. | Add an editorial display token for reader title surfaces only in P0. |
| Motion | IMPROVE | Many bespoke 300–600ms animations and persistent effects exist; reduced-motion coverage is incomplete. | Add 120/180/240ms tokens and reduced-motion rules to new P0 UI. |
| Mobile | REFACTOR | Reader is responsive but remains inside desktop page chrome and controls are dense. | Make Reader full viewport and touch-first in P0. Bottom app navigation is P4. |
| Accessibility | IMPROVE | Semantic headings, labels and keyboard page navigation exist; icon titles replace some explicit labels and focus/reduced-motion are inconsistent. | Add 44px controls, focus-visible states, live status, keyboard shortcuts and motion reduction to P0. |
| Performance | REFACTOR | Production bundle is ~650 KiB minified; webtoon mode maps every page; reader images have no bounded preload window. | Implement page-window preloading in P0. Route splitting and image pipeline remain later work. |
| Skeletons/errors | IMPROVE | Reader has loading/error states and retry/source alternatives. Empty page state is plain text. | Replace technical reader errors with product language and keep actionable retry/source switching. |
| Tests | MISSING | No application unit, integration, visual regression or E2E test files were found. | Add deterministic tests around new pure reader/progress utilities where feasible; document manual validation. |
| Analytics | MISSING | No P0 reader event instrumentation found. | Defer to T-3045; avoid adding an ad-hoc analytics dependency. |
| PWA/offline | MISSING | No offline reader/download architecture inspected. | Correctly deferred until online reader is stable. |

## P0 implementation decisions

1. Keep `/read/:source/:mangaId/:chapterId` and render an independent full-viewport reader shell with no Header/Footer.
2. Introduce persisted reader preferences with visitor localStorage fallback: vertical, webtoon, single page, double page, RTL manga and LTR comic, plus fit, zoom, gap, background, brightness, fullscreen and preload count.
3. Render only the active page spread in paged modes and preload a bounded window around it. In continuous modes, mount a bounded progressive range instead of eagerly decoding the entire chapter.
4. Prefetch next chapter metadata and its first page near chapter completion using the existing provider contract and React Query client.
5. Keep progress local-first, throttle routine persistence, and flush on visibility/page unload and chapter transitions.
6. Add a forward-only universal Supabase progress table keyed by user + provider + external manga, with exact chapter/page/percentage/timestamp and owner RLS. Preserve `user_history` and `user_progress`.
7. Make Continue Reading the first personalized homepage block after Hero, using the V3 visual direction and explicit confirmation before clearing all local history.

## Known risks

- Provider chapter ordering is usually descending but not guaranteed by the shared contract; current next/previous logic relies on that convention.
- Cross-source canonical progress merging is not safe until P1 canonical source mappings are consumed by the frontend.
- Comick currently provides reliable discovery metadata but not reliable reader pages; fallback remains necessary.
- Authenticated universal progress requires a migration and regenerated/manual TypeScript typing until Supabase types are regenerated.
- Full visual regression automation is absent; P0 requires manual desktop/mobile checks in addition to lint/build.

## P0 exit criteria

- Reader contains no global marketing chrome.
- All requested reader modes/settings are persisted and keyboard/touch usable.
- Paged mode decodes only the active spread plus bounded preloads.
- Continuous mode progressively mounts pages.
- Exact progress survives reload for anonymous users and syncs for authenticated users.
- Continue Reading resumes the exact page and presents clear progress metadata.
- Provider failure retains retry and source-switch actions without exposing raw technical messages.
- Lint and production build pass after every ticket.
