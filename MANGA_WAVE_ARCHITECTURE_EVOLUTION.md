# Manga Wave — Évolution de l’architecture

## Principes conservés

1. **Une identité canonique par œuvre** (`public.mangas`), quelle que soit la source.
2. **Des sources remplaçables**, isolées derrière des adaptateurs ; aucune page React ne parle
   directement à une infrastructure d’extraction.
3. **Données personnelles sous RLS**, agrégées côté serveur avant tout usage collectif
   (tendances, classement), jamais exposées brutes au client.
4. **Métadonnées honnêtes** : niveaux de confiance, pas de fusion approximative d’identités,
   pas d’image ou de signal fabriqué.

## Flux actuels

```
Sources de lecture externes
  → adaptateurs isolés (src/integrations/sources, server/src/sources)
  → passerelle d’extraction (api/extract.ts, cache, santé des sources)
  → résolveur canonique (canonicalManga, sourceResolution, automaticFallback, chapterMatching)
  → lecteur Manga Wave

Sources de métadonnées (MangaDex, AniList, Jikan, Kitsu, MangaUpdates)
  → adaptateurs (scripts/metadata, supabase/functions/_shared)
  → correspondance d’identité (find_canonical_manga : titre/alias exacts)
  → évaluation de confiance
  → catalogue canonique Supabase

Activité des lecteurs (historique, suivis, favoris, listes)
  → tables privées sous RLS
  → agrégats (manga_trending_scores, classement)  → Tendances / Classement
  → profil local au navigateur                     → Pour toi, recommandations
```

## Évolution proposée : la bibliothèque personnelle OPDS

Komga, Stump et Kavita servent des fichiers **que le lecteur possède**. Les intégrer par le
protocole OPDS ajoute une source de lecture légitime sans copier le code de ces projets.

```
Serveur de l’utilisateur (Komga / Stump / Kavita)
  → adaptateur OPDS (nouveau, même contrat que les autres sources)
      · parse le flux OPDS 1.2 (Atom) et OPDS 2 (JSON)
      · pages via OPDS-PSE (Komga, Stump) ou téléchargement du fichier
  → correspondance d’identité canonique (titre/alias exacts, comme catalog-sync)
  → lecteur Manga Wave (aucune modification du lecteur : il reçoit des URL de pages)
```

Décisions à valider :

| Question | Proposition | Raison |
|---|---|---|
| Où vivent les identifiants du serveur personnel ? | Dans le navigateur de l’utilisateur uniquement, jamais en base. | Un mot de passe stocké par Manga Wave deviendrait une cible ; le lecteur n’en a besoin que sur son appareil. |
| Appels directs ou via proxy ? | Directs depuis le navigateur ; documentation CORS fournie pour Komga/Stump/Kavita. | Un proxy Manga Wave verrait passer les identifiants et les fichiers de l’utilisateur. |
| Hors-ligne | Mise en cache explicite, à la demande, des chapitres OPDS seulement (vite-plugin-pwa + Cache Storage). | C’est le seul contenu que l’utilisateur a le droit de copier localement. |
| Identité canonique | Rattachement uniquement sur correspondance exacte et unique ; sinon entrée « bibliothèque personnelle » non canonique. | Même règle que la synchronisation MangaDex : jamais de fusion approximative. |

## Évolution proposée : suivi vers AniList

Inspiré de SyncDex et du modèle de trackers de Mihon, mais par l’API officielle :

```
Progression Manga Wave (user_canonical_reading_progress, RLS)
  → Edge Function « tracker-sync » (OAuth AniList, jeton chiffré côté serveur)
  → mutation SaveMediaListEntry (progress, status)
```

Correspondance AniList ↔ identité canonique : déjà produite par le pipeline de métadonnées
(identifiants AniList des fiches enrichies) ; aucune nouvelle fusion d’identité.

## Évolution proposée : observabilité

```
Navigateur → web-vitals (LCP, INP, CLS) + erreurs non capturées
  → Sentry (échantillonnage, sans e-mail ni identifiant utilisateur)
Edge Functions / extracteurs → Sentry (erreurs) ; santé des sources déjà dans source_health
```

## Ce qui ne change pas

- Aucune nouvelle source de scans : l’architecture des extensions Mihon/Suwayomi sert de
  comparaison pour le contrat d’adaptateur, pas de catalogue de sources.
- Le lecteur ne connaît pas la source : il reçoit des pages par le résolveur, quelle qu’en soit
  l’origine (MangaDex, bibliothèque OPDS).
