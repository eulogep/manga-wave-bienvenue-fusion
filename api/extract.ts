import { getExtractor, extractors } from '../server/src/sources/index.js';
import { sourceManager, SourceCircuitOpenError } from '../server/src/lib/source-manager.js';

type QueryValue = string | string[] | undefined;
type ApiRequest = {
  method?: string;
  query: Record<string, QueryValue>;
  url?: string;
};
type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
  send(body: unknown): unknown;
};

const IMAGE_HOST_SUFFIXES = [
  'asuracomic.net',
  'asurascans.com',
  'comick.pictures',
  'crunchyscan.fr',
  'crunchyscan.org',
  'crunchyscan.st',
  'mangadex.org',
  'mangafire.to',
  'lelmanga.com',
  'originmanga.com',
  'wp.com',
];

const stringParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || '';

sourceManager.register(Object.keys(extractors));

function allowedImageUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return null;
    const allowed = IMAGE_HOST_SUFFIXES.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
    return allowed ? url : null;
  } catch {
    return null;
  }
}

function routeParts(request: ApiRequest): string[] {
  const rewrittenPath = stringParam(request.query.path);
  if (rewrittenPath) return rewrittenPath.split('/').filter(Boolean);
  return request.url?.split('?')[0].replace(/^\/api\/extract\/?/, '').split('/').filter(Boolean) || [];
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const parts = routeParts(request);
  const action = parts[0] || 'health';

  if (action === 'health') {
    return response.status(200).json({ status: 'ok', sources: sourceManager.snapshots() });
  }

  if (action === 'image-proxy') {
    const target = allowedImageUrl(stringParam(request.query.url));
    if (!target) return response.status(400).json({ error: 'URL d’image non autorisée.' });
    try {
      const upstream = await fetch(target, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: `${target.protocol}//${target.host}/`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) return response.status(upstream.status).json({ error: 'Image indisponible.' });
      response.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      response.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return response.status(200).send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error: unknown) {
      return response.status(502).json({
        error: error instanceof Error ? error.message : 'Impossible de charger l’image.',
      });
    }
  }

  const sourceId = parts[1] || '';
  const extractor = getExtractor(sourceId);
  if (!extractor) return response.status(404).json({ error: `Source inconnue : ${sourceId}` });

  try {
    if (action === 'search') {
      const query = stringParam(request.query.q).trim();
      if (query.length < 2) return response.status(400).json({ error: 'Recherche trop courte.' });
      const page = Math.max(Number.parseInt(stringParam(request.query.page) || '1', 10), 1);
      const results = await sourceManager.execute(sourceId, 'search', () => extractor.search(query, page));
      response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      return response.status(200).json({ results });
    }

    if (action === 'popular') {
      const page = Math.max(Number.parseInt(stringParam(request.query.page) || '1', 10), 1);
      const results = await sourceManager.execute(sourceId, 'popular', () => extractor.getPopular(page));
      response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900');
      return response.status(200).json({ results });
    }

    const resourceId = decodeURIComponent(parts.slice(2).join('/'));
    if (!resourceId) return response.status(400).json({ error: 'Identifiant requis.' });

    if (action === 'detail') {
      const manga = await sourceManager.execute(sourceId, 'detail', () => extractor.getDetail(resourceId));
      response.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
      return response.status(200).json({ manga });
    }

    if (action === 'pages') {
      const images = await sourceManager.execute(sourceId, 'pages', () => extractor.getPages(resourceId));
      if (images.length === 0) {
        return response.status(404).json({ error: `Aucune page trouvée sur ${extractor.name}.` });
      }
      response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900');
      return response.status(200).json({ images, count: images.length });
    }

    return response.status(404).json({ error: `Action inconnue : ${action}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur d’extraction.';
    console.error(`[extract:${sourceId}:${action}]`, message);
    const status = error instanceof SourceCircuitOpenError ? 503 : 502;
    return response.status(status).json({
      error: message,
      source: sourceId,
      operation: action,
      retryAt: error instanceof SourceCircuitOpenError ? error.retryAt : null,
    });
  }
}
