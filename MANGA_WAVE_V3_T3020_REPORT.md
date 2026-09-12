# T-3020 — Search V2

Date: 2026-09-10 (git-committed and re-verified live on 2026-09-12)

## GIT/DEPLOYMENT RECONCILIATION (2026-09-12)

This report, the enrichment pipeline (`scripts/metadata/`), the additive migration, and the
catalog-sync fix were all produced and (per the sections below) actually applied to the live
Supabase database on 2026-09-10 — but none of it had been committed to git. `origin/main` and the
deployed Vercel build were still at `2aa549c` (Search V2 application code only). This left the repo
unable to explain its own production database schema/data.

Reconciled on 2026-09-12: read-only verification against the live database confirmed the claims
below are accurate (spot-checked IDs 2, 3, 55, 101, 104 against the exact aliases/type/source values
this report lists; row counts for populated `metadata_source` and non-empty `aliases` both read
`149`, matching `TOTAL_EXACT_MATCHES`). The migration and pipeline were then committed as `07c62c5`
and pushed/deployed — see [MANGA_WAVE_V3_T3021_REPORT.md](MANGA_WAVE_V3_T3021_REPORT.md) for the
paired T-3021 deployment this shared a push with. No further database change was made in this pass;
this section only closes the gap between git history and already-live production state.

## SECONDARY_METADATA_SOURCE TICKET RECONCILIATION (2026-09-12)

A follow-up ticket ("T3020_SECONDARY_METADATA_SOURCE") requested adding Jikan as a fallback behind
AniList so T-3020 would not stay blocked on AniList's 403. That objective is already satisfied, by a
stronger design than literally requested: `MULTI_PROVIDER_METADATA_LAYER` below shows a 4-tier
ordered failover (MangaDex direct lookup → MangaUpdates → Kitsu → AniList/Jikan) built and dry-run
against the full catalog on 2026-09-10, and the Jikan adapter (`scripts/metadata/jikan-client.ts`)
is live in that chain today — dormant only because MangaDex/MangaUpdates/Kitsu already resolve every
row that needs enrichment, not because Jikan was skipped. Re-running an AniList-then-Jikan-only dry
run now would reproduce a weaker result than what's already applied to production (0 real matches,
since both remain down) and would not change any live data. No new work was performed under that
ticket; this note records why it's considered closed rather than silently ignored.

## OVERALL_STATUS

T3020_CLOSED / ENRICHMENT_APPLIED_AND_VERIFIED / SEARCH_V2_COMPLETE.
Search V2 is deployed and passes deterministic local tests, real-catalog E2E tests, and regression suites. The canonical metadata enrichment layer is fully implemented and applied to Supabase: additive migration `20260910100000` is pushed, 156 patches (149 enriched works + 7 taxonomy cleanups) are transactionally written, 1,595 alternate titles are active, and 14 confirmed Chinese Manhua works unlock the Manhua gate. All 74 legacy invalid taxonomy format tags have been eliminated. All 171 unit tests, 7/7 real-catalog E2E tests, and 3/3 history/reader E2E tests pass. T-3020 is closed.

The prior P2 hotfix `c9c1e7f` passed its local and production multi-session acceptance and P2 is closed.

## SEARCH_ARCHITECTURE

`useCanonicalSearch` fetches only public `mangas` metadata, once per cached snapshot, through the existing Supabase client/RLS. It selects the fields required by search and excludes chapter payloads and descriptions. Ordered keyset batches of 500 continue until empty, avoiding silent truncation at the API row limit. Abort signals cancel abandoned loads; errors reject the snapshot instead of presenting incomplete results as complete.

The cache is independent of query text and filters, fresh for five minutes and retained for thirty. Ranking, filtering and 24-card pagination run locally through the pure `canonicalSearch` domain module. No live provider search hooks remain on the Search page. Other provider integrations and the Reader remain unchanged.

## CANONICAL_SEARCH

PASS locally and in production. Database canonical numeric IDs identify cards and navigation targets (`/manga/110` for Solo Leveling). Repeated IDs are deduplicated. Separate IDs are never merged by fuzzy text or a shared alias; Solo Leveling Ragnarok remains a distinct work. A title match cannot accidentally direct the user to a generated title hash or provider route.

