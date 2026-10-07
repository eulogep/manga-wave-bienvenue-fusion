# Fournisseurs de catalogue

Manga Wave utilise désormais une couche de normalisation pour rechercher des métadonnées anime et manga auprès d’AniList, Jikan et Kitsu. Cette couche ne copie pas de pages de lecture et ne transforme pas une API de métadonnées en autorisation de redistribution de contenu.

## Fournisseurs intégrés

| Fournisseur | Protocole | Données exploitées | Limites opérationnelles |
|---|---|---|---|
| AniList | GraphQL | Titres, synonymes, synopsis nettoyé, genres, statut, année, couverture et URL AniList | 90 requêtes/minute en régime normal ; la documentation signale aussi un état dégradé temporaire à 30 requêtes/minute [1]. |
| Jikan | REST v4 | Métadonnées MyAnimeList, scores, genres, synopsis, images et URL officielle | API non officielle, lecture seule ; 60 requêtes/minute et 3 requêtes/seconde, avec cache amont de 24 heures [2]. |
| Kitsu | JSON:API | Titres, synopsis, notation, statut, dates, images et URL Kitsu | GET public pour les ressources publiques ; pagination maximale documentée de 20 éléments par page [3]. |
| Public APIs | Répertoire | Source de découverte d’APIs publiques à évaluer | Le répertoire ne vaut pas contrat de diffusion ; chaque API doit être vérifiée séparément avant intégration [4]. |

La recherche agrégée tolère l’indisponibilité ponctuelle d’un fournisseur : les résultats disponibles sont retournés, tandis que l’échec d’une API ne rend pas la recherche entière inutilisable. Les réponses sont mises en cache côté client pendant cinq minutes afin de réduire les appels répétitifs.

## Séparation catalogue / lecture

AniList, Jikan et Kitsu sont utilisés ici comme sources de découverte et de métadonnées. Les cartes multi-sources renvoient vers l’URL officielle du fournisseur. La lecture intégrée de Manga Wave devra utiliser uniquement des fichiers hébergés par Manga Wave ou des flux dont le droit de diffusion et l’API ont été explicitement accordés par le titulaire concerné.

Le lecteur intégré devra recevoir un contrat indépendant contenant un identifiant de contenu, une liste de pages autorisées, un manifeste signé ou une URL de média contrôlée, ainsi que les informations de licence. Les identifiants AniList, Jikan, Kitsu ou MangaDex ne suffisent pas, à eux seuls, à autoriser la copie des pages ou des médias.

## Fichiers concernés

L’adaptateur unifié se trouve dans `src/integrations/catalog/providers.ts`, le hook TanStack Query dans `src/hooks/useCatalogSearch.ts` et la présentation des résultats dans `src/pages/Search.tsx`. Aucun secret n’est requis pour ces appels publics et aucune clé privée n’est embarquée dans le bundle.

## Références

[1]: https://docs.anilist.co/guide/rate-limiting "AniList API — Rate Limiting"

[2]: https://docs.api.jikan.moe/ "Jikan REST API v4 Documentation"

[3]: https://kitsu.docs.apiary.io/ "Kitsu API Documentation"

[4]: https://github.com/public-apis/public-apis#anime "Public APIs — Anime section"
