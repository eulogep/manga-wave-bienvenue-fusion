# MANGA WAVE V3 — P1 Reader Micro-Hotfix Report

Date: 2026-08-29  
Scope: Reader uniquement — aucun travail P2, refonte visuelle ou migration de données  
Production: https://manga-wave-bienvenue-fusion.vercel.app/  
Implementation commit: `8d3b8ff` (`fix(reader): restore paging and settings interactions`)

## OVERALL_STATUS

`IMPLEMENTED_AND_DEPLOYED_AUTOMATED_VALIDATION_PASS_INTERACTIVE_QA_BLOCKED`

Le correctif est poussé sur `main`. Le smoke test interactif reste `BLOCKED` dans cette session, car le service de contrôle du navigateur intégré ne peut pas établir de connexion. Les statuts ci-dessous distinguent donc les contrats automatisés validés des clics de production qui doivent encore être rejoués avant l’approbation finale P1.

## PAGE_NAVIGATION_ROOT_CAUSE

`FIXED`

`UniversalReader` avait deux écrivains concurrents pour la page courante :

- `currentPage`, état local utilisé pour l’image, l’indicateur et la progression ;
- `initialPage`, recalculé depuis `?page=` puis réinjecté par un effet dépendant de chaque changement de cette valeur.

Le clic mutait l’état local et synchronisait simultanément l’URL. La navigation React Router pouvait alors réexécuter la logique d’hydratation du même Reader et écraser l’interaction. L’hydratation est désormais autorisée uniquement quand l’identité réelle `${source}:${chapterId}` change. Une simple synchronisation de `?page=` ne réhydrate plus le chapitre actif.

`createReaderPageTransition` produit maintenant la page et la progression depuis la même transition bornée. Le Reader applique ensuite cette page à l’image rendue, à l’indicateur, à l’URL et à la persistance existante.

## SETTINGS_ROOT_CAUSE

`FIXED`

L’état d’ouverture existait, mais le panneau était rendu dans le conteneur Reader `overflow-hidden`. Sa visibilité dépendait donc de la hiérarchie de stacking et de clipping du Reader. Le panneau et son backdrop sont maintenant rendus dans une couche dédiée avec `createPortal`, attachée à `document.body` ou à l’élément plein écran actif.

Le panneau expose aussi `role="dialog"`, `aria-modal="true"`, `aria-expanded` sur le bouton et `data-reader-settings-state="open"` sur la couche montée. L’ouverture reste idempotente ; seul le bouton de fermeture, le backdrop ou une sélection de source la ferme.

## ASURA_NEXT_PREVIOUS

`AUTOMATED_PASS — INTERACTIVE_PRODUCTION_PENDING`

- page 1/26 + Next → index 1 ;
- index 1 + Next → index 2 ;
- index 2 + Previous → index 1 ;
- bornage à `0..totalPages-1` ;
- double-page conserve un pas de 2 uniquement lorsque ce mode est réellement actif.

Contrôle API production AsuraScans :

- manga : `Solo Leveling` (`solo-leveling-b57aa235`) ;
- chapitre : `5` (`/comics/solo-leveling-b57aa235/chapter/5`) ;
- pages utilisables : `26` ;
- URLs uniques : `26` ;
- trois premières pages distinctes : `3/3`.

## SETTINGS_OPEN

`AUTOMATED_PASS — INTERACTIVE_PRODUCTION_PENDING`

Les tests confirment `closed → open`, un second `open` idempotent, le maintien du montage et `open → close`. Le portal retire le panneau du contexte de clipping du Reader.

## SOURCE_SELECTOR

`IMPLEMENTED — INTERACTIVE_PRODUCTION_PENDING`

Le composant T-3010 existant n’a pas été redessiné. Le panneau monté contient toujours :

- source active et langue ;
- alternatives classées ;
- source recommandée et score détaillé ;
- disponibilité du chapitre exact ;
- six modes de lecture, fit, zoom, espacement, luminosité et direction.

## SOURCE_SWITCH

`AUTOMATED_PASS — INTERACTIVE_PRODUCTION_PENDING`

