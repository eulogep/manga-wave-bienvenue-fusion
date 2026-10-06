# Synchronisation du catalogue — guide d’exploitation

Document vérifié contre le code local le 6 octobre 2026. Il décrit le comportement
implémenté ; il ne certifie pas l’état du déploiement ou de la base distante.

## Deux circuits complémentaires

| Circuit | Entrée et destination | Planification versionnée |
|---|---|---|
| `catalog-sync` | API MangaDex → `public.mangas` | `mangadex-catalog-daily`, `17 3 * * *` : 03:17 UTC chaque jour |
| `source-sync` | File `pgmq` → extracteurs Vercel → RPC `upsert_source_catalog` | `manga-wave-source-sync`, `*/5 * * * *` : toutes les cinq minutes, lot de deux messages |

Les définitions sont dans [catalog-sync](../supabase/functions/catalog-sync/index.ts),
[source-sync](../supabase/functions/source-sync/index.ts), le
[schedule MangaDex](../supabase/schedules/daily_mangadex_catalog_sync.sql) et la
[migration du cron multi-source](../supabase/migrations/20260828220000_schedule_source_sync.sql).
Un fichier versionné ne prouve pas que le job est actif à distance.

## MangaDex : rafraîchissement sans remplacement

`catalog-sync` effectue un appel groupé pour au plus 100 mangas, triés par nombre
de suivis, disposant d’une traduction française et classés `safe` ou `suggestive`.
Il ne parcourt pas tout le catalogue et ne supprime pas les titres absents de la réponse.
Les couvertures enregistrées passent par `mangadex-proxy`.

Pour une identité `mangadex_id` existante, il actualise le titre, les auteurs,
la description, la couverture, le statut, les genres, la classification et les dates
`source_updated_at` / `last_synced_at`. Il conserve le type canonique `manga_type`,
les alias et la provenance de l’enrichissement. Pour une nouvelle identité, le type
est déduit de la langue d’origine ; un conflit concurrent est ignoré pour préserver
la ligne déjà créée.

Les écritures sont séquentielles, sans transaction globale : une erreur peut laisser
un lot partiellement actualisé. La réponse `200` contient `synced` (nombre de lignes
exploitables traitées, pas nécessairement de nouvelles insertions) et `synced_at`.

## File multi-source et délais réels

Sources admises : `mangadex`, `comick`, `originmanga`, `crunchyscan`, `mangafire`,
`asurascans`, `mangapill`, `sushiscan`, `mangakatana`. Cette liste ne garantit pas
la disponibilité des fournisseurs. WeebCentral est absent de la liste admise.

Chaque message lance la première page de `/api/extract/popular/{source}?page=1`
sur `https://manga-wave-bienvenue-fusion.vercel.app`, puis la RPC de persistance.
Même exécutée localement, cette Edge Function utilise actuellement cet extracteur
de production : elle ne constitue pas un test local isolé.

- Le lot vaut deux par défaut, trois au maximum dans la fonction ; le cron en demande deux.
- Les messages lus sont invisibles pendant 150 secondes. L’extraction a un délai maximal de 65 secondes.
- Après succès, le message est supprimé et un nouveau est créé avec un délai de 900 secondes.
- Aux deux premiers échecs, le message reste en file et redevient visible après son délai de visibilité.
- À partir de la troisième lecture en échec, il est archivé puis remplacé par un message différé de 1 800 secondes.
- Une source inconnue est archivée. L’actualisation de `source_health` est secondaire et ne bloque pas volontairement la file.

**Quinze minutes est un délai minimal avant éligibilité, pas une fréquence garantie
par source.** Le cron peut prendre au plus 24 messages par heure avec son lot actuel,
si toutes les invocations aboutissent. La concurrence entre sources, les erreurs et
les doublons peuvent allonger l’attente. Ne pas réinjecter des seeds à chaque retard :
chaque injection crée une nouvelle chaîne de messages.

La réponse HTTP `200` du worker peut contenir des résultats `failed` ou `archived`.
Contrôler `results`, les runs et la file. Certaines erreurs renvoyées par les RPC
secondaires de clôture/ré-enqueue ne sont actuellement pas vérifiées par le worker :
un résultat `succeeded` seul ne prouve donc pas que la continuation est en place.

## Authentification et secrets

Les deux fonctions ont des contrats différents dans [config.toml](../supabase/config.toml).

| Fonction | Appel autorisé par le code actuel | Vérification de passerelle |
|---|---|---|
| `catalog-sync` | `POST` à la racine, JWT serveur `service_role` dans `Authorization: Bearer …` | `verify_jwt = true` |
| `source-sync` | `POST`, JWT serveur `service_role` dans `Authorization: Bearer …` | `verify_jwt = true`, à conserver |

