# Catalogue Manga Wave — refonte éditoriale

Validation du 7 octobre 2026 : **LOCAL_VALIDATED**. Publication : **NOT_DEPLOYED**.

### Ajustement pleine largeur

Les plafonds de 1 440 px du contenu et de 1 220 px du panneau de recherche ont été retirés.
Le header et le footer du catalogue suivent également la largeur disponible. La page
occupe au minimum toute la hauteur du viewport ; les cartes s’adaptent aux grands écrans.
Vérification Chromium réelle à 390, 430, 768, 1 440, 1 920 et 2 560 px : main = largeur
du viewport, aucun débordement horizontal. Marges de confort : 16 px sur mobile, 32 px
à partir de 768 px. Capture : `/tmp/catalogue-full-width.png`.

## Résultat

La page `/search` reprend la composition de la référence approuvée : hero court à artwork
canonique, titre serif, panneau recherche/filtres unifié, rail de genres, série à l’honneur,
sélection du jour, filtres amovibles et grille éditoriale asymétrique. Le mode liste présente
les auteurs et alias avec davantage de place. Sur mobile : ambiances horizontales, panneaux
empilés et grille de deux colonnes. Sur tablette : trois colonnes, rail horizontal.

Le catalogue initial affiche maintenant les œuvres sans obliger à cliquer Explorer tout
le catalogue. Ce changement de présentation conserve le contrat URL existant ; saisie,
débounce de 250 ms, filtres, tri, pagination et navigation arrière/avant utilisent toujours
`parseSearchState`, `serializeSearchState` et `searchCanonicalWorks`.

## Réutilisation et exactitude

- `useCanonicalSearch` reste l’unique snapshot de recherche. Aucun endpoint fournisseur
  n’est contacté par la recherche.
- `useTrendingRanking` et `selectFeaturedWorks`, déjà utilisés par le hero d’accueil,
  fournissent les découvertes. Aucun pipeline de données ajouté.
- La sélection du jour fait tourner quotidiennement en UTC trois œuvres distinctes du
  même pool canonique ; elle n’est pas présentée comme une recommandation personnalisée.
- Fantastique correspond au genre réellement présent Fantasy ou Fantastique ; Mystère
  à Mystery/Mystère ; Tranches de vie à Slice of Life/Tranche de vie ; Horreur à Horror/Horreur.
  Les valeurs absentes ne sont pas proposées. Action et Romance conservent leur valeur exacte.
  Les catégories Chill et Sombre ne sont pas inventées.
- Ni synopsis fictif, ni faux compte de chapitres ou de votes. Les descriptions absentes
  sont omises. Les couvertures sont celles du catalogue, pas les personnages de la maquette.
- La vitrine publique exclut les œuvres marquées erotica ; les résultats gardent leur
  contrôle adulte et leur navigation `AdultGatedLink` existants.
- Tout lien manga pointe vers une identité canonique `/manga/<id>`. Le lecteur et le
  résolveur P1 ne sont pas modifiés dans ce lot catalogue.
- Priorité aux images du hero, de la série et aux deux premières cartes ; autres images
  lazy, proxy différé, dimensions réservées. Pas de moteur masonry ni d’autoplay.

## Fichiers du lot

- `src/pages/Search.tsx` : orchestration et contrôles conservés, nouvelle présentation.
- `src/components/CatalogueDiscovery.tsx` : hero, rail et découvertes.
- `src/components/EditorialMangaCard.tsx` : carte canonique avec contrôle adulte.
- `src/components/Catalogue.css` : layout, responsive, focus et reduced motion.
- `tests/e2e/catalogue-editorial.spec.ts` : nouvelles acceptations.

Les composants Hero/FeaturedMangaCarousel, Header, MangaCover et le banc Jev proviennent
du lot local précédent et restent présents. Aucun de leurs changements n’a été supprimé.

## Validation exécutée

