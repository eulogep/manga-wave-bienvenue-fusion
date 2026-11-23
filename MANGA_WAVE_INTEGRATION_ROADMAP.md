# Manga Wave — Feuille de route d’intégration

Ordre fixé par le bénéfice mesurable rapporté à l’effort et au risque. Chaque étape a un
critère de succès chiffré et un retour arrière.

## Fait (23 novembre 2026)

| Intégration | Résultat mesuré |
|---|---|
| axe-core + Playwright | 208 violations graves/critiques → 0 sur 28 vues |
| Lighthouse (protocole médiane) | Accueil 44 → 64, CLS 0,362 → 0, −187 ko par page |
| Nettoyage des dépendances | Alerte haute de production 1 → 0 |
| Requête dédiée du carrousel | 12 lignes au lieu de ~970 ; LCP accueil 9,7 → 8,7 s |

## Prochaines étapes

### 1. LCP de l’accueil — en cours

- **Fait** : requête dédiée aux titres vedettes (12 lignes au lieu de ~970, sélection
  identique vérifiée) et priorité haute sur la couverture active. LCP médian (5 passages)
  9,7 → 8,7 s.
- **Cascade restante**, mesurée sur la chronologie réseau (4G lente, CPU ×4) :
  1. Le morceau `useAuth` (302 ko, client Supabase) arrive à 4,4 s et l’accueil n’affiche
     rien avant la fin du chargement de session. Piste : afficher le carrousel sans attendre
     la session, et charger les titres vedettes par un `fetch` REST direct, sans le client.
  2. Chaque couverture MangaDex coûte deux requêtes : l’en-tête `apikey` du proxy déclenche
     une pré-vérification CORS (+150 ms de latence par image). Piste : accepter la clé
     publique en paramètre d’URL ou rendre les couvertures publiques dans `mangadex-proxy`
     (déploiement Supabase requis).
  3. Les sections sous la ligne de flottaison téléchargent encore le catalogue complet
     (86 + 78 + 40 ko) en concurrence avec la couverture vedette. Piste : différer ces
     requêtes jusqu’au premier affichage de la couverture ou à l’approche du défilement.
- **Succès** : LCP médian de l’accueil < 4 s, performance ≥ 80.

### 2. Observabilité — dépend d’un DSN Sentry

- **Plan** : `@sentry/react` + `web-vitals`, chargés après le rendu, échantillonnage 10 %,
  `sendDefaultPii: false`, filtrage des URL contenant des jetons.
- **Succès** : erreurs JS et Core Web Vitals réels visibles par route ; surcoût du point
  d’entrée < 15 ko gzip (mesuré).
- **Prérequis** : ton compte Sentry (ou alternative auto-hébergée) et ton accord sur les
  données collectées.

### 3. Bibliothèque personnelle OPDS (Komga, Stump, Kavita)

- **Plan** : analyseur OPDS 1.2/2 pur et testé ; adaptateur au contrat des sources ;
  écran « Connecter ma bibliothèque » ; identifiants conservés sur l’appareil.
- **Validation** : serveur Komga et Stump de test (Docker), E2E complet : catalogue →
  fiche → lecture → reprise.
- **Succès** : un utilisateur lit ses propres CBZ dans le lecteur Manga Wave, progression
  synchronisée comme pour les autres sources.

### 4. Suivi AniList

- **Plan** : OAuth AniList, Edge Function de synchronisation, mutation de progression.
- **Succès** : la progression d’un chapitre terminé apparaît sur AniList en < 1 min.
- **Prérequis** : migration (jeton chiffré, sous RLS) — accès Supabase requis.

### 5. Hors-ligne avec vite-plugin-pwa

- **Plan** : remplacer le service worker manuel par Workbox (précache des fichiers hachés,
  invite de mise à jour) ; cache explicite des chapitres OPDS seulement.
- **Succès** : relancement hors-ligne de l’application et lecture d’un chapitre OPDS mis en
  cache ; aucun contenu de source tierce mis en cache.
- **Dépend de** : étape 3.

### 6. Poids du bundle

- **Constat** : point d’entrée 270 ko (156 ko en octobre) ; morceau `useAuth` 256 ko (client
  Supabase).
- **Plan** : analyse du graphe d’import, chargement différé des sections de l’accueil sous
  la ligne de flottaison.
- **Succès** : point d’entrée ≤ 180 ko, mesuré au build.

## Hors feuille de route

- Extensions de sites de scans (Keiyoushi, Kotatsu, Nyora, sources Suwayomi) : rejet
  définitif comme sources de lecture.
- Traduction automatique de pages tierces : rejetée.
