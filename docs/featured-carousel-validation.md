# À l’affiche — implémentation et validation

7 octobre 2026. Statut : **LOCAL_VALIDATED**, publication en attente.

## Changements

- `HeroSection` devient l’adaptateur du catalogue canonique et des agrégats Trending existants.
  Les tendances fiables passent en premier ; sinon le tri stable des nouveautés alimente
  Découverte. Les doublons, identités non canoniques, couvertures absentes et œuvres marquées
  erotica sont exclus de cette vitrine publique, sans les retirer du catalogue.
- `FeaturedMangaCarousel` et sa feuille de style sont réutilisables, sans requête fournisseur
  ni état applicatif global. Sept œuvres au maximum, cinq cartes montées et trois visibles
  sur mobile. État vide, chargement et erreur récupérable présents.
- La homepage authentifiée conserve Reprendre la lecture et ses sections personnalisées,
  avec la même vitrine canonique. Toutes les sections anonymes restent présentes.
- Les fiches reçoivent une intention `?read=1`. Le résolveur canonique P1 existant et le
  contrôle adulte restent seuls responsables du choix de source avant l’entrée Reader.
  Aucun fournisseur n’est imposé par la homepage. Sans chapitre, la fiche garde sa récupération.
- `MangaCover` reçoit des options compatibles avec ses usages existants : priorité eager/lazy
  et proxy lazy optionnel. Les cartes hors des cinq slots ne sont pas montées.
- Correction ciblée du breakpoint du header, suite au débordement réellement reproduit à 768 px.

## Preuves

| Vérification | Résultat |
| --- | --- |
| Carousel : sélection canonique, déduplication, contenu adulte, positions circulaires | 4 tests unitaires PASS |
| T-3020 à T-3027 + sélection carousel | 94 tests unitaires PASS |
| Suite unitaire complète finale | 292/292 PASS |
| Failover Jev après ajout du cas JSON/réseau/version | 9/9 PASS |
| E2E carousel avec fixtures | 7/7 PASS |
| E2E carousel avec catalogue réel | 4/4 PASS ; 3 fixtures explicitement exclues |
| E2E T-3026/T-3027, fiches et chapitres | 4/4 PASS ; 2 modes réels exclus |
| TypeScript app et configuration Node | PASS |
| TypeScript strict banc Jev | PASS |
| Build Vite | PASS |
| Lint | PASS, 0 erreur ; 61 avertissements Fast Refresh préexistants |
| Axe, clavier, Touch/swipe, reduced-motion | PASS sur le carousel aux quatre viewports |
| Production existante : recherche T-3020 réelle | 7/7 PASS ; 2 fixtures exclues |
| Nouveau carousel en production | NOT_DEPLOYED / NOT_VALIDATED |

Les E2E couvrent les largeurs 390, 430, 768 et 1440, le lien vers la fiche canonique, le
plus petit chapitre via mapping P1, l’absence de source et le contrôle adulte. Le test
réel lit le catalogue Supabase ; il ne fabrique aucune œuvre ni activité Trending.
Les tests ne créent aucun compte QA et n’écrivent pas en base.

Voir [la revue visuelle](../design-qa.md) et [l’expérience Jev](typesafe-jev-experiment.md).
Le service de développement reste disponible sur `http://127.0.0.1:8080/`.
Le dernier build local produit `/assets/index-ODob4Fte.js` ; la production sert encore
`/assets/index-BvbBpX-4.js`. Ces assets différents empêchent de confondre les deux validations.

## Reproduire

```sh
npm run dev -- --host 127.0.0.1
node --experimental-strip-types --test tests/*.test.ts
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 AXE_CORE_PATH=/tmp/mw-axe/node_modules/axe-core/axe.min.js npx playwright test tests/e2e/featured-carousel.spec.ts
CAROUSEL_REAL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 AXE_CORE_PATH=/tmp/mw-axe/node_modules/axe-core/axe.min.js npx playwright test tests/e2e/featured-carousel.spec.ts
```

Axe 4.10.3 est installé uniquement dans `/tmp/mw-axe`, pas dans les dépendances produit.
Sans `AXE_CORE_PATH`, les tests visuels marquent explicitement ce contrôle comme sauté.
Le passage production utilisera la même commande réelle avec l’URL publiée après confirmation
du nouvel asset, puis vérifiera aussi l’entrée Reader avec un fournisseur réellement disponible.

## Préservation du dépôt

Index laissé vide, aucun commit ni push. Aucun lockfile, migration, secret ou fichier
personnel modifié. Les différences CRLF/LF préexistantes restent hors index, sans
normalisation massive. Les deux rapports historiques déjà modifiés ne sont pas inclus
dans le travail de ce lot. Aucune fonctionnalité de P3 supplémentaire n’est commencée.