La navigation manuelle utilise désormais `buildReaderLocation`. Elle encode explicitement la source cible, le manga cible, l’identifiant du chapitre équivalent, sa langue réelle et la page courante. Le test cible `AsuraScans chapter 5 → OriginManga origin-chapter-5` et interdit toute destination `chapter-1`.

## PAGE_PRESERVATION

`PASS`

Le changement manuel transmet la page courante dans `?page=`. Le changement d’identité source/chapitre déclenche ensuite une hydratation unique avec cette valeur. Si le fournisseur cible contient moins de pages, le seul reset autorisé est un clamp vers sa dernière page, avec resynchronisation de l’URL.

## CANONICAL_PROGRESS_REGRESSION

`PASS`

La suite P1 conserve le test « canonical progress keeps one latest entry across providers ». Le schéma canonique, la déduplication Continue Reading et la migration Supabase n’ont pas été modifiés.

## P1_TESTS

`PASS — 41/41`

Commande : `npm.cmd run test:p1`

Nouveaux contrôles Reader :

1. AsuraScans Next 0→1 ;
2. second Next 1→2 ;
3. Previous 2→1 ;
4. synchronisation `?page=` ;
5. progression issue de la même transition ;
6. absence de réhydratation du même Reader ;
7. réhydratation lors d’un changement source/chapitre ;
8. source switch vers le chapitre 5 équivalent ;
9. préservation de la page au source switch ;
10. ouverture et maintien du panneau Settings ;
11. fermeture explicite du panneau.

## TYPESCRIPT

`PASS`

Commande : `npx.cmd tsc -b --pretty false`

## LINT

`PASS — 0 error`

Commande : `npm.cmd run lint`  
Résultat : 57 avertissements Fast Refresh préexistants, aucun nouvel échec.

## BUILD

`PASS`

- client : `npm.cmd run build` ;
- serveur : `npm.cmd --prefix server run build` ;
- bundle local attendu : `assets/index-BMm67CFX.js` ;
- avertissement historique bundle >500 kB conservé en dette technique et non bloquant P1.

## DEPLOYMENT

`PASS`

- branche : `main` ;
- remote : `origin/main` ;
- commit envoyé : `8d3b8ff` ;
- bundle de production confirmé : `assets/index-BMm67CFX.js` ;
- bundle identique au build local : oui ;
- endpoint AsuraScans chapitre 5 : `26/26` pages uniques.

## COMMIT

Implementation: `8d3b8ff fix(reader): restore paging and settings interactions`

## MANUAL_SMOKE

`BLOCKED`

Le navigateur intégré est indisponible dans cette session. Ne pas convertir ce blocage en PASS. À rejouer sur production :

1. ouvrir Solo Leveling, AsuraScans, chapitre 5, page 1 ;
2. Next → page 2, Next → page 3, Previous → page 2 ;
3. vérifier image, indicateur, `?page=` et progression à chaque clic ;
4. ouvrir Settings et vérifier que le panneau reste visible ;
5. vérifier le sélecteur et les six modes ;
6. changer AsuraScans → OriginManga ;
7. vérifier chapitre 5 et page préservée/clampée uniquement si nécessaire ;
8. revenir à l’accueil et vérifier une seule carte Continue Reading.

## ACCEPTANCE_GATE

- `ASURA_NEXT = AUTOMATED_PASS / INTERACTIVE_PENDING`
- `ASURA_PREVIOUS = AUTOMATED_PASS / INTERACTIVE_PENDING`
- `SETTINGS_OPEN = AUTOMATED_PASS / INTERACTIVE_PENDING`
- `SOURCE_SELECTOR = IMPLEMENTED / INTERACTIVE_PENDING`
- `READER_SOURCE_SWITCH = AUTOMATED_PASS / INTERACTIVE_PENDING`
- `CHAPTER_PRESERVED = AUTOMATED_PASS / INTERACTIVE_PENDING`
- `CANONICAL_PROGRESS_REGRESSION = PASS`
- `CRITICAL_CODE = 0`
- `HIGH_CODE = 0`
- `P1_FINAL_QA = PENDING_INTERACTIVE_SMOKE`
