# Manga Wave — Technical Debt

## Deferred responsive QA

Status: BACKLOG / NON-BLOCKING FOR T-3007

- Validate homepage, Manga Detail and Reader interactively at 430 × 932.
- Validate homepage, Manga Detail and Reader interactively at 390 × 844.
- Validate the Reader interactively at 768 × 1024.
- Confirm toolbar reachability, Settings scrolling, height-fit fallback, double-page handling, RTL and Webtoon layouts in a real browser.

## Bundle size

Status: BACKLOG / NON-BLOCKING FOR T-3007

- Split the production JavaScript bundle, currently above the 500 kB warning threshold.
- Prioritize route-level lazy loading and isolate heavy extractor/admin dependencies from the initial client bundle.

## Legacy visual token names

Status: BACKLOG / NON-BLOCKING FOR T-3007

- Replace historical names such as `manga-purple` with semantic tokens.
- Preserve their current coral/blue resolved values during migration.

## Automated regression coverage

Status: INCREMENTAL / NON-BLOCKING FOR T-3007

- Add Reader mode transition tests.
- Add exact progress persistence and resume tests.
- Add canonical Reader route and chapter navigation tests.
- Add Continue Reading resume URL tests.
