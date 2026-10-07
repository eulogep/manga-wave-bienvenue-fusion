# Audit produit orienté vidéo

Audit réalisé le 7 octobre 2026 sur la production et sur le candidat local, à partir des captures conservées dans ce kit.

## État actuel

La production reste cohérente, sombre et lisible, mais son premier écran ne délivre pas assez vite une image signature. Dans `screenshots/audit-production/desktop/01-home-discovery.png`, le hero et les cartes éditoriales restent partiellement en chargement après l’ouverture. Le catalogue de production fonctionne, mais son traitement est plus utilitaire et dense que le candidat local.

Le candidat local possède le meilleur moment de lancement : `screenshots/desktop/01-home-discovery.png` présente une hiérarchie immédiate, une couverture centrale et des CTA cohérents. `screenshots/desktop/02-catalogue.png` remplit mieux la largeur et organise filtres, sélection et résultats dans un récit éditorial.

## Parcours

Le chemin découverte → recherche → fiche est compréhensible. Le clip `16x9-search-to-detail.webm` conserve la couverture comme repère pendant la transition. Le passage fiche → lecture a finalement été capturé sur un chapitre réel de production : les pages 1 à 3 du chapitre 309 de One Punch-Man se chargent sans fixture. La disponibilité Reader dépend toutefois toujours du fournisseur. Le parcours bibliothèque → historique est clair et se capture sans donnée personnelle grâce au compte QA temporaire.

## Hiérarchie et densité

- Homepage locale : hiérarchie forte, CTA principal visible, profondeur du carousel maîtrisée.
- Catalogue local : structure claire sur desktop ; les captures full page deviennent trop longues sur mobile et doivent être recadrées au montage.
- Fiche manga : identité canonique forte, mais le synopsis anglais très long et les notes techniques dominent visuellement avant les chapitres.
- Auth : fonctionnelle mais générique ; elle ne mérite pas un plan principal.

## Interaction et feedback

Les clips montrent des changements de carte, un scroll de catalogue, une ouverture de fiche et une navigation bibliothèque/historique. Les plans commencent pendant le chargement initial ; `capture-matrix.md` donne les timecodes à couper. Aucun compte ou mot de passe n’apparaît dans les clips régénérés.

## Confiance produit

La recherche canonique et la fiche réelle sont les preuves les plus fortes. Les écrans Tendances et Classement sont vides en production et doivent être exclus. Le classement local a été influencé par les données QA temporaires et reste explicitement marqué `DEMO_ONLY`.

## Responsive

Les captures 390 px montrent que le carousel, le catalogue, la bibliothèque et l’historique restent dans la largeur. Les pages full page sont très longues ; pour le 9:16, utiliser des plans rapprochés et le clip tactile plutôt que réduire l’écran entier.

## Accessibilité

L’automatisation vérifie le débordement horizontal, les images sans `alt`, les contrôles sans nom accessible, le nombre de `h1` et les cibles tactiles. Ce contrôle DOM ne remplace pas un audit axe complet ni un test lecteur d’écran. Les écarts de cibles sous 44 px sont consignés dans `capture-audit.json` et doivent être traités comme points de revue, pas comme conformité démontrée.

## Actions prioritaires

1. Déployer le candidat local, puis recapturer homepage et catalogue depuis la production.
2. Rejouer le smoke Reader au moment de l’export final, car la disponibilité fournisseur peut évoluer.
3. Réduire la présence du synopsis et des notes techniques dans le premier viewport de la fiche.
4. Éviter Tendances et Classement jusqu’à ce que l’activité organique produise un écran non vide.
5. Exécuter axe et navigation clavier sur le bundle déployé avant de qualifier la vidéo de prête au lancement.