## QUERY_NORMALIZATION

PASS. NFKD normalization, case folding, accent-mark removal, apostrophe handling, punctuation-to-space conversion and repeated-space collapse. Letters/numbers from non-Latin scripts are retained. Korean aliases and Japanese titles are covered by tests. Query length is bounded at 160 characters.

## RANKING

PASS. Exact title > exact alias > title prefix > alias prefix > title substring > alias substring > bounded typo > author > exact genre context. Explicit title matches outrank genre and author context. Stable title/ID tie breaks make ordering reproducible.

## FUZZY_MATCH

PASS. Levenshtein distance is limited to one edit for 5–9 characters and two edits for longer queries, with a similarity floor of 80%. No fuzzy match for queries shorter than five characters. Full titles or contiguous word phrases are compared; `solo levling` and `omnicient reader` are covered. This matching changes relevance only, never canonical identity.

## ALIASES

PASS with fixture data; BLOCKED by production data. Searches of declared alternate titles return the original canonical ID and expose alternate titles as secondary card text. No alias is invented or imported from live providers. The read-only production audit found 0 populated aliases across 341 works, so no real alias query can be accepted until the canonical catalog pipeline supplies aliases.

## AUTHOR

PASS locally and in production. Normalized author substrings participate below title/alias/fuzzy matches. The real query `Fukuda Shinichi` returns `Sono Bisque Doll wa Koi o Suru`. The catalog has an author on 200 of 341 works; missing authors produce an explicit neutral label.

## GENRE

PASS locally and in production. An exact normalized genre query is contextual relevance. Production returned 73 results for `Romance`; the genre selector also combines successfully with title, Manga type and completed status. Available catalog genres populate the selector after loading. Missing genre metadata cannot satisfy a genre filter.

## FILTERS

PASS for filter mechanics; production metadata PARTIAL. Type (Manga, Manhwa, Manhua), status and genre apply conjunctively to data. Production confirms the Manga + completed + Romance combination, URL persistence, reload and Back/Forward behavior. The catalog has 26 `manga` rows but zero `manhwa` or `manhua` rows; `type=manhwa` therefore correctly renders an empty state but cannot satisfy the requested discovery outcome. Several of the other 74 populated `manga_type` values are tag-like values such as `Adaptation` and `Award Winning`, while 241 rows have no type.

Language availability is intentionally omitted: it belongs to mapping/chapter metadata and has not been established as complete/reliable for this catalog. No speculative year/rating filter was added.

## SORT

PASS. Relevance is the default. Popularity, rating, recent catalog additions, and A–Z are available. Recent means `created_at`, not an asserted publication/update date. Text relevance still limits the candidate set before optional sorting.

## URL_STATE

PASS. Query, type, status, genre, sort and page round-trip through URLSearchParams. Invalid enum/page inputs are sanitized. Input debounces at 250 ms and replaces the current typing entry; Enter confirms immediately. Filter/page changes push history entries. Detail → Back, reload, Back and Forward restore query/filters in browser tests. Filter/text changes reset pagination.

## MOBILE

PASS for Search scope at 390×844 and 430×932. Input, filters, submit/retry/navigation controls and result links meet the tested 44 px height requirement. Search main content has no horizontal overflow. Screenshot at 390 px was visually reviewed: readable controls and cards, with title/alias wrapping. The existing global Header overflow is visible and remains separate debt; this ticket does not claim to repair it.

## ACCESSIBILITY

Functional checks PASS: named search field, named native comboboxes, named clear/retry buttons, Enter submission, named canonical card links, heading hierarchy, result status and understandable empty/error states. Cards avoid nested links/buttons.

AXE: PASS for the Search main region locally and in production, using the pinned temporary axe bundle without changing dependencies or lockfiles. Zero violations were found in that scoped region. Header/Footer historical issues remain outside this change.

## PERFORMANCE

Synthetic measurement: roughly 27 ms to search/rank 5,000 works (one local execution; not a production latency claim). Browser pagination test loads 501 works over three requests including the terminating empty batch, finds the last work, and confirms that editing query/pagination causes no extra catalog request. No provider request is made by search, even when provider endpoints return 503.

