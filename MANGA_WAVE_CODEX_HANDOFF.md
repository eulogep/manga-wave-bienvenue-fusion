# Manga Wave — Codex handoff courant

Dernière actualisation : **2026-09-04**

Dernier état fonctionnel vérifié : **T-3014, le 2026-08-30**

Branche de référence : **`main`**

Dernier commit fonctionnel avant ce kit de migration : **`a22bbaa`**

État Git : **propre, `main` alignée avec `origin/main`**

Ce fichier est la source de reprise prioritaire pour un nouvel agent. Les anciens rapports détaillés restent utiles comme preuves, mais leurs sections « prochaine étape » peuvent être historiques.

## 1. Mission produit

Manga Wave est une plateforme manga/manhwa française, multi-source et centrée sur la continuité de lecture.

Objectifs invariants :

1. Découvrir un titre sans devoir choisir d’abord un fournisseur.
2. Représenter une œuvre par un manga canonique unique.
3. Résoudre automatiquement la meilleure source lisible.
4. Ouvrir un Reader autonome et reprendre à la page exacte.
5. Basculer de source si le chapitre actif est indisponible.
6. Séparer clairement :
   - Favori : conserver dans la bibliothèque ;
   - Suivi : surveiller les nouveaux chapitres.
7. Détecter les nouveaux chapitres suivis, les ouvrir directement et effacer l’état « nouveau » après lecture.

## 2. Production et dépôt

- Production : <https://manga-wave-bienvenue-fusion.vercel.app/>
- Dépôt : <https://github.com/eulogep/manga-wave-bienvenue-fusion.git>
- Branche de déploiement : `main`
- Ancien workspace Windows : `D:\PLATEFORME MANGA`
- Projet Supabase : `ilmsomiaqthhfyvgqnsp`
- Build Vercel : `npm run build`
- Sortie Vite : `dist`
- Dernier bundle fonctionnel T-3014 vérifié : `assets/index-BAGTvmzG.js`

Sur Mac, ne réutilise pas le chemin Windows. Travaille dans le dossier retourné par `pwd` après le clone.

## 3. Stack technique

- React 18 + TypeScript
- Vite 8 + SWC
- React Router 7
- TanStack Query 5
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase Auth/Postgres/RLS/Edge Functions
- Vercel serverless extraction via `api/extract.ts`
- Backend extracteur local dans `server/`
- Playwright pour les smokes Reader/T-3013/T-3014
- Sources lisibles : MangaDex, OriginManga, Comick, CrunchyScan/LelManga, MangaFire, AsuraScans
- Sources catalogue supplémentaires : AniList, Jikan, Kitsu, Shikimori

## 4. Routes principales

| Route | Rôle |
| --- | --- |
| `/` | Homepage éditoriale et personnalisée |
| `/auth` | Connexion/inscription |
| `/search` | Recherche canonique multi-source |
| `/manga/:id` | Manga Detail canonique |
| `/manga/:providerId?source=:source` | Vue directe d’une source, résolue vers l’identité canonique |
| `/read/:source/:mangaId/:chapterId` | Reader autonome |
| `/library` | Favoris et historique |

## 5. État des lots

```text
P0_READING_FOUNDATION = APPROVED
VISUAL_REFACTOR = APPROVED
RESPONSIVE_READER = APPROVED
P1_CANONICAL_MULTI_SOURCE = APPROVED
P1_PRODUCTION_SMOKE = PASS
T3011_HOMEPAGE_V2 = APPROVED
T3012_REMOVE_SOURCE_FIRST_UX = APPROVED
T3013_NEW_CHAPTER_DETECTION = PASS
T3013_DETERMINISTIC_SMOKE_FIXTURE = PASS
T3014_FOLLOW = PASS
T3015 = NOT_STARTED
CRITICAL = 0
HIGH = 0
```

Dernière fonctionnalité terminée : **T-3014 — Follow canonique**.

## 6. Architecture canonique