| Contrôle | Résultat |
| --- | --- |
| 390 × 844 / 430 × 932 | PASS — deux colonnes, pas de débordement |
| 768 × 1024 | PASS — trois colonnes, rail horizontal |
| 1440 × 1100 | PASS — cinq colonnes, hauteurs alternées |
| Vue grille/liste, ordre conservé | PASS |
| Ambiance → genre réel → URL ; suppression chip | PASS |
| Tri et restauration après reload | PASS |
| Lien série canonique au clavier | PASS |
| État vide → Surprise-moi → `/random` | PASS |
| Axe sur le catalogue | PASS — zéro violation aux quatre tailles, fixture et catalogue réel |
| Focus, cibles ≥ 44 px en hauteur, reduced motion | PASS |
| TypeScript app | PASS |
| ESLint | PASS — 0 erreur, 61 avertissements préexistants |
| Build Vite final | PASS — `/assets/index-B8Ei1sb3.js` |
| Suite unitaire complète, dont T-3020 à T-3027 et Reader | 292/292 PASS |
| E2E nouveau catalogue | 7/7 PASS avec fixture ; 5/5 scénarios applicables PASS en réel |
| T-3020 Search E2E | 7/7 PASS, 2 scénarios de catalogue réel exclus dans ce run |
| T-3021 Command Search E2E | 7/7 PASS au run final, sans retry automatique |
| T-3022 Trending réel | 3/3 PASS |
| T-3023 Ranking réel | 2/2 PASS |
| T-3024 Recommendations réel | 2/2 PASS |
| T-3025 Random | 3/3 PASS, 1 scénario réel exclu |
| T-3026 Manga Detail | 2/2 PASS, 1 scénario réel exclu |
| T-3027 Chapter List | 2/2 PASS, 1 scénario réel exclu |
| Nettoyage comptes QA T-3022/T-3023 | PASS — 0 compte restant, vérification admin en lecture seule |
| Reader E2E production existante | BLOCKED — 1 échec de prérequis, 3 non exécutés |
| Smoke de la nouvelle interface en production | NOT_DEPLOYED / NOT_VALIDATED |

Un premier essai Command Search a expiré en attendant l’ouverture de la palette. Le run
séquentiel complet suivant passe les sept cas, sans modification du produit ni du test
existant ; cette instabilité initiale n’est pas masquée par des retries automatiques.

## Reader et production : limite précisément observée

La fixture `tests/e2e/reader-p1.spec.ts` exige Solo Leveling sur AsuraScans **et** OriginManga.
AsuraScans répond au premier prérequis. L’appel de recherche OriginManga échoue avant les
scénarios UI. La vérification directe de
`/api/extract/search/originmanga?q=Solo%20Leveling&page=1` retourne **HTTP 502**, erreur
**fetch failed**. Aucune source n’a été forcée ou inventée pour faire passer les tests.

La production répond HTTP 200 sur `/search` et sert encore `/assets/index-BvbBpX-4.js`,
distinct du build local. Cette indisponibilité est donc observée sur la version déjà publiée,
et non provoquée par les nouveaux composants locaux. Le Reader réel n’est pas déclaré PASS.

Les autorisations de publication précédentes visaient des commits précis. Ce lot n’a pas
été commité ou poussé ; son smoke production doit suivre une publication autorisée puis
la vérification de l’asset réellement servi. La simple réponse HTTP 200 de l’ancienne page
ne vaut pas validation de cette refonte.

## Revue visuelle et artefacts

Comparaison effectuée avec la référence desktop et les captures du catalogue réel. Palette
navy/corail, hero image à droite, hiérarchie serif, centre dominant et panneau quotidien
compact conservés. Les couvertures sources, parfois de faible résolution, limitent la netteté
des grands recadrages ; aucune illustration de remplacement n’a été fabriquée.

Artefacts locaux temporaires :

- `/tmp/catalogue-desktop.png` : vue desktop réelle.
- `/tmp/catalogue-mobile.png` : page mobile complète réelle.
- `/tmp/catalogue-real/` : captures des quatre viewports et sorties Playwright.
- `/tmp/catalogue-validation.txt` : E2E contrôlés.
- `/tmp/catalogue-discovery-regression.txt` : Trending/Ranking réels.
- `/tmp/catalogue-reader.txt` : prérequis Reader en échec.

Pas de mesure chiffrée de CLS/Lighthouse, ni de validation sur appareil physique. Les tests
constatent la géométrie et l’absence de débordement, pas une certification globale WCAG.

## Préservation

Index vide ; aucun changement de lockfile, migration, secret ou configuration distante.
Les CRLF/LF préexistants et fichiers personnels restent hors index. Les deux rapports
historiques déjà modifiés ne sont pas réécrits. L’aperçu local reste sur
`http://127.0.0.1:8080/search?browse=1`.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 AXE_CORE_PATH=/tmp/mw-axe/node_modules/axe-core/axe.min.js npx playwright test tests/e2e/catalogue-editorial.spec.ts --retries=0
CATALOGUE_REAL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 AXE_CORE_PATH=/tmp/mw-axe/node_modules/axe-core/axe.min.js npx playwright test tests/e2e/catalogue-editorial.spec.ts --retries=0
```
