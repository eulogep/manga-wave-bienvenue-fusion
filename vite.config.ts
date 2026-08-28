import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

const mangaDexUserAgent =
  'MangaWave/0.1 (development contact: github.com/eulogep/manga-wave-bienvenue-fusion)';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
}));
