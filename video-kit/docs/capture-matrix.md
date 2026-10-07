# Capture matrix

## Captures candidat local

| Fichier | État | Usage |
|---|---|---|
| `screenshots/desktop/01-home-discovery.png` | READY_LOCAL | Vue complète de la homepage et du carousel. |
| `screenshots/desktop/02-catalogue.png` | READY_LOCAL | Refonte catalogue plein écran. |
| `screenshots/desktop/03-search-results.png` | READY_LOCAL | Résultat canonique Solo Leveling. |
| `screenshots/desktop/04-trending.png` | REJECT | État vide. |
| `screenshots/desktop/05-ranking.png` | DEMO_ONLY | Classement alimenté par le compte QA temporaire. |
| `screenshots/desktop/06-manga-detail.png` | REJECT_LOCAL | Liste de chapitres indisponible sans backend local. |
| `screenshots/desktop/07-auth.png` | SECONDARY | Authentification réelle, traitement visuel faible. |
| `screenshots/desktop/08-home-continue-reading.png` | READY_LOCAL_DEMO | Progression QA réelle, données nettoyées après capture. |
| `screenshots/desktop/09-library.png` | READY_LOCAL_DEMO | Bibliothèque QA réelle. |
| `screenshots/desktop/10-history.png` | READY_LOCAL_DEMO | Historique QA réel. |
| `screenshots/mobile/01-home-390x844.png` | READY_LOCAL | Vérification full page, utiliser plutôt le clip portrait. |
| `screenshots/mobile/02-catalogue-390x844.png` | READY_LOCAL | Pas de débordement horizontal observé. |
| `screenshots/mobile/03-manga-detail-390x844.png` | REJECT_LOCAL | Même indisponibilité de chapitres. |
| `screenshots/mobile/04-library-390x844.png` | READY_LOCAL_DEMO | Bibliothèque responsive. |
| `screenshots/mobile/05-history-390x844.png` | READY_LOCAL_DEMO | Historique responsive. |

## Captures production

| Fichier | État | Usage |
|---|---|---|
| `screenshots/audit-production/desktop/01-home-discovery.png` | AUDIT_ONLY | Ancienne homepage et chargements visibles. |
| `screenshots/audit-production/desktop/02-catalogue.png` | AUDIT_ONLY | Ancien catalogue. |
| `screenshots/audit-production/desktop/03-search-results.png` | READY_PRODUCTION | Recherche exacte Solo Leveling. |
| `screenshots/audit-production/desktop/04-trending.png` | REJECT | État vide. |
| `screenshots/audit-production/desktop/05-ranking.png` | REJECT | État vide. |
| `screenshots/audit-production/desktop/06-manga-detail.png` | READY_PRODUCTION | Fiche One Punch-Man et liste réelle de chapitres. |
| `screenshots/audit-production/desktop/07-auth.png` | SECONDARY | Auth réelle, peu différenciante. |
| `screenshots/audit-production/desktop/08-reader.png` | READY_PRODUCTION | Chapitre réel, page 1 décodée. |
| `screenshots/audit-production/mobile/04-reader-390x844.png` | READY_PRODUCTION | Reader réel en 390 × 844. |
| Autres `screenshots/audit-production/mobile/*` | AUDIT_ONLY | Preuve responsive de l’ancien bundle ; éviter au montage principal. |

## Clips bruts locaux

| Fichier | Durée | Segment conseillé | État |
|---|---:|---:|---|
| `recordings/candidate/16x9-home-carousel.webm` | 5.96 s | 1.7–5.8 s | READY_LOCAL |
| `recordings/candidate/16x9-catalogue-discovery.webm` | 4.48 s | 1.6–4.4 s | READY_LOCAL |
| `recordings/candidate/16x9-search-to-detail.webm` | 5.04 s | 1.5–5.0 s | READY_LOCAL |
| `recordings/candidate/16x9-library-to-history.webm` | 5.76 s | 1.5–5.7 s | READY_LOCAL_DEMO |
| `recordings/candidate/9x16-home-swipe.webm` | 4.44 s | 1.4–4.4 s | READY_LOCAL |
| `recordings/production/16x9-reader-navigation-raw.webm` | 3.48 s | 0–3.48 s | READY_PRODUCTION |

Les clips démarrent avant la stabilisation du premier écran afin de rester bruts. Les timecodes ci-dessus suppriment le chargement initial.