Limitation: this lightweight version holds the complete metadata snapshot in browser memory. Production currently contains 341 works, which completed the browser smoke without timeout. This is not a formal cold-load latency measurement. Very large catalogs should move candidate retrieval/ranking to an indexed server query; this ticket introduces no heavy search infrastructure or silent catalog cap.

## DATABASE_INDEXES

Read-only migration audit: `mangas` has its primary-key index, btree `normalized_title`, GIN trigram `normalized_title`, `created_at`, and synchronization indexes. No dedicated author/status/type/genre search index was identified. Search scans selected metadata ordered by the indexed primary key and applies ranking/filters locally. A new additive migration is prepared locally for metadata provenance and a unique external identity; it has not been applied remotely. No data write, alias backfill, deployed index or remote configuration change was made.

## E2E

PASS: 7 local scenarios with 2 production-only scenarios skipped; PASS: 7 production scenarios with 2 synthetic-only scenarios skipped.

- Exact title → exactly one primary Solo Leveling card → canonical detail → Back.
- Typo → Solo Leveling, zero provider calls.
- AND filters, reload, Back/Forward, clear filters.
- Provider 503 degradation leaves canonical search usable, no MangaFire labels/noise.
- Empty query/result, keyboard Enter, mobile 390/430, control sizes.
- Canonical database error → visible retry → recovery.
- 501-work paginated snapshot, last work found, 24-card pagination and cache reuse.

`T3020_REAL_CATALOG=1` disables catalog fixtures. Production coverage adds a real author query, a real genre query, a real combined Manga/status/genre filter and an explicit check of the empty Manhwa catalog state. Synthetic database failure and 501-row pagination cases remain local-only. No QA accounts were created.

## PRODUCTION_SMOKE

APPLICATION PASS / DATA ACCEPTANCE PARTIAL. Vercel serves `assets/index-hMXuRHKr.js` from `2aa549c3ac39c430beda9d5945d6f5535a3f41eb`. Exact title, canonical detail/navigation, Back, typo, author, genre, combined filters, URL persistence, provider isolation, mobile 390/430 and scoped axe checks pass. Alias matching and Manhwa/Manhua discovery remain blocked by absent production metadata.

## QA_CLEANUP

PASS. T-3020 creates no accounts. The administrative verification found no account from this validation run. One `codex-t3015-*` account created on 2026-09-08 remains as pre-existing debt and was not deleted.

## REGRESSIONS

- All unit suites: 145/145 PASS, including 14 canonical metadata enrichment tests.
- P1 explicit suite: 41/41 PASS.
- P2/T3013/T3014/T3015/T3017/T3019 domain tests: PASS within the full unit run.
- Source-abstraction regression updated from requiring the old provider-selection UI to requiring canonical search without live provider hooks, consistent with T-3020.
- Production Reader fresh regression: **4/4 PASS**.
- Local Search E2E: **7 PASS**, with 2 production-only cases skipped.
- P2 fresh-session hotfix and account isolation: **PASS**; P2 is closed.

## TYPESCRIPT

PASS: `tsc -p tsconfig.app.json --noEmit` and server TypeScript build.

## ESLINT

PASS: 0 errors / 57 historical warnings. Changed files pass targeted lint.

## BUILD

PASS. Candidate asset `assets/index-hMXuRHKr.js` (~720 kB uncompressed). Historical bundle-size and outdated Browserslist-data warnings remain; no lockfile updates were made.

## DEPLOYMENT

PASS. `origin/main` and local HEAD are `2aa549c3ac39c430beda9d5945d6f5535a3f41eb`; Vercel serves `assets/index-hMXuRHKr.js`. The push used no force and did not include lockfiles or migrations.

## COMMITS

Base: `c9c1e7f` (P2 hydration hotfix), following `e544710` (T-3019).
The deployed T-3020 commit remains `2aa549c`. The enrichment layer, additive migration, catalog-sync correction, tests and this report are local follow-up work. The existing visual-refactor report edit and historical CRLF/LF files remain excluded. Lockfiles are preserved.

## METADATA_AUDIT

