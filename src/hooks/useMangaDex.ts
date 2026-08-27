import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getMangaById,
  getPopularManga,
  searchManga,
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