`public.mangas` est la table d’œuvre canonique et ne doit pas être remplacée sans migration explicite de toutes les clés étrangères.

`public.manga_source_mappings` rattache une identité fournisseur à une œuvre canonique.

Contraintes essentielles :

- une identité externe `(source_id, source_manga_id)` ne mappe qu’une fois ;
- au plus un mapping par fournisseur et manga canonique ;
- la similarité floue ne déclenche jamais une fusion destructive ;
- les correspondances sûres reposent sur titre normalisé exact ou alias déclaré.

Fichiers :

- `src/domain/canonicalManga.ts`
- `src/domain/canonicalDetailResolution.ts`
- `src/hooks/useCanonicalMangaEntry.ts`
- `src/hooks/useSourceResolution.ts`
- `supabase/migrations/20260829040000_stabilize_canonical_manga.sql`
- `supabase/migrations/20260829050000_add_source_resolution_ranking.sql`

## 7. Résolution de source et fallback

La résolution classe les sources selon disponibilité, circuit, langue, couverture de chapitres, latence, qualité d’image, erreurs et fraîcheur.

Le fallback Reader :

- exige le même chapitre logique ;
- exclut la source courante et les sources déjà essayées ;
- conserve langue et page ;
- utilise `replace` pour le fallback automatique ;
- s’arrête après trois sources ;
- conserve toujours Retry et le sélecteur manuel.

Fichiers :

- `src/domain/sourceResolution.ts`
- `src/domain/automaticFallback.ts`
- `src/domain/chapterMatching.ts`
- `src/hooks/useMangaReader.ts`
- `src/components/UniversalReader.tsx`
- `src/pages/Reader.tsx`

## 8. Reader — invariants stricts

Route canonique :

```text
/read/:source/:mangaId/:chapterId?lang=<lang>&page=<index-zero-based>
```

Ne jamais casser :

- absence de Header/Footer dans le Reader autonome ;
- index de page commençant à zéro dans URL, état et progression ;
- six modes exacts : `vertical`, `webtoon`, `single_page`, `double_page`, `manga_rtl`, `comic_ltr` ;
- reprise exacte du chapitre et de la page ;
- changement de chapitre sans quitter le Reader ;
- réglages persistants ;
- source manuelle dans Settings ;
- fallback automatique limité et sans boucle ;
- cadrage défensif des images multi-source.

## 9. Progression canonique

La progression authentifiée est stockée dans `user_canonical_reading_progress`. La progression locale reste disponible pour les utilisateurs anonymes.

Le changement de fournisseur ne doit pas créer deux positions pour la même œuvre canonique.

Fichiers :

- `src/domain/canonicalProgress.ts`
- `src/hooks/useReadingProgress.ts`
- `src/components/ContinueReadingSection.tsx`
- migration `20260829060000_add_canonical_reading_progress.sql`

## 10. T-3013 — nouveaux chapitres

Le moteur surveille maintenant les mangas **suivis**, pas tous les favoris.

Flux :

```text
Follow
-> première synchronisation = baseline lue
-> publication ultérieure = unread 1
-> Homepage/Bibliothèque montrent la nouveauté
-> ouverture directe du Reader
-> progression Reader acquitte le chapitre
-> unread 0
```

Table : `user_followed_chapter_state`.

Fichiers :

- `src/domain/followedChapterUpdates.ts`
- `src/hooks/useFollowedChapterUpdates.ts`
- `src/components/FollowedUpdatesSection.tsx`
- `tests/e2e/t3013-deterministic-smoke.spec.ts`
- migration `20260830090000_add_followed_chapter_updates.sql`

## 11. T-3014 — Follow canonique

Table : `public.user_follows`.

Identité :

```text
UNIQUE(user_id, canonical_manga_id)
```

Comportement final :

| État | Bibliothèque | Surveillance |
| --- | --- | --- |
| Favori seul | Oui | Non |
| Follow seul | Non | Oui |
| Favori + Follow | Oui | Oui |
| Aucun | Non | Non |

