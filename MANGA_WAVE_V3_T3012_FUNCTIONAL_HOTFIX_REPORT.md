# MANGA WAVE V3 — T-3012 Functional Hotfix

## OVERALL_STATUS

`IMPLEMENTATION: PASS`  
`AUTOMATED_REGRESSION: PASS`  
`PRODUCTION_DEPLOYMENT: PASS`  
`PRODUCTION_SOURCELESS_ROUTE_SMOKE: PASS`  
`REAL_AUTHENTICATED_BROWSER_SMOKE: BLOCKED — aucun navigateur ni session utilisateur attachés`

Le hotfix corrige les deux causes de code confirmées. La route canonique et la chaîne provider ont été vérifiées en production. L'upsert d'un utilisateur réel et le clic Resume ne sont pas revendiqués comme validés sans session authentifiée.

## ROOT_CAUSE_SOURCELESS_DETAIL

`MangaDetail` interprétait l'absence de query param avec :

```ts
searchParams.get('source') || 'mangadex'
```

Les cartes du catalogue local ouvraient simultanément `/manga/:mangadex_id` sans query param. Une fiche sans source lançait donc directement MangaDex et rendait son erreur comme erreur produit, même lorsque le catalogue canonique possédait un mapping sain.

Correction :

- les cartes Homepage, Featured et Library ouvrent maintenant `/manga/:canonical_id` ;
- l'absence de `?source=` active `useCanonicalMangaEntry` ;
- les métadonnées de `canonical_manga_catalog` rendent la fiche de base ;
- `rank_canonical_manga_sources` ordonne les mappings selon P1 ;
- `resolveCanonicalDetail` tente au maximum quatre sources éligibles et passe à la suivante en cas d'échec ;
- un échec de toutes les sources n'efface plus la fiche canonique : il produit un état chapitre secondaire et récupérable.

## ROOT_CAUSE_CONTINUE_READING

Deux conditions rendaient la persistance intermittente :

1. `UniversalReader` n'enregistrait rien tant que `useUniversalMangaDetail` n'avait pas fourni `mangaTitle`. Les pages pouvaient fonctionner alors que les métadonnées provider étaient encore absentes ou en échec.
2. L'écriture locale attendait 500 ms. Un retour rapide à la Homepage pouvait précéder la persistance observable.

Correction :

- Manga Detail transmet `title` et `author` dans l'URL Reader ;
- Reader utilise ces valeurs comme fallback immédiat et les préserve lors d'un fallback ou changement manuel de source ;
- `saveLocalHistoryItem` est appelé immédiatement à chaque état de lecture enregistré ;
- l'upsert Supabase reste regroupé à 750 ms et est forcé sur `pagehide`, `visibilitychange` et unmount ;
- l'erreur d'upsert est journalisée explicitement ;
- les queries Continue Reading, canonical progress et Homepage personnalisée sont invalidées après succès distant.

## AUTO_RESOLVER

Chaîne effective :

```text
/manga/:canonical_id sans source
→ canonical_manga_catalog
→ rank_canonical_manga_sources(preferred_language = fr)
→ sources éligibles triées par score
→ détail + chapitres du premier mapping fonctionnel
→ failover borné vers le mapping suivant
```

Le resolver conserve l'ordre P1 fourni par Supabase, limite les essais à quatre et ne boucle pas.

## MANGADEX_DEFAULT_AUDIT

- `MangaDetail` : défaut MangaDex supprimé.
- Homepage / Featured / Library : liens remplacés par les identifiants canoniques.
- Search externe : les liens explicitement provider conservent `?source=`, ce qui est intentionnel et rétrocompatible.
- Reader : la route exige toujours `:source`; son fallback défensif de paramètre n'est pas une entrée Manga Detail et reste hors du défaut corrigé.

`HasOldMangaDexDefault` dans le bundle production : `false`.

## PROGRESS_WRITE

Le snapshot de progression normalise :

- `canonicalKey` ;
- `pageIndex` ;
- `totalPages` ;
- pourcentage ;
- date de lecture.

Page 2 sur 26 est persistée avec `page_index = 1` et `progress_percentage = 8`. Elle est immédiatement éligible à Continue Reading ; aucun seuil minimal ne la masque.

## SUPABASE_STATE

Schéma vérifié : `user_canonical_reading_progress` contient notamment `canonical_manga_id`, identité logique du chapitre, dernier provider, page, total, pourcentage, `read_at` et `updated_at` avec clé primaire `(user_id, canonical_key)`.

Avant l'upsert :

1. recherche exacte dans `manga_source_mappings` avec `(source_id, source_manga_id)` ;
2. si absente, fallback `find_canonical_manga(mangaTitle)` limité à `exact_title` ou `exact_alias` ;
3. aucun fuzzy match n'est utilisé pour la progression.

État public réel vérifié le 30 août 2026 :

- Canonical ID : `110`
- Titre : `Solo Leveling`
- Mapping : `originmanga / 656de8df-4b6c-483a-b1e0-4fe0aee8eafb`
- Disponible : `true`
- Ranking FR : `originmanga`, score `55.5`

L'existence d'une ligne utilisateur après clic ne peut pas être inspectée sans session authentifiée et reste `BLOCKED`.

## QUERY_INVALIDATION