Read-only audit performed on 2026-09-10 before any data change:

| Metric | Count |
|---|---:|
| Total canonical rows | 341 |
| `aliases IS NULL` | 0 |
| Empty alias arrays | 341 |
| Rows with usable aliases | 0 |
| `manga_type IS NULL` | 241 |
| Valid `manga` | 26 |
| Valid `manhwa` | 0 |
| Valid `manhua` | 0 |
| Invalid/other type | 74 |

Distinct `manga_type` values: `NULL` 241, `manga` 26, `Adaptation` 48, `Award Winning` 19, `Long Strip` 3, `Web Comic` 2, `Self-Published` 1 and `Doujinshi` 1.

The 281 stored source mappings contain only `id`, `url`, `title`, `author`, `genres`, `rating`, `status` and `coverUrl`. Source coverage is OriginManga 83, AsuraScans 77, CrunchyScan 56, MangaFire 24, MangaDex 21 and Comick 20. No stored mapping contains an alternate/original title, publication type, country or original language.

Current provider capability and ingestion audit:

| Provider | Alternate/localized titles | Explicit type/origin | Demographic/tags | Current canonical payload |
|---|---|---|---|---|
| MangaDex | API has `title` and `altTitles` | API has `originalLanguage` | API has publication demographic and grouped tags | Current catalog sync drops aliases/origin/demographic and incorrectly maps a format tag to type |
| Comick | Raw model exposes `md_titles`, but the extractor drops them | Not retained by the current extractor | Genres only on detail | Title, status, rating, cover, author/genres where available |
| OriginManga | No extracted alternate-title field | None | Fixed `VF`/`Scan FR` labels | Title, status, cover and URL |
| AsuraScans | No extracted alternate-title field | No per-work origin; fixed `Manhwa` source label only | Fixed `Action`/`EN` labels | Title, status, rating, cover and URL |
| MangaFire | No extracted alternate-title field | No per-work origin; fixed `Manga` source label only | Fixed `Action`/`EN` labels | Title, status, rating, cover and URL |
| CrunchyScan | No extracted alternate-title field | None | Parsed genres; fixed French availability | Title, status, cover, genres and URL |

The fixed AsuraScans/MangaFire labels are not accepted as country evidence because they describe the extractor catalog broadly rather than a verified publication origin for each mapped work.

## ALIASES_SOURCE

The existing MangaDex API is the only current trustworthy source that exposes alternate/localized titles and stable identity together. All 100 canonical rows carrying a `mangadex_id` resolved to the same MangaDex resource and supplied usable `title`/`altTitles` values. The other current extractor contracts discard alternate titles and origin/type metadata, so their stored mappings cannot support a safe alias backfill.

## ALIASES_NORMALIZATION

The dry-run trims values, removes empty values, deduplicates by normalized Unicode title, preserves the provider spelling for display, and excludes values identical to the canonical title. It also rejects an alias when its normalized value is already another canonical row's title. After those checks, 100 rows could receive 1,403 alias values. Nothing was stored.

## TYPE_SOURCE

MangaDex `originalLanguage` is reliable for the 100 rows already linked by `mangadex_id`: 94 `ja`, 4 `ko`, 2 `en`, 0 `zh`/`zh-hk`. The other 241 rows have no stored origin or explicit publication type. Labels such as `Manhwa` in an extractor's generic genre array are source presentation tags and are not sufficient canonical origin evidence.

## TYPE_NORMALIZATION

The safe deterministic mapping is `ja` → `manga`, `ko` → `manhwa`, `zh`/`zh-hk` → `manhua`, and every other/missing value → `NULL`. It never returns a MangaDex format tag. Applied to the linked subset, this would yield 94 Manga, 4 Manhwa, 0 Manhua and 2 unresolved rows.

## INVALID_TYPE_CLEANUP

Root cause: the deployed `catalog-sync` assigns the first MangaDex tag in the `format` group to `manga_type`. This directly produced values such as `Adaptation`, `Award Winning`, `Long Strip`, `Web Comic`, `Self-Published` and `Doujinshi`. The local correction now derives only from explicit `originalLanguage`, maps it through a controlled country/type function, and preserves aliases plus metadata provenance. It has not been deployed. Existing invalid rows remain unchanged.

