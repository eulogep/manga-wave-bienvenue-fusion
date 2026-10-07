import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getMangaById,
  getMangaChapters,
  getPopularManga,
  searchManga,
  type MangaDexChapterOptions,
  type MangaDexSearchOptions,
} from '@/integrations/mangadex/client';

export const mangaDexQueryKeys = {
  all: ['mangadex'] as const,
  popular: (limit: number) => [...mangaDexQueryKeys.all, 'popular', limit] as const,
  search: (options: MangaDexSearchOptions) =>
    [
      ...mangaDexQueryKeys.all,
      'search',
      options.title || '',
      options.status || '',
      options.offset || 0,
      options.limit || 24,
    ] as const,
  detail: (id: string) => [...mangaDexQueryKeys.all, 'detail', id] as const,
  chapters: (id: string, options: MangaDexChapterOptions) =>
    [
      ...mangaDexQueryKeys.all,
      'chapters',
      id,
      options.translatedLanguage || '',
      options.offset || 0,
      options.limit || 100,
    ] as const,
};

const CATALOGUE_STALE_TIME = 5 * 60 * 1_000;

export function usePopularMangaDex(limit = 24) {
  return useQuery({
    queryKey: mangaDexQueryKeys.popular(limit),
    queryFn: () => getPopularManga(limit),
    staleTime: CATALOGUE_STALE_TIME,
    gcTime: 30 * 60 * 1_000,
    retry: (failureCount, error) => {
      if ('status' in error && error.status === 429) return false;
      return failureCount < 2;
    },
  });
}

export function useMangaDexSearch(options: MangaDexSearchOptions) {
  const searchTerm = options.title?.trim() || '';

  return useQuery({
    queryKey: mangaDexQueryKeys.search(options),
    queryFn: () => searchManga(options),
    enabled: searchTerm.length >= 2,
    staleTime: CATALOGUE_STALE_TIME,
    gcTime: 30 * 60 * 1_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if ('status' in error && error.status === 429) return false;
      return failureCount < 2;
    },
  });
}

export function useMangaDexDetail(id: string | undefined) {
  return useQuery({
    queryKey: mangaDexQueryKeys.detail(id || ''),
    queryFn: () => getMangaById(id || ''),
    enabled: Boolean(id),
    staleTime: CATALOGUE_STALE_TIME,
    gcTime: 30 * 60 * 1_000,
    retry: (failureCount, error) => {
      if ('status' in error && error.status === 429) return false;
      return failureCount < 2;
    },
  });
}

export function useMangaDexChapters(
  mangaId: string | undefined,
  options: MangaDexChapterOptions = {},
) {
  return useQuery({
    queryKey: mangaDexQueryKeys.chapters(mangaId || '', options),
    queryFn: () => getMangaChapters(mangaId || '', options),
    enabled: Boolean(mangaId),
    staleTime: CATALOGUE_STALE_TIME,
    gcTime: 30 * 60 * 1_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if ('status' in error && error.status === 429) return false;
      return failureCount < 2;
    },
  });
}
