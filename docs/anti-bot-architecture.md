# Architecture & Gestion des Anti-Bots & Scrapers (2026)

Ce document détaille les patterns d'architecture issus de **`manga-py/manga-py`** et **`Xonshiz/comic-dl`**, ainsi que les stratégies pour contourner les protections anti-bots (Cloudflare Turnstile, DDOS-Guard, WAF) dans un écosystème web moderne.

---

## 1. Patterns d'extraction inspirés de `manga-py` et `comic-dl`

Dans les architectures comme `manga-py` et `comic-dl`, chaque source manga est un **Extractor / Provider modulaire** :

```
┌─────────────────────────────────────────────────────────────┐
│                       Manga Wave Frontend                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       APIs JSON directes            Scrapers HTML / Regex
     (MangaDex, Comick.io)       (OriginManga, CrunchyScan)
                │                             │
                │                     ┌───────┴───────┐
                │                     ▼               ▼
                │             Proxy Multi-Pool   Edge Worker
                │            (Failover + Retry)  (Stealth Header)
                │                     │               │
                └─────────────────────┼───────────────┘
                                      ▼
                            Site Cible / CDN Images
```

### Principes implémentés dans Manga Wave (`src/integrations/common/scraperClient.ts`) :
1. **Pool de proxies rotatifs avec failover** : Si `corsproxy.io` échoue ou est limité, la requête bascule automatiquement sur `allorigins.win` puis `codetabs`.
2. **Exponential Backoff** : Temporisation progressive (400ms, 800ms, 1600ms) en cas de 429 (Rate Limit) ou 503.
3. **Emulation d'en-têtes de navigateur (Stealth Headers)** :
   - `User-Agent` Chrome moderne.
   - `Referer` dynamique configuré sur le domaine hôte (ex: `https://originmanga.com/` pour autoriser le chargement des images).
   - En-têtes `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`.

---

## 2. Gestion des protections Cloudflare & Anti-Bots en 2026

En 2026, Cloudflare utilise **Turnstile**, le fingerprinting TLS (JA3/JA4) et le comportement HTTP/2 pour bloquer les requêtes automatisées.

### Pourquoi un navigateur (SPA client) ne peut pas bypass Cloudflare seul :
- Le navigateur de l'utilisateur n'a pas accès aux en-têtes système (`User-Agent` forcé, `Forbidden Headers`).
- Les requêtes cross-origin sont bloquées par CORS avant même d'atteindre le serveur.

---

## 3. Les 3 Solutions d'Architecture Recommandées

### Option A : Edge Function / Cloudflare Worker (Déjà disponible)
- **Fichier** : [`supabase/functions/manga-proxy/index.ts`](file:///d:/PLATEFORME%20MANGA/supabase/functions/manga-proxy/index.ts)
- **Rôle** : Reçoit l'URL cible, injecte les en-têtes furtifs nécessaires, met en cache les images sur le CDN et renvoie la réponse sans restriction CORS.
- **Avantage** : 100% serverless, gratuit, aucun serveur à maintenir.

### Option B : FlareSolverr (Pour les sites sous challenge Cloudflare Turnstile actif)
**FlareSolverr** est un microservice proxy open-source qui résout les challenges Cloudflare en utilisant un vrai navigateur headless (Chromium).

```yaml
# docker-compose.yml pour FlareSolverr
version: "3"
services:
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    environment:
      - LOG_LEVEL=info
      - CAPTCHA_SOLVER=none # ou 2captcha / hcaptcha
    ports:
      - "8191:8191"
    restart: unless-stopped
```

**Fonctionnement** :
1. Manga Wave envoie une requête POST à `http://flaresolverr:8191/v1` avec `{ "cmd": "request.get", "url": "https://site-protege.com" }`.
2. FlareSolverr ouvre Chromium, attend la validation du challenge Cloudflare (5 secondes), récupère les cookies de session (`cf_clearance`).
3. Il retourne le HTML débloqué et les cookies.

### Option C : Microservice Node.js + Puppeteer-Extra-Plugin-Stealth
Pour un contrôle total sur les scrapers complexes (ex: sites qui nécessitent d'exécuter du JavaScript ou de scroller pour charger les images) :

```ts
// server/scraper-service.ts
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeProtectedManga(targetUrl: string) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9',
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle2' });
  const content = await page.content();
  await browser.close();

  return content;
}
```

---

## 4. Statut actuel dans Manga Wave

| Source | Protection | Solution actuelle |
|---|---|---|
| **MangaDex** | API Officielle | Accès direct via `api.mangadex.org` |
| **Comick.io** | API Publique | Accès direct via `api.comick.fun` |
| **OriginManga** | CORS / Hotlink | `resilientScrape` multi-proxy avec Referer spoofing |
| **CrunchyScan** | CORS / Cloudflare partiel | `resilientScrape` API endpoint + HTML fallback |
| **AsuraScans / MangaFire** | Cloudflare Challenge actif | Découverte + Redirection vers lecteur externe sécurisé |
