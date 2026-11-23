# Manga Wave — Inventaire open source

Évaluation du 23 novembre 2026. Les étoiles, la date de dernière activité, la licence et
l’état d’archivage proviennent de l’API GitHub (`gh api repos/<owner>/<repo>`) le jour même ;
les capacités citées ont été vérifiées dans les README. Ce qui n’a pas pu être vérifié est
signalé comme tel.

**Règle transverse.** Une licence open source porte sur le code, pas sur les œuvres. Aucun
dépôt ci-dessous n’accorde le droit de copier ou de rediffuser des pages de manga. Les
écosystèmes qui consistent à extraire des sites de scans non licenciés sont donc rejetés
comme sources de lecture, quelle que soit leur qualité technique ; leur architecture peut
rester une référence.

## Classification

| Catégorie | Signification |
|---|---|
| INTEGRATE_NOW | Intégré dans cette passe, avec mesure avant/après |
| INTEGRATE_LATER | Utile, mais dépend d’une décision, d’un compte, d’un accès ou d’un chantier préalable |
| ARCHITECTURE_REFERENCE | On réutilise des idées ou un protocole, pas le code |
| REJECT | Non retenu, avec la raison |

## Synthèse

| Dépôt | ★ | Activité | Licence | Fonction | Décision |
|---|---|---|---|---|---|
| [microsoft/playwright](https://github.com/microsoft/playwright) | 100 888 | 2026-11-23 | Apache-2.0 | Tests E2E navigateur | **INTEGRATE_NOW** (déjà présent, étendu) |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) via `@axe-core/playwright` | 7 874 | 2026-11-19 | MPL-2.0 | Audit d’accessibilité WCAG | **INTEGRATE_NOW** |
| [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | 31 195 | 2026-11-20 | Apache-2.0 | Mesure perf / SEO / bonnes pratiques | **INTEGRATE_NOW** (protocole, via `npx`) |
| [gotson/komga](https://github.com/gotson/komga) | 6 874 | 2026-11-23 | MIT | Serveur de bibliothèque personnelle (OPDS, REST) | INTEGRATE_LATER (adaptateur OPDS) |
| [stumpapp/stump](https://github.com/stumpapp/stump) | 2 793 | 2026-11-22 | MIT | Serveur de bibliothèque (OPDS, OPDS-PSE, GraphQL, REST) | INTEGRATE_LATER (adaptateur OPDS) |
| [Kareadita/Kavita](https://github.com/Kareadita/Kavita) | 12 168 | 2026-11-23 | GPL-3.0 | Serveur de bibliothèque (REST ; OPDS d’après sa documentation, absent du README) | INTEGRATE_LATER (protocole seulement) |
| [vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | 4 312 | 2026-10-09 | MIT | PWA / Workbox | INTEGRATE_LATER |
| [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) | 8 782 | 2026-11-23 | MIT (fichier LICENSE) | Remontée d’erreurs, performance réelle | INTEGRATE_LATER (DSN requis) |
| [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals) | 8 699 | 2026-11-12 | Apache-2.0 | Mesure LCP/INP/CLS chez les vrais visiteurs | INTEGRATE_LATER (destination requise) |
| [Glagan/SyncDex](https://github.com/Glagan/SyncDex) | 52 | **2022-11-10** | MPL-2.0 | Synchronisation de lecture vers AniList/MAL… | ARCHITECTURE_REFERENCE |
| [Snd-R/komf](https://github.com/Snd-R/komf) | 740 | 2026-09-27 | MIT | Récupération de métadonnées (AniList, MangaUpdates, MAL, MangaDex) | ARCHITECTURE_REFERENCE |
| [mihonapp/mihon](https://github.com/mihonapp/mihon) | 25 585 | 2026-11-22 | Apache-2.0 | Lecteur Android, contrats de sources et de trackers | ARCHITECTURE_REFERENCE |
| [Suwayomi/Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server) | 8 095 | 2026-11-22 | MPL-2.0 | Serveur JVM qui exécute les extensions Tachiyomi | ARCHITECTURE_REFERENCE |
| [AngeloSha/uchiyomi](https://github.com/AngeloSha/uchiyomi) | 120 | 2026-11-23 | MPL-2.0 | Serveur auto-hébergé, téléchargeur, sortie OPDS | ARCHITECTURE_REFERENCE |
| [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | 2 838 | 2026-07-19 | Apache-2.0 | OCR du japonais manga (Python) | INTEGRATE_LATER (contenu détenu seulement) |
| [motiondivision/motion](https://github.com/motiondivision/motion) | 35 480 | 2026-11-23 | MIT | Animations React | REJECT (pour l’instant) |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 75 126 | 2026-11-23 | Licence Remotion (deux niveaux) | Vidéo programmatique | REJECT pour l’app (hors bundle seulement) |
| [keiyoushi/extensions-source](https://github.com/keiyoushi/extensions-source) | 4 925 | 2026-11-23 | Apache-2.0 | Extracteurs de sites de scans | **REJECT** |
| [KotatsuApp/kotatsu-parsers](https://github.com/KotatsuApp/kotatsu-parsers) | 326 | 2025-11-03 | GPL-3.0 | Extracteurs de sites de scans | **REJECT** (archivé) |
| [Nyora-Manga/nyora-android](https://github.com/Nyora-Manga/nyora-android) | 61 | 2026-09-23 | GPL-3.0 | Lecteur Android + ~900 extracteurs Kotatsu | **REJECT** |
| [horizonfps/horizonreader](https://github.com/horizonfps/horizonreader) | 0 | 2026-11-22 | MIT | Lecteur auto-hébergé | REJECT (aucune maturité) |
| [zyddnys/manga-image-translator](https://github.com/zyddnys/manga-image-translator) | 10 635 | 2026-11-18 | GPL-3.0 | Traduction automatique de pages | REJECT |
| [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) | 393 | **2023-08-13** | GPL-3.0 | Détection de texte de bulles | REJECT |

Noms demandés **introuvables** sous ce nom (aucun dépôt identifiable, recherche GitHub du jour) :
`komf-rs` (le projet réel le plus proche est `Snd-R/komf`, en Kotlin), `MetaFlux`, `MTL Studio`,
« Nyora Web » (seule l’application Android existe) et `onidoku` (seul un dépôt de site
`onidoku.github.io`). Ils ne sont pas évalués plutôt que d’être décrits de mémoire.

## Détail par dépôt

### Ingénierie produit

**Playwright** — déjà utilisé (22 specs E2E). Étendu : suite d’accessibilité sur 14 routes ×
2 largeurs. Coût nul, Chromium local. Risque de régression : aucun (tests seulement).

**axe-core / @axe-core/playwright** — moteur de règles WCAG de référence. MPL-2.0 :
copyleft au niveau fichier, sans effet sur le code de Manga Wave tant qu’on ne modifie pas
ses fichiers ; dépendance de développement uniquement, absente du bundle. Bénéfice mesuré :
208 violations graves/critiques → 0 (voir le rapport d’intégration).

**Lighthouse** — lancé via `npx lighthouse@12.2.1`, sans dépendance au projet. Script
`npm run perf:lighthouse` (médiane de N passages). Bénéfice mesuré : a localisé le CLS de
0,36 et 650 ko de ressources bloquantes.

**Sentry** — SDK sous MIT ; le service est payant au-delà du quota gratuit. Valeur forte
(aucune remontée d’erreur aujourd’hui), mais exige un DSN, un réglage d’échantillonnage et une
revue de confidentialité (pas d’e-mail ni d’identifiant dans les événements). Reporté.

**web-vitals** — ~2 ko, mesure réelle LCP/INP/CLS. Sans destination (Sentry, ou table
Supabase protégée), la donnée n’est pas exploitable : reporté avec Sentry.

**Motion** — rejeté pour l’instant : les animations actuelles sont en CSS et respectent
`prefers-reduced-motion` ; ajouter ~30 ko compressés n’a pas de bénéfice mesurable.

**Remotion** — licence à deux niveaux (gratuite pour les particuliers et petites structures,
licence entreprise au-delà d’une certaine taille). Non utilisé par `video-kit/`. N’a pas sa
place dans le bundle de l’application.

### Lecture, bibliothèque et hors-ligne

**Komga, Stump, Kavita** — serveurs auto-hébergés où l’utilisateur range **ses propres
fichiers** (CBZ, PDF…). C’est la seule famille de « sources de lecture » de cet inventaire
qui ne pose pas de problème de droits : le lecteur lit ce qu’il possède. Intégration prévue
par le **protocole OPDS** (Komga et Stump le documentent dans leur README ; Kavita dans sa
documentation, à vérifier), jamais en important leur code : Kavita est sous GPL-3.0, l’usage
d’un protocole n’entraîne aucune obligation de licence. Voir l’architecture proposée.

**vite-plugin-pwa** — le service worker actuel (88 lignes, écrit à la main) ne met en cache
que la coquille. Workbox apporterait le précache des fichiers hachés et une invite de mise à
jour. Reporté : le gain n’existe qu’avec un périmètre hors-ligne défini (bibliothèque OPDS de
l’utilisateur, pas les pages de sources tierces).

### Métadonnées

**komf** — agrège AniList, MangaUpdates, MyAnimeList et MangaDex pour Komga/Kavita. Manga
Wave possède déjà un pipeline équivalent (`scripts/metadata/` : AniList, Jikan, Kitsu,
MangaUpdates, MangaDex, avec niveaux de confiance). Référence pour la correspondance de noms
et l’ordre de priorité des fournisseurs ; aucun code à importer (Kotlin/JVM).

**SyncDex** — dernière activité en 2022. L’idée (pousser la progression vers AniList/MAL)
est bonne ; elle se réalise par les **API officielles** (OAuth AniList), pas en reprenant ce
code d’extension navigateur.

### Infrastructure de sources

**keiyoushi/extensions-source, kotatsu-parsers, Nyora** — collections de centaines
d’extracteurs de sites de scans non licenciés. Rejetés comme sources : les intégrer
étendrait la rediffusion d’œuvres sans autorisation. kotatsu-parsers est de plus archivé.

**Mihon, Suwayomi, Uchiyomi** — références d’architecture utiles : contrat de source
uniforme (catalogue, détail, chapitres, pages, filtres), limitation de débit par source,
modèle de trackers, sortie OPDS-PSE. Manga Wave suit déjà ce principe (adaptateurs isolés →
résolveur canonique) ; ces projets servent de comparaison, pas de dépendance.

### IA manga

**manga-image-translator** (GPL-3.0, Python, GPU recommandé) et **comic-text-detector**
(GPL-3.0, inactif depuis 2023) — rejetés : traduire des pages tierces produit des œuvres
dérivées sans droit, coût GPU, et un service GPL exposé en réseau ajoute des obligations.

**manga-ocr** (Apache-2.0) — envisageable plus tard pour l’accessibilité (texte alternatif
des bulles) **sur du contenu que l’utilisateur détient** (bibliothèque OPDS), exécuté côté
serveur ou localement. Modèle de plusieurs centaines de Mo : hors périmètre web actuel.
