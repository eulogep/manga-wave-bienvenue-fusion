import { useEffect, useState } from 'react';
import {
  isMangaDexProxyCover,
  MANGADEX_PROXY_PUBLISHABLE_KEY,
} from '@/integrations/mangadex/client';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=900&fit=crop';

type MangaCoverProps = {
  src: string | null;
  alt: string;
  className?: string;
};

const MangaCover = ({ src, alt, className }: MangaCoverProps) => {
  const requiresProxyHeader = isMangaDexProxyCover(src);
  const [resolvedSource, setResolvedSource] = useState<string | null>(
    requiresProxyHeader ? null : src,
  );

  useEffect(() => {
    if (!src || !isMangaDexProxyCover(src)) {
      setResolvedSource(src);
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    const loadCover = async () => {
      try {
        const response = await fetch(src, {
          headers: { apikey: MANGADEX_PROXY_PUBLISHABLE_KEY },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        objectUrl = URL.createObjectURL(await response.blob());
        setResolvedSource(objectUrl);
      } catch {
        if (!controller.signal.aborted) setResolvedSource(null);
      }
    };

    setResolvedSource(null);
    void loadCover();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return (
    <img
      src={resolvedSource || FALLBACK_COVER}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setResolvedSource(null)}
    />
  );
};

export default MangaCover;
