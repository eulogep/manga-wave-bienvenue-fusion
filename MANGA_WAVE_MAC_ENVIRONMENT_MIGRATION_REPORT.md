# MANGA_WAVE_MAC_ENVIRONMENT_MIGRATION_REPORT

Date : 2026-09-08. Rapport actualisé après autorisation de reprendre en conservant le commit local et les différences de fins de ligne. Remplace le statut de l’audit initial.

## PROJECT_PATH / OS / ARCHITECTURE

- PROJECT_PATH : `/Users/eulogemabiala/Desktop/Developer/PLATEFORME MANGA`
- OS : macOS 26.2 (25C56)
- ARCHITECTURE : arm64
- Périmètre : migration et validations locales uniquement. T-3015 non commencé.

## GIT_BRANCH / GIT_REMOTE / GIT_STATUS_BEFORE

- Branche : `main`, HEAD attachée : `2aaeabf08e6454e977f1da30f2d50d5461a03052`.
- Origin : `https://github.com/eulogep/manga-wave-bienvenue-fusion.git`, conforme au handoff.
- Référence locale origin/main : `a22bbaa`, main ahead 1 / behind 0. Aucun fetch ; la référence GitHub actuelle n’a pas été actualisée.
- `git show --stat --oneline 2aaeabf` et `git show --name-status 2aaeabf` exécutés : modification de `MANGA_WAVE_CODEX_HANDOFF.md`, ajout de `MANGA_WAVE_MAC_BOOTSTRAP_PROMPT.md` ; 480 insertions, 633 suppressions. Documentation uniquement.
- Commit préservé, ni amendé ni supprimé. Aucun reset, checkout global, add, commit, pull ou push.
- Les 98 modifications initiales sont strictement des différences CRLF/LF : `git diff --ignore-space-at-eol --stat` vide avant correction, et comparaison binaire à HEAD après normalisation CRLF → LF identique pour chaque fichier.
- Aucun de ces 98 fichiers n’a été réécrit ou normalisé. Comparaison SHA256 avant/après de tous les fichiers suivis.
- `mac recuperer.txt` figurait non suivi au premier audit, mais était déjà absent lors de la reprise, avant tout nettoyage. Aucune action sur ce fichier. Classé document local hors produit selon la consigne ; conservation physique impossible à attester puisqu’il est absent. Il n’a pas été recréé, ajouté à Git ou supprimé par l’agent.

État exact au premier audit :