Décisions :

- migration unique des anciens favoris vers Follow pour ne pas couper T-3013 ;
- les nouveaux favoris ne créent pas automatiquement de Follow ;
- Unfollow supprime l’état de détection par cascade ;
- Unfollow ne supprime jamais l’historique ou la progression ;
- Refollow établit une nouvelle baseline sans notification rétroactive ;
- UI principale `Suivre / Suivi` sur Manga Detail ;
- indication légère `Suivi` dans la Bibliothèque ;
- mutation optimiste avec rollback si Supabase échoue ;
- aucune identité fournisseur dans Follow.

Fichiers :

- `src/domain/canonicalFollow.ts`
- `src/hooks/useFollows.ts`
- `src/pages/MangaDetail.tsx`
- `src/pages/Library.tsx`
- `tests/t3014Follow.test.ts`
- `tests/e2e/t3014-follow.spec.ts`
- `scripts/verify-t3014-db.mjs`
- migration `20260830130000_add_canonical_follows.sql`

Rapport de référence : `MANGA_WAVE_V3_T3014_REPORT.md`.

## 12. Migrations Supabase récentes

Les migrations sont forward-only. Ne jamais éditer ni supprimer une migration déjà appliquée.

```text
20260829010000 reader preferences
20260829020000 universal reading progress
20260829030000 Reader fit-width default
20260829040000 canonical manga stabilization
20260829050000 source resolution ranking
20260829060000 canonical reading progress
20260830090000 followed chapter updates
20260830130000 canonical user follows
```

Au dernier contrôle, `20260830130000` était alignée local/distant.

## 13. Variables d’environnement

Les variables publiques sont décrites dans `.env.example`.

Variables nécessaires au client :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_MANGADEX_API_PROXY_URL
VITE_MANGADEX_COVER_PROXY_URL
VITE_MANGADEX_PROXY_PUBLISHABLE_KEY
VITE_MANGA_PROXY_URL
```

Les validations DB temporaires nécessitent localement une clé service dans `.env` :

```text
API_KEY_SERVICE_SUPABASE
# ou API_KEY_SECRET_SUPABASE
```

Règles :

- ne jamais committer `.env` ;
- ne jamais mettre une clé service dans une variable `VITE_*` ;
- transférer les secrets vers le Mac par un canal chiffré ;
- ne jamais afficher les valeurs dans un prompt ou un log ;
- `.env` est ignoré par Git.

## 14. Validation actuelle

Dernière validation complète enregistrée :

```text
P1 = 41/41 PASS
P2 aggregate = 9/9 PASS
T3012 hotfix = 5/5 PASS
T3013 = 7/7 PASS
T3014 = 12/12 PASS
T3013 production E2E = 1/1 PASS
T3014 production E2E = 1/1 PASS
Supabase T3014 real test = PASS
TypeScript = PASS
ESLint = 0 errors
Build = PASS
```

Les comptes QA temporaires ont été supprimés après les tests.

## 15. Commandes de validation

Depuis la racine du dépôt :

```bash
npm ci
npm run test:p1
npm run test:p2
npm run test:t3012:hotfix
npm run test:t3013
npm run test:t3014
npx tsc --noEmit
npm run lint -- --quiet
npm run build
```

Smokes nécessitant Chromium, réseau et environnement Supabase :

```bash
npx playwright install chromium
npm run test:e2e:reader
npm run test:e2e:t3013
npm run test:e2e:t3014
```

Validation DB destructive uniquement pour des comptes temporaires explicitement autorisés :

```bash
npm run verify:t3014:db -- --allow-temporary-users
```

Alignement Supabase :

```bash
npx supabase login
npx supabase link --project-ref ilmsomiaqthhfyvgqnsp
npx supabase migration list --linked
```

Développement local :

```bash
npm run dev:full
```

Vite : `http://localhost:8080`

Extracteur : `http://localhost:3001`

## 16. Derniers commits importants

