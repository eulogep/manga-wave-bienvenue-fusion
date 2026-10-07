# TypeSafe / Jev — expérimentation Manga Wave

Date : 7 octobre 2026. Classification : **EXPERIMENTAL**.

## Décision

Conserver les règles comme moteur primaire. Jev mérite un essai en observation pour les
ambiguïtés d’identité et l’escalade humaine. Il n’existe actuellement aucune preuve mesurée
qu’un appel distant améliore les règles de retry, les circuits ou le choix d’un chapitre.
L’expérience est isolée dans `scripts/experiments/` ; aucun appel TypeSafe n’est ajouté au
frontend, au lecteur, au synchroniseur ou à une tâche distante.

L’accès `TYPESAFE_API_KEY` n’a pas été trouvé dans l’environnement du processus ni dans les
fichiers `.env` / `.env.local` présents. Aucun secret n’a été affiché et aucun appel facturé
n’a été tenté. Les métriques Jev ci-dessous sont **non mesurées**, jamais remplacées par
des résultats de mocks ou les chiffres marketing.

## Sources officielles vérifiées

- [Site TypeSafe](https://typesafe.ai) et [organisation GitHub officielle](https://github.com/typesafe-ai).
- [API](https://docs.typesafe.ai/api) : entrée `state` + questions typées, sortie structurée ;
  Choice renvoie un choix, une distribution et une confiance. Un Noul renvoie une probabilité
  binaire, sans champ de confiance distinct. Le banc utilise l’API HTTP depuis Node, sans SDK
  supplémentaire ni dépendance applicative.
- [Confiance](https://docs.typesafe.ai/confidence) : la confiance Choice est dérivée de la
  distribution, pas une mesure de précision observée. Avec deux choix, elle vaut
  `2 * max(p) - 1`. Ne pas la confondre avec la probabilité d’un appariement correct.
- [Modèles et prix](https://docs.typesafe.ai/models) : modèle épinglé `jev-1.13.0`, prix affiché
  de **0,042 USD par million de tokens entrants**, sortie gratuite. Une requête de 2 000
  tokens entrants coûterait 0,000084 USD à ce tarif ; ce calcul n’est pas une facture ni
  une mesure de notre charge. Les alias peuvent changer, donc le banc refuse une version
  retournée différente. La documentation signale une qualité moins uniforme hors anglais,
  point sensible pour les titres français, japonais, chinois et coréens.

## Périmètre évalué

| Décision | Règle existante / contrainte | Intérêt éventuel de Jev | Verdict actuel |
| --- | --- | --- | --- |
| Source selection | `rankSources`, mapping canonique et éligibilité | Départager des candidats déjà admissibles | Règles primaires ; pas de vérité historique suffisante |
| Provider fallback | `selectAutomaticFallback`, chapitre exact, langue, budget et sources déjà essayées | Ordre des seuls candidats admissibles | Aucun bénéfice démontré |
| Retry / stop | `ProviderHttpClient`, budget borné, Retry-After, 403 terminal | Classification de diagnostics inconnus | HTTP connu : garder les règles |
| Canonical identity | `selectMetadataMatch`, auteurs, alias, collisions et ambiguïtés | Proposition sur cas REVIEW multilingues | Candidat au shadow ; aucune fusion automatique |
| Metadata routing | chaîne MangaDex/MangaUpdates/Kitsu/AniList/Jikan | Prédire le meilleur prochain fournisseur | Ne pas remplacer circuit et provenance |
| Provider health | indisponibilité et circuit ouvert excluent une source | Priorisation de sondes à faible risque | Ne peut pas réactiver une source désactivée |
| Human review | conflit d’identité ou preuve insuffisante | Trier les cas et proposer une classe | Meilleur candidat à un pilote supervisé |
| Background jobs | files, cadence, idempotence et droits | Priorité parmi jobs déjà autorisés | Aucun droit de lancer/modifier/supprimer un job |

Jev n’est utilisé ni comme catalogue, ni comme scraper, ni comme backend de lecture,
ni comme assistant ou générateur de recommandations. Aucun LLM actuel n’a été remplacé.

## Données historiques et limites

Trois incidents documentés sont rejoués : AniList 403 et Jikan 504
(`MANGA_WAVE_V3_T3020_REPORT.md`, section MULTI_PROVIDER_METADATA_LAYER), Mangakakalot 522
(`MANGA_WAVE_V3_P4_PROVIDER_RESILIENCE_REPORT.md`, PROVIDER DECISIONS).

Les rapports donnent les statuts, pas une trace complète horodatée contenant latence,
mapping, langue, chapitre et résultat utilisateur. Le banc ne fabrique pas ces champs.
Il injecte chaque statut dans le **vrai ProviderHttpClient existant**, sans requête aux
fournisseurs, puis observe sa classification de transport. Les étiquettes attendues ont
été annotées selon la politique documentée ; elles ne constituent pas un gold indépendant.
Chaque incident est répété cinq fois pour observer la stabilité, soit 15 exécutions mais
seulement **3 cas distincts**. Les retries et attentes réseau sont désactivés dans le replay.

Le 522 est classé transitoire par le transport ; Mangakakalot reste désactivé par la politique
supérieure. Cette classe ne donne **jamais** l’autorisation de réessayer ce fournisseur.
Les 149 appariements EXACT et 75 collisions du rapport de métadonnées sont des agrégats :
ils ne sont pas transformés artificiellement en exemples annotés sans les entrées originales.

## Mesures exécutées

Run du 7 octobre 2026, Node local, première initialisation incluse :

| Mesure | A : règles réelles en replay | B : Jev | C : petit LLM |
| --- | --- | --- | --- |
| Accord avec politique annotée | 3/3 cas, 15/15 répétitions | NOT_MEASURED | NOT_RUN_OPTIONAL |
| Précision sur décisions métier indépendantes | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| Latence p50 / p95 | 0,064 / 16,039 ms, replay CPU, pas réseau | NOT_MEASURED | NOT_MEASURED |
| Coût d’API | 0 USD | NOT_MEASURED, aucun appel | aucun appel |
| Déterminisme | même sortie sur 5 répétitions de chaque cas | NOT_MEASURED | NOT_MEASURED |
| Faux positifs / négatifs | 0/1 statut terminal ; 0/2 transitoires, non représentatif | NOT_MEASURED | NOT_MEASURED |
| Calibration / Brier | règles sans probabilité | INSUFFICIENT_DATA | NOT_MEASURED |
| Panne TypeSafe | décision existante conservée | tests de transport simulé uniquement | sans objet |

La p95 froide est dominée par l’initialisation du chemin HTTP simulé. Ni ces durées ni
le tarif fournisseur ne permettent d’affirmer une accélération ou une économie en production.
Le script calcule précision, p50/p95, Brier, FP/FN, répétabilité exacte et coût estimé sur
les réponses réellement reçues lorsqu’un accès est fourni. Les appels échoués restent
visibles avec leur statut ; leur éventuelle facturation n’est pas connue.

## Frontière de sécurité et failover

`observeJev` est un adaptateur **shadow**, pas un moteur d’exécution :

1. La règle produit d’abord sa décision.
2. Une copie réduite de l’état (fournisseur, statut HTTP, budget) peut être soumise à Jev.
3. Validation fermée de l’enum, des nombres finis, de la distribution normalisée,
   du choix maximum, de la confiance et de la version de modèle.
4. La suggestion est enregistrée séparément ; `executedDecision` reste celle des règles,
   y compris si Jev répond avec une confiance élevée et contredit la politique.

Clé absente : aucun réseau. Deadline totale de 1 500 ms pour l’observation, interruption de
la requête et course de promesses même si le transport n’honore pas le signal. Aucun retry
TypeSafe automatique. 401/429/500/529, timeout, erreur réseau, JSON invalide ou sortie
hors schéma : conserver la règle. Rien de ce chemin n’est branché à la latence du Reader.
Les tests couvrent ces protections sans les présenter comme disponibilité API réelle.

## Seuils et calibration

`autonomyThreshold = null`, `secondaryThreshold = null` : **autonomie désactivée**.
Il serait trompeur de calibrer 0,90/0,65, ou tout autre chiffre, avec trois statuts et
zéro réponse Jev. Même une confiance de 1 ne peut déclencher une mutation dans ce pilote.

Avant un pilote secondaire :

- Exporter des incidents et candidats réels, sans comptes, sessions, secrets ni historique
  individuel ; conserver provenance, instant de décision et résultat observé.
- Faire annoter indépendamment chaque classe, en incluant rejets, pannes, homonymes,
  adaptations, alias CJK, conflits d’auteur et absences de chapitre.
- Séparer chronologiquement calibration et test ; grouper par œuvre/incident pour éviter
  qu’un doublon ou une répétition se retrouve des deux côtés.
- Mesurer par tâche et langue : matrice de confusion, précision/rappel, FP/FN, Brier,
  diagramme de fiabilité et ECE avec effectifs par bin, couverture des abstentions,
  p50/p95/p99 sous froid/chaud et erreurs/timeouts. Comparer les sorties Jev brutes et
  celles après politique ; ne pas attribuer au modèle la précision du fallback.
- Choisir sur calibration le seuil offrant le plus de couverture sous un plafond de
  faux positifs défini par le produit, avec borne de confiance statistique ; le confirmer
  une seule fois sur le test tenu à l’écart. Les fusions d’identité restent interdites.
- Versionner modèle, rubrique, données et seuils. Recalibrer après tout changement de
  modèle, de fournisseur ou de distribution. Si le plafond ne peut être établi faute
  d’effectifs, garder le seuil désactivé et la revue humaine.

## Reproduire

```sh
node --experimental-strip-types scripts/experiments/jev-benchmark.ts --out=/tmp/mw-jev.json
node --experimental-strip-types --test tests/jevShadow.test.ts
# Avec TYPESAFE_API_KEY configurée uniquement côté terminal/serveur :
node --experimental-strip-types scripts/experiments/jev-benchmark.ts --live --out=/tmp/mw-jev-live.json
```

Ne pas définir de variable `VITE_*` pour cette clé. Le mode `--live` envoie au maximum
15 petites requêtes sur les trois statuts publics ; il ne modifie aucune donnée Manga Wave.
Le baseline LLM facultatif est différé : coût et complexité supplémentaires sans jeu
de test assez riche pour une comparaison utile.

```text
TYPESAFE_LATENCY: NOT_MEASURED
TYPESAFE_COST: NOT_MEASURED (tarif documenté, aucun appel)
TYPESAFE_ACCURACY: NOT_MEASURED
CALIBRATION: INSUFFICIENT_DATA / AUTONOMY_DISABLED
FAILOVER: PASS (9 tests locaux, pas de preuve de disponibilité API)
RULE_BASELINE: PASS (3 cas historiques de transport ; pas de validation métier générale)
LLM_BASELINE: NOT_RUN_OPTIONAL
RECOMMENDATION: EXPERIMENTAL
```
