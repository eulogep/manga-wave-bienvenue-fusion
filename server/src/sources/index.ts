import { asuraScansExtractor } from './asurascans.js';
import { comickExtractor } from './comick.js';
import { crunchyScanExtractor } from './crunchyscan.js';
import { mangaDexExtractor } from './mangadex.js';
import { mangaFireExtractor } from './mangafire.js';
import { originMangaExtractor } from './originmanga.js';
import type { SourceExtractor } from '../lib/extractor-types.js';

export const extractors: Record<string, SourceExtractor> = {
  mangadex: mangaDexExtractor,
  comick: comickExtractor,
  originmanga: originMangaExtractor,
  crunchyscan: crunchyScanExtractor,
  mangafire: mangaFireExtractor,
  asurascans: asuraScansExtractor,
};

export function getExtractor(sourceId: string): SourceExtractor | null {
  return extractors[sourceId] || null;
}
