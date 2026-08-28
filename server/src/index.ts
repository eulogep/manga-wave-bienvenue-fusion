/**
 * Main Express Server — Manga Wave Scraper Backend
 * Exposes a REST API that the Vite frontend proxies to via /api/extract
 */
import express from 'express';
import cors from 'cors';
import { closeBrowser } from './lib/browser-pool.js';
import { extractors, getExtractor } from './sources/index.js';

const app = express();
const PORT = process.env.PORT || process.argv[2] || 3001;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

app.use(cors({ origin: ['http://localhost:8080', 'http://localhost:5173', 'https://ilmsomiaqthhfyvgqnsp.supabase.co'] }));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sources: Object.keys(extractors) });
});

// ─── Search ──────────────────────────────────────────────────────────
app.get('/api/extract/search/:source', async (req, res) => {
  const { source } = req.params;
  const query = String(req.query.q || '').trim();
  const page = parseInt(String(req.query.page || '1'), 10);

  const extractor = getExtractor(source);
  if (!extractor) return res.status(404).json({ error: `Source inconnue : ${source}` });
  if (!query) return res.status(400).json({ error: 'Paramètre q requis' });

  try {
    console.log(`[${source}] search: "${query}" page ${page}`);
    const results = await extractor.search(query, page);
    return res.json({ results });
  } catch (err: unknown) {
    const message = errorMessage(err);
    console.error(`[${source}] search error:`, message);
    return res.status(500).json({ error: message || 'Erreur lors de la recherche' });
  }
});

// ─── Popular ─────────────────────────────────────────────────────────
app.get('/api/extract/popular/:source', async (req, res) => {
  const { source } = req.params;
  const page = parseInt(String(req.query.page || '1'), 10);

  const extractor = getExtractor(source);
  if (!extractor) return res.status(404).json({ error: `Source inconnue : ${source}` });

  try {
    console.log(`[${source}] popular page ${page}`);
    const results = await extractor.getPopular(page);
    return res.json({ results });
  } catch (err: unknown) {
    const message = errorMessage(err);
    console.error(`[${source}] popular error:`, message);
    return res.status(500).json({ error: message || 'Erreur lors du chargement populaire' });
  }
});

// ─── Manga Detail + Chapters ──────────────────────────────────────────
app.get('/api/extract/detail/:source/:mangaId', async (req, res) => {
  const { source, mangaId } = req.params;

  const extractor = getExtractor(source);
  if (!extractor) return res.status(404).json({ error: `Source inconnue : ${source}` });

  try {
    console.log(`[${source}] detail: ${mangaId}`);
    const detail = await extractor.getDetail(mangaId);
    return res.json({ manga: detail });
  } catch (err: unknown) {
    const message = errorMessage(err);
    console.error(`[${source}] detail error:`, message);
    return res.status(500).json({ error: message || 'Erreur lors du chargement du manga' });
  }
});

// ─── Chapter Pages (THE KEY ENDPOINT) ────────────────────────────────
app.get('/api/extract/pages/:source/:chapterId', async (req, res) => {
  const { source, chapterId } = req.params;

  const extractor = getExtractor(source);
  if (!extractor) return res.status(404).json({ error: `Source inconnue : ${source}` });

  try {
    console.log(`[${source}] pages: chapter ${chapterId}`);
    const images = await extractor.getPages(chapterId);
    if (images.length === 0) {
      return res.status(404).json({
        error: `Aucune page trouvée pour ce chapitre sur ${extractor.name}. Le site a peut-être changé de structure.`,
      });
    }
    return res.json({ images, count: images.length });
  } catch (err: unknown) {
    const message = errorMessage(err);
    console.error(`[${source}] pages error:`, message);
    return res.status(500).json({ error: message || 'Impossible de charger les pages du chapitre' });
  }
});

// ─── Image Proxy (Bypasses Hotlink & Referer Restrictions) ───────────
app.get('/api/extract/image-proxy', async (req, res) => {
  const targetUrl = String(req.query.url || '').trim();
  const referer = String(req.query.referer || '').trim();

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('Paramètre url requis et doit commencer par http');
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (referer) {
      headers['Referer'] = referer;
    } else {
      try {
        const u = new URL(targetUrl);
        headers['Referer'] = `${u.protocol}//${u.host}/`;
      } catch {
        // The URL was validated above; omit the optional referer if parsing fails.
      }
    }

    const response = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: unknown) {
    const message = errorMessage(err);
    console.error('[ImageProxy] Error:', message);
    return res.status(500).send(`Image proxy error: ${message}`);
  }
});

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Manga Wave Scraper Backend running on http://localhost:${PORT}`);
  console.log(`   Sources: ${Object.keys(extractors).join(', ')}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export default app;
