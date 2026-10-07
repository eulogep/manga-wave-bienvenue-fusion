# Manga Wave — Video Production Prep Kit

Ce dossier regroupe les éléments de tournage, les références visuelles et le
rough-cut déjà généré pour préparer le montage final.

## 🎬 Vidéo générée

La vidéo ci-dessous est le master de travail actuel. Cliquez sur l’aperçu pour
ouvrir ou télécharger le fichier MP4.

[![Aperçu du rough-cut Manga Wave](./screenshots/desktop/01-home-discovery.png)](./video%20ge%CC%81nere/manga-wave-master-16x9-roughcut.mp4)

### [▶ Ouvrir le rough-cut 16:9](./video%20ge%CC%81nere/manga-wave-master-16x9-roughcut.mp4)

| Fichier | Définition | Durée | Cadence | Taille | Audio |
| --- | ---: | ---: | ---: | ---: | --- |
| `manga-wave-master-16x9-roughcut.mp4` | 1920 × 1080 | 40,4 s | 25 i/s | 14,7 Mio | Aucune piste |

Ce rough-cut présente le parcours Manga Wave : accueil, catalogue de
découverte, carrousel éditorial, fiche manga et Reader. Il sert de référence
visuelle pour le rythme, l’ordre des séquences et la préparation des versions
finales. Les textes, la voix, la musique et le sound design restent à intégrer
au montage.

Les captures `screenshots/desktop` et `screenshots/mobile` représentent le candidat local audité. Les captures sous `screenshots/audit-production` représentent le bundle réellement servi en production au moment de l’audit. Cette séparation doit rester visible pendant le montage.

Les clips bruts sont générés dans `recordings/` et restent hors Git. Pour régénérer les captures publiques :

```bash
VIDEO_BASE_URL=http://127.0.0.1:8080 node scripts/video/capture-video-kit.mjs
```

Pour inclure Bibliothèque, Historique et Continuer la lecture avec un compte QA éphémère :

```bash
VIDEO_BASE_URL=http://127.0.0.1:8080 VIDEO_CREATE_TEMP_ACCOUNT=1 node scripts/video/capture-video-kit.mjs
```

Le compte et ses données sont créés en mémoire, puis supprimés dans le bloc de nettoyage. Aucune clé ni aucun identifiant n’est écrit dans le kit.

Capturer le Reader réel de production et vérifier trois pages :

```bash
node scripts/video/capture-production-reader.mjs
```

Régénérer les références de couvertures et les exports de marque :

```bash
node scripts/video/export-artwork-references.mjs
node scripts/video/export-branding.mjs
```

Les audits DOM reproductibles sont dans `docs/capture-audit-candidate.json` et `docs/capture-audit-production.json`.

Consulter en priorité :

- `OPUS_5_5_HANDOFF.md`
- `docs/product-truth-sheet.md`
- `docs/shot-list.md`
- `docs/capture-matrix.md`
- `docs/featured-titles.md`