```text
M .env.example
 M .gitignore
 M README.md
 M components.json
 M docs/catalog-providers.md
 M docs/catalog-sync.md
 M docs/mangadex-integration.md
 M docs/product-roadmap.md
 M eslint.config.js
 M index.html
 M package-lock.json
 M package.json
 M postcss.config.js
 M public/robots.txt
 M src/App.css
 M src/App.tsx
 M src/components/MangaCover.tsx
 M src/components/ui/accordion.tsx
 M src/components/ui/alert-dialog.tsx
 M src/components/ui/alert.tsx
 M src/components/ui/aspect-ratio.tsx
 M src/components/ui/avatar.tsx
 M src/components/ui/badge.tsx
 M src/components/ui/breadcrumb.tsx
 M src/components/ui/button.tsx
 M src/components/ui/calendar.tsx
 M src/components/ui/card.tsx
 M src/components/ui/carousel.tsx
 M src/components/ui/chart.tsx
 M src/components/ui/checkbox.tsx
 M src/components/ui/collapsible.tsx
 M src/components/ui/command.tsx
 M src/components/ui/context-menu.tsx
 M src/components/ui/dialog.tsx
 M src/components/ui/drawer.tsx
 M src/components/ui/dropdown-menu.tsx
 M src/components/ui/form.tsx
 M src/components/ui/hover-card.tsx
 M src/components/ui/input-otp.tsx
 M src/components/ui/input.tsx
 M src/components/ui/label.tsx
 M src/components/ui/menubar.tsx
 M src/components/ui/navigation-menu.tsx
 M src/components/ui/pagination.tsx
 M src/components/ui/popover.tsx
 M src/components/ui/progress.tsx
 M src/components/ui/radio-group.tsx
 M src/components/ui/resizable.tsx
 M src/components/ui/scroll-area.tsx
 M src/components/ui/select.tsx
 M src/components/ui/separator.tsx
 M src/components/ui/sheet.tsx
 M src/components/ui/sidebar.tsx
 M src/components/ui/skeleton.tsx
 M src/components/ui/slider.tsx
 M src/components/ui/sonner.tsx
 M src/components/ui/switch.tsx
 M src/components/ui/table.tsx
 M src/components/ui/tabs.tsx
 M src/components/ui/textarea.tsx
 M src/components/ui/toast.tsx
 M src/components/ui/toaster.tsx
 M src/components/ui/toggle-group.tsx
 M src/components/ui/toggle.tsx
 M src/components/ui/tooltip.tsx
 M src/components/ui/use-toast.ts
 M src/hooks/use-mobile.tsx
 M src/hooks/use-toast.ts
 M src/hooks/useAuth.tsx
 M src/hooks/useCatalogSearch.ts
 M src/hooks/useLibrary.ts
 M src/hooks/useManga.tsx
 M src/hooks/useMangaDex.ts
 M src/hooks/useOriginManga.ts
 M src/integrations/catalog/providers.ts
 M src/integrations/mangadex/client.ts
 M src/integrations/supabase/client.ts
 M src/integrations/supabase/types.ts
 M src/lib/utils.ts
 M src/main.tsx
 M src/pages/Auth.tsx
 M src/pages/NotFound.tsx
 M src/vite-env.d.ts
 M supabase/config.toml
 M supabase/functions/catalog-sync/index.ts
 M supabase/functions/mangadex-proxy/index.ts
 M supabase/functions/reading-progress/index.ts
 M supabase/migrations/20260827154000_create_manga_wave_schema.sql
 M supabase/migrations/20260827170000_add_mangadex_catalog_metadata.sql
 M supabase/migrations/20260827180000_enable_mangadex_upsert.sql
 M supabase/migrations/20260827190000_add_mangadex_chapter_identity.sql
 M supabase/schedules/daily_mangadex_catalog_sync.sql
 M supabase/seed/20260827_mangadex_initial_catalog.sql
 M tsconfig.app.json
 M tsconfig.json
 M tsconfig.node.json
 M vercel.json
 M vite.config.ts
?? "mac recuperer.txt"
```

## NODE_VERSION / NPM_VERSION

- Node : `v26.8.1`, `/Users/eulogemabiala/.local/bin/node`.
- npm : `11.19.0`, `/Users/eulogemabiala/.local/bin/npm`.
- Aucun `.nvmrc`, `.node-version` ou `engines` racine. Aucune version exacte attendue n’est fixée par ces fichiers.
- Vite verrouillé : Node `^20.19.0 || >=22.12.0` ; Playwright : Node `>=20`. Version présente compatible avec ces contraintes ; aucune erreur EBADENGINE lors des installations.
- nvm absent du shell inspecté ; version Node conservée et validée par installations, build et exécution.

## DEPENDENCY_INSTALL

- Ancien node_modules racine remplacé par `npm ci` (qui nettoie le dossier avant installation).
- Anciens `dist`, `server/node_modules`, `server/dist` supprimés après vérification qu’ils ne contiennent aucun fichier suivi ; fichiers générés uniquement.
- Première tentative npm ci : échec réseau dans le bac à sable, `ENOTFOUND registry.npmjs.org` (requête zod-3.23.8.tgz notamment). Pas d’incompatibilité de lockfile.
- Reprise avec accès réseau : `npm ci --cache /tmp/manga-wave-npm-cache --no-audit --no-fund --fetch-retries=1` : PASS, 610 paquets.
- `npm ci --prefix server --cache /tmp/manga-wave-npm-cache --no-audit --no-fund --fetch-retries=1` : PASS, 106 paquets.
- Les deux package-lock.json sont strictement inchangés (SHA256). Aucun npm install, mise à niveau ou approbation d’install scripts persistante.
- Avertissements : glob 10.5.0 et ESLint 9.39.5 dépréciés ; npm signale des scripts d’installation non couverts par allowScripts (SWC, esbuild, fsevents). Les builds et démarrages ont cependant réussi. Aucun changement hors périmètre.

## ENV_AUDIT

