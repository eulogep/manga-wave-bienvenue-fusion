# Motion guide

## Principes

- Mouvement fonctionnel : chaque animation révèle un choix, un résultat ou une continuité.
- Durées UI : 220 à 420 ms ; plans produit : 2 à 4 secondes.
- Courbe recommandée : `cubic-bezier(.22,.8,.24,1)`.
- Les zooms restent entre 102 % et 106 %.
- N’animer que transform et opacity dans les compositing shots.

## Transitions

- Problème → produit : cut net sur le premier mot corail.
- Découverte → recherche : push horizontal de 10 % maximum.
- Résultat → fiche : match cut entre couverture de carte et couverture de fiche.
- Fiche → bibliothèque : fondu de 6 à 8 images, puis déplacement vertical léger.
- Outro : logo fixe, vague corail de 12 à 16 images, CTA après 8 images.

## Formats

- 16:9 : garder le curseur visible seulement pendant l’action utile.
- 9:16 : cadrer le carousel et les CTA ; ne pas afficher les full-page screenshots en réduction.
- Website loop : 6 à 8 secondes, sans son, boucle entre deux positions stables du carousel.

## À éviter

- Autoplay agressif, tremblements, glitch, rotations 3D excessives.
- Empiler blur, glow et grain sur les couvertures.
- Simuler un chargement réussi ou masquer un message d’indisponibilité.
- Faire croire que la page Reader a été capturée si elle ne l’a pas été.
