# Product truth sheet — audit du 7 octobre 2026

Production auditée : `https://manga-wave-bienvenue-fusion.vercel.app/`  
Bundle servi : `assets/index-BvbBpX-4.js`  
Candidat local capturé : `http://127.0.0.1:8080/`

## Classification des fonctionnalités

| Fonctionnalité | Classification vidéo | Preuve actuelle | Formulation autorisée |
|---|---|---|---|
| Homepage éditoriale de production | LIVE_BUT_VISUALLY_WEAK | `screenshots/audit-production/desktop/01-home-discovery.png` charge encore des emplacements vides dans le premier écran | « Manga Wave organise le catalogue par découvertes et ambiances. » |
| Carousel premium « À l’affiche » | EXPERIMENTAL | Présent uniquement dans le candidat local capturé | « Nouveau carousel en préparation » uniquement dans une vidéo de produit à venir ; ne pas le présenter comme déjà en production. |
| Catalogue canonique | LIVE_AND_VIDEO_READY | Production : 513 résultats et filtres réels | « Explorez un catalogue unifié de mangas, manhwas et manhuas. » |
| Refonte éditoriale du catalogue | EXPERIMENTAL | `screenshots/desktop/02-catalogue.png`, non déployée | Utiliser seulement si le candidat est déployé avant publication de la vidéo. |
| Recherche exacte | LIVE_AND_VIDEO_READY | Recherche production `Solo Leveling` : un résultat canonique | « Recherchez un titre, un auteur ou un genre. » |
| Recherche par commande clavier | LIVE_BUT_VISUALLY_WEAK | Contrôle disponible dans le header ; pas de clip propre dans ce kit | « La recherche reste accessible depuis toute l’interface. » |
| Fiche manga canonique | LIVE_AND_VIDEO_READY | `/manga/7` sert la fiche One Punch-Man et 102 chapitres en production | « Retrouvez les informations et éditions disponibles sur une seule fiche. » |
| Liste et recherche de chapitres | LIVE_AND_VIDEO_READY | Liste réelle visible dans la capture production de la fiche | « Choisissez un chapitre parmi les éditions disponibles. » |
| Reader multi-source | LIVE_AND_VIDEO_READY | Le chapitre 309 de One Punch-Man a été ouvert en production et les pages 1, 2 et 3 ont été vérifiées sans fixture | « Ouvrez un chapitre disponible et poursuivez votre lecture. » Ne pas promettre une disponibilité permanente de toutes les sources. |
| Résolution et fallback de source | LIVE_BUT_VISUALLY_WEAK | Architecture et contrôles existent, mais le comportement est technique et soumis aux fournisseurs | « Manga Wave peut essayer une autre édition disponible. » Ne jamais dire « aucune panne » ou « toutes les sources fonctionnent ». |
| Bibliothèque personnelle | LIVE_BUT_VISUALLY_WEAK | Fonction réelle ; capture propre obtenue sur candidat local avec compte QA temporaire | « Retrouvez favoris, suivis et lectures en cours dans votre bibliothèque. » |
| Continuer la lecture | LIVE_BUT_VISUALLY_WEAK | Capture locale réelle avec progression Supabase et compte QA nettoyé | « Reprenez au chapitre et à la page enregistrés. » Ne pas garantir la reprise si la source externe n’est plus disponible. |
| Historique de lecture | LIVE_BUT_VISUALLY_WEAK | Capture locale réelle de trois entrées canoniques ; suppression et RLS déjà couvertes par les tests projet | « Retrouvez vos dernières lectures. » |
| Suivis et notifications | LIVE_BUT_VISUALLY_WEAK | Présents dans le produit, peu lisibles sans contexte dans une vidéo courte | À réserver à un plan secondaire ou à une vidéo dédiée. |
| Tendances | NOT_USEFUL_FOR_VIDEO | La production affiche « Pas encore assez d’activité récente » | Ne pas montrer l’écran vide dans la vidéo de lancement. |
| Classement | NOT_USEFUL_FOR_VIDEO | La production affiche un état vide ; le classement local capturé a été alimenté par les données QA temporaires | Ne pas présenter les trois titres locaux comme un classement organique de production. |
| Découverte aléatoire | LIVE_AND_VIDEO_READY | Route publique `/random`, intégrée à la navigation « Surprise » | « Laissez Manga Wave vous proposer une découverte. » |
| Recommandations personnalisées | LIVE_BUT_VISUALLY_WEAK | Une section « Pour vous » existe, mais son niveau de personnalisation ne doit pas être sur-promis | « Des sélections adaptées à votre univers de lecture. » |
| Décisions Jev / TypeSafe | EXPERIMENTAL | Expérience locale, sans rôle produit autonome | Ne jamais la citer dans la vidéo grand public. |
| Scraping, synchronisation et santé fournisseurs | NOT_USEFUL_FOR_VIDEO | Infrastructure interne, sujette aux variations externes | Ne pas citer de fournisseurs ni de techniques d’extraction dans le marketing. |

## Safe to say

- Manga Wave rassemble découverte, recherche, fiche canonique, bibliothèque et historique dans une même expérience.
- Le catalogue distingue l’œuvre canonique de ses éditions et sources techniques.
- Un lecteur connecté peut retrouver ses favoris, suivis et progressions enregistrées.
- L’interface est disponible sur desktop et mobile.

## Techniquement vrai mais trop complexe pour une promesse courte

- Le moteur peut classer plusieurs sources et tenter un fallback.
- Les données de progression et d’historique sont séparées pour préserver la reprise exacte.
- Les signaux d’activité alimentent tendances et classements, seulement quand le volume est suffisant.

## Do not claim

- « Tous les mangas sont disponibles. »
- « Toutes les sources fonctionnent en permanence. »
- « Lecture gratuite et illimitée de n’importe quel titre. »
- « Recommandations par IA » ou « décisions Jev ».
- « Tendances temps réel » tant que les écrans de production sont vides.
- Que le nouveau carousel et le catalogue éditorial sont déjà en production avant vérification du nouveau bundle.
