import { mangaDexSource } from './mangadex';
import { originMangaSource } from './originmanga';
import { crunchyScanSource } from './crunchyscan';
import { comickSource } from './comick';
import { mangaFireSource } from './mangafire';
import { asuraScansSource } from './asurascans';
import type { MangaSource, SourceSearchResult, SourceType } from './types';

export * from './types';
export { originMangaSource } from './originmanga';
export { mangaDexSource } from './mangadex';
export { crunchyScanSource } from './crunchyscan';
export { comickSource } from './comick';
export { mangaFireSource } from './mangafire';
export { asuraScansSource } from './asurascans';

export const sources: Record<string, MangaSource> = {
  mangadex: mangaDexSource,
  originmanga: originMangaSource,
  crunchyscan: crunchyScanSource,
  comick: comickSource,
  mangafire: mangaFireSource,
  asurascans: asuraScansSource,
};

export const sourceList: MangaSource[] = [
  mangaDexSource,
  originMangaSource,
  comickSource,
  crunchyScanSource,
  mangaFireSource,
  asuraScansSource,
];

export function getSource(sourceId: SourceType | string): MangaSource | undefined {
  return sources[sourceId];
}

export function isValidSource(sourceId: string): sourceId is SourceType {
  return sourceId in sources;
}

export async function searchAllSources(
  query: string,
  page = 1,
  selectedSources?: SourceType[],
): Promise<SourceSearchResult[]> {
  const activeSources = selectedSources?.length
    ? sourceList.filter((s) => selectedSources.includes(s.id))
    : sourceList;

  const results = await Promise.allSettled(
    activeSources.map((source) => source.search(query, page)),
  );

  return results.flatMap((res) => (res.status === 'fulfilled' ? res.value : []));
}
