# Prompt de reprise Manga Wave sur Mac

## Installation préalable sur le Mac

Dans Terminal :

```bash
git clone https://github.com/eulogep/manga-wave-bienvenue-fusion.git
cd manga-wave-bienvenue-fusion
git checkout main
git pull --ff-only origin main
npm ci
npx playwright install chromium
```

Transférer ensuite le fichier `.env` depuis Windows par un canal chiffré, ou le recréer depuis `.env.example` avec les valeurs correctes.

Ne jamais :

- envoyer `.env` dans une conversation ;
- committer `.env` ;
- placer une clé service Supabase dans une variable `VITE_*`.

Si des opérations Supabase sont nécessaires :

```bash
npx supabase login
npx supabase link --project-ref ilmsomiaqthhfyvgqnsp
```

## Prompt à copier dans le nouvel Antigravity/Codex

```text
Tu reprends le projet Manga Wave depuis un nouvel ordinateur Mac. L’historique de l’ancien agent Windows n’est pas disponible localement. Le dépôt Git et les fichiers de handoff versionnés sont donc les seules sources de vérité.

Repository:
https://github.com/eulogep/manga-wave-bienvenue-fusion.git

Production:
https://manga-wave-bienvenue-fusion.vercel.app/

Branche de référence:
main

Règles de démarrage obligatoires:

1. Ne modifie aucun fichier avant d’avoir restauré le contexte.
2. Depuis la racine du dépôt, exécute uniquement ces contrôles read-only:
   - pwd
   - git status --short
   - git branch --show-current
   - git log -8 --oneline --decorate
   - git remote -v
   - git fetch origin
   - git rev-parse HEAD
   - git rev-parse origin/main
3. Lis entièrement, dans cet ordre:
   - MANGA_WAVE_CODEX_HANDOFF.md
   - MANGA_WAVE_V3_T3014_REPORT.md
   - MANGA_WAVE_V3_T3013_DETERMINISTIC_SMOKE_REPORT.md
   - package.json
4. Vérifie seulement la présence des noms de variables nécessaires. N’affiche jamais leur valeur et ne lis pas les secrets dans la conversation.
5. Si le worktree est dirty, préserve toutes les modifications présentes. Ne fais aucun reset, checkout destructif ou écrasement.
6. Si HEAD local diffère de origin/main, explique exactement la divergence avant d’agir.
7. Ne recommence pas les tickets terminés et ne recrée pas leur architecture.

État attendu à confirmer, pas à supposer:

- P0 Reading Foundation: APPROVED
- Visual Refactor: APPROVED
- Responsive Reader: APPROVED
- P1 Canonical Multi-Source: APPROVED
- T-3011 Homepage V2: APPROVED
- T-3012 Remove Source-First UX: APPROVED
- T-3013 New Chapter Detection: PASS
- T-3013 Deterministic Smoke Fixture: PASS
- T-3014 Canonical Follow: PASS
- T-3015: NOT STARTED et pas encore spécifié en détail

Dernier comportement livré:

- Favorite conserve un manga dans la Bibliothèque.
- Follow surveille un manga canonique pour ses futurs chapitres.
- Favorite et Follow sont indépendants.
- Le moteur T-3013 surveille user_follows.
- La première synchronisation après Follow crée une baseline sans faux unread.
- Une publication ultérieure produit unread 1.
- Le Reader acquitte le chapitre et ramène unread à 0.
- Unfollow arrête la surveillance et supprime seulement l’état de détection, pas l’historique de lecture.
- Refollow établit une nouvelle baseline sans notification rétroactive.

Contraintes absolues:

- aucune UX source-first;
- aucun Follow lié à un fournisseur;
- aucun doublon canonique par source;
- aucune fusion automatique basée seulement sur du fuzzy matching;
- aucun Header/Footer dans le Reader autonome;
- conserver les six modes Reader et l’index de page zero-based;
- conserver source fallback, source switch, progression et reprise;
- ne jamais supprimer historique/progression lors d’un unfollow;
- ne jamais exposer une clé service Supabase côté client;
- ne jamais modifier une migration Supabase déjà appliquée;
- ne pas implémenter T-3015 sans brief explicite;
- ne pas push, migrer ou déployer tant que je ne l’ai pas demandé dans cette nouvelle session.

Validation de reprise non destructive:

- npm ci si node_modules est absent ou incohérent
- npm run test:p1
- npm run test:p2
- npm run test:t3012:hotfix
- npm run test:t3013
- npm run test:t3014
- npx tsc --noEmit
- npm run lint -- --quiet
- npm run build

Ne lance pas les scripts créant des comptes QA temporaires sans mon autorisation explicite. Ne lance pas de migration Supabase pendant la reprise.

Ta première réponse doit être un rapport court sous cette forme:

CONTEXTE_RESTAURE=<YES|NO>
REPO=<path>
BRANCH=<branch>
HEAD_LOCAL=<sha>
HEAD_REMOTE=<sha>
WORKTREE=<clean|dirty>
LAST_COMPLETED=<ticket>
NEXT_RECOMMENDED=<ticket ou action>
ENV_NAMES_PRESENT=<YES|NO, sans valeurs>
BLOCKERS=<none ou liste précise>

Ensuite arrête-toi et attends ma prochaine instruction. Si tout correspond au handoff, indique:

LAST_COMPLETED=T-3014
NEXT_RECOMMENDED=T-3015_SPECIFICATION
```

## Ce que ce mécanisme conserve

- l’état exact du code via Git ;
- l’architecture et les décisions via le handoff ;
- les preuves de validation via les rapports ;
- la prochaine étape via le prompt de reprise ;
- les secrets uniquement dans l’environnement local sécurisé.

Il ne transfère pas l’interface ou les conversations historiques d’Antigravity. Il rend cet historique non indispensable pour continuer correctement le projet.
