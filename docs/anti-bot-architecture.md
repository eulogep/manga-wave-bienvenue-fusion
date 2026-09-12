# Accès fournisseurs et résilience

Date de vérification : 2026-09-13

Manga Wave traite les protections anti-bot comme une limite du fournisseur. Le projet ne contourne
pas les challenges, ne falsifie pas d’empreinte TLS, ne résout pas de CAPTCHA et ne réutilise pas de
cookies obtenus par un navigateur furtif. Un refus `403` est terminal pour la requête concernée et
la couche multi-source peut alors choisir une autre source déjà autorisée.

## Client HTTP serveur

`server/src/lib/provider-http.ts` centralise les requêtes HTML des sources compatibles :

- HTTPS obligatoire ;
- User-Agent stable qui identifie Manga Wave ;
- intervalle minimal de deux secondes par origine ;
- déduplication des requêtes simultanées identiques ;
- cache mémoire borné à 200 réponses, avec une durée par défaut de cinq minutes ;
- délai exponentiel borné et respect de `Retry-After` sur `408`, `429` et `5xx` ;
- deux retries au maximum ;
- aucun retry sur `403` ou autre erreur client déterministe.

Le cache HTTP public des routes Vercel complète ce cache éphémère. Les données d’API, les comptes et
les cookies utilisateurs ne sont jamais stockés dans ce cache fournisseur.

## État des candidats proposés

| Source | Constat vérifié | Décision |
|---|---|---|
| Webtoon | La page publique d’une série expose titre, auteur, synopsis, couverture et URL canonique. Son `robots.txt` interdit les pages `viewer` au user-agent `Scrapy`. | Métadonnées et lien officiel uniquement après définition d’un adaptateur canonique ; aucune copie des pages de lecture. |
| Tapas | Les pages `/series/...` sont publiquement rendues et le `robots.txt` permet les pages de série au groupe général. Les pages `/episode/` sont interdites au user-agent `Scrapy`. | Métadonnées et lien officiel uniquement ; aucun navigateur furtif et aucune extraction d’épisodes. |
| Mangakakalot | La racine a répondu `522` derrière Cloudflare lors de la vérification. | Fournisseur désactivé. Aucun `curl_cffi`, FlareSolverr ou plugin stealth. |

Webtoon et Tapas ne sont pas ajoutés au contrat `SourceExtractor` actuel, car ce contrat implique
`getPages()` et donc une lecture intégrée. Les déclarer comme sources de lecture avec une liste de
pages vide créerait un fournisseur artificiellement disponible et dégraderait le fallback. Leur
future intégration doit passer par le contrat de métadonnées canonique, avec un lien sortant vers le
lecteur officiel.

## Exploitation

Une source compatible doit échouer clairement quand sa structure change ou quand l’accès est
refusé. `SourceManager` mesure les échecs, ouvre son circuit après trois échecs consécutifs et expose
`retryAt` dans `/api/extract/health`. Le client HTTP réduit les appels avant que le circuit ne soit
sollicité grâce au cache et au regroupement des requêtes concurrentes.

Les nouveaux fournisseurs doivent être validés avec une requête identifiée à faible volume, leurs
règles publiques et leur contrat d’utilisation. Un challenge actif, un CAPTCHA ou une interdiction
explicite arrête l’intégration technique ; le fournisseur peut rester proposé comme lien externe.