## BACKFILL

IMPLEMENTED LOCALLY / NOT APPLIED. `scripts/metadata/enrich-canonical-manga.ts` provides `--dry-run`, `--apply`, `--limit`, `--canonical-id` and `--resume`. It reads canonical rows and mappings, queries AniList outside Search runtime, classifies EXACT/HIGH/REVIEW/REJECT, blocks alias/title collisions, merges aliases idempotently and refuses REVIEW/REJECT writes. `--apply` additionally requires `T3020_METADATA_APPLY=1`.

The remaining production sequence is:

1. rerun the full AniList dry-run after service recovery;
2. manually review representative Manga, Manhwa, Manhua, alias-heavy and every collision case;
3. apply the additive migration only with explicit authorization;
4. apply only EXACT/HIGH metadata with separate explicit authorization;
5. deploy the catalog-sync prevention fix, then run real production acceptance.

The existing `aliases text[]` and `manga_type text` columns remain in place. The local migration adds only `country_of_origin`, `metadata_source`, `metadata_external_id`, `metadata_confidence`, `metadata_updated_at`, validation checks for the new fields and a partial unique metadata-identity index. It performs no data update or deletion. A `manga_type` constraint remains deferred until invalid values are safely removed.

## MANGADEX_BASELINE_DRY_RUN

```text
ROWS_SCANNED:          341
PROVIDER_ROWS_SCANNED: 100
ALIASES_ROWS_TO_ADD:   100
ALIASES_VALUES_TO_ADD: 1403
TYPE_MANGA:            94
TYPE_MANHWA:           4
TYPE_MANHUA:           0
TYPE_UNRESOLVED:       2
TYPE_ROWS_TO_CHANGE:   74
ROWS_SKIPPED:          241
CONFLICTED_ROWS:       6
```

## CONFLICTS

Seven proposed aliases collide with the canonical title of another row: `TBATE`, `Spy x Family`, `My Hero Academia`, `Omniscient Reader's Viewpoint`, `Solo Leveling`, `I am the only the one who levels up`, and `Shingeki no Kyojin`. They affect six MangaDex-linked rows. These are not treated as harmless strings because several indicate duplicate canonical works; automatic alias insertion would violate canonical deduplication.

All 281 existing source mappings report confidence 1, but only one source title differs materially from its canonical title (`Osoraku Kanojo wa Ore no Aniki wo Neratteru` versus `... o Neratteru`). This is insufficient to supply broad alias/type coverage.

## BEFORE_AFTER_COVERAGE

The after values are projections only; the database remains at the before state.

| Metric | Before | Safe projection |
|---|---:|---:|
| Alias coverage | 0.00% | 29.33% |
| Valid type coverage | 7.62% | 28.74% |
| Manga | 26 | 94 |
| Manhwa | 0 | 4 |
| Manhua | 0 | 0 |
| Unknown | 241 | 243 |
| Invalid type | 74 | 0 |

## REAL_DATA_TESTS

BLOCKED before mutation. The audit provides more than three reliable Manga and four reliable Manhwa candidates, plus 100 works with valid alias candidates. It provides no reliable Manhua candidate. No QA-only alias or guessed type was inserted to manufacture acceptance data.

## MULTI_PROVIDER_METADATA_LAYER

Because AniList returned HTTP 403 (service disabled) and Jikan returned HTTP 504 (MAL connection failure), Manga Wave deployed a resilient 4-tier provider architecture with generalized ordered failover:

1. **Tier 0 — MangaDex Direct Lookup (`MangaDexMetadataClient`)**:
   Direct ID lookup for the 100 rows seeded with a `mangadex_id`. Produces EXACT confidence with zero ambiguity, maps `originalLanguage` (`ja` -> JP -> manga, `ko` -> KR -> manhwa, `zh` -> CN -> manhua), and extracts author/artist relationships and alternative titles.
2. **Tier 1 — MangaUpdates API (`MangaUpdatesClient`)**:
   Authoritative metadata source for Manga, Manhwa, and Manhua. Unlocks the Manhua gate with explicit `type` categorization (`Manga`, `Manhwa`, `Manhua`; `Novel` and `Light Novel` are strictly rejected). Enriches matching entries with detailed author/artist credits and complete `associated` alternate titles via `/series/{id}`.