Les deux fonctions vérifient que le JWT annonce le rôle `service_role`, mais la
signature est validée par la passerelle Supabase. **Ne déployer aucune des deux avec
`--no-verify-jwt`.** Une clé opaque `sb_secret_…` n’est pas interchangeable avec
le JWT attendu par ce contrat. Voir les [contrats d’authentification Supabase](https://supabase.com/docs/guides/functions/auth).

Vault contient les noms suivants ; ne jamais afficher leurs valeurs dans les rapports :

| Nom | Usage |
|---|---|
| `source_sync_service_role_key` | JWT serveur partagé par les deux crons internes |

Aucune clé administrative dans le navigateur, les variables `VITE_*`, les fixtures,
les fichiers versionnés ou les journaux. Le frontend utilise sa clé publique et les
politiques RLS. La planification utilise `pg_cron`, `pg_net` et Vault, conformément au
[guide Supabase](https://supabase.com/docs/guides/functions/schedule-functions).

## Ordre de publication d’une nouvelle source

1. Vérifier le diff ciblé, les tests et le projet Supabase lié (`ilmsomiaqthhfyvgqnsp`).
2. Publier l’extracteur Vercel et vérifier sa réponse réelle depuis la production.
3. Déployer `source-sync` avec la source admise et `verify_jwt = true`.
4. Comparer les migrations locales/distantes ; appliquer uniquement le seed prévu s’il est encore absent.
5. Vérifier un run réussi, les identités canoniques et mappings persistés, puis le message de continuation.

Pour MangaKatana, le seed concerné est
[`20260916090000_seed_mangakatana_sync_job.sql`](../supabase/migrations/20260916090000_seed_mangakatana_sync_job.sql).
Il ajoute un message, sans modifier le schéma. Il n’est **pas idempotent** si son SQL
est rejoué manuellement. L’appliquer avant la fonction qui accepte la source conduit
à l’archivage du message comme source inconnue.

Pour MangaDex, le schedule quotidien est un script séparé des migrations. Vérifier
les secrets attendus avant son application. Toute application distante doit rester
ciblée ; aucun reset de base, rejeu de tous les seeds ou nettoyage global de la file.

## Contrôles en lecture seule

À exécuter avec un accès administratif autorisé au projet ciblé. Les requêtes ne
lisent pas les valeurs Vault et ne modifient pas la visibilité des messages.

```sql
-- Présence et activation des deux crons ; ne pas exporter leur commande complète.
select jobname, schedule, active
from cron.job
where jobname in ('mangadex-catalog-daily', 'manga-wave-source-sync');

-- Dernier run de chaque source : une vieille réussite ne prouve pas sa fraîcheur.
select distinct on (source_id)
  source_id, status, attempt, items_synced, started_at, finished_at
from public.source_sync_runs
order by source_id, started_at desc, id desc;

-- Messages éligibles et messages différés/en cours : plusieurs par source
-- appellent un diagnostic, pas une suppression automatique.
select message->>'source' as source_id,
  count(*) as total,
  count(*) filter (where vt <= now()) as eligible,
  count(*) filter (where vt > now()) as invisible,
  min(enqueued_at) as oldest_enqueued_at,
  min(vt) as earliest_visibility
from pgmq.q_source_sync
group by message->>'source'
order by source_id;

-- Fraîcheur MangaDex ; le catalogue entier n'est pas rafraîchi à chaque passage.
select count(*) as total, max(last_synced_at) as latest_sync,
  count(*) filter (where last_synced_at >= now() - interval '26 hours') as recent
from public.mangas
where mangadex_id is not null;

-- Aucun résultat attendu si l'unicité est respectée.
select mangadex_id, count(*)
from public.mangas
where mangadex_id is not null
group by mangadex_id
having count(*) > 1;
```

Ne pas utiliser `dequeue_source_sync` pour observer la file : il modifie la visibilité
et le compteur de lectures. Un cron ayant envoyé une requête HTTP avec succès ne
prouve pas la réussite de la fonction ; vérifier aussi la réponse et les données.

## Diagnostic et critères de clôture

| Observation | Contrôle suivant |
|---|---|
| `catalog-sync` : `401` | Présence du JWT `service_role` dans `Authorization` et `verify_jwt = true` ; ne pas imprimer la clé |
| `catalog-sync` : `503` | Présence des variables administratives attendues |
| `catalog-sync` : `500` | Lecture/écriture DB et éventuel lot partiel |
| `catalog-sync` : `502` | Réponse MangaDex, données exploitables ; un `429` amont est encapsulé en `502` |
| Worker : `200` mais données absentes | Statut de chaque résultat, run, identité canonique et mapping |
| Source en retard | Cron actif, messages éligibles, tentatives, doublons et capacité du lot |
| Run `running` ancien | Interruption/timeout possible ; comparer avec le message et les logs |
| Source archivée | Liste admise et ordre de publication ; ne pas rejouer le seed sans diagnostic |

MangaDex n’effectue pas de retry interne. Les sources suivent les délais ci-dessus ;
ne pas multiplier les appels manuels sur un `403` ou `429`.

La clôture production exige une preuve datée de chaque étape : version déployée,
alignement des migrations concernées, cron actif, run réussi, données/mappings
persistés, conservation de l’enrichissement et continuation de la file. Une validation
locale doit être rapportée séparément. Les anciens rapports restent des preuves
datées, pas un statut de disponibilité actuel.

## Validation locale du 6 octobre 2026

- Tests ciblés métadonnées, seeds multi-source et classification : **53/53 PASS**.
- TypeScript application et serveur : **PASS**.
- Build Vite : **PASS**.
- Lint : **PASS**, zéro erreur et 61 avertissements à traiter séparément.
- État distant, migrations appliquées et smoke production : voir la validation ci-dessous.

## Validation production du 6 octobre 2026

- `origin/main` et le déploiement Vercel du commit `189e436` : **PASS**, déploiement `READY`.
- Migration `20260916090000_seed_mangakatana_sync_job` : **DÉJÀ APPLIQUÉE**, aucun rejeu.
- Extracteur MangaKatana : **PASS**, 20 résultats ; dernier run observé : 20 éléments synchronisés.
- Edge Function `catalog-sync` : **PASS**, version 7 active avec `verify_jwt = true`.
- Cron `mangadex-catalog-daily` : **PASS**, actif à `17 3 * * *` avec le JWT Vault existant.
- Smoke réel `catalog-sync` : **PASS**, HTTP 200 et 100 titres synchronisés à `2026-10-06T18:13:24.998Z`.
- Conservation du type canonique, des alias, du pays et de la provenance enrichie sur l’échantillon contrôlé : **PASS**.
- File multi-source : opérationnelle, avec plusieurs messages historiques pour certaines sources ; aucun nettoyage destructif effectué.
