Configuration Scantrad (approches A + D)

Le mode local recommandé connecte le backend à un vrai Google Chrome via un endpoint CDP limité à la boucle locale. Cela conserve l'empreinte du navigateur dans lequel le challenge a été résolu. Les autres sources continuent d'utiliser des contextes isolés.

1. Ouvrir le Chrome Scantrad

Dans un premier terminal, depuis le dossier server :

    export SCANTRAD_CDP_URL='http://127.0.0.1:9222'
    npm run scantrad:login

Résolvez le challenge sur `https://manga-scantrad.io/manga/`, puis laissez Chrome et ce terminal ouverts.

Dans un second terminal :

    cd "/chemin/du/projet/server"
    export SCANTRAD_CDP_URL='http://127.0.0.1:9222'
    npm run dev

Le backend se connecte alors au Chrome local sans exposer CDP sur le réseau. Fermer Chrome coupe la source Scantrad, mais pas les autres sources.

Le mode persistant Playwright sans CDP reste disponible en omettant `SCANTRAD_CDP_URL`. Sur les protections Cloudflare agressives, il peut rester bloqué même avec un `cf_clearance` valide.

2. Configurer un proxy (option D)

    export SCANTRAD_PROXY_SERVER='http://proxy.example:8080'
    export SCANTRAD_PROXY_USERNAME='user'
    export SCANTRAD_PROXY_PASSWORD='secret'

Les protocoles http, https et socks5 sont acceptés. En mode CDP, Chrome reçoit uniquement l'adresse du proxy ; s'il demande une authentification, saisissez-la dans sa fenêtre. En mode Playwright persistant, les variables d'identifiant/mot de passe sont disponibles uniquement pour HTTP(S), car Playwright ne les prend pas en charge pour SOCKS5. Les identifiants intégrés dans l'URL du proxy sont refusés. Utilisez uniquement un fournisseur autorisé et conforme aux conditions du site. Un proxy ordinaire ne résout pas Cloudflare et ne « transporte » pas automatiquement une session : le challenge doit être résolu depuis sa sortie réseau.

3. Injection facultative de cookies

Utilisez une seule des deux variables :

    export SCANTRAD_COOKIES_PATH='/chemin/absolu/scantrad-cookies.json'

ou :

    export SCANTRAD_COOKIES_JSON='[{"name":"cf_clearance","value":"...","domain":".manga-scantrad.io","path":"/","secure":true,"httpOnly":true,"sameSite":"None"}]'

Le fichier doit contenir un tableau de cookies au format Playwright. Chaque cookie doit avoir un nom non vide et utiliser soit une URL HTTPS Scantrad, soit la paire domaine Scantrad + chemin. Les cookies configurés sont injectés une seule fois à l'initialisation du contexte, afin qu'une valeur statique ne remplace pas ensuite un cookie renouvelé dans le profil. Ne commitez jamais les cookies ni les identifiants proxy.

4. Variables disponibles

    SCANTRAD_USER_DATA_DIR   Profil persistant (local : server/.playwright_user_data/scantrad)
    SCANTRAD_CDP_URL         Endpoint Chrome local recommandé (http://127.0.0.1:9222)
    SCANTRAD_HEADLESS        true par défaut en mode Playwright sans CDP
    SCANTRAD_USER_AGENT      Surcharge facultative ; sinon dérivé de la version Chromium
    SCANTRAD_PROXY_SERVER    URL du proxy
    SCANTRAD_PROXY_USERNAME  Identifiant facultatif
    SCANTRAD_PROXY_PASSWORD  Mot de passe facultatif
    SCANTRAD_COOKIES_PATH    Fichier JSON facultatif
    SCANTRAD_COOKIES_JSON    Tableau JSON facultatif

Limite de déploiement

Un profil local n'est durable que sur une machine ou un conteneur dont le disque survit au redémarrage. Sur Vercel ou AWS Lambda, le défaut devient un dossier temporaire inscriptible et propre au processus (`<tmp>/scantrad-<pid>`), pour éviter les verrous entre instances. Ce dossier peut être réutilisé par une instance chaude, mais `/tmp` est éphémère et n'est ni partagé ni durable entre instances.

Ne configurez pas plusieurs instances avec le même `userDataDir`, même sur un volume partagé : Chromium verrouille le profil ouvert. Une montée en charge serverless exige un profil distinct par instance et un mécanisme externe pour provisionner la session de chacune ; ce projet ne fournit pas de profil durable partagé entre instances.
