# MANGA WAVE V3 — T-3015 Notifications

## OVERALL_STATUS

`PASS`

L'implémentation, la migration Supabase, les validations locales, le push vers `origin/main`, le déploiement Vercel et le smoke T-3015 contre la production sont validés.

## NOTIFICATION_DATA_MODEL

`PASS`

La migration `20260908080000_add_canonical_notifications.sql` ajoute `user_notifications`. L'identité unique est `(user_id, canonical_manga_id, canonical_chapter_key, type)`. Le fournisseur et son identifiant de chapitre ne font pas partie de l'identité ni de la destination persistée.

## RLS

`PASS`

Les utilisateurs authentifiés peuvent sélectionner leurs propres lignes et modifier uniquement `is_read` et `read_at` sur leurs propres lignes. Aucun droit `INSERT` client n'est accordé. L'E2E réel a confirmé qu'un second compte ne voit pas les lignes du propriétaire et ne peut pas les modifier.

## EVENT_GENERATION

`PASS`

Un trigger sur l'insertion T-3013 dans `user_followed_chapter_state` crée la notification. Aucun second moteur de détection n'a été ajouté.

## FOLLOW_INTEGRATION

`PASS`

Le trigger vérifie explicitement la présence du Follow canonique avant toute création.

## FAVORITE_ONLY

`PASS`

Le scénario réel Favorite = true et Follow = false conserve zéro état T-3013 et zéro notification.

## BASELINE

`PASS`

Les lignes de baseline T-3013 portent un `read_at` non nul. Le trigger les ignore, ce qui empêche toute notification historique lors du premier Follow et du refollow.

## IDEMPOTENCY

`PASS`

La contrainte unique canonique et `ON CONFLICT DO NOTHING` empêchent les doublons. Trois observations successives de la même publication conservent exactement une notification.

## NOTIFICATION_CENTER

`PASS`

Le Header authentifié contient une cloche ouvrant une Sheet. Le centre couvre les états chargement, vide, erreur, non lu et lu, ainsi que l'action « Tout marquer comme lu ».

## UNREAD_BADGE

`PASS`

Le badge est calculé depuis les lignes Supabase chargées. Il est invalidé après la détection T-3013, après les mutations de lecture et au retour du Reader. Un polling React Query de 60 secondes et le refetch au focus assurent le rattrapage sans WebSocket supplémentaire.

## CLICK_TO_READER

`PASS_LOCAL_AND_PRODUCTION_E2E`

L'ouverture marque la notification comme lue immédiatement, demande le classement canonique existant, parcourt les sources éligibles dans cet ordre et ouvre la première source qui contient le même chapitre logique.

## READ_ACK

`PASS`

Politique retenue : ouvrir une notification la marque immédiatement comme lue. Une lecture réelle met aussi à jour `user_followed_chapter_state.read_at`; le trigger associé acquitte la notification correspondante.

## T3013_COHERENCE

`PASS`

Le Reader invalide les caches T-3013 et T-3015 après l'enregistrement de lecture. L'E2E confirme zéro état non lu des deux côtés après l'ouverture effective du chapitre.

## UNFOLLOW

`PASS`

L'unfollow supprime la baseline T-3013 et arrête les détections futures. Les notifications historiques restent attachées à l'utilisateur et au manga canonique, sans clé étrangère vers Follow.

## REFOLLOW

`PASS`

Le refollow reconstruit une baseline au catalogue courant sans notification rétroactive. Le chapitre logique suivant crée exactement un nouvel événement.

## LANGUAGE

`PASS`

Une seule notification est créée par chapitre canonique, quelle que soit la langue du fournisseur. La langue observée sert de préférence au résolveur Reader, qui conserve son fallback normal.

## MOBILE

`PASS_LOCAL_AND_PRODUCTION_E2E`

La Sheet occupe toute la hauteur et toute la largeur disponible sous 640 px. L'E2E en viewport 390 × 844 confirme l'absence de débordement horizontal et une cloche de 44 × 44 px minimum.

## ACCESSIBILITY

`PASS`

La cloche expose le nombre non lu dans son `aria-label`. La Sheet Radix gère focus et clavier. Chaque notification annonce explicitement « Lue » ou « Non lue » et cet état ne dépend donc pas uniquement de la couleur. Les actions tactiles principales mesurent au moins 44 px.

## E2E

`PASS_LOCAL_AND_PRODUCTION`

- T-3015 : 1/1 sans retry, cycle Favorite-only → Follow baseline → notification → Reader → lecture → unfollow → refollow → notification suivante.
- Production T-3015 : 1/1, zéro retry Playwright. Le parcours complet et le nettoyage QA passent avec une reprise limitée aux timeouts de transport Node et un plafond global de 180 secondes.
- Reader P1 : 4/4 sans retry.
- T-3013 déterministe : 1/1 sans retry.
- T-3014 Follow : 1/1 sans retry.

## SUPABASE_REAL_TEST

`PASS`

La migration additive a été appliquée au projet lié. `supabase db lint --linked` retourne « No schema errors found ». `supabase migration list --linked` montre `20260908080000` alignée local/distant. Les comptes Supabase temporaires ont couvert propriété, unicité, compte non lu, marquage lu et isolation RLS.

## QA_CLEANUP

`PASS`

Chaque scénario E2E supprime les utilisateurs temporaires. La suppression en cascade a été vérifiée sur `user_notifications`.

## REGRESSIONS

`PASS_LOCAL`

- P1 : 41/41.
- P2 : 9/9.
- T-3012 hotfix : 5/5.
- T-3013 : 7/7.
- T-3014 : 12/12.
- T-3015 : 12/12.
- Reader E2E : 4/4.
- T-3013 E2E : PASS.
- T-3014 E2E : PASS.

## TYPESCRIPT

`PASS`

`npx tsc --noEmit -p tsconfig.app.json` termine avec le code 0. Le build TypeScript du serveur termine aussi avec le code 0.

## ESLINT

`0 ERRORS`

57 avertissements Fast Refresh préexistants, aucune erreur.

## BUILD

`PASS`

Le build Vite de production et le build serveur passent. Vite signale uniquement la taille du bundle et une base Browserslist ancienne.

## DEPLOYMENT

`PASS`

La migration Supabase est déployée. `origin/main` pointe sur `c71e77f` et contient `2aaeabf`, `68c1290` et `c71e77f`. Le déploiement Vercel répond en HTTP 200 et le smoke T-3015 de production passe 1/1. Plusieurs essais préalables ont rencontré des timeouts TCP intermittents vers Cloudflare/Supabase à des étapes différentes; les traces confirmaient des réponses 200/201 sur les opérations produit. Le run final a conservé zéro retry Playwright et ajouté uniquement une reprise de transport Node hors dépôt.

## COMMITS

- `2aaeabf` — `docs: add portable Mac Codex handoff` — conservé intact.
- `68c1290` — `fix: stabilize macOS project validation`.
- `c71e77f` — `feat: add canonical in-app notifications`.
- Rapport T-3015 : conservé localement hors index, car l'autorisation de push portait exactement sur les trois commits ci-dessus.

Les fichiers dont la différence est uniquement liée aux fins de ligne restent hors index. `MANGA_WAVE_MAC_ENVIRONMENT_MIGRATION_REPORT.md` reste également non suivi.
