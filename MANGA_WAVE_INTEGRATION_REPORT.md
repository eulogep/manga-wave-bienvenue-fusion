# Manga Wave — Rapport d’intégration open source

Passe du 23 novembre 2026, branche `feat/oss-integration` partie de `origin/main` (`3dd8992`).
Chaque intégration a une mesure de référence prise sur le commit précédent, puis la même
mesure après le changement.

## État de départ (audit, phase 1)

| Élément | Constat vérifié |
|---|---|
| Production | `https://manga-wave-bienvenue-fusion.vercel.app` sert `3dd8992` (bundle contenant `/pour-toi`, collections, statistiques, extracteurs Mangas Origines et Scantrad). |
| Catalogue | 970 titres, dont 375 avec identité MangaDex ; dernière synchronisation MangaDex le 2026-11-23 à 14:10 UTC. La synchronisation élargie est donc déployée. |
| Routes | 15 : accueil, recherche, fiche, lecteur, Pour toi, collections ×2, bibliothèque, historique, statistiques, tendances, classement, surprise, auth, 404. |
| Backend | 27 migrations, 5 Edge Functions (`catalog-sync`, `source-sync`, `manga-proxy`, `mangadex-proxy`, `reading-progress`), extracteurs Vercel (`api/extract.ts`, 12 sources côté serveur). |
| Résolveur canonique | `canonicalManga.ts`, `sourceResolution.ts`, `automaticFallback.ts`, `chapterMatching.ts` (≈ 390 lignes, couvertes par les tests P1). |
| Hors-ligne | Service worker manuel : coquille seulement, aucun contenu de lecture. |
| Accessibilité | axe-core seulement optionnel (`AXE_CORE_PATH`), donc jamais exécuté en pratique. |
| Observabilité | Aucune remontée d’erreur ni mesure terrain. |
| Tests | 402 tests unitaires PASS, 0 erreur TypeScript, 0 erreur ESLint (61 avertissements préexistants). |
| Bundle | 1 012 ko de JS ; point d’entrée 270 ko (77 ko gzip), contre 156 ko en octobre. |

## Intégrations réalisées

### 1. axe-core (`@axe-core/playwright`) + Playwright

- **Réutilisé** : le moteur de règles WCAG d’axe-core et son adaptateur Playwright officiel.
- **Adapté** : `tests/e2e/a11y-routes.spec.ts` scanne 14 routes publiques à 1280 px et 390 px
  (règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`). Les violations graves et critiques font
  échouer le test ; toutes sont jointes au rapport. `npm run test:e2e:a11y`.
- **Pourquoi** : rien ne détectait les régressions d’accessibilité ; la règle du projet
  « mobile-first, premium » inclut la lisibilité.
- **Preuve** :

| | Avant (`3dd8992`) | Après |
|---|---|---|
| Violations critiques (`button-name`) | 8 nœuds, 4 vues | 0 |
| Violations graves (`color-contrast`) | 200 nœuds, 25 vues sur 28 | 0 |
| Vues conformes | 3 / 28 | **28 / 28** |

- **Ce que le scan a révélé au-delà du contraste** :
  - `--mw-accent-coral` était utilisé 80 fois dans 22 composants **sans jamais être défini** :
    logo, soulignement de navigation, badges « Nouveau », boutons « Reprendre » rendaient
    transparents. Vérifié dans le navigateur (`getComputedStyle` → `rgba(0,0,0,0)`).
  - La page 404 était le gabarit Lovable en anglais sur fond gris clair.
- **Correctifs** : jeton corail défini ; encre sombre `#061622` sur corail plein (5,67:1 contre
  3,25:1 en blanc), y compris pour le bouton par défaut ; gris secondaires relevés ; index
  décoratif sorti de l’arbre d’accessibilité ; libellés pour le filtre de statut et le bouton
  du mot de passe ; 404 refaite aux couleurs du site.
- **Performance** : aucune (dépendance de développement, absente du bundle).
- **Sécurité** : aucune surface ajoutée en production.
- **Maintenance** : faible ; une mise à jour d’axe-core peut ajouter des règles et faire
  échouer la suite — c’est le comportement voulu.
- **Retour arrière** : `git revert 89aaa4b` (suite) ; `85a86cc` pour les correctifs visuels.

### 2. Lighthouse (protocole de mesure)

- **Réutilisé** : Lighthouse 12.2.1 via `npx`, Chromium de Playwright.
- **Adapté** : `scripts/perf/lighthouse-median.mjs` (`npm run perf:lighthouse`) : profil
  mobile, N passages, **médiane**. Un passage unique s’est révélé trop bruité (la fiche manga
  variait de 88 à 74 sans changement de code).
