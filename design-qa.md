# Manga Wave — QA visuelle du carousel

> Suite : la refonte éditoriale du catalogue a également été implémentée et vérifiée.
> Voir [le rapport catalogue](docs/catalogue-editorial-validation.md) pour les quatre
> viewports, les images réelles, axe, les régressions et les limites de publication.

7 octobre 2026 — **PASS local**, production du nouveau composant **NOT_DEPLOYED**.

## Référence et adaptation

Comparaison avec l’image desktop/mobile jointe à la demande : composition éditoriale en
haut à gauche, couverture centrale, quatre voisines desktop en perspective, deux aperçus
mobiles, métadonnées et deux actions sous la couverture. Aucun player, wording cinéma,
avatar inventé ou asset généré. Les images viennent du catalogue canonique réel ; les
titres affichés ne sont donc pas ceux de la maquette. Le header et les sections existants
conservent l’identité de l’application. Le badge Découverte reste honnête quand les
agrégats Trending ne sont pas suffisamment fiables.

## Contrôles visuels

| Surface | Constat |
| --- | --- |
| Typographie | Police existante héritée, titre éditorial 44 px desktop / 29 px mobile, hiérarchie lisible ; titre de l’œuvre plafonné à deux lignes |
| Espacement | Couverture centrale 246 × 346 desktop et 190 × 267 mobile ; actions sous les métadonnées ; aucun recouvrement des commandes |
| Couleurs | Fonds #061622 / #141C28, actions #FF4D5A, focus #1EA7FF ; texte #EDEFF2, teintes secondaires éclaircies pour le contraste |
| Images | Couvertures réelles chargées, recadrage portrait, fond dérivé de la couverture active ; pas de duplication artificielle de l’art de la référence |
| Texte et icônes | À l’affiche, Découverte/Tendance, Lire maintenant, Voir la fiche ; Lucide existant, aucune terminologie de film |
| Interactions | Flèches, dots, clavier, swipe, focus visible, lien canonique et entrée P1 ; aucun autoplay |

Revue des captures complètes desktop et mobile, puis des zones couverture/métadonnées/
CTA à 390 px et tablette. Les libellés, icônes et focus sont lisibles à ces résolutions ;
aucune région supplémentaire illisible ne nécessitait un agrandissement indépendant.

Captures du vrai catalogue après chargement de l’image active :

- [390 × 844](test-results/featured-carousel-carousel-390x844-layout-navigation-a11y/carousel-390.png)
- [430 × 932](test-results/featured-carousel-carousel-430x932-layout-navigation-a11y/carousel-430.png)
- [768 × 1024](test-results/featured-carousel-carousel-768x1024-layout-navigation-a11y/carousel-768.png)
- [1440 × 1000](test-results/featured-carousel-carousel-1440x1000-layout-navigation-a11y/carousel-1440.png)

Ces captures sont des artefacts locaux ignorés par Git et peuvent être remplacées par un
prochain run Playwright. Les captures avec focus sur une flèche documentent le parcours clavier.

## Findings résolus

- **P2 — Débordement préexistant du header tablette.** À 768 px, les liens desktop, la
  recherche et les actions excédaient la largeur. Les trois breakpoints de navigation/menu
  passent de `md` à `xl`. Le menu complet reste disponible sur tablette.
- **P2 — Retard de la couverture proxy.** Les premières captures étaient antérieures au
  chargement MangaDex. Le smoke réel attend maintenant une image chargée non fallback ;
  active et voisines sont eager, les autres lazy, avec proxy différé pour les cartes lointaines.
- **P2 — Intention de swipe.** Le clic synthétique qui suit un swipe ne doit pas ouvrir
  accidentellement une fiche. Suppression bornée à 350 ms, sans bloquer le clic suivant.

## Validation et limites

- 4 viewports : zéro débordement horizontal ; 5 cartes au maximum desktop, 3 mobile.
- Axe sur le bloc : zéro violation aux quatre tailles, avec fixture puis catalogue réel.
- Clavier : flèches et focus conservé ; swipe horizontal testé par événements Touch du
  navigateur ; défilement vertical permis par `touch-action: pan-y`.
- Reduced motion : transitions neutralisées, y compris la règle globale existante à 0,01 ms.
- Contrôles du carousel ≥ 44 px ; actions mobiles sur toute la largeur disponible.
- Images dans cadres fixes, contenu chargé sans changement de hauteur des couvertures ;
  pas de mesure chiffrée de CLS/Lighthouse ni d’essai sur appareil physique.
- Le contrôle axe porte sur le nouveau bloc, pas une certification de toute l’application.
- Header modifié uniquement pour le breakpoint prouvé nécessaire ; autres capacités préservées.
- Le navigateur intégré n’étant pas disponible dans cette session, captures et interactions
  ont été vérifiées dans Chromium Playwright, demandé dans le périmètre de validation.

## Réserve de publication

Le bundle servi en production reste `/assets/index-BvbBpX-4.js`. Le smoke de recherche
canonique existant passe 7/7 (2 cas synthétiques volontairement exclus). Cela ne valide
pas le carousel en production. Le smoke du nouveau carousel doit être exécuté après
publication de ce lot ; aucun push ni déploiement n’est réalisé dans cette passe.
