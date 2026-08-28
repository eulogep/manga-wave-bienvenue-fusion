import { createGenericBrowserSource } from './generic-browser-source.js';

export const mangaFireExtractor = createGenericBrowserSource({
  id: 'mangafire',
  name: 'MangaFire',
  baseUrl: 'https://mangafire.to',
  language: 'en',
  mangaPath: (mangaId) => `/manga/${mangaId}`,
  searchPath: (query, page) => `/filter?keyword=${encodeURIComponent(query)}&page=${page}`,
  mangaHrefPattern: '/manga/',
  chapterHrefPatterns: ['/read/', '/chapter/'],
  readerSelectors: [
    '.manga-reading img',
    '.reading-content img',
    '[class*="reader"] img',
    '[class*="chapter"] img',
  ],
});
