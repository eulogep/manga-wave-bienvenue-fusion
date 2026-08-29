import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type RankedCanonicalSource = Database['public']['Functions']['rank_canonical_manga_sources']['Returns'][number];

export function useCanonicalSourceRanking(canonicalId: number | undefined, preferredLanguage = 'fr') {
  return useQuery({
    queryKey: ['canonical-source-ranking', canonicalId, preferredLanguage],
    queryFn: async (): Promise<RankedCanonicalSource[]> => {
      if (canonicalId === undefined) return [];
      const { data, error } = await supabase.rpc('rank_canonical_manga_sources', {
        requested_canonical_id: canonicalId,
        preferred_language: preferredLanguage,
      });
      if (error) throw error;
      return data;
    },
    enabled: canonicalId !== undefined,
    staleTime: 60_000,
  });
}