- Présents : `.env`, `.env.example`.
- Absents : `.env.local`, `.env.development`, `.env.production`, `server/.env`, `server/.env.example`.
- Variables attendues et non vides : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MANGADEX_API_PROXY_URL`, `VITE_MANGADEX_COVER_PROXY_URL`, `VITE_MANGADEX_PROXY_PUBLISHABLE_KEY`.
- `VITE_MANGA_PROXY_URL` manque dans .env ; le code prévoit un fallback Supabase à partir de VITE_SUPABASE_URL. Pas de crash de variable manquante constaté.
- Autres variables présentes et non vides : `API_KEY_ANONYME_SUPABASE`, `API_KEY_PUBLISHABE_SUPABASE`, `API_KEY_SERVICE_SUPABASE`, `API_KEY_SECRET_SUPABASE`, `API_ANON_PUBLIC_SUPABASE`, `SUPABASE_ACCESS_TOKEN`.
- Aucune valeur secrète publiée ; aucun chemin Windows détecté dans les valeurs inspectées ; aucun fichier .env modifié.
- Les variables serveur distantes SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS n’ont pas été exportées ni modifiées.

## WINDOWS_PATH_AUDIT

- `MANGA_WAVE_CODEX_HANDOFF.md:36` : ancien chemin D: documentaire, préservé.
- `server/src/lib/browser-pool.ts:19–22` : chemins Chrome/Edge Windows, limités à win32 ; préservés.
- User-Agent et en-têtes Windows : chaînes d’identification, sans effet de chemin système ; préservés.
- Aucun autre motif C:/D: avec antislash, cmd.exe, powershell.exe, .exe, .bat ou .ps1 trouvé dans les fichiers suivis lisibles au premier audit.
- Aucun fichier suivi > 10 MiB au premier audit ; dossiers générés ignorés non inventoriés exhaustivement.

### Blocage macOS reproduit et corrigé

L’appel réel à `createBrowserContext()` sous macOS échouait : `browserType.launch: spawn ENOEXEC`.
`file` identifie le navigateur extrait par @sparticuz/chromium comme ELF x86-64 GNU/Linux : inexécutable sur ce Mac arm64.

Correction limitée à `server/src/lib/browser-pool.ts` : sous darwin, sélectionner `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si fourni, sinon `chromium.executablePath()` de Playwright. Les branches Windows et Linux/Vercel gardent leur sélection précédente.

Vérification après correction : création du navigateur et d’un contexte, affichage d’une page locale, fermeture réussie (`LOCAL_BROWSER_POOL_PASS`). ESLint ciblé et TypeScript serveur passent. Aucun provider, Reader, comportement fonctionnel ou schéma modifié.

## SUPABASE

- CLI : `2.116.0`, `/Users/eulogemabiala/.local/bin/supabase`.
- Contournement sans modification de projet : préfixer chaque commande par `SUPABASE_TELEMETRY_DISABLED=1`.
- Version et aide fonctionnent ainsi ; erreur de télémétrie initiale résolue.
- `supabase migration list --linked` : première tentative limitée par le réseau, puis PASS avec accès réseau ; 17/17 migrations identiques local/distant, dernière `20260830130000`.
- Marqueur de liaison local cohérent avec .env et supabase/config.toml.
- Aucun login/relink, reset, déploiement, application de migration ou modification de configuration distante.
- Les E2E T3013/T3014 utilisent leurs comptes QA temporaires et leurs opérations de données existantes ; les deux suites passent, y compris leurs suppressions et contrôles de nettoyage. Aucun script verify:*:db supplémentaire exécuté.

## LINT

`npm run lint` : PASS, 0 erreur, 57 avertissements `react-refresh/only-export-components`.
Après le correctif macOS : ESLint ciblé sur browser-pool.ts : PASS, aucune erreur.

## TYPESCRIPT

