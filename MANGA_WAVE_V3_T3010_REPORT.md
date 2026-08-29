# Manga Wave V3 — T-3010 Manual Source Selector

STATUS: PARTIAL

READER_SETTINGS_SELECTOR: PASS

MANGA_DETAIL_SELECTOR: PASS

SOURCE_NAME: PASS

LANGUAGE: PASS

AVAILABILITY: PASS

QUALITY_SCORE: PASS

LAST_SUCCESS: PASS

MANUAL_READER_SWITCH: PASS

AUTOMATIC_SELECTION_PRESERVED: PASS

TOUCH_TARGETS: PASS

INTERACTIVE_BROWSER_QA: NOT_VERIFIED

## Implemented behavior

- Reader Settings retains its existing preferences and adds a source section showing the active provider and ranked alternatives.
- Each alternative exposes language, exact-chapter availability, T-3008 quality score and last successful request when measured.
- Selecting an available source manually preserves the current zero-based page and uses the selected chapter language.
- Manga Detail adds an on-demand “Changer de source” panel with the same source intelligence and links to the corresponding provider detail.
- Source discovery starts only when the user opens a selector or when automatic fallback is required; ordinary Reader and Manga Detail loads do not fan out to every provider.
- The automatic T-3008/T-3009 path remains the default. Manual choice is available but never required.

## Validation note

- TypeScript, P1 automated tests, lint and production build pass.
- The in-app browser remains unavailable, so click-through and visual checks are not claimed as interactively verified. This is the only reason for `PARTIAL`.
