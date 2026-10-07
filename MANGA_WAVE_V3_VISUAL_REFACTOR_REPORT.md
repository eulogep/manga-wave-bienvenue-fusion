# MANGA WAVE V3 — VISUAL REFACTOR REPORT

## Status

IMPLEMENTED — INTERACTIVE VISUAL QA PENDING

The approved mockup is now treated as the product direction rather than a loose moodboard. The implementation replaces the former neon SaaS-like presentation with an editorial, artwork-led composition built around deep navy, coral action accents, restrained blue metadata and Cinzel display typography.

## What was replaced

- The centered, text-only hero, rotating buzzwords, ambient neon orbs and generic statistics were removed.
- The hero is now a cinematic featured-manga stage powered by live OriginManga artwork, with asymmetrical copy, metadata, strong CTAs, a four-title selector and controlled image overlays.
- The former generic OriginManga carousel and promotional reader banner were replaced by a five-title editorial ranking with prominent numbers.
- The colorful gradient genre cards were replaced by a restrained grid of editorial “reading territories”.
- The default multi-column footer and decorative social buttons were replaced by a calmer brand conclusion with intentional navigation.

## What was restructured

The homepage flow is now:

1. Featured manga hero
2. Continue Reading
3. Editorial trending ranking
4. Multi-source discovery
5. Local MangaDex selection
6. Genre territories
7. Brand footer

This moves the page from a stack of interchangeable modules to a curated progression: emotional entry, personal return, ranked discovery, broader catalogue, focused selection and genre exploration.

## Components redesigned

- `HeroSection` — complete structural replacement.
- `MangaCard` — artwork-first frame, editorial title treatment, restrained metadata and coral reading action.
- `ContinueReadingSection` — more prominent editorial band, explicit percentage and stronger resume hierarchy.
- `OriginMangaSection` — transformed into the ranked trending section.
- `MultiSourceHubSection` — sharper typography, tab rail and controlled blue/coral hierarchy.
- `FeaturedSection` — editorial section heading, square filters and denser catalogue rhythm.
- `CategoriesSection` — complete replacement with premium discovery tiles.
- `Header` — coral brand mark, tighter navigation, underline active state and quieter account actions.
- `Footer` — complete brand and information hierarchy replacement.
- `MangaDetail` — editorial title, sharper artwork frame, dark layered metadata and chapter surfaces.
- Global visual tokens — coral primary, electric-blue secondary, reduced radius, reduced glow and layered navy surfaces.

## Alignment with the approved mockup

- Artwork now carries the emotional weight of the hero and cards.
- Cinzel is reserved for major editorial titles while Inter/Outfit remain interface fonts.
- Coral identifies actions, ranking and priority; blue is limited to secondary discovery metadata.
- Cards and sections use sharper edges, subtle borders and dark elevation instead of glassmorphism and purple glow.
- Ranking numbers, denser horizontal rows and stronger section separators reproduce the mockup’s editorial seriousness without copying its layout pixel for pixel.
- The page contains less dead space and exposes meaningful manga content immediately.

## P0 functionality protected

- The canonical standalone `/read/:source/:mangaId/:chapterId` route is unchanged.
- No Header or Footer was reintroduced in the Reader.
- Reading progress and exact page persistence are unchanged.
- Continue Reading keeps its existing data, sort, resume URL and Supabase/localStorage behavior.
- All six reading modes and persisted preferences are unchanged.
- Manga Detail reading actions still enter the canonical Reader.
- Existing multi-source queries, source selection and unavailable-chapter alternatives remain connected.

## Validation

- Targeted ESLint: PASS — 0 errors.
- Production build: PASS.
- P0 architecture static checks: PASS.
- Interactive desktop inspection: PENDING — no controllable browser was available.
- Interactive tablet/mobile inspection: PENDING — no controllable browser was available.
- Manga Detail and Reader visual inspection: PENDING for the same reason.

## Remaining gaps

- A real-browser review is still required at desktop, tablet and the required mobile widths before claiming final high-fidelity visual acceptance.
- Live cover crops depend on provider artwork; individual outliers may need focal-position metadata later.
- The production bundle retains the existing chunk-size warning above 500 kB.
- Some legacy shared UI utilities still carry historical class names such as `manga-purple`; their resolved colors now follow the coral system, but a future semantic naming cleanup would improve maintainability.
- P1 product architecture work remains out of scope and was not started.
