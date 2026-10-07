# Feuille de route produit — Manga Wave

## Position actuelle

Manga Wave dispose désormais d’un catalogue local de 100 titres provenant de MangaDex, d’une recherche, de fiches manga, d’une liste de chapitres et d’un système d’authentification avec des tables personnelles protégées par RLS. La priorité produit est maintenant de transformer la consultation du catalogue en une **bibliothèque personnelle durable**, puis en une expérience de lecture et de découverte récurrente.

> Principe directeur : chaque fonctionnalité doit réduire une friction concrète dans le parcours « découvrir → choisir → suivre → reprendre ».

## Priorités recommandées

| Priorité | Fonctionnalité | Bénéfice utilisateur | Fondations déjà disponibles | Critère de succès |
|---|---|---|---|---|
| P0 | **Ma bibliothèque** | Retrouver ses favoris dans un espace personnel persistant. | `user_favorites`, authentification, cartes de catalogue. | Un utilisateur connecté peut consulter, filtrer et retirer ses favoris. |
| P0 | **Reprendre la lecture** | Revenir immédiatement au dernier manga et chapitre consultés. | `user_history`, `user_progress`, fiche et flux de chapitres. | L’accueil affiche une section « Continuer la lecture » personnalisée. |
| P0 | **Suivi d’un manga** | Suivre un titre et voir clairement les nouveaux chapitres. | Favoris, catalogue synchronisé, métadonnées `last_synced_at`. | Les titres suivis signalent les chapitres non consultés. |
| P1 | **Lecteur de chapitres responsable** | Ouvrir ou reprendre un chapitre depuis sa fiche. | Liste de chapitres MangaDex, table `pages`, progression. | Un clic mène vers un parcours de lecture cohérent, conformément aux règles de diffusion applicables. |
| P1 | **Découverte personnalisée** | Trouver plus vite des titres proches de ses goûts. | Genres, statuts, favoris et historique. | Les recommandations s’appuient sur les genres suivis et l’historique réel. |
| P1 | **Recherche enrichie** | Filtrer par genre, statut, type, langue et contenu adapté. | Page de recherche, métadonnées locales, `content_rating`. | Les filtres restent partageables dans l’URL et produisent des résultats cohérents. |
| P2 | **Alertes de nouveautés** | Être informé des nouveaux chapitres des titres suivis. | Synchronisation quotidienne, favoris, historique. | Préférences par utilisateur et notifications activables/désactivables. |
| P2 | **Listes et collections** | Organiser les lectures par thèmes ou états personnels. | Authentification et schéma personnel extensible. | Création de listes privées, ajout/retrait de mangas et ordre manuel. |
| P3 | **Avis et modération** | Donner un avis utile sans dégrader la qualité communautaire. | Profils utilisateurs et catalogue local. | Signalement, modération et règles de publication avant ouverture publique. |

## Séquence de livraison

La première itération devrait livrer **Ma bibliothèque** et **Reprendre la lecture** dans un même cycle. Ces deux fonctionnalités exploitent directement les tables déjà créées et rendent l’authentification immédiatement utile. Elles doivent inclure un état vide clair, un accès depuis l’en-tête, des messages de connexion explicites et une mise à jour optimiste des favoris.

La seconde itération doit enrichir le suivi des titres. Elle ajoutera une date de dernier chapitre vu, un compteur de nouveautés et des filtres dans la bibliothèque. La synchronisation quotidienne du catalogue sera alors utile non seulement pour l’affichage général mais également pour l’utilisateur connecté.

La troisième itération portera sur l’expérience de lecture. Avant de servir des pages ou des images de chapitre dans l’interface, il faut vérifier les règles de la source, la disponibilité par langue et les obligations liées aux contenus et aux ayants droit. À défaut d’un lecteur intégré conforme, le parcours doit diriger clairement vers la fiche ou le chapitre de la source officielle.

## Évolutions de données suggérées

| Domaine | Évolution recommandée | Utilisation |
|---|---|---|
| Historique | Ajouter `last_chapter_id`, `last_read_at` et un index par `user_id, last_read_at desc`. | Section « Continuer la lecture ». |
| Progression | Ajouter `chapter_id`, `page_number`, `completed_at` et une contrainte unique par utilisateur et chapitre. | Reprise précise dans le lecteur. |
| Favoris | Ajouter `notifications_enabled` et `last_notified_chapter_at`. | Alertes de nouveautés contrôlées par l’utilisateur. |
| Catalogue | Stocker `latest_chapter_published_at` et éventuellement une table de publications synchronisées. | Détection fiable de nouveaux chapitres. |
| Préférences | Créer `user_preferences` avec langues, genres masqués et règle de contenu. | Découverte personnalisée et contrôle parental. |

## Indicateurs de pilotage

Le premier indicateur est le taux d’utilisateurs connectés qui ajoutent au moins un favori. Il doit être suivi avec le nombre moyen de favoris, le taux de retour vers la bibliothèque et le nombre de reprises de lecture par semaine. Pour la découverte, mesurer la conversion « recherche ou sélection → fiche → favori » permet de distinguer les titres vus des titres réellement adoptés.

Aucune donnée personnelle de lecture ne doit être envoyée à MangaDex. Les données de bibliothèque, d’historique et de progression restent rattachées à `auth.uid()` et continuent de relever des politiques RLS de Manga Wave.

## Décision recommandée pour le prochain développement

Le prochain lot de développement recommandé est **Bibliothèque personnelle + Continuer la lecture**. Il génère de la valeur dès la première connexion, réutilise le schéma existant et prépare logiquement le suivi de nouveaux chapitres puis les notifications.