- TypeScript installé depuis le lockfile : 5.9.3.
- `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` : FAIL.
- Erreur exacte : `src/domain/followedChapterUpdates.ts(58,26): TS2322: Type 'DetectedFollowedChapter[]' is not assignable to type 'FollowedChapterState[]'. Type 'DetectedFollowedChapter' is missing ... firstSeenAt, readAt`.
- Le tri déclare un retour DetectedFollowedChapter[], alors que la fonction appelante promet FollowedChapterState[]. Fichier inchangé à HEAD ; erreur de typage sans dépendance à macOS, laissée intacte conformément au périmètre.
- `./node_modules/.bin/tsc --noEmit -p tsconfig.node.json` : PASS.
- `./server/node_modules/.bin/tsc --noEmit -p server/tsconfig.json` : PASS avant et après correction.
- Pas de script typecheck ; le build Vite ne remplace pas ces validations.

## BUILD

- `npm run build` : PASS, 1837 modules, bundle `dist/assets/index-BAGTvmzG.js` (701.00 kB, gzip 205.82 kB), même nom que le bundle de référence dans le handoff.
- Avertissements : chunk > 500 kB, caniuse-lite ancien (23 mois). Aucune modification pour les résoudre.
- `npm --prefix server run build` : PASS après correction macOS.

## DEV_SERVER

- `npm run dev -- --host 127.0.0.1 --strictPort` : PASS avec autorisation d’écoute réseau ; le premier lancement sous bac à sable échouait avec listen EPERM.
- URL vérifiée : `http://127.0.0.1:8080/`, HTTP 200.
- Chromium rend la homepage canonique, ses rails catalogue et ses couvertures ; titre manga-wave-bienvenue-fusion ; aucune exception JavaScript pageerror.
- Capture vérifiée : `test-results/mac-migration/homepage.png`.
- Console : avertissements existants de clés /search dupliquées et liens imbriqués ; un appel extracteur a échoué avant le démarrage du backend. Aucun correctif UI.
- `npm run server` démarre l’extracteur à `http://localhost:3001` avec ses six sources.
- Processus de validation : Vite et tsx arrêtés par SIGINT après les tests ; aucune session serveur volontairement laissée active.

## PLAYWRIGHT / CRITICAL_TESTS

- `npx --no-install playwright --version` : 1.62.1.
- Chromium macOS arm64 déjà installé dans le cache Playwright, réinstallation inutile ; lancement headless et sanity homepage PASS.
- Base URL des tests explicitement locale : `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080` ; tests existants inchangés ; un worker, retries=0, trace=off.
- Unités : P1 41/41, P2 9/9, T3012 hotfix 5/5, T3013 7/7, T3014 12/12 : 74/74 PASS.
- E2E T3013 : 1/1 PASS (9.0 s), baseline → nouveau chapitre → lecture → acquittement et contrôle RLS/nettoyage.
- E2E T3014 : 1/1 PASS (12.0 s), favori/follow/unfollow/refollow et nettoyage.
- Reader : 4 scénarios exécutés au total, 1 PASS et 3 FAIL. Navigation réelle PASS. Réglages et changement manuel de source FAIL car bouton OriginManga absent après 60 s (`reader-p1.spec.ts:72` et `:87`). Réapparition des contrôles FAIL : position y = -54.5, attendue >= 0 (`reader-p1.spec.ts:17`, appelé à la ligne 104). Aucun scénario laissé non exécuté après la commande complémentaire.
- L’instantané d’échec montre uniquement AsuraScans comme source active. Cause macOS non démontrée ; pas de modification Reader, provider, données catalogue ou test pour contourner l’échec.
- Artefacts et logs unitaires : `test-results/`, ignorés par Git.

## TEST_COMMANDS

Scripts exacts disponibles :

```text
npm run test:canonical  # node --experimental-strip-types --test tests/canonicalManga.test.ts
npm run test:sources  # node --experimental-strip-types --test tests/sourceResolution.test.ts
npm run test:p1  # node --experimental-strip-types --test tests/canonicalManga.test.ts tests/sourceResolution.test.ts tests/automaticFallback.test.ts tests/chapterMatching.test.ts tests/providerHotfix.test.ts tests/providerHttp.test.ts tests/readerUiState.test.ts tests/readerMicroHotfix.test.ts
npm run test:e2e:reader  # playwright test tests/e2e/reader-p1.spec.ts
npm run test:e2e:t3013  # playwright test tests/e2e/t3013-deterministic-smoke.spec.ts
npm run test:e2e:t3014  # playwright test tests/e2e/t3014-follow.spec.ts
npm run test:p2  # node --experimental-strip-types --test tests/homePersonalization.test.ts tests/sourceFirstUx.test.ts
npm run test:t3012  # node --experimental-strip-types --test tests/sourceFirstUx.test.ts
npm run test:t3012:hotfix  # node --experimental-strip-types --test tests/t3012FunctionalHotfix.test.ts
npm run verify:t3012:hotfix:db  # node scripts/verify-t3012-hotfix-db.mjs
npm run test:t3013  # node --experimental-strip-types --test tests/followedChapterUpdates.test.ts
npm run test:t3014  # node --experimental-strip-types --test tests/t3014Follow.test.ts
npm run verify:t3014:db  # node --experimental-strip-types scripts/verify-t3014-db.mjs
npm run verify:t3013:db  # node scripts/verify-t3013-db.mjs
```

