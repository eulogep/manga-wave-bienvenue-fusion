const MANGADEX_API_BASE = 'https://api.mangadex.org';
const MANGADEX_UPLOADS_BASE = 'https://uploads.mangadex.org';
const FUNCTION_PATH = '/mangadex-proxy';
const USER_AGENT = 'MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  Vary: 'Origin',
};

function jsonResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function extractResourcePath(requestUrl: URL): string | null {
  const functionPathIndex = requestUrl.pathname.indexOf(FUNCTION_PATH);
  if (functionPathIndex === -1) return null;

  const resourcePath = requestUrl.pathname.slice(functionPathIndex + FUNCTION_PATH.length);
  return resourcePath || '/';
}

function isSafeMangaPath(resourcePath: string): boolean {
  return /^\/manga(?:\/[0-9a-f-]{36}(?:\/feed)?)?$/.test(resourcePath);
}

function getCoverTarget(resourcePath: string): string | null {
  const match = resourcePath.match(/^\/cover\/([0-9a-f-]{36})\/([A-Za-z0-9._-]+)$/);
  if (!match) return null;

  const [, mangaId, fileName] = match;
  return `${MANGADEX_UPLOADS_BASE}/covers/${mangaId}/${encodeURIComponent(fileName)}`;
}

function forwardResponse(upstream: Response, cacheControl: string): Response {
  const headers = new Headers(corsHeaders);
  headers.set('Cache-Control', cacheControl);

  const contentType = upstream.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  const etag = upstream.headers.get('ETag');
  if (etag) headers.set('ETag', etag);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse(405, 'Seules les requêtes GET sont acceptées.');
  }

  const requestUrl = new URL(request.url);
  const resourcePath = extractResourcePath(requestUrl);

  if (!resourcePath) {
    return jsonResponse(400, 'Chemin de proxy MangaDex invalide.');
  }

  const coverTarget = getCoverTarget(resourcePath);
  const isCoverRequest = Boolean(coverTarget);

  if (!coverTarget && !isSafeMangaPath(resourcePath)) {
    return jsonResponse(404, 'Cette ressource MangaDex n’est pas exposée par le proxy.');
  }

  const targetUrl = coverTarget
    ? coverTarget
    : `${MANGADEX_API_BASE}${resourcePath}${requestUrl.search}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        Accept: isCoverRequest ? 'image/avif,image/webp,image/*,*/*;q=0.8' : 'application/json',
        'User-Agent': USER_AGENT,
      },
    });

    return forwardResponse(
      upstream,
      isCoverRequest
        ? 'public, max-age=604800, s-maxage=2592000, immutable'
        : 'public, max-age=300, s-maxage=600',
    );
  } catch {
    return jsonResponse(502, 'Le proxy ne peut pas joindre MangaDex pour le moment.');
  }
});
