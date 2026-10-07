# OPUS 5.5 handoff

## État du produit

La production auditée sert `assets/index-BvbBpX-4.js`. Elle contient la recherche canonique, la fiche manga et une liste réelle de chapitres, mais elle ne contient pas encore le nouveau carousel premium ni la refonte éditoriale plein écran capturés localement.

Le candidat local montre le meilleur récit visuel : homepage premium, catalogue éditorial, bibliothèque et historique responsive. Il ne doit pas être présenté comme production avant un déploiement et un smoke du nouveau bundle.

## Assets prioritaires

1. `recordings/candidate/16x9-home-carousel.webm`
2. `recordings/candidate/16x9-search-to-detail.webm`
3. `recordings/candidate/16x9-library-to-history.webm`
4. `recordings/candidate/9x16-home-swipe.webm`
5. `screenshots/audit-production/desktop/06-manga-detail.png`
6. `recordings/production/16x9-reader-navigation-raw.webm`
7. `branding/logo-transparent-2048.png`

Consulter `docs/capture-matrix.md` avant d’utiliser un fichier. Les fichiers marqués `REJECT`, `AUDIT_ONLY` ou `DEMO_ONLY` ne doivent pas être montrés comme preuve d’un état organique de production.

## Narration

Raconter : **PROBLEM → DISCOVERY → SEARCH → DETAIL → READ → CONTINUE → DISCOVER MORE**.

La scène Reader est réelle : chapitre 309 de One Punch-Man, pages 1 à 3 vérifiées en production, sans interception réseau ni fixture. Elle prouve un parcours disponible à l’instant de la capture ; elle ne prouve pas que tous les titres et fournisseurs restent disponibles en permanence.

## Vérité produit

Utiliser seulement les formulations de `docs/product-truth-sheet.md`. Ne pas citer les fournisseurs, Jev, les extracteurs, les détails Supabase ou les techniques anti-bot. Ne pas promettre une disponibilité permanente des chapitres.

## Traitement visuel

- Ink `#061622`, surface `#141C28`, corail `#FF4D5A`, bleu `#1EA7FF`.
- Cinzel pour les titres éditoriaux, Outfit/Inter pour l’interface et les cartons.
- Mouvement discret, aucun effet glitch, aucune esthétique Netflix ou player audio.
- Les couvertures viennent du catalogue canonique réel ; le manifeste conserve leur source et leur route.

## Données de démonstration

Les captures Bibliothèque, Historique et Continuer la lecture utilisent un compte QA éphémère sans donnée personnelle. Le compte a été supprimé automatiquement après la capture. Les titres, couvertures et identités canoniques sont réels ; les chapitres et pourcentages affichés servent uniquement à la démonstration du parcours de rétention.

## Montage

- Couper les clips aux timecodes de `docs/capture-matrix.md` pour retirer le chargement initial.
- Produire un master 16:9, une adaptation 9:16 et une boucle website muette de 6 à 8 secondes.
- La boucle website peut utiliser seulement les positions stables du carousel.
- Pour la fiche longue, animer un crop ; ne pas afficher la page complète réduite.

## Validation avant export final

- Déployer le candidat local et confirmer le nouveau hash de bundle.
- Recapturer homepage/catalogue depuis la production déployée.
- Rejouer le smoke Reader juste avant l’export public si le montage a lieu plusieurs jours après la capture.
- Vérifier les droits de campagne pour les couvertures si la vidéo est sponsorisée.
- Vérifier orthographe, sous-titres, safe zones 16:9 et 9:16, et absence d’identifiant QA.

## What I need to provide

- Décision de positionnement : vidéo de lancement public ou vidéo de présentation du candidat.
- URL de production après déploiement du nouveau bundle.
- Une nouvelle fenêtre de capture seulement si le chapitre Reader actuel n’est plus disponible au moment du montage.
- Choix de voix : masculine, féminine ou neutre ; ton chaleureux recommandé.
- Licence musicale ou bibliothèque sonore autorisée.
- Confirmation des droits d’utilisation publicitaire des couvertures si diffusion payante.
