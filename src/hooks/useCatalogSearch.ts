import { useQuery } from '@tanstack/react-query';
import {
  searchAllCatalogProviders,
  searchCatalogProvider,
  type CatalogMediaType,
  type CatalogProvider,
} from '@/integrations/catalog/providers';

export const useCatalogSearch = (options: {
  query: string;
  provider: CatalogProvider | 'all';
  mediaType: CatalogMediaType;
  limit?: number;
}) => useQuery({
  queryKey: ['catalog-search', options],
  enabled: options.query.trim().length >= 2,
  queryFn: () => options.provider === 'all'
    ? searchAllCatalogProviders(options)
    : searchCatalogProvider(options.provider, options),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: (failureCount, error) => failureCount < 1 && !String(error).includes('(429)'),
});
