# P4 — Mobile and Accessibility: Manga Card Semantics

Date: 2026-09-12

## STATUS

PRODUCTION_VALIDATED / APPROVED.

## OBSERVED DEFECT

The current production homepage rendered 24 `MangaCard` instances and 24 invalid nested-anchor
structures (`a a`). Each card wrapped the whole article in a detail link while also rendering a
second detail link and a favorite button inside that link. This produced invalid interactive
semantics and unreliable keyboard or assistive-technology navigation.

Fresh production browser evidence at 1200 px:

- cards: **24**;
- nested anchors: **24**;
- horizontal overflow: **none**.

## TARGETED FIX

- `MangaCard` now owns an explicit, labelled full-card link as a sibling of its content.
- The detail action and favorite button remain independent interactive siblings above the card
  link, so no interactive element is nested in another.
- The full-card link keeps the existing focus ring and navigation target.
- Detail and full-card links have distinct accessible names.
- No provider, data model, database, migration, dependency or lockfile changed.

## VALIDATION

- Local Chromium at 1200 px: **24 cards, 0 nested anchors, 0 horizontal overflow**.
- Local Chromium at 390 x 844: **0 nested anchors, 0 horizontal overflow**.
- Targeted Playwright: **2/2 PASS**.
- Full unit suite: **253/253 PASS**.
- TypeScript application: **PASS**.
- TypeScript server build: **PASS**.
- ESLint: **0 errors**, 61 historical Fast Refresh warnings.
- Production application build: **PASS**, `assets/index-Dwc77JeX.js` and
  `assets/index-CkN5cte7.css`.
- Lockfiles: **unchanged**.
- Database and remote writes: **none**.
- Git deployment: **PASS**, `origin/main` at `d31c68fcbf3d7da1a30926a660dfbdbb1b2de23c`.
- Production asset: **PASS**, `assets/index-UFWrDfXa.js`.
- Production Playwright smoke: **2/2 PASS**.
- Production Chromium at 1200 px: **24 cards, 0 nested anchors, 0 horizontal overflow**.
- Production Chromium at 390 x 844: **24 cards, 0 nested anchors, 0 horizontal overflow**.

## ACCEPTANCE

```text
PRODUCTION_DEFECT_REPRODUCED:  PASS (24 nested anchors)
FULL_CARD_NAVIGATION:          PASS
INDEPENDENT_DETAIL_ACTION:     PASS
INDEPENDENT_FAVORITE_ACTION:   PASS
NESTED_INTERACTIVE_CONTENT:    PASS (0 remaining)
MOBILE_390_OVERFLOW:           PASS
TARGETED_E2E:                  PASS (2/2)
UNIT_TESTS:                    PASS (253/253)
TYPESCRIPT:                    PASS
ESLINT:                        PASS (0 errors)
BUILD:                         PASS
LOCKFILES:                     PRESERVED
PRODUCTION_SMOKE:              PASS (2/2)
P4_CARD_SEMANTICS_FINAL:       APPROVED
```

## NEXT STEP

Continue the wider P4 audit from current production evidence. Prioritize the next reproducible
mobile, accessibility, performance or resilience defect and keep the validated card semantics as a
regression gate.
