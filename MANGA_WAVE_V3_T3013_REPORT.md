# MANGA WAVE V3 — T-3013 Followed Manga Chapter Updates

## OVERALL_STATUS

`IMPLEMENTATION: PASS`  
`DATABASE_MIGRATION: PASS`  
`AUTHENTICATED_DATABASE_FLOW: PASS`  
`AUTOMATED_REGRESSION: PASS`  
`PRODUCTION_DEPLOYMENT: PASS`  
`INTERACTIVE_VISUAL_QA: BLOCKED — aucun navigateur attaché`

## PRODUCT_CONTRACT

Le flux livré est :

```text
manga favori
→ première observation = baseline
→ chapitre logique inconnu détecté
→ état non lu persistant
→ badge Homepage + Library
→ ouverture directe dans le Reader
→ lecture enregistrée
→ acquittement du chapitre exact
→ disparition de l'état nouveau
```

T-3013 ne crée aucune notification email, push ou système. Ces canaux restent hors périmètre T-3014.

## DETECTION_ARCHITECTURE

- `useFollowedChapterUpdates` charge les favoris canoniques de l'utilisateur.
- Les mappings disponibles sont récupérés depuis `manga_source_mappings`.
- Les sources sont ordonnées par langue utile : FR, multi, indéterminée, autres.
- Une source en échec laisse la place au mapping suivant.
- Les appels sont groupés par lots de quatre mangas afin de limiter la pression sur les extracteurs.
- Les vingt chapitres logiques les plus récents par favori sont comparés à l'état durable.
- La détection s'exécute au chargement, au retour de focus et toutes les cinq minutes pendant que l'application reste ouverte.

La détection est in-app. Manga Wave ne prétend pas détecter en arrière-plan lorsque l'application est fermée ; cela nécessiterait le travail planifié de T-3014.

## BASELINE

À la première observation d'un favori, les chapitres déjà présents sont insérés comme lus. Cela évite d'afficher rétroactivement tout le catalogue comme nouveau.

Lors d'une observation ultérieure :

- un chapitre logique déjà connu conserve son état ;
- un chapitre logique inconnu est inséré avec `read_at = null` ;
- les doublons provider d'un même numéro logique ne créent qu'une nouveauté.

## DATABASE_MODEL

Migration : `20260830090000_add_followed_chapter_updates.sql`.

Table : `user_followed_chapter_state`.

Clé primaire :

```text
(user_id, manga_id, canonical_chapter_key)
```

Champs principaux :

- manga canonique ;
- chapitre logique ;
- numéro et titre ;
- dernier mapping provider utilisable ;
- langue ;
- date de première détection ;
- date de lecture.

La clé étrangère composite référence `user_favorites(user_id, manga_id)` avec suppression en cascade. Retirer un favori supprime donc uniquement son état de nouveautés.

## SECURITY

- RLS activée.
- SELECT, INSERT, UPDATE et DELETE limités à `auth.uid() = user_id`.
- Aucun état utilisateur n'est exposé à `anon`.
- Le test d'intégration a utilisé une session utilisateur normale après création administrative temporaire.

## HOMEPAGE

La fausse section T-3011 basée sur les mangas `ongoing` récemment synchronisés est remplacée par `FollowedUpdatesSection`.

La section réelle affiche :

- nombre total de nouveaux chapitres ;
- cover et titre canonique ;
- compteur par manga ;
- numéro du chapitre et langue ;
- action `Lire maintenant` vers le Reader exact.

La section disparaît lorsqu'il n'existe aucune nouveauté non lue.

## LIBRARY

Les cartes de favoris peuvent afficher :

- badge `N nouveau(x)` ;
- bouton direct `Lire le chapitre N`.

Le manga reste le concept principal ; le provider n'est pas exposé dans la carte.

## DIRECT_READER_ENTRY

Le lien utilise `buildReaderLocation` avec :

- provider résolu ;
- ID manga provider ;
- ID chapitre provider ;
- langue ;
- page 0 ;
- titre et auteur comme fallback de persistance.

