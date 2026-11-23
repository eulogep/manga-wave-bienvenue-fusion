import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { sentryVitePlugin } from '@sentry/bundler-plugins/vite';

const mangaDexUserAgent =
  'MangaWave/0.1 (development contact: github.com/eulogep/manga-wave-bienvenue-fusion)';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // Vercel exposes the deployed commit and its environment at build time.
  const sentryRelease = env.VITE_SENTRY_RELEASE || env.VERCEL_GIT_COMMIT_SHA || '';
  const sentryEnvironment = env.VITE_SENTRY_ENVIRONMENT || env.VERCEL_ENV || '';
  // Source maps are only generated when they can be uploaded, then deleted from the
  // build output so the original source is never served publicly.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN);

  return {
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease),
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(sentryEnvironment),
  },
  build: { modulePreload: false, sourcemap: uploadSourceMaps ? 'hidden' : false },
  server: {
    host: '::',
    port: 8080,
    proxy: {
      // Scraper backend (Node.js + Playwright)
      '/api/extract': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // MangaDex API direct proxies
      '/mangadex-api': {
        target: 'https://api.mangadex.org',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/mangadex-api/, ''),
        headers: { 'User-Agent': mangaDexUserAgent },
      },
      '/api/mangadex': {
        target: 'https://api.mangadex.org',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/mangadex/, ''),
        headers: { 'User-Agent': mangaDexUserAgent },
      },
      '/mangadex-covers': {
        target: 'https://uploads.mangadex.org',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/mangadex-covers\/cover/, '/covers'),
        headers: { 'User-Agent': mangaDexUserAgent },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    // Must stay last (Sentry docs): uploads source maps for the release, then deletes them.
    uploadSourceMaps && sentryVitePlugin({
      org: 'esiea-wy',
      project: 'manga-wave-frontend',
      authToken: env.SENTRY_AUTH_TOKEN,
      release: sentryRelease ? { name: sentryRelease } : undefined,
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  };
});
