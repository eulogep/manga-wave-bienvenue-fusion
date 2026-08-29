# MANGA WAVE V3 — T-3012 Remove Source-First UX

## OVERALL_STATUS

`IMPLEMENTATION: PASS`  
`PRODUCTION_DEPLOYMENT: PASS`  
`AUTOMATED_REGRESSION: PASS`  
`INTERACTIVE_VISUAL_QA: BLOCKED — aucun navigateur intégré n'est attaché à cette session`

T-3012 est implémenté et déployé sans réécriture du Reader, des routes provider ou du moteur P1. Le bundle de production est passé de `assets/index-DM_a-mq5.js` à `assets/index-DjaZMxPo.js`.

## SOURCE_UX_AUDIT

| SOURCE_FIRST_SURFACE | CURRENT_BEHAVIOR BEFORE T-3012 | TARGET / RESULT | CLASSIFICATION |
|---|---|---|---|
| Homepage — hub providers | Bloc complet organisé par source | Bloc retiré de la composition Homepage ; composants et intégrations conservés | A — REMOVE |
| Homepage — Hero | `OriginManga` affiché au niveau éditorial | `Sélection Manga Wave` et langue de lecture ; source gardée uniquement dans l'URL interne | A — REMOVE |
| Homepage — catalogue | `Catalogue MangaDex` comme surtitre | `Catalogue Manga Wave` ; attribution légale conservée en pied de section | B — DEMOTE |
| Navigation | `Scans FR` / `Scans français` | `Découvrir`, vers la recherche canonique | A — REMOVE |
| Search — en-tête | Moteur et six sources mis en avant | Recherche Manga Wave centrée sur l'œuvre et l'accès automatique | A — REMOVE |
| Search — sélecteur | Chips providers avant la recherche | Sélecteur replié dans `Options avancées` | D — KEEP_ONLY_IN_ADVANCED_CONTEXT |
| Search — résultats par défaut | Agrégation présentée comme architecture multi-source | Une carte par manga canonique ; compteur de sources discret | B — DEMOTE |
| MangaCard | Message de favoris mentionnant la synchronisation source | Message produit sans terminologie provider | A — REMOVE |
| Manga Detail — badge | Provider affiché à côté du statut | Badge provider retiré de l'overview | A — REMOVE |
| Manga Detail — override | Sélecteur secondaire déjà disponible, score 0–100 visible | Action `Changer de source` conservée ; alternatives `Recommandée` / `Disponible` | D — KEEP_ONLY_IN_ADVANCED_CONTEXT |
| Chapter list | Copie et état vide nommant le provider | Chapitres et indisponibilité formulés côté Manga Wave | A — REMOVE |
| Continue Reading | Provider affiché sous le titre | Langue, chapitre, page et progression ; provider seulement dans la route de reprise | A — REMOVE |
| Library history | Badge provider superposé à la cover | Badge retiré et clé React canonique | A — REMOVE |
| Reader Settings | Source actuelle et changement manuel | Inchangé, car contexte opérationnel avancé | C — KEEP |
| Reader fallback | Notification nommant source initiale et fallback | Inchangé, car l'information explique un événement utile | C — KEEP |
| URLs Reader | `/read/:source/:mangaId/:chapterId` | Inchangé pour protéger P1 | C — KEEP |

## HOMEPAGE

- Composition T-3011 protégée : Hero, tendances, sorties récentes, populaires, formats, découverte quotidienne et genres restent présents.
- `MultiSourceHubSection` n'est plus monté dans la Homepage anonyme.
- Le Hero garde ses données et routes existantes mais ne présente plus OriginManga comme identité produit.
- Les libellés de navigation sont orientés découverte, pas providers.

## SEARCH

- La recherche par défaut utilise `selectedSource = all` et consolide les candidats avec `canonicalizeMangaCandidates`.
- Une même œuvre normalisée produit une seule carte canonique.
- Le lien principal utilise `getPrimarySource(manga, 'fr')`.
- Le choix manuel d'une source reste accessible dans un `<details>` avancé.
- Les groupes et diagnostics provider ne sont rendus que lorsqu'une source a été explicitement sélectionnée.
- L'état local est resynchronisé avec les paramètres d'URL afin qu'un retour vers `/search` rétablisse bien le mode automatique.

## MANGA_CARDS

- Les cartes par défaut restent centrées sur cover, titre, auteur, statut, note et genres.
- Aucun badge provider n'a été ajouté aux variantes T-3011.
- Le résultat canonique peut afficher un compteur discret `N sources disponibles`, sans énumérer les providers.
- Le message de favori indisponible ne parle plus de synchronisation de source.

## MANGA_DETAIL

- L'identité primaire est le manga : cover, titre, auteur, statut, genres et synopsis.
- `Commencer la lecture` reste l'action principale et ne demande aucune sélection préalable.
- `Changer de source` reste une action secondaire.
- Le panneau avancé conserve source active, alternatives et langue, mais traduit le score technique en `Recommandée` ou `Disponible`.
- Le contrôle expose `aria-expanded` et `aria-controls="manga-source-options"`.

## CHAPTER_LIST

- La page affiche une seule liste logique pour la source résolue ou explicitement choisie ; elle ne juxtapose pas de groupes provider dupliqués.
- Les libellés de section et états vides ne nomment plus l'infrastructure.
- Une entrée issue de la recherche canonique arrive sur la source lisible préférée ; les correspondances strictes et le fallback P1 prennent ensuite en charge l'indisponibilité.