Le Reader P1 et ses routes ne sont pas réécrits.

## READ_ACKNOWLEDGEMENT

Après l'upsert de progression canonique :

- `canonical_manga_id` et `canonical_chapter_key` identifient exactement la nouveauté ;
- seule cette ligne est mise à jour avec `read_at` ;
- lire un ancien chapitre ne masque pas un chapitre plus récent ;
- `followed-chapter-updates` est invalidée avec les queries de progression et Homepage.

## DATABASE_INTEGRATION_TEST

Commande :

```text
npm.cmd run verify:t3013:db -- --allow-temporary-user
```

Résultat :

```text
favoriteCreated: true
unreadBeforeRead: 1
unreadAfterRead: 0
rlsUserScoped: true
temporaryUserDeleted: true
```

Le compte temporaire et toutes ses lignes dépendantes ont été supprimés après la validation.

## MIGRATION_STATUS

`npx.cmd supabase migration list --linked` confirme :

```text
local  20260830090000
remote 20260830090000
```

## TESTS

`npm.cmd run test:t3013` → `6/6 PASS`.

Cas couverts :

1. baseline initiale sans faux positif ;
2. nouveau chapitre après baseline ;
3. déduplication logique multi-provider ;
4. disparition après lecture exacte ;
5. route Reader directe ;
6. câblage Homepage, Library, progression et invalidation.

## REGRESSIONS

- P1 : `41/41 PASS`
- T-3011 : `4/4 PASS`
- P2 agrégé avant T-3013 : `9/9 PASS`
- T-3012 : `5/5 PASS`
- T-3012 functional hotfix : `5/5 PASS`

## TYPESCRIPT

`npx.cmd tsc --noEmit` → `PASS`.

## LINT

`npm.cmd run lint -- --quiet` → `0 ERROR — PASS`.

## BUILD

`npm.cmd run build` → `PASS`.

- JS local : `dist/assets/index-DTG6r2tJ.js`, 696.98 kB, gzip 204.32 kB.
- CSS local : `dist/assets/index-CFirfyMG.css`, 88.55 kB, gzip 16.31 kB.
- L'avertissement historique >500 kB reste non bloquant.

## DEPLOYMENT

- Production : https://manga-wave-bienvenue-fusion.vercel.app/
- Bundle avant : `assets/index-BO71GtB8.js`
- Bundle T-3013 : `assets/index-DCEcEL7n.js`
- Section `Nouveaux chapitres` présente : PASS
- Détection présente : PASS
- Query `followed-chapter-updates` présente : PASS
- Acquittement Reader présent : PASS
- Action `Lire maintenant` présente : PASS

## VISUAL_QA

`BLOCKED` : la liste des navigateurs intégrés disponibles est vide.

Le bundle, le modèle, les tests et l'intégration Supabase sont validés, mais aucun PASS visuel desktop/mobile n'est revendiqué dans ce rapport.

## COMMITS

- `312a87a feat: detect unread chapters for followed manga`
- Le présent rapport est livré dans le commit de documentation suivant.

## ACCEPTANCE

- `FOLLOWED_MANGA_DETECTION: PASS`
- `FIRST_OBSERVATION_BASELINE: PASS`
- `CANONICAL_CHAPTER_DEDUP: PASS`
- `NEW_BADGE_HOMEPAGE: PASS`
- `NEW_BADGE_LIBRARY: PASS`
- `DIRECT_NEW_CHAPTER_ENTRY: PASS`
- `READ_ACKNOWLEDGEMENT: PASS`
- `NEW_STATE_DISAPPEARS: PASS`
- `RLS: PASS`
- `DATABASE_INTEGRATION: PASS`
- `P1_REGRESSION: 41/41 PASS`
- `T3011_REGRESSION: 4/4 PASS`
- `T3012_REGRESSION: PASS`
- `TYPESCRIPT: PASS`
- `LINT: 0 ERRORS`
- `BUILD: PASS`
- `VISUAL_QA: BLOCKED`
- `T3014_NOT_STARTED: TRUE`
