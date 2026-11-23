# Manga Wave — Registre des risques de dépendances

Relevé du 23 novembre 2026 (`npm audit`, API GitHub, lecture du code).

## Échelle

Probabilité × impact, de 1 (faible) à 3 (élevé). Score = produit.

## Dépendances et services en place

| # | Élément | Risque | P | I | Score | Mesure en place | Action |
|---|---|---|---|---|---|---|---|
| R1 | Extracteurs de sites de scans (12 sources serveur, dont Scantrad avec profil navigateur persistant) | Juridique (rediffusion sans licence) ; opérationnel (blocages Cloudflare, changements de HTML) | 3 | 3 | **9** | Repli automatique entre sources ; `source_health` | Ne pas étendre ; privilégier MangaDex et la bibliothèque OPDS de l’utilisateur ; décision produit sur le maintien de ces sources |
| R2 | Profil Chromium persistant Scantrad (`.playwright_user_data/`) | Contient des cookies de session ; fuite si versionné ou copié | 2 | 2 | 4 | Ignoré par Git (vérifié : aucun fichier suivi) | Ne jamais l’inclure dans un artefact ou un log |
| R3 | `@supabase/supabase-js` | Cœur de l’app ; morceau `useAuth` de 256 ko | 1 | 3 | 3 | Versions maintenues | Surveiller le poids (étape 6 de la feuille de route) |
| R4 | `playwright-core` + `@sparticuz/chromium` (production, `api/extract.ts`) | Surface d’attaque d’un navigateur côté serveur ; durée et coût des fonctions Vercel | 2 | 2 | 4 | `maxDuration` 120 s ; liste d’hôtes d’images autorisés | Garder la liste d’hôtes fermée |
| R5 | Avis `npm audit` de production : `glob`, `minimatch`, `postcss-selector-parser`, `sucrase` (modérés) | Déni de service à la compilation ; pas exposés aux visiteurs | 1 | 1 | 1 | — | Mettre à jour lors du prochain cycle de dépendances |
| R6 | Google Fonts (Cinzel, Outfit, Inter) | Disponibilité tierce, vie privée (IP transmise à Google) | 2 | 1 | 2 | `display=swap`, polices de repli | Envisager l’auto-hébergement (WOFF2 dans `public/`) |
| R7 | `caniuse-lite` (25 mois) | Ciblage navigateur obsolète au build | 1 | 1 | 1 | — | `npx update-browserslist-db@latest` |
| R8 | API MangaDex (catalog-sync) | Limites de débit, changement de contrat | 2 | 2 | 4 | Pause de 400 ms, arrêt sur page incomplète, tests du gestionnaire | Suivre les annonces de l’API |

## Risques supprimés dans cette passe

| Élément | Avant | Après |
|---|---|---|
| `zod` 3.23 (inutilisé) | Avis **haut** de production | Retiré |
| `@hookform/resolvers` (inutilisé) | Dépendance morte | Retiré |
| Photo Unsplash de secours | Dépendance tierce dans chaque couverture, image trompeuse | Espace réservé SVG embarqué |
| Noto Sans JP | 459 ko de CSS bloquant chez un tiers | Retirée |

Audit de production : **1 haute + 4 modérées → 0 haute + 4 modérées**.

## Dépendances ajoutées

| Élément | Licence | Portée | Risque |
|---|---|---|---|
| `@axe-core/playwright` 4.10 (+ `axe-core`) | MPL-2.0 | Développement uniquement, absent du bundle | Copyleft au fichier : sans effet tant que ses fichiers ne sont pas modifiés |
| Lighthouse 12.2.1 | Apache-2.0 | Exécuté via `npx`, non installé | Aucun en production |

## Dépendances évaluées et écartées

| Élément | Raison principale |
|---|---|
| keiyoushi/extensions-source, kotatsu-parsers (archivé), Nyora | Extracteurs de scans non licenciés |
| manga-image-translator, comic-text-detector (inactif depuis 2023) | Œuvres dérivées, GPL, coût GPU |
| Motion | Aucun bénéfice mesurable face au CSS actuel (+~30 ko) |
| Remotion | Licence à deux niveaux ; aucun usage dans l’application |
| SyncDex | Inactif depuis 2022 ; l’idée se réalise par l’API AniList |
