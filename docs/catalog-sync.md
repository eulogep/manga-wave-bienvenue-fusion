# Synchronisation quotidienne du catalogue MangaDex

## Finalité

La fonction `catalog-sync` remplace le catalogue local par un **upsert** des 100 mangas les plus suivis disposant d’une traduction française. Elle effectue un unique appel groupé à MangaDex par exécution, convertit les métadonnées en lignes `public.mangas`, puis enregistre la date de synchronisation.

Cette exécution réduite est volontaire. MangaDex exige un proxy pour les appels et les images d’une application tierce, impose un `User-Agent` explicite et limite globalement l’API à environ cinq requêtes par seconde et par adresse IP. [1]

## Sécurité

La fonction n’accepte que les requêtes `POST` portant une **clé Supabase Secret** dans l’en-tête `apikey`. Cette clé est disponible pour la fonction dans son environnement hébergé et permet l’upsert administratif malgré la politique RLS qui interdit les écritures de catalogue depuis le navigateur. Elle ne doit jamais être ajoutée aux variables `VITE_*`, à Vercel, aux fichiers `.env` versionnés ni aux journaux applicatifs. [2]

Le navigateur continue d’utiliser uniquement la clé **Publishable** pour lire le catalogue et appeler le proxy MangaDex. Les droits personnels restent filtrés par les politiques RLS existantes.

## Déploiement

Après publication des sources, déployer `catalog-sync` depuis l’interface Supabase ou avec une CLI authentifiée :

```bash
supabase functions deploy catalog-sync --project-ref ilmsomiaqthhfyvgqnsp --no-verify-jwt
```

Une fois la fonction déployée, créer dans **Vault** les secrets suivants :

| Nom Vault | Valeur |
|---|---|
| `catalog_sync_project_url` | `https://ilmsomiaqthhfyvgqnsp.supabase.co` |
| `catalog_sync_secret_key` | Une clé Supabase **Secret** active du projet Manga wave |

Ensuite, exécuter `supabase/schedules/daily_mangadex_catalog_sync.sql`. Le job `mangadex-catalog-daily` s’exécute à **03:17 UTC** une fois par jour. Il utilise `pg_cron` et `pg_net`; les secrets sont lus depuis Vault au moment de l’appel. [3]

> Ne créez jamais le secret en clair dans la migration, le seed, la fonction ou un fichier versionné.

## Contrôles opérationnels

Le résultat de la fonction est un JSON contenant `synced` et `synced_at`. Après le premier lancement, contrôler que `mangas.mangadex_id` reste unique et que `last_synced_at` est récent. En cas d’erreur 429 ou 502, laisser l’exécution suivante reprendre automatiquement : la fonction n’effectue qu’un appel amont et ne multiplie pas les tentatives.

## Références

[1]: https://api.mangadex.org/docs/2-limitations/ "MangaDex — Limitations and Requirements"
[2]: https://supabase.com/docs/guides/functions/secrets "Supabase — Environment Variables"
[3]: https://supabase.com/docs/guides/functions/schedule-functions "Supabase — Scheduling Edge Functions"