Commandes E2E exécutées :

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:reader -- --workers=1 --retries=0 --max-failures=1 --trace=off
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:t3013 -- --workers=1 --retries=0 --trace=off --output=test-results/mac-t3013
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:t3014 -- --workers=1 --retries=0 --trace=off --output=test-results/mac-t3014
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:reader -- --workers=1 --retries=0 --trace=off --grep 'manual source switch|Reader chrome hides' --output=test-results/mac-reader-remaining
```

## CRLF_FIXES / PERMISSION_FIXES / VERCEL

Aucune conversion de fins de ligne, aucun chmod. Aucun script .sh suivi découvert au premier audit. core.autocrlf non défini, configuration Git inchangée.
Vercel : configuration préservée (api/extract.ts, maxDuration 120, binaires Chromium inclus, réécritures API/SPA). CLI Vercel absente ; aucun relink ni déploiement.

## FILES_CHANGED / GIT_STATUS_AFTER

- `server/src/lib/browser-pool.ts` : unique correction macOS prouvée, deux lignes nettes ajoutées.
- `MANGA_WAVE_MAC_ENVIRONMENT_MIGRATION_REPORT.md` : rapport non suivi actualisé.
- Les 98 fichiers préexistants demeurent identiques à l’octet près à leur état avant cette reprise ; les deux lockfiles sont inchangés.
- Générés ignorés : node_modules, dist, server/node_modules, server/dist, test-results.
- Aucun fichier ajouté à l’index. Aucun commit créé.
- Statut final : 99 fichiers suivis modifiés (98 écarts CRLF/LF préexistants + le correctif macOS), rapport non suivi. Aucun changement indexé.

```text
M .env.example
 M .gitignore
 M README.md
 M components.json
 M docs/catalog-providers.md
 M docs/catalog-sync.md
 M docs/mangadex-integration.md
 M docs/product-roadmap.md
 M eslint.config.js
 M index.html
 M package-lock.json
 M package.json
 M postcss.config.js
 M public/robots.txt
 M server/src/lib/browser-pool.ts
 M src/App.css
 M src/App.tsx
 M src/components/MangaCover.tsx
 M src/components/ui/accordion.tsx
 M src/components/ui/alert-dialog.tsx
 M src/components/ui/alert.tsx
 M src/components/ui/aspect-ratio.tsx
 M src/components/ui/avatar.tsx
 M src/components/ui/badge.tsx
 M src/components/ui/breadcrumb.tsx
 M src/components/ui/button.tsx
 M src/components/ui/calendar.tsx
 M src/components/ui/card.tsx
 M src/components/ui/carousel.tsx
 M src/components/ui/chart.tsx
 M src/components/ui/checkbox.tsx
 M src/components/ui/collapsible.tsx
 M src/components/ui/command.tsx
 M src/components/ui/context-menu.tsx
 M src/components/ui/dialog.tsx
 M src/components/ui/drawer.tsx
 M src/components/ui/dropdown-menu.tsx
 M src/components/ui/form.tsx
 M src/components/ui/hover-card.tsx
 M src/components/ui/input-otp.tsx
 M src/components/ui/input.tsx
 M src/components/ui/label.tsx
 M src/components/ui/menubar.tsx
 M src/components/ui/navigation-menu.tsx
 M src/components/ui/pagination.tsx
 M src/components/ui/popover.tsx
 M src/components/ui/progress.tsx
 M src/components/ui/radio-group.tsx
 M src/components/ui/resizable.tsx
 M src/components/ui/scroll-area.tsx
 M src/components/ui/select.tsx
 M src/components/ui/separator.tsx
 M src/components/ui/sheet.tsx
 M src/components/ui/sidebar.tsx
 M src/components/ui/skeleton.tsx
 M src/components/ui/slider.tsx
 M src/components/ui/sonner.tsx
 M src/components/ui/switch.tsx
 M src/components/ui/table.tsx
 M src/components/ui/tabs.tsx
 M src/components/ui/textarea.tsx
 M src/components/ui/toast.tsx
 M src/components/ui/toaster.tsx
 M src/components/ui/toggle-group.tsx
 M src/components/ui/toggle.tsx
 M src/components/ui/tooltip.tsx
 M src/components/ui/use-toast.ts
 M src/hooks/use-mobile.tsx
 M src/hooks/use-toast.ts
 M src/hooks/useAuth.tsx
 M src/hooks/useCatalogSearch.ts
 M src/hooks/useLibrary.ts
 M src/hooks/useManga.tsx
 M src/hooks/useMangaDex.ts
 M src/hooks/useOriginManga.ts
 M src/integrations/catalog/providers.ts
 M src/integrations/mangadex/client.ts
 M src/integrations/supabase/client.ts
 M src/integrations/supabase/types.ts
 M src/lib/utils.ts
 M src/main.tsx
 M src/pages/Auth.tsx
 M src/pages/NotFound.tsx
 M src/vite-env.d.ts
 M supabase/config.toml
 M supabase/functions/catalog-sync/index.ts
 M supabase/functions/mangadex-proxy/index.ts
 M supabase/functions/reading-progress/index.ts
 M supabase/migrations/20260827154000_create_manga_wave_schema.sql
 M supabase/migrations/20260827170000_add_mangadex_catalog_metadata.sql
 M supabase/migrations/20260827180000_enable_mangadex_upsert.sql
 M supabase/migrations/20260827190000_add_mangadex_chapter_identity.sql
 M supabase/schedules/daily_mangadex_catalog_sync.sql
 M supabase/seed/20260827_mangadex_initial_catalog.sql
 M tsconfig.app.json
 M tsconfig.json
 M tsconfig.node.json
 M vercel.json
 M vite.config.ts