Après upsert distant réussi :

- `['continue-reading-universal']`
- `['canonical-progress']`
- `['homepage-personalized']`

sont invalidées explicitement. L'écriture locale déclenche aussi l'événement `manga_wave_history_updated` et invalide Continue Reading immédiatement.

## AUTH_HYDRATION

`Index` conserve le contrat :

```text
loading → écran d'attente
session résolue + user → ContinueReadingSection + Homepage personnalisée
session résolue sans user → Homepage anonyme
```

La branche anonyme ne peut pas devenir l'état final tant que `loading` est vrai. Le test de câblage protège la présence de `ContinueReadingSection` dans la branche authentifiée.

## CANONICAL_JOIN

- L'upsert écrit `canonical_manga_id` lorsque le mapping ou le titre exact est connu.
- La clé fonctionnelle reste `title:<normalized_title>` afin que le local et le distant fusionnent même pendant une indisponibilité temporaire du mapping.
- `mergeCanonicalProgress` conserve uniquement la ligne la plus récente d'une œuvre après changement de provider.

## RESUME

Continue Reading construit la route avec `buildReaderLocation` : source et IDs de la dernière lecture, langue, page sauvegardée, titre et auteur. Pour le cas QA, le résultat contient :

```text
/read/asurascans/solo-leveling/chapter-5?...&page=1&title=Solo+Leveling
```

Le Reader réhydrate `page=1`, soit l'affichage utilisateur Page 2.

## REAL_BROWSER_SMOKE

`BLOCKED`.

Le runtime navigateur a retourné une liste vide. Impossible dans cette session de :

- se connecter avec un compte réel ;
- cliquer physiquement Next ;
- lire la ligne RLS de cet utilisateur ;
- vérifier la carte Homepage et Resume ;
- tester 390×844 ou 430×932.

Smoke production non interactif exécuté :

- `/manga/110` sert correctement la SPA ;
- le bundle contient le resolver canonique ;
- le défaut MangaDex n'est plus présent ;
- l'API OriginManga résout `Solo Leveling`, 201 chapitres, premier chapitre retourné `200.5`.

## TESTS

Commande : `npm.cmd run test:t3012:hotfix`

Résultat : `5/5 PASS`

Cas couverts :

1. source-less detail et failover première source en échec ;
2. absence de défaut MangaDex et liens canoniques Homepage ;
3. snapshot réel Page 2 / 26 ;
4. une seule entrée canonique et route Resume à la bonne page ;
5. write immédiat, join canonique, invalidation et hydratation auth.

Validateur Supabase : `npm.cmd run verify:t3012:hotfix:db` — `PASS`.

## P1_REGRESSION

`npm.cmd run test:p1` → `41/41 PASS`.

## T3011_REGRESSION

Tests `homePersonalization.test.ts` inclus dans `npm.cmd run test:p2` → `4/4 PASS`.

## T3012_REGRESSION

`npm.cmd run test:t3012` → `5/5 PASS`.  
`npm.cmd run test:p2` → `9/9 PASS`.

## TYPESCRIPT

`npx.cmd tsc --noEmit` → `PASS`.

## LINT

`npm.cmd run lint -- --quiet` → `0 ERROR — PASS`.

## BUILD

`npm.cmd run build` → `PASS`.

- JS : `dist/assets/index-BO71GtB8.js`, 690.29 kB, gzip 202.67 kB.
- CSS : `dist/assets/index-g4_kKATi.css`, 88.49 kB, gzip 16.30 kB.
- L'avertissement historique >500 kB reste non bloquant et hors périmètre.

## DEPLOYMENT

- Production : https://manga-wave-bienvenue-fusion.vercel.app/
- Route canonique testée : https://manga-wave-bienvenue-fusion.vercel.app/manga/110
- Bundle avant : `assets/index-DjaZMxPo.js`
- Bundle après : `assets/index-BO71GtB8.js`
- Route servie : `PASS`
- Resolver présent : `PASS`
- Write canonique présent : `PASS`
- Ancien défaut MangaDex absent : `PASS`

## COMMITS

- `8c11e80 fix: resolve canonical detail and persist reading progress`
- Le présent rapport et l'amélioration du validateur DB sont livrés dans le commit de documentation suivant.

## ACCEPTANCE_GATE

- `SOURCELESS_CANONICAL_DETAIL: PASS — production route + API smoke`
- `AUTO_SOURCE_RESOLUTION: PASS`
- `NO_MANGADEX_HARD_DEFAULT: PASS`
- `SOURCE_FAILOVER_DETAIL: PASS — automated contract`
- `REAL_PROGRESS_PERSISTENCE: BLOCKED — authenticated browser required`
- `CONTINUE_READING_VISIBLE: BLOCKED — authenticated browser required`
- `CANONICAL_SINGLE_ENTRY: PASS — automated contract`
- `RESUME: PASS — route/page contract; real click BLOCKED`
- `P1_REGRESSION: 41/41 PASS`
- `T3011_REGRESSION: 4/4 PASS`
- `T3012_REGRESSION: PASS`
- `TYPESCRIPT: PASS`
- `LINT: 0 ERRORS`
- `BUILD: PASS`
- `MOBILE_390x844: INCONCLUSIVE`
- `MOBILE_430x932: INCONCLUSIVE`