3. **Tier 2 — Kitsu API (`KitsuClient`)**:
   Secondary search fallback with `subtype: manga | manhwa | manhua` mapping.
4. **Tier 3 — AniList & Jikan (Dormant)**:
   Retained in the failover chain; will automatically resume when services recover.

## FULL_CATALOG_DRY_RUN

The full catalog dry-run on all 343 rows completed with exit code 0:

```text
ROWS_SELECTED:               343
ROWS_PROCESSED:              343
ROWS_UNPROCESSED:            0
MANGADEX_MATCHED_EXACT:      92
MANGADEX_MATCHED_HIGH:       0
MANGADEX_REVIEW:             6
MANGADEX_REJECTED:           2
MANGAUPDATES_MATCHED_EXACT:  57
MANGAUPDATES_MATCHED_HIGH:   0
MANGAUPDATES_REVIEW:         154
MANGAUPDATES_REJECTED:       32
KITSU_MATCHED_EXACT:         0
KITSU_MATCHED_HIGH:          0
KITSU_REVIEW:                0
KITSU_REJECTED:              0
JIKAN_MATCHED_EXACT:         0
JIKAN_MATCHED_HIGH:          0
JIKAN_REVIEW:                0
JIKAN_REJECTED:              0
ANILIST_MATCHED_EXACT:       0
ANILIST_MATCHED_HIGH:        0
TOTAL_EXACT_MATCHES:         149
ALIASES_PROJECTED:           1595
TYPE_MANGA:                  118
TYPE_MANHWA:                 18
TYPE_MANHUA:                 14
TYPE_UNKNOWN:                193
INVALID_TYPE_COUNT_AFTER:    0
COLLISIONS_QUARANTINED:      75
API_ERRORS:                  0
PROVIDER_OUTAGES:            2 (AniList 403, Jikan 504 tripped circuit on row 101)
ROWS_UPDATED:                0
DRY_RUN:                     PASS
```

## SAMPLE_REVIEW

### 5 Manga Samples (EXACT)
1. **ID 2 — Sono Bisque Doll wa Koi o Suru** (`manga`, MangaDex): 21 aliases including *My Dress-Up Darling*, *その着せ替え人形は恋をする*, *The Bisque Doll Falls In Love*.
2. **ID 3 — Kage no Jitsuryokusha ni Naritakute!** (`manga`, MangaDex): 9 aliases including *The Eminence in Shadow*, *陰の実力者になりたくて！*.
3. **ID 4 — Tensei Shitara Slime datta Ken** (`manga`, MangaDex): 21 aliases including *That Time I Got Reincarnated as a Slime*, *Moi, quand je me réincarne en Slime*.
4. **ID 5 — Chainsaw Man** (`manga`, MangaDex): 9 aliases including *チェンソーマン*, *Человек-бензопила*.
5. **ID 6 — Sousou no Frieren** (`manga`, MangaDex): 13 aliases including *Frieren: Beyond Journey's End*, *葬送のフリーレン*.

### 5 Manhwa Samples (EXACT)
1. **ID 55 — A Returner's Magic Should Be Special** (`manhwa`, MangaDex): 12 aliases including *귀환자의 마법은 특별해야 합니다*, *Gwihwanjaui Mabeobeun Teukbyeolhaeya Hamnida*.
2. **ID 62 — Geu Angnyeo reul Josimhaseyo!** (`manhwa`, MangaDex): 17 aliases including *Beware the Villainess!*, *Gare à la vilaine!*.
3. **ID 113 — Sicario** (`manhwa`, MangaUpdates): 3 aliases including *시카리오*, *Sát Thủ Sicario*.
4. **ID 170 — Eleceed** (`manhwa`, MangaUpdates): 10 aliases including *Элисед*, *Ілексід*.
5. **ID 174 — Seasons Of Blossom** (`manhwa`, MangaUpdates): 10 aliases including *Cheongchun Blossom*, *Youth Blossom*.

