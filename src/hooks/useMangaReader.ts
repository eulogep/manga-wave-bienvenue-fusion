import { useQuery } from '@tanstack/react-query';
import {
  getSource,
  searchAllSources,
  sourceList,
  type SourceChapter,
  type SourceType,
} from '@/integrations/sources';
import { getExtractorHealth } from '@/integrations/common/extractorClient';
import { rankSources, type SourceScoreBreakdown } from '@/domain/sourceResolution';

export type ChapterSourceAlternative = {
  source: SourceType;
  sourceName: string;
  mangaId: string;
  mangaTitle: string;
  chapter: SourceChapter | null;
  language: string;
  available: boolean;
  lastSuccessfulRequest: string | null;
  sourceScore: number;
  scoreBreakdown: SourceScoreBreakdown;
};

const normalizeTitle = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeChapterNumber = (value: string) => value
  .replace(/^0+/, '')
  .replace(/\.0+$/, '') || '0';

export function useUniversalChapterPages(sourceId: SourceType | string, chapterId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'pages', sourceId, chapterId],
    queryFn: async () => {
      if (!chapterId) return [];
      const source = getSource(sourceId);
      if (!source) throw new Error(`Source non reconnue : ${sourceId}`);
      const pages = await source.getPageUrls(chapterId);
      if (pages.length === 0) {
        throw new Error(`La source ${source.displayName} n'a retourné aucune page pour ce chapitre.`);
      }
      return pages;
    },
    enabled: Boolean(sourceId && chapterId),
    staleTime: 60 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });
}

export function useUniversalMangaDetail(sourceId: SourceType | string, mangaId: string | undefined) {
  return useQuery({
    queryKey: ['source', sourceId, 'detail', mangaId],
    queryFn: async () => {
      if (!mangaId) throw new Error('ID manga requis');
      const source = getSource(sourceId);
      if (!source) throw new Error(`Source non reconnue : ${sourceId}`);
      return source.getMangaDetails(mangaId);
    },
    enabled: Boolean(sourceId && mangaId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUniversalMangaChapters(
  sourceId: SourceType | string,
  mangaId: string | undefined,
  options?: { language?: string; offset?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['source', sourceId, 'chapters', mangaId, options?.language, options?.offset],
    queryFn: async () => {
      if (!mangaId) return [];
      const source = getSource(sourceId);
      if (!source) throw new Error(`Source non reconnue : ${sourceId}`);
      return source.getChapters(mangaId, options);
    },
    enabled: Boolean(sourceId && mangaId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMultiSourceSearch(
  query: string,
  page = 1,
  selectedSources?: SourceType[],
) {
  return useQuery({
    queryKey: ['sources', 'search', query, page, selectedSources],
    queryFn: () => searchAllSources(query, page, selectedSources),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChapterSourceAlternatives(
  mangaTitle: string | undefined,
  chapterNumber: string,
  currentSource: SourceType | string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reader', 'alternatives', mangaTitle, chapterNumber, currentSource],
    queryFn: async (): Promise<ChapterSourceAlternative[]> => {
      if (!mangaTitle) return [];
      const wantedTitle = normalizeTitle(mangaTitle);
      const wantedChapter = normalizeChapterNumber(chapterNumber);
      const health = await getExtractorHealth().catch(() => []);
      const healthBySource = new Map(health.map((item) => [item.sourceId, item]));
      const candidates = sourceList.filter(
        (candidate) => candidate.id !== currentSource
          && candidate.supportsSearch
          && candidate.supportsChapters
          && candidate.hasDirectPages,
      ).sort((left, right) => {
        const leftHealth = healthBySource.get(left.id);
        const rightHealth = healthBySource.get(right.id);
        if (leftHealth?.circuit === 'open' && rightHealth?.circuit !== 'open') return 1;
        if (rightHealth?.circuit === 'open' && leftHealth?.circuit !== 'open') return -1;
        return (rightHealth?.score ?? 100) - (leftHealth?.score ?? 100);
      });

      const results = await Promise.allSettled(candidates.map(async (candidate) => {
        const matches = await candidate.search(mangaTitle, 1);
        if (matches.length === 0) return null;

        const manga = matches.find((item) => normalizeTitle(item.title) === wantedTitle)
          || matches.find((item) => {
            const candidateTitle = normalizeTitle(item.title);
            return candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle);
          })
          || matches[0];
        const chapters = await candidate.getChapters(manga.id, { language: 'fr', limit: 500 });
        const chapter = chapters.find(
          (item) => normalizeChapterNumber(item.chapterNumber) === wantedChapter,
        ) || null;

        return {
          source: candidate.id,
          sourceName: candidate.displayName,
          sourceLanguage: candidate.lang,
          mangaId: manga.id,
          mangaTitle: manga.title,
          chapter,
          chapterCount: chapters.length,
        };
      }));

      const resolved = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
      const maximumChapterCount = Math.max(0, ...resolved.map((item) => item.chapterCount));
      const ranked = rankSources(resolved.map((item) => {
        const sourceHealth = healthBySource.get(item.source);
        return {
          sourceId: item.source,
          available: Boolean(item.chapter),
          circuit: sourceHealth?.circuit || 'closed',
          language: item.sourceLanguage,
          preferredLanguage: 'fr',
          averageLatencyMs: sourceHealth?.averageLatencyMs ?? null,
          requestCount: sourceHealth?.requestCount ?? 0,
          failureCount: sourceHealth?.failureCount ?? 0,
          chapterCount: item.chapterCount,
          maximumChapterCount,
          imageQualityScore: null,
          lastSuccessfulRequest: sourceHealth?.lastSuccessAt ?? null,
        };
      }));
      const scoreBySource = new Map(ranked.map((item) => [item.sourceId, item]));

      return resolved.map(({ sourceLanguage: _sourceLanguage, chapterCount: _chapterCount, ...alternative }) => {
        const sourceRanking = scoreBySource.get(alternative.source);
        return {
          ...alternative,
          language: _sourceLanguage,
          available: Boolean(alternative.chapter),
          lastSuccessfulRequest: sourceRanking?.lastSuccessfulRequest ?? null,
          sourceScore: sourceRanking?.sourceScore ?? 0,
          scoreBreakdown: sourceRanking?.breakdown ?? {
            availability: 0,
            latency: 0,
            language: 0,
            chapterCoverage: 0,
            imageQuality: 0,
            errorRate: 0,
            freshness: 0,
          },
        };
      }).sort((left, right) => right.sourceScore - left.sourceScore || left.source.localeCompare(right.source));
    },
    enabled: enabled && Boolean(mangaTitle?.trim()),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