- **Constats** (mesures directes dans le navigateur pour localiser les causes) :
  - CLS 0,361 sur l’accueil : le bloc d’attente d’authentification faisait 55 % de la
    hauteur, le pied de page apparaissait à l’écran puis était repoussé.
  - La feuille Google Fonts pesait 120 ko compressés, dont **459 ko** non compressés pour
    Noto Sans JP, utilisée seulement pour des titres en caractères latins, chargée en
    `@import` chaîné et bloquant le rendu.
  - L’élément LCP était une **photo Unsplash** : `MangaCover` affichait une image de stock
    sans rapport pendant le chargement de chaque couverture et en cas d’échec.
- **Correctifs** : bloc d’attente pleine hauteur ; Noto Sans JP retirée (`font-japanese` →
  Inter, rendu comparé visuellement) ; polices liées depuis `index.html` avec `preconnect` ;
  espace réservé SVG embarqué à la place de la photo distante.
- **Preuve** (médiane de 3, mobile, A/B en alternance, builds `3dd8992`+a11y contre après) :

| Page | Perf | LCP | FCP | CLS | Octets |
|---|---|---|---|---|---|
| Accueil | 44 → **64** | 10,7 → 9,7 s | 5,0 → 4,2 s | 0,362 → **0,000** | 1 542 → 1 355 ko |
| Catalogue | 62 → 64 | 9,4 → 7,6 s | 5,2 → 4,8 s | 0,001 → 0,001 | 1 326 → 1 138 ko |
| Fiche manga | 61 → 62 | 8,9 → 8,1 s | 5,5 → 5,1 s | 0,000 → 0,008 | 1 672 → 1 484 ko |

- **Limite restante** : le LCP de l’accueil reste élevé. L’image vedette attend le
  catalogue canonique complet (970 lignes) avant de connaître sa couverture. Traité dans la
  feuille de route (point 1).
- **Sécurité** : l’espace réservé est une URL `data:` statique, sans requête tierce ; une
  dépendance externe (Unsplash) disparaît.
- **Retour arrière** : `git revert 8998c25`.

### 3. Carrousel de l’accueil sans le catalogue complet

- **Constat** : le carrousel attendait ~970 lignes pour en afficher 7.
- **Changement** : `useFeaturedWorks` lit les identifiants en tendance et les ajouts récents
  éligibles, puis applique la même `selectFeaturedWorks`. Couverture active en priorité haute.
- **Preuve** : sélection identique sur les données de production (7 mêmes titres, 12 lignes
  lues) et test unitaire d’équivalence avec et sans tendances fiables ; Lighthouse mobile,
  médiane de 5 : LCP 9,7 → 8,7 s, FCP 4,5 → 4,2 s, CLS 0 ; E2E carrousel et tendances PASS.
- **Retour arrière** : revert du commit ; `HeroSection` reprend le catalogue complet.

### 4. Réduction de la surface de dépendances

- `zod` 3.23 et `@hookform/resolvers` n’étaient importés nulle part (vérifié sur tout le
  dépôt) mais portaient la seule alerte **haute** de production.
- **Preuve** : `npm audit --omit=dev` : 1 haute + 4 modérées → 0 haute + 4 modérées ; build,
  typage et 402 tests inchangés.
- **Retour arrière** : `git revert b8ac720`.

## Non intégré dans cette passe, et pourquoi

| Ressource | Raison | Condition pour avancer |
|---|---|---|
| Sentry + web-vitals | Exigent un DSN (compte) et une revue de confidentialité | Ton accord et un DSN |
| Komga / Stump / Kavita (OPDS) | Chantier de conception : identifiants de l’utilisateur, CORS, stockage | Validation de l’architecture proposée |
| vite-plugin-pwa | Sans périmètre hors-ligne défini, aucun gain mesurable | Après l’adaptateur OPDS |
| Extensions de scans (Keiyoushi, Kotatsu, Nyora, sources Suwayomi) | Rediffusion d’œuvres sans licence | Aucune : rejet définitif comme sources |
| Traduction / détection IA de pages | Œuvres dérivées de pages tierces, coût GPU, GPL | Seulement sur contenu détenu |

## Validation globale

- Tests unitaires : **402 / 402** à chaque commit.
- Accessibilité E2E : **28 / 28** vues sans violation grave ni critique.
- Accessibilité Lighthouse : 100 sur les trois pages mesurées.
- TypeScript : 0 erreur ; ESLint : 0 erreur.
- Mobile : 390 px couvert par la suite d’accessibilité ; aucun débordement horizontal.
- RLS : aucune table, politique ni fonction modifiée dans cette passe.
- Production : **non déployé** à la rédaction ; nécessite ton autorisation de pousser sur `main`.