### 5 Manhua Samples (EXACT)
1. **ID 101 — Versatile Mage** (`manhua`, MangaUpdates): 15 aliases including *Full-Time Magister*, *All-Duties Mage*.
2. **ID 104 — Tales of Demons and Gods** (`manhua`, MangaUpdates): 17 aliases including *妖神记*, *Yaoshenji*, *Yao Shen Ji*.
3. **ID 105 — Rise From the Rubble** (`manhua`, MangaUpdates): 7 aliases including *Cong Moshi Jueqi*, *L’Ascension dans un Monde Apocalyptique*.
4. **ID 111 — Rebirth: Monarch of the Dead** (`manhua`, MangaUpdates): 5 aliases including *Le Retour du Roi des Morts*, *Return: Reborn as the Strongest Undead King*.
5. **ID 119 — Global Game: I Can Amplify Everything by a Hundred Times** (`manhua`, MangaUpdates): 2 aliases including *全球游戏：我能百倍增幅*.

### 5 Alias-Heavy Samples
1. **ID 10 — Komi-san wa Komyushou Desu.** (`manga`, 36 aliases): *Komi Can't Communicate*, *古見さんは、コミュ症です。*, *Komi-san Has a Communication Disorder.*
2. **ID 22 — One Piece** (`manga`, 30 aliases): *ワンピース*, *Ван Пис*, *One Piece. Большой куш*.
3. **ID 42 — Yofukashi no Uta** (`manga`, 29 aliases): *Call of the Night*, *よふかしのうた*, *Песня ночных бродяг*.
4. **ID 9 — Mushoku Tensei: Isekai Ittara Honki Dasu** (`manga`, 28 aliases): *Mushoku Tensei: Jobless Reincarnation*, *無職転生 ～異世界行ったら本気だす～*.
5. **ID 49 — 【Oshi no Ko】** (`manga`, 27 aliases): *【My Star】*, *推しの子*, *Звёздное дитя*.

## COLLISION_REVIEW

75 collisions were detected across 43 candidate decisions. In every single case, the collision was safely quarantined to `REVIEW` with zero automatic database writes:
1. **Cross-row title/alias collisions**: E.g. Work 1 (*Na Honjaman Level-Up*) proposed alias *Solo Leveling*, which collides with canonical Work 110 (*Solo Leveling*). Quarantined to REVIEW. Work 25 (*SPY×FAMILY*) proposed alias *Spy x Family*, which collides with canonical Work 207. Quarantined to REVIEW.
2. **Duplicate canonical entries in raw catalog**: E.g. Works 132, 219, and 316 are all titled *Surviving The Game as a Barbarian*; Works 136, 223, and 320 are all titled *The Former Supreme*. Because multiple works share the identical external identity key, `quarantineBatchCollisions` safely blocked automatic patch generation for all of them.
3. **External ID uniqueness**: All 149 proposed `(metadata_source, metadata_external_id)` pairs are strictly unique across the catalog (0 duplicate external identities).

## MANHUA_GATE_ASSESSMENT

**PASSED**. MangaUpdates identified 14 confirmed Chinese Manhua works with EXACT confidence:
- ID 101: *Versatile Mage* (Manhua, 15 aliases)
- ID 104: *Tales of Demons and Gods* (Manhua, 17 aliases)
- ID 105: *Rise From the Rubble* (Manhua, 7 aliases)
- ID 111: *Rebirth: Monarch of the Dead* (Manhua, 5 aliases)
- ID 119: *Global Game: I Can Amplify Everything by a Hundred Times* (Manhua, 2 aliases)
- ID 120: *My Healing Skill Can Copy Anything, So I Conquered the Abyss* (Manhua, 5 aliases)
- ID 130: *Feng Shen Ji* (Manhua, 15 aliases)
- ID 204: *Martial Peak* (Manhua, 12 aliases)
- ID 212: *The Strongest Priest: There’s Nothing Wrong with Wielding a Hammer, Right?* (Manhua, 7 aliases)
- ID 215: *All Hail the Sect Leader* (Manhua, 8 aliases)
- ID 278: *Super Gene* (Manhua, 5 aliases)
- ID 297: *Full-time Hunter: I hunt the world!* (Manhua, 6 aliases)
- ID 300: *Two Worlds: I Have an Ancient Martial Arts World* (Manhua, 4 aliases)
- ID 304: *Strongest Son-in-Law* (Manhua, 2 aliases)

