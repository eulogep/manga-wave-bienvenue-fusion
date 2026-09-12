# New sources: MangaPill and Sushi-Scan

Date: 2026-09-14

## Why these two

Requested: propose additional scan sources. Investigated three tiers before writing any code
(official APIs, EN fan-scan aggregators, FR scan sites) by fetching each candidate live —
`robots.txt`, real search/detail pages — rather than assuming structure. Findings:

- **MangaPlus**: API returns Protobuf, not JSON — a real, separate engineering effort (schema
  decoding), not attempted here.
- **Webtoons.com**: `robots.txt` explicitly disallows the `Scrapy` user-agent on its chapter-viewer
  path — a deliberate anti-scraping signal from the rights holder that would undermine the entire
  reason to prefer an "official" source. Not integrated.
- **Tapas**: server response is a client-rendered SPA shell with no usable content in the raw HTML.
  Would need a headless browser and further investigation. Not attempted here.
- **Mangakakalot / Manganato / natomanga**: both current mirrors returned `403` to a plain HTTP
  request with a real browser User-Agent — Cloudflare-class protection. Not integrated.
- **MangaPill**: plain server-rendered HTML, no protection observed, clean English catalogue.
  **Integrated.**
- **Sushi-Scan**: French, Madara/WordPress (same CMS family as the existing `crunchyscan` adapter,
  which actually targets LelManga — both expose the same `ts_reader.run(...)` reader payload).
  **Integrated**, with one real finding: its own genre taxonomy mixes explicit-content tags
  ("Érotique", "Pornhwa") into the general catalogue with no separate gate. Per explicit product
  decision, integrated as-is (matching how MangaDex's own `erotica` rating already flows through
  this app unfiltered today), with `contentRating` derived from those genre tags rather than left
  unmarked — see `src/domain/contentRating.ts`.

## What was added

Follows the existing `SourceExtractor` / `MangaSource` contract exactly — no new abstraction:

- `server/src/sources/mangapill.ts`, `server/src/sources/sushiscan.ts` — new extractors
  (search/getPopular/getDetail/getPages), registered in `server/src/sources/index.ts`.
- `src/integrations/mangapill/client.ts`, `src/integrations/sushiscan/client.ts` — thin
  `extractorFetch` wrappers, identical shape to the existing AsuraScans/MangaFire clients.
- `src/integrations/sources/mangapill.ts`, `src/integrations/sources/sushiscan.ts` — `MangaSource`
  implementations, registered in `src/integrations/sources/index.ts`; `mangapill`/`sushiscan` added
  to the `SourceType` union.
- `src/domain/contentRating.ts` — exact-tag (never substring) genre-based classifier, used only by
  Sushi-Scan today. Unit tested.
- **Real production bug found and fixed while verifying end-to-end**: MangaPill's page CDN
  (`cdn.readdetectiveconan.com`) enforces Referer-based hotlink protection keyed to the *site*
  (`https://mangapill.com/`), not the image host — the default proxy behavior (and a direct,
  `referrerPolicy="no-referrer"` browser load) both `403`. Fixed in two places:
  - `server/src/sources/mangapill.ts`: `getPages()` now returns pre-proxied URLs with the correct
    `referer` query param attached, instead of raw CDN URLs.
  - `api/extract.ts` (the production Vercel image-proxy handler): added support for an explicit
    `referer` query param (previously always defaulted to the image's own host — silently ignoring
    what the local dev server already supported, which would have made this fix work locally but
    still fail in production undetected). Also added `readdetectiveconan.com`, `sushiscan.fr`, and
    `yaoiscan.fr` to `IMAGE_HOST_SUFFIXES` (the production proxy's allowlist).

## What was deliberately NOT done

- **Canonical catalog auto-sync**: `supabase/functions/source-sync/index.ts` has its own hardcoded
  `SOURCE_IDS` set that does not yet include `mangapill`/`sushiscan`. Without it, these two sources
  are reachable only by direct provider navigation (`?source=mangapill`, `?source=sushiscan`) —
  they do not yet contribute to canonical Search, Trending, Ranking, or Recommendations. Extending
  and deploying that Edge Function is a real next step, gated the same way database migrations have
  been in this project: prepared but not deployed without explicit authorization, since it's a
  shared-resource deployment outside the normal `git push` → Vercel pipeline.
- No legacy per-provider discovery UI was added or reintroduced (`MultiSourceHubSection.tsx`,
  which predates the canonical/source-agnostic architecture, is confirmed unused/dead code and was
  left untouched).

## Verification

- Real, live end-to-end checks (local dev server, real network calls to both sites): search,
  detail, chapter list, and — critically — the actual `<img>` element's `naturalWidth > 0` after
  clicking through to the Reader (not just an HTTP 200 or DOM presence). Both sources render real
  pages.
- `tests/contentRating.test.ts` (6 tests): exact-tag matching, no false positives from similar
  substrings, case/accent normalization.
- `tests/e2e/new-sources.spec.ts`: the same two end-to-end scenarios as a committed, repeatable
  Playwright spec (`npm run test:e2e:new-sources`).
- Full regression: unit suite 239/239 PASS (6 new), `tsc --noEmit` clean for both the app and the
  `server/` package, `eslint` 0 errors, `npm run build` (app) and `npm run build` (server) both PASS.

## Next steps (not done yet)

1. Deploy this commit (mechanical — same `git push` → Vercel pipeline as every other change), then
   re-run `npm run test:e2e:new-sources` against production to confirm the `api/extract.ts` referer
   fix and allowlist additions work identically live.
2. If canonical integration (Search/Trending/Ranking/Recommendations awareness) is wanted, extend
   `source-sync`'s `SOURCE_IDS` and deploy that Edge Function — requires the same explicit
   authorization already used for database migrations in this project.
