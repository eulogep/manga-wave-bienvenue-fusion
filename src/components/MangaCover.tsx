import { useEffect, useRef, useState } from 'react';
import {
  isMangaDexProxyCover,
  MANGADEX_PROXY_PUBLISHABLE_KEY,
} from '@/integrations/mangadex/client';

// Neutral, inline placeholder shown while a cover loads or when it is missing.
// It used to be a remote stock photo: an unrelated image posing as the cover,
// downloaded before real covers and reported as the page's LCP element.
const FALLBACK_COVER = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='%23182431'/><stop offset='1' stop-color='%230b131f'/></linearGradient></defs><rect width='300' height='450' fill='url(%23g)'/><path d='M105 238c22-26 44-26 66 0s44 26 66 0' fill='none' stroke='%23ff4d5a' stroke-opacity='.35' stroke-width='8' stroke-linecap='round'/></svg>`;

type MangaCoverProps = {
  src: string | null;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  deferProxy?: boolean;
};

const MangaCover = ({ src, alt, className, loading = 'lazy', deferProxy = false }: MangaCoverProps) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const shouldLoad = !deferProxy || loading === 'eager' || visible;
  useEffect(() => {
    if (shouldLoad || !imageRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [shouldLoad]);
  const requiresProxyHeader = isMangaDexProxyCover(src);
  const [resolvedSource, setResolvedSource] = useState<string | null>(
    requiresProxyHeader ? null : src,
  );

  useEffect(() => {
    if (!shouldLoad) return undefined;
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
  }, [src, shouldLoad]);

  return (
    <img
      ref={imageRef}
      src={resolvedSource || FALLBACK_COVER}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setResolvedSource(null)}
    />
  );
};

export default MangaCover;