```text
a22bbaa docs: record T-3014 follow delivery
8a80fa1 fix: always roll back failed follow updates
bbe56a7 feat: add canonical manga follows
5d845fa test: add deterministic T-3013 smoke fixture
e10b6d7 docs: record T-3013 deployment
312a87a feat: detect unread chapters for followed manga
656c7ea docs: record T-3012 functional hotfix
8c11e80 fix: resolve canonical detail and persist reading progress
```

## 17. Limitations et dette connue

- Bundle JavaScript supérieur à 500 kB : dette connue, non bloquante pour les tickets précédents.
- Les fournisseurs externes peuvent être instables ; utiliser les fixtures déterministes avant de conclure à une régression produit.
- Le navigateur interactif intégré n’était pas disponible lors de la dernière session, mais les smokes Chromium Playwright de production ont passé.
- T-3015 n’a aucun cahier des charges détaillé versionné à ce jour.
- Aucun push, email, SMS, permission Web Push ou service worker de notification n’a été implémenté.

## 18. Contraintes « do not break »

1. Ne pas recréer une UX source-first.
2. Ne pas dupliquer une œuvre par fournisseur.
3. Ne pas fusionner automatiquement sur simple similarité floue.
4. Ne pas remettre Header/Footer dans le Reader.
5. Ne pas changer les six valeurs de mode Reader.
6. Ne pas changer l’index de page zero-based.
7. Ne pas supprimer progression/historique lors d’un unfollow.
8. Ne pas rendre Favori et Follow définitivement identiques.
9. Ne pas surveiller tous les favoris : T-3013 doit lire `user_follows`.
10. Ne pas créer de Follow fournisseur.
11. Ne pas contourner RLS depuis le client.
12. Ne jamais exposer de clé service dans le bundle.
13. Ne pas éditer une migration Supabase déjà appliquée.
14. Ne pas démarrer T-3015 sans brief explicite ou validation utilisateur.
15. Ne pas pousser ou déployer des modifications non demandées après une simple reprise de contexte.

## 19. Prochaine étape exacte

Sur le nouveau Mac :

1. Cloner le dépôt et vérifier `main`/`origin/main`.
2. Restaurer les variables d’environnement sans les committer.
3. Installer les dépendances et Chromium.
4. Exécuter les tests locaux non destructifs.
5. Lire `MANGA_WAVE_V3_T3014_REPORT.md`.
6. Confirmer que T-3014 est le dernier ticket terminé.
7. Attendre ou demander le brief exact de **T-3015** avant toute implémentation.

Le prochain domaine logique est la transformation du signal canonique `user_follows` en notifications sortantes. Cependant les canaux, permissions, fréquence, préférences, idempotence et stratégie d’envoi ne sont pas encore spécifiés. Ne pas les inventer.

## 20. Rollback

Application : utiliser `git revert`, jamais `git reset --hard` sur `main` partagé.

```bash
git revert <commit>
npm run test:p1
npm run test:p2
npm run test:t3013
npm run test:t3014
npm run build
git push origin main
```

Pour T-3014, l’ordre de revert applicatif est du plus récent au plus ancien :

```text
8a80fa1
bbe56a7
```

Attention : la migration Supabase T-3014 est déjà appliquée. Ne pas la supprimer. Si une correction DB est nécessaire, créer une nouvelle migration forward-only. Le schéma additif peut rester présent même si le frontend est temporairement reverté.

## 21. Règle de reprise pour le prochain agent

Avant toute modification :

```bash
pwd
git status --short
git branch --show-current
git log -5 --oneline --decorate
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

Si le dépôt local diverge du remote, ne jamais écraser les changements. Expliquer la divergence et préserver le travail existant.

Après lecture de ce fichier, répondre d’abord avec :

```text
CONTEXTE_RESTAURE
HEAD_LOCAL=<sha>
HEAD_REMOTE=<sha>
WORKTREE=<clean|dirty>
LAST_COMPLETED=T-3014
NEXT=T-3015_NOT_SPECIFIED
```
