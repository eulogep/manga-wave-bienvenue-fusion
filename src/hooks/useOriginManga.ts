import { useQuery } from '@tanstack/react-query';
import {
    searchOriginManga,
    getPopularOriginManga,
    getOriginMangaDetail,
    getOriginMangaPages,
} from '@/integrations/originmanga/client';

export function usePopularOriginManga() {
    return useQuery({
        queryKey: ['originmanga', 'popular'],
        queryFn: () => getPopularOriginManga(),
        staleTime: 10 * 60 * 1000,
    });
}

export function useOriginMangaSearch(query: string, page = 1) {
    return useQuery({
        queryKey: ['originmanga', 'search', query, page],
        queryFn: () => searchOriginManga(query, page),
        enabled: query.trim().length >= 2,
        staleTime: 5 * 60 * 1000,
    });
}

export function useOriginMangaDetail(mangaId: string | undefined) {
    return useQuery({
        queryKey: ['originmanga', 'detail', mangaId],
        queryFn: () => getOriginMangaDetail(mangaId!),
        enabled: Boolean(mangaId),
        staleTime: 5 * 60 * 1000,
    });
}

export function useOriginMangaPages(chapterId: string | undefined) {
    return useQuery({
        queryKey: ['originmanga', 'pages', chapterId],
        queryFn: () => getOriginMangaPages(chapterId!),
        enabled: Boolean(chapterId),
        staleTime: 60 * 60 * 1000, // Les pages ne changent pas
    });
}