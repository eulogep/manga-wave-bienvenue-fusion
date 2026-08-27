# Intégration MangaDex

## Objectif

Manga Wave consomme désormais le catalogue public de MangaDex via une couche d’adaptation TypeScript, puis affiche une sélection de titres suivis disponibles en français. Cette intégration ne remplace pas Supabase : Supabase reste la source des données utilisateur, telles que l’authentification, les favoris, l’historique et la progression de lecture.

## Architecture

```text
Navigateur React
    │
    ├── développement : proxy Vite `/api/mangadex` et `/mangadex-covers`
    └── production : fonction Supabase `mangadex-proxy`
                              │
                         MangaDex API et CDN de couvertures
```

Les appels passent par un proxy parce que MangaDex ne fournit pas les en-têtes CORS nécessaires à une application tierce et demande également de ne pas lier directement ses images depuis un autre site. Le proxy transmet un `User-Agent` explicite, limite les routes accessibles à la recherche de mangas et aux couvertures, et met les réponses publiques en cache.

## Fichiers principaux

| Fichier | Responsabilité |
|---|---|
| `src/integrations/mangadex/client.ts` | Modèles typés, appels HTTP, gestion des erreurs et conversion du format MangaDex vers le modèle de l’interface. |
| `src/hooks/useMangaDex.ts` | Clés de cache et hooks TanStack Query pour les titres populaires, la recherche et le détail. |
| `supabase/functions/mangadex-proxy/index.ts` | Proxy de production sécurisé entre Manga Wave, l’API MangaDex et le CDN de couvertures. |
| `vite.config.ts` | Proxy local pour les requêtes de développement. |
| `src/components/FeaturedSection.tsx` | Affichage, filtrage local par genre/statut et pagination de la sélection MangaDex. |

## Déployer le proxy de production

Installer la CLI Supabase, s’authentifier avec un compte autorisé sur le projet puis exécuter les commandes suivantes depuis la racine du dépôt :

```bash
supabase functions deploy mangadex-proxy --project-ref yuebnijezlpyolmwfylx --no-verify-jwt
```

L’application utilise automatiquement l’URL de cette fonction en build de production. Pour utiliser un autre projet Supabase ou un autre proxy, définir les deux variables suivantes dans l’environnement de build :

```bash
VITE_MANGADEX_API_PROXY_URL=https://votre-projet.supabase.co/functions/v1/mangadex-proxy
VITE_MANGADEX_COVER_PROXY_URL=https://votre-projet.supabase.co/functions/v1/mangadex-proxy
```

## Limites de la première intégration

Cette tranche couvre l’adaptateur, le catalogue populaire, la recherche programmatiquement accessible via `useMangaDexSearch`, les couvertures et les filtres sur l’accueil. La navigation vers les chapitres et le lecteur intégré ne sont volontairement pas encore ajoutés.

L’étape suivante devra exposer le flux `/manga/:id/feed`, sélectionner une langue et un groupe de scanlation, puis demander un serveur MangaDex@Home juste avant le chargement des pages. Les URL d’images de chapitre étant temporaires, elles ne doivent jamais être mises en cache comme des URL permanentes.

## Références

[1]: https://api.mangadex.org/docs/2-limitations/ "MangaDex — Limitations and Requirements"
[2]: https://api.mangadex.org/docs/03-manga/ "MangaDex — Manga API"
[3]: https://api.mangadex.org/docs/04-chapter/search/ "MangaDex — Searching for Chapters"
