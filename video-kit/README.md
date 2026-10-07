# Manga Wave — Video Production Prep Kit

Ce dossier prépare le tournage et le montage.

## 🎬 Vidéo générée

| Fichier | Format | Taille | Description |
|---------|--------|--------|-------------|
| [`video génere/manga-wave-master-16x9-roughcut.mp4`](./video%20génere/manga-wave-master-16x9-roughcut.mp4) | MP4 / 16×9 | ~14.7 MB | Rough-cut master — séquence complète de la plateforme Manga Wave |

> Ce rough-cut couvre l'ensemble du parcours utilisateur : page d'accueil, catalogue de découverte, carrousel éditorial, détail manga et lecteur. Il sert de référence visuelle pour le montage final.

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
