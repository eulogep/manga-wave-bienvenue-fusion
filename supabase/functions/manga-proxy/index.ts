import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Universal Manga Wave Edge Proxy
 * Provides CORS bypass, user-agent/referer emulation, and edge caching for manga scrapers
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-target-url, x-referer",
  "Vary": "Origin",
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ALLOWED_HOSTS = new Set([
  "api.comick.app",
  "api.comick.fun",
  "crunchyscan.fr",
  "lelmanga.com",
  "www.lelmanga.com",
  "originmanga.com",
  "www.originmanga.com",
]);

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url") || request.headers.get("x-target-url");

    if (!targetUrl) {
      return jsonResponse(400, { error: "Paramètre 'url' ou header 'x-target-url' manquant." });
    }

    try {
      const parsedTarget = new URL(targetUrl);
      if (parsedTarget.protocol !== "https:" || !ALLOWED_HOSTS.has(parsedTarget.hostname)) {
        return jsonResponse(403, { error: "Source non autorisée." });
      }
      const referer = url.searchParams.get("referer") ||
        request.headers.get("x-referer") ||
        `${parsedTarget.protocol}//${parsedTarget.host}/`;

      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Referer": referer,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
        },
      });

      const responseHeaders = new Headers(CORS_HEADERS);
      const contentType = upstream.headers.get("Content-Type");
      if (contentType) responseHeaders.set("Content-Type", contentType);

      // Cache headers based on content type
      if (contentType && (contentType.includes("image") || contentType.includes("font"))) {
        responseHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
      } else {
        responseHeaders.set("Cache-Control", "public, max-age=300, s-maxage=600");
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      return jsonResponse(502, {
        error: "Échec de récupération de la ressource en amont",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