?? MANGA_WAVE_MAC_ENVIRONMENT_MIGRATION_REPORT.md
```

## ÉTAT AVANT STABILISATION (HISTORIQUE)

- Erreur TypeScript applicative TS2322 existante, hors compatibilité macOS.
- Trois échecs E2E Reader : source alternative OriginManga absente dans deux scénarios ; contrôle hors viewport (y = -54.5) dans le scénario de réapparition. Analyse fonctionnelle/données et synchronisation UI à traiter séparément ; aucune cause macOS prouvée.
- mac recuperer.txt : absent à la reprise, sans intervention de l’agent ; conservation physique non attestable.

```text
GIT_LOCAL_COMMIT: PASS
LINE_ENDINGS: CONFIRMED_ONLY (les 98 fichiers initiaux)
UNTRACKED_LOCAL_FILE: PRESERVED (non manipulé ; déjà absent à la reprise)
SUPABASE_CLI: PASS
NPM_CI: PASS
LINT: PASS
TYPESCRIPT: FAIL
BUILD: PASS
DEV_SERVER: PASS
PLAYWRIGHT: PASS (outil et Chromium ; résultats E2E dans CRITICAL_TESTS)
CRITICAL_TESTS: FAIL
MAC_ENVIRONMENT: OPERATIONAL
PROJECT_VALIDATION_ON_MAC: BLOCKED
T3015: DO_NOT_START_YET
```

Ce statut intermédiaire a déclenché la stabilisation ci-dessous. Le commit local,
les fins de ligne et la télémétrie Supabase n’étaient plus des blocages de
migration. T3015 est resté hors périmètre.

## STABILISATION POST-MIGRATION — 2026-09-08

### TS2322_ROOT_CAUSE

`reconcileFollowedChapters` construit `unread` comme `FollowedChapterState[]`, mais
`sortDetectedChapters` déclarait systématiquement un retour
`DetectedFollowedChapter[]`. Ce contrat effaçait statiquement les propriétés
`firstSeenAt` et `readAt`, bien que les objets les conservent à l’exécution.

### TS2322_FIX

`sortDetectedChapters` est maintenant générique :
`<T extends DetectedFollowedChapter>(chapters: T[]): T[]`. Le tri préserve donc
le sous-type exact reçu, sans assertion, `any`, propriété optionnelle ou
affaiblissement du typage.

`tsc --noEmit` passe pour l’application, la configuration Vite et le serveur.

### READER_FAILURE_1_ROOT_CAUSE

Le scénario Settings utilisait une route figée dont l’identifiant de chapitre
AsuraScans était devenu obsolète. Le manga demandé restait
`solo-leveling-b57aa235`, mais son détail courant renvoie le chapitre 5 avec
`/comics/solo-leveling-53fc8424/chapter/5`. `currentChapterObj` était donc absent,
`chapterNumber` valait `undefined` et la requête d’alternatives était désactivée.
Aucune requête health/search/OriginManga n’était émise : ce n’était pas une
latence du sélecteur.

### READER_FAILURE_2_ROOT_CAUSE

Le scénario de changement manuel partageait la même fixture périmée et la même
cause d’activation. OriginManga n’a pas été injecté : le préflight E2E vérifie
maintenant une recherche exacte réelle, le détail réel et la présence réelle du
chapitre 5 avant de construire la route Reader depuis le détail AsuraScans.

La donnée canonique distante contient un mapping disponible pour le manga 110
vers OriginManga (`656de8df-4b6c-483a-b1e0-4fe0aee8eafb`, confiance 1). Aucun
mapping AsuraScans n’est présent pour ce manga dans le résultat lu. Le sélecteur
Reader actuel ne consulte pas ces mappings : il résout ses alternatives par
recherche exacte du titre, à l’ouverture des réglages.

### READER_FAILURE_3_ROOT_CAUSE

Le mouvement souris déclenchait bien `pointermove` et faisait passer
`data-visible` à `true`. Le helper testait cependant l’opacité du bouton enfant,
qui reste `1` même lorsque le parent est encore à `opacity: 0` avec
`transform: translateY(-64px)`. L’assertion pouvait donc continuer pendant la
transition de 200 ms et lire une bounding box à `y = -54.5`.

Le helper attend maintenant atomiquement : `data-visible=true`, opacité du
chrome à 1, transform nul, bounding box dans le viewport, hauteur minimale et
`elementFromPoint` appartenant au contrôle. Aucun changement de l’auto-hide ou
du Reader produit.

### LOCAL_VS_PRODUCTION

Avant correction des tests, local et production reproduisaient les mêmes états
DOM/CSS et la même fixture périmée. Après correction : Reader 4/4 local et 4/4
production. La production a exposé un locator ambigu pendant l’état de
chargement (`Sources` et `Recherche des autres sources…`) ; le locator vise
désormais la légende exacte. Aucun écart fonctionnel produit restant observé.

### VALIDATION FINALE

```text
TYPESCRIPT: PASS
READER_E2E: 4/4 PASS (local) ; 4/4 PASS (production)
UNIT_TESTS: 74/74 PASS
T3013_E2E: 1/1 PASS
T3014_E2E: 1/1 PASS
BUILD: PASS (application et serveur)
LINT: PASS (0 erreur, 57 avertissements historiques)
MAC_ENVIRONMENT_READY: PASS
PROJECT_VALIDATED_ON_MAC: PASS
T3015: DO_NOT_START_YET
```

Fichiers modifiés par la migration/stabilisation :

- `server/src/lib/browser-pool.ts` : sélection de Chromium Playwright sur macOS ;
- `src/domain/followedChapterUpdates.ts` : conservation générique du sous-type ;
- `tests/e2e/reader-p1.spec.ts` : fixture réelle prévalidée et attente DOM/CSS atomique ;
- ce rapport.

Les 98 écarts de fins de ligne préexistants, les lockfiles, le commit local
`2aaeabf`, Supabase et les migrations n’ont pas été modifiés par cette
stabilisation. Les serveurs locaux de validation ont été arrêtés. Aucun travail
T3015 n’a commencé.