## CONTINUE_READING

- `useContinueReading` continue de fusionner la progression avec `mergeCanonicalProgress`.
- La carte affiche désormais `Lecture FR/EN`, chapitre, page et progression plutôt que le provider.
- La Library utilise `canonicalKey` comme clé de ligne et pour la suppression.
- `last_provider`, `mangaId` et `chapterId` restent conservés pour reprendre exactement la lecture.

## READER

- Aucun code Reader, contrôle de page, auto-hide, CSS Reader ou route Reader n'a été modifié.
- Le sélecteur manuel de source dans le Reader reste fonctionnel, couvert par la suite P1.
- Next/Previous, Settings, reprise et progression canonique restent protégés.

## FALLBACK

- La sélection automatique, la préférence de langue, la limite de tentatives, l'anti-loop et les notifications de changement de source restent inchangés.
- Les notifications provider restent visibles uniquement lorsqu'elles expliquent un fallback réel.

## LANGUAGE

- `getPrimarySource` accepte une langue préférée et classe d'abord les sources lisibles compatibles, puis `multi`, `und`, puis les autres langues, avec ordre stable à égalité.
- La recherche canonique appelle le resolver avec `fr`.
- Continue Reading affiche la langue comme métadonnée utile à la place du provider.

## MOBILE

- Les chips providers horizontales ont été supprimées de Search.
- Le formulaire reste `grid-cols-1` avant le breakpoint `md` et le sélecteur avancé reste dans le flux.
- Les badges providers superposés aux covers d'historique ont été supprimés.
- Le build et les tests de structure passent, mais le contrôle visuel 430/390 px est `BLOCKED` : la liste des navigateurs intégrés disponible dans cette session est vide.

## ACCESSIBILITY

- `Changer de source` conserve un nom visible, le focus du composant Button et ajoute `aria-expanded` / `aria-controls`.
- Le panneau contrôlé possède un identifiant stable et conserve `aria-live="polite"`.
- Le retrait des badges providers ne retire aucun nom accessible des liens de manga, des covers ou des actions.

## T3012_TESTS

Commande : `npm.cmd run test:t3012`

Résultat : `5/5 PASS`

Couverture ajoutée : déduplication canonique, sélection automatique compatible FR, progression canonique après changement de provider, absence d'UX source-first sur les surfaces de découverte, lecture immédiate et override secondaire sur Manga Detail.

## P1_REGRESSION

Commande : `npm.cmd run test:p1`

Résultat : `41/41 PASS`

Cela couvre notamment source ranking, strict chapter matching, fallback, anti-loop, Comick dégradé, MangaFire relevance, contrôles Reader, Settings, switch manuel et progression canonique.

## T3011_REGRESSION

Commande incluse dans `npm.cmd run test:p2`.

Résultat T-3011 : `4/4 PASS`  
Résultat P2 agrégé après ajout de T-3012 : `9/9 PASS`

## TYPESCRIPT

Commande : `npx.cmd tsc --noEmit`

Résultat : `PASS`

## LINT

Commande finale : `npm.cmd run lint -- --quiet`

Résultat : `0 ERROR — PASS`. Les avertissements Fast Refresh historiques ne sont pas bloquants et ne sont pas introduits par T-3012.

## BUILD

Commande : `npm.cmd run build`

Résultat : `PASS`

- JS local : `dist/assets/index-H8wSggyh.js`, 685.79 kB, gzip 201.15 kB.
- CSS local : `dist/assets/index-Cz2iJ6BL.css`, 88.27 kB, gzip 16.26 kB.
- Avertissement bundle >500 kB : dette technique déjà non bloquante, hors périmètre T-3012.

## DEPLOYMENT

- URL : https://manga-wave-bienvenue-fusion.vercel.app/
- Branche : `main`
- Bundle avant : `assets/index-DM_a-mq5.js`
- Bundle après : `assets/index-DjaZMxPo.js`
- Smoke bundle production : `Résultats Manga Wave = true`, `Options avancées · Choisir une source = true`, ancien heading multi-source = false, ancien hub multi-source = false.
- QA interactive : `BLOCKED`, car aucun navigateur intégré n'est attaché à la session ; aucune validation visuelle n'est revendiquée.

## COMMITS

- `f74e2b8 feat: remove source-first discovery UX` — implémentation et tests T-3012.
- Le présent rapport est livré dans le commit de documentation suivant.

## ACCEPTANCE

- `SOURCE_FIRST_HOMEPAGE: REMOVED`
- `SOURCE_FIRST_SEARCH: REMOVED`
- `SOURCE_FIRST_CARDS: REMOVED`
- `SOURCE_FIRST_CONTINUE_READING: REMOVED`
- `SOURCE_FIRST_MANGA_DETAIL: DEMOTED`
- `AUTO_SOURCE_RESOLUTION: PASS`
- `MANUAL_SOURCE_OVERRIDE: PASS`
- `READER_SOURCE_CONTROL: PASS`
- `FALLBACK_SOURCE_NOTICE: PASS`
- `CANONICAL_SEARCH: PASS`
- `P1_TESTS: 41/41 PASS`
- `T3011_TESTS: 4/4 PASS`
- `TYPESCRIPT: PASS`
- `LINT: 0 ERRORS`
- `BUILD: PASS`
- `VISUAL_QA_DESKTOP_MOBILE: BLOCKED — browser unavailable`
