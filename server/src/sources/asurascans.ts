import { createGenericBrowserSource } from './generic-browser-source.js';

export const asuraScansExtractor = createGenericBrowserSource({
  id: 'asurascans',
  name: 'AsuraScans',
  baseUrl: 'https://asurascans.com',
  language: 'en',
  mangaPath: (mangaId) => `/comics/${mangaId}`,
  searchPath: (query, page) => `/browse?q=${encodeURIComponent(query)}&page=${page}`,
  mangaHrefPattern: '/comics/',
  chapterHrefPatterns: ['/chapter/', '/read/'],
  readerSelectors: [
    'img[src*="/asura-images/chapters/"]',
    'img[data-src*="/asura-images/chapters/"]',
    '.py-8 img',
    '[class*="reader"] img',
    '[class*="chapter"] img',
    'main img',
  ],
});
