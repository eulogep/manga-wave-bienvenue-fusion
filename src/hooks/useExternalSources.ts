import { useQuery } from '@tanstack/react-query';
import { searchComick, getComickDetail, getPopularComick } from '@/integrations/comick/client';
import { searchCrunchyScan, getCrunchyScanDetail, getPopularCrunchyScan } from '@/integrations/crunchyscan/client';
import { getPopularMangaFire, searchMangaFire } from '@/integrations/mangafire/client';
import { getPopularAsura, searchAsura } from '@/integrations/asurascans/client';

export function usePopularComick() {
  return useQuery({
    queryKey: ['comick-popular'],
    queryFn: () => getPopularComick(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useComickSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ['comick-search', query, page],
    queryFn: () => searchComick(query, page),
    enabled: Boolean(query.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useComickDetail(slugOrHid: string) {
  return useQuery({
    queryKey: ['comick-detail', slugOrHid],
    queryFn: () => getComickDetail(slugOrHid),
    enabled: Boolean(slugOrHid),
    staleTime: 1000 * 60 * 10,
  });
}

export function usePopularCrunchyScan() {
  return useQuery({
    queryKey: ['crunchyscan-popular'],
    queryFn: () => getPopularCrunchyScan(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useCrunchyScanSearch(query: string) {
  return useQuery({
    queryKey: ['crunchyscan-search', query],
    queryFn: () => searchCrunchyScan(query),
    enabled: Boolean(query.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCrunchyScanDetail(idOrSlug: string) {
  return useQuery({
    queryKey: ['crunchyscan-detail', idOrSlug],
    queryFn: () => getCrunchyScanDetail(idOrSlug),
    enabled: Boolean(idOrSlug),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMangaFireSearch(query: string) {
  return useQuery({
    queryKey: ['mangafire-search', query],
    queryFn: () => searchMangaFire(query),
    enabled: Boolean(query.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePopularMangaFire() {
  return useQuery({
    queryKey: ['mangafire-popular'],
    queryFn: () => getPopularMangaFire(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useAsuraSearch(query: string) {
  return useQuery({
    queryKey: ['asura-search', query],
    queryFn: () => searchAsura(query),
    enabled: Boolean(query.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePopularAsura() {
  return useQuery({
    queryKey: ['asurascans-popular'],
    queryFn: () => getPopularAsura(),
    staleTime: 1000 * 60 * 15,
  });
}
