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
| `src/hooks/useMangaDex.ts` | Clés de cache et hooks TanStack Query pour les titres populaires, la recherche, le détail et les chapitres. |
| `supabase/functions/mangadex-proxy/index.ts` | Proxy de production sécurisé entre Manga Wave, l’API MangaDex et le CDN de couvertures. |
| `vite.config.ts` | Proxy local pour les requêtes de développement. |
| `src/components/FeaturedSection.tsx` | Affichage, filtrage local par genre/statut et pagination de la sélection MangaDex. |
| `src/pages/Search.tsx` | Recherche avancée par titre et statut, avec URL partageable et pagination. |
| `src/pages/MangaDetail.tsx` | Fiche détaillée, crédits de scanlation, choix de langue et pagination des chapitres. |

## Déployer le proxy de production

Installer la CLI Supabase, s’authentifier avec un compte autorisé sur le projet puis exécuter les commandes suivantes depuis la racine du dépôt :

```bash
supabase functions deploy mangadex-proxy --project-ref ilmsomiaqthhfyvgqnsp --no-verify-jwt
```

L’application utilise automatiquement l’URL de cette fonction en build de production. Le nouveau projet Manga Wave conserve l’authentification et les favoris sur le projet Supabase existant ; seule l’intégration MangaDex pointe vers ce proxy dédié. La passerelle Supabase requiert une clé **Publishable** dans les appels HTTP. Pour utiliser un autre projet Supabase ou un autre proxy, définir les variables suivantes dans l’environnement de build :

```bash
VITE_MANGADEX_API_PROXY_URL=https://votre-projet.supabase.co/functions/v1/mangadex-proxy
VITE_MANGADEX_COVER_PROXY_URL=https://votre-projet.supabase.co/functions/v1/mangadex-proxy
VITE_MANGADEX_PROXY_PUBLISHABLE_KEY=sb_publishable_votre_cle_publique
```

## Limites de la première intégration

Cette tranche couvre l’adaptateur, le catalogue populaire, la recherche, les couvertures, les filtres de l’accueil, la fiche détaillée et la liste de chapitres via `/manga/:id/feed`. Les couvertures sont téléchargées via `fetch` avec la clé Publishable, puis affichées comme des URL objet : elles respectent ainsi la passerelle Supabase sans exposer de clé secrète ni dépendre d’un hotlink direct. La fiche permet de choisir la langue et crédite les groupes de scanlation. Le lecteur intégré n’est volontairement pas encore ajouté.

L’étape suivante devra demander un serveur MangaDex@Home juste avant le chargement des pages d’un chapitre. Les URL d’images de chapitre étant temporaires, elles ne doivent jamais être mises en cache comme des URL permanentes.

## Références

[1]: https://api.mangadex.org/docs/2-limitations/ "MangaDex — Limitations and Requirements"
[2]: https://api.mangadex.org/docs/03-manga/ "MangaDex — Manga API"
[3]: https://api.mangadex.org/docs/04-chapter/search/ "MangaDex — Searching for Chapters"
