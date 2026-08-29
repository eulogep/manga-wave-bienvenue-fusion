# MANGA WAVE V3 — T-3011 Homepage V2

Date: 2026-08-29  
Phase: P2 — Retention  
Ticket: T-3011 — Homepage Personalization

## STATUS

`IMPLEMENTED_VALIDATED_AND_DEPLOYED`

## SCOPE

T-3011 différencie désormais réellement l’accueil anonyme de l’accueil authentifié. Aucun travail T-3012, T-3013, Follow, Notifications ou Library V2 n’a été commencé.

## ANONYMOUS_HOMEPAGE

Ordre fonctionnel :

1. Hero éditorial ;
2. Tendances du moment ;
3. Dernières sorties ;
4. Populaires ;
5. Manga / Manhwa / Manhua avec filtre local ;
6. Découverte aléatoire déterministe, renouvelée chaque jour ;
7. hub multi-source existant ;
8. catalogue filtrable existant ;
9. territoires de lecture.

Le retrait de l’UX source-first reste explicitement réservé à T-3012.

## AUTHENTICATED_HOMEPAGE

Ordre fonctionnel :

1. Continuer la lecture, alimenté par la progression canonique P1 ;
2. Nouveaux chapitres — séries en cours récemment actualisées ;
3. Pour vous ;
4. Tendances ;
5. Récemment mis à jour ;
6. Genres favoris ;
7. Séries terminées.

L’état d’authentification affiche un écran de préparation bref afin d’éviter le flash de l’accueil anonyme pendant la restauration de session.

## PERSONALIZATION_MODEL

Fichier : `src/domain/homePersonalization.ts`.

- genres favoris calculés uniquement depuis les mangas réellement ajoutés aux favoris ;
- recommandations excluant les favoris déjà possédés ;
- score d’affinité basé sur le classement des genres favoris ;
- fallback populaire tant que l’utilisateur n’a pas encore de favoris ;
- tendances ordonnées par vues et note ;
- mises à jour ordonnées par `source_updated_at`, puis `created_at` ;
- séries terminées filtrées par statut ;
- découverte anonyme stable pendant une journée, sans randomisation à chaque render.

Toutes les fonctions sont pures et déterministes. Aucun historique personnel n’est envoyé aux providers.

## DATA

Aucune migration n’est nécessaire. T-3011 réutilise :

- `mangas` ;
- `user_favorites` avec RLS propriétaire ;
- `user_canonical_reading_progress` via Continue Reading ;
- le contexte Supabase Auth existant.

## LIMITS

La section « Nouveaux chapitres » utilise pour l’instant les séries `ongoing` les plus récemment synchronisées. La détection publication par publication, l’état lu/non lu et la priorité Follow appartiennent à T-3013/T-3014 et ne sont pas simulés ici.

## FILES

- `src/pages/Index.tsx` ;
- `src/components/HomeCatalogSections.tsx` ;
- `src/domain/homePersonalization.ts` ;
- `tests/homePersonalization.test.ts` ;
- `package.json`.

## TESTS_T3011

`PASS — 4/4`

- classement des genres favoris ;
- recommandations par affinité et exclusion des favoris ;
- groupes connecté : en cours, tendances, terminé ;
- groupes anonyme : dernières sorties, formats, découverte déterministe.

Commande : `npm.cmd run test:p2`.

## P1_REGRESSION

`PASS — 41/41`

Commande : `npm.cmd run test:p1`.

## TYPESCRIPT

`PASS`

Commande : `npx.cmd tsc -b --pretty false`.

## LINT

`PASS — 0 error`

57 avertissements Fast Refresh préexistants.

## BUILD

`PASS`

- client : `assets/index-KalYCWpQ.js`, 695.79 kB, gzip 203.62 kB ;
- CSS : `assets/index-BDFeSQq9.css` ;
- serveur TypeScript : PASS ;
- avertissement historique >500 kB non bloquant, inchangé en nature.

## QA

`AUTOMATED_PASS — INTERACTIVE_HOMEPAGE_QA_PENDING`

Le navigateur n’étant pas connecté à cette session, le rendu connecté/anonyme ne doit pas être déclaré visuellement approuvé à partir des tests seuls.

## DEPLOYMENT

`PASS`

- commit : `d674338 feat(p2): personalize homepage catalog` ;
- branche : `main` synchronisée avec `origin/main` ;
- JS production : `assets/index-DM_a-mq5.js` ;
- CSS production : `assets/index-BDFeSQq9.css`.

## NEXT

Après validation visuelle de T-3011, démarrer T-3012 — Remove Source-First UX. Ne pas commencer simultanément Updates, Follow ou Notifications.
