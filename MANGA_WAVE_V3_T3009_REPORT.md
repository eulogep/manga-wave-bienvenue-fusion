# Manga Wave V3 — T-3009 Automatic Source Fallback

STATUS: PASS

PRIMARY_FAILURE_DETECTION: PASS

RANKED_SECONDARY_SELECTION: PASS

EXACT_CHAPTER_REQUIREMENT: PASS

LOOP_PROTECTION: PASS

ATTEMPT_BUDGET: PASS — 3 sources maximum

PAGE_PRESERVATION: PASS

LANGUAGE_PRESERVATION: PASS

FRIENDLY_FALLBACK_STATES: PASS

MANUAL_RECOVERY: PASS

AUTOMATED_TESTS: PASS — 4/4 T-3009, 15/15 P1

TYPESCRIPT: PASS

LINT: PASS — 0 error

BUILD: PASS

## Implemented behavior

- After the current chapter-page query exhausts its retries, Reader searches compatible providers and reuses the T-3008 ranking.
- Automatic fallback only selects a source that contains the exact requested chapter.
- The best eligible untried source is loaded with route replacement while preserving language and zero-based page index.
- The URL carries the attempted-source chain. Current and previously tried sources are excluded, and automatic resolution stops after three source attempts.
- During resolution the Reader displays “Cette source répond lentement” and “Nous essayons une autre source”. After navigation it confirms “Source alternative chargée”.
- Raw technical errors are no longer the primary message; details remain available in an expandable diagnostic section if recovery is exhausted.
- Retry and manual source selection remain available when no automatic candidate succeeds.

## Scope protection

- Canonical Reader route, six modes, progress persistence, resume, chapter navigation and standalone layout remain unchanged.
- T-3010 manual source selector redesign was not started in this ticket.
- Interactive browser QA was unavailable in the current environment and remains explicitly unclaimed.