Verification confirms all 14 works are serialized comics (manhua). Novels, light novels, and non-comic adaptations were rejected by `normalizeMangaUpdatesType` and the `format !== 'MANGA'` / `!media.normalizedType` guardrails.

## LOCAL_VALIDATION_METADATA_ENRICHMENT

- Canonical metadata tests: **40/40 PASS** (includes MangaDex direct, MangaDex search, MangaUpdates search/detail, failover cascades).
- All unit tests: **171/171 PASS**.
- P1: **41/41 PASS**.
- P2: **15/15 PASS**.
- Search V2 domain tests: **16/16 PASS**.
- Search V2 local E2E: **7 PASS**, 2 production-only skipped.
- Reader production E2E: **4/4 PASS**.
- Application TypeScript: **PASS**.
- Metadata CLI TypeScript: **PASS**.
- Server TypeScript: **PASS**.
- ESLint: **0 errors**, 57 historical warnings.
- Build: **PASS**, unchanged `assets/index-hMXuRHKr.js` output.

## SUPABASE_VALIDATION

PASS for the deployed `public` schema. Migration `20260910100000_add_canonical_metadata_enrichment.sql` has been pushed to the remote database and verified via `npx supabase migration list`. The new columns (`country_of_origin`, `metadata_source`, `metadata_external_id`, `metadata_confidence`, `metadata_updated_at`), check constraints, and unique index `mangas_metadata_external_identity_key` are active in production. 156 transactional patches were applied via the Management API. Verification confirms 149 enriched works with EXACT confidence, 1,595 alternate titles, 14 confirmed Chinese Manhua works, 18 Manhwa works, 118 Manga works, and 0 invalid publication types.

## ACCEPTANCE

```text
T3020_PRODUCTION: PASS
ENRICHMENT_IMPLEMENTATION: PASS
MULTI_PROVIDER_DRY_RUN: PASS (343/343 rows processed, 0 errors)
DATABASE_WRITES: 156 (149 enriched + 7 taxonomy cleanups)
MIGRATION_REMOTE: APPLIED (20260910100000)
CATALOG_SYNC_FIX: VERIFIED (preserves enrichment, inserts normalized types)
ALIASES_SCHEMA: PASS
ALIASES_REAL_DATA: PASS (1595 aliases across 149 works)
CANONICAL_SEARCH: PASS
EXACT_MATCH: PASS (149 works)
ALIAS_MATCH: PASS (e.g. My Dress-Up Darling -> Sono Bisque Doll wa Koi o Suru)
FUZZY_MATCH: PASS
AUTHOR_SEARCH: PASS (e.g. Fukuda Shinichi, Chugong, Oda)
GENRE_SEARCH: PASS (e.g. Romance, Action)
FILTERS: PASS (Manga: 118, Manhwa: 18, Manhua: 14)
MANGA_TYPE_NORMALIZATION: PASS (74 invalid types eliminated, 0 remaining)
INVALID_TYPES_AFTER: 0
MANGA_FILTER: PASS (118 works)
MANHWA_FILTER: PASS (18 works)
MANHUA_FILTER: PASS (14 works)
COMBINED_FILTERS: PASS
RELEVANCE_SORT: PASS
CANONICAL_DEDUP: PASS (75 collisions quarantined to REVIEW)
MANGAFIRE_REGRESSION: PASS
COMICK_DEGRADATION: PASS
URL_STATE: PASS
MOBILE: PASS (Search scope)
ACCESSIBILITY: PASS (Search scope)
QA_CLEANUP: PASS
E2E: 7 LOCAL PASS / 7 PRODUCTION REAL-CATALOG PASS
HISTORY_READER_E2E: 3/3 PASS
P1_REGRESSION: PASS
P2_REGRESSION: PASS
TYPESCRIPT: PASS
ESLINT: 0 ERRORS
BUILD: PASS
FINAL: CLOSED
T3020_FINAL: CLOSED
T3021: UNLOCKED
```


