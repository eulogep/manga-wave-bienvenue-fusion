# Manga Wave P0 — Desktop Smoke Test

Gate target:

- `P0_DESKTOP = PASS`
- `P0_RESPONSIVE = DEFERRED`

## Deterministic checks completed

- [x] Production homepage route returns HTTP 200.
- [x] Production Manga Detail route returns HTTP 200.
- [x] Production standalone Reader route returns HTTP 200.
- [x] Manga Detail routes every reading action to `/read/:source/:mangaId/:chapterId`.
- [x] Reader route does not import or render the global Header.
- [x] Reader route does not import or render the global Footer.
- [x] Toolbar reveal handlers exist for pointer movement, pointer interaction and touch.
- [x] Toolbar/settings overlays do not participate in document layout.
- [x] Vertical, Webtoon, Single Page, Double Page, Manga RTL and Comic LTR are registered and persisted.
- [x] Previous/next chapter handlers preserve the standalone Reader route.
- [x] Continue Reading preserves source, manga, chapter and exact page in its resume URL.
- [x] Covers from shared homepage sources use the defensive `MangaCover` component.
- [x] Lint completes with zero errors.
- [x] Production build completes.

## Interactive desktop checks required

- [ ] Homepage desktop composition, cover crops and absence of blocking horizontal overflow.
- [ ] Manga Detail desktop composition, chapter actions and cover crop.
- [ ] Reader desktop initial render without Header/Footer.
- [ ] Toolbar appears after interaction, hides after inactivity and returns on mouse movement.
- [ ] Settings opens, remains usable and closes correctly.
- [ ] Activate and navigate in all six reading modes without blank content or page reset.
- [ ] Switch Vertical → Single → Double → Manga RTL → Webtoon without progress loss.
- [ ] Previous and next chapter remain inside the standalone Reader.
- [ ] Inspect representative covers from OriginManga, MangaDex, Comick, MangaFire, AsuraScans and LelManga.
- [ ] Confirm no desktop-blocking overflow, clipped controls or inaccessible action.

Current verdict:

`P0_DESKTOP = PENDING`

Reason: no controllable browser is exposed in the current execution environment. Do not convert this verdict to PASS from lint/build alone.
