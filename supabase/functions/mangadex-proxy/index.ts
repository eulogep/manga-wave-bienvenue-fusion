import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_BASE = "https://api.mangadex.org";
const UPLOADS_BASE = "https://uploads.mangadex.org";
const FUNCTION_PATH = "/mangadex-proxy";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

function response(status: number, body: BodyInit | null, headers: HeadersInit = {}) {
  return new Response(body, { status, headers: { ...CORS_HEADERS, ...headers } });
}

function resourcePath(url: URL) {
  const index = url.pathname.indexOf(FUNCTION_PATH);
  return index === -1 ? null : url.pathname.slice(index + FUNCTION_PATH.length) || "/";
}

function coverTarget(path: string) {
  const match = path.match(/^\/cover\/([0-9a-f-]{36})\/([A-Za-z0-9._-]+)$/);
  return match ? `${UPLOADS_BASE}/covers/${match[1]}/${encodeURIComponent(match[2])}` : null;
}

function allowedMangaPath(path: string) {
  return /^\/manga(?:\/[0-9a-f-]{36}(?:\/feed)?)?$/.test(path);
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return response(204, null);
    if (request.method !== "GET") {
      return response(405, JSON.stringify({ error: "GET uniquement" }), {
        "Content-Type": "application/json",
      });
    }

    const url = new URL(request.url);
    const path = resourcePath(url);
    if (!path) {
      return response(400, JSON.stringify({ error: "Chemin invalide" }), {
        "Content-Type": "application/json",
      });
    }

    const cover = coverTarget(path);
    if (!cover && !allowedMangaPath(path)) {
      return response(404, JSON.stringify({ error: "Ressource non exposée" }), {
        "Content-Type": "application/json",
      });
    }

    try {
      const upstream = await fetch(cover ?? `${API_BASE}${path}${url.search}`, {
        headers: {
          "Accept": cover ? "image/avif,image/webp,image/*,*/*;q=0.8" : "application/json",
          "User-Agent": "MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)",
        },
      });
      const headers = new Headers(CORS_HEADERS);
      headers.set(
        "Cache-Control",
        cover
          ? "public, max-age=604800, s-maxage=2592000, immutable"
          : "public, max-age=300, s-maxage=600",
      );
      const contentType = upstream.headers.get("Content-Type");
      if (contentType) headers.set("Content-Type", contentType);

      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return response(502, JSON.stringify({ error: "MangaDex est indisponible" }), {
        "Content-Type": "application/json",
      });
    }
  },
};
