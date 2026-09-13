import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SearchWork } from '@/domain/canonicalSearch';

// One cached canonical metadata snapshot, independent of keystrokes and filters.
// Keyset pagination avoids Supabase's default row limit silently hiding works.
export function useCanonicalSearch(enabled: boolean) {
  return useQuery({
    queryKey: ['canonical-search-index', 1],
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async ({ signal }): Promise<SearchWork[]> => {
      const works: SearchWork[] = [];
      let after = 0;
      while (true) {
        const { data, error } = await supabase.from('mangas')
          .select('id,title,aliases,author,genre,manga_type,status,cover_image,rating,views,created_at,content_rating')
          .gt('id', after).order('id', { ascending: true }).limit(500).abortSignal(signal);
        if (error) throw error;
        if (!data?.length) break;
        works.push(...data);
        after = data[data.length - 1].id;
      }
      return works;
    },
  });
}
