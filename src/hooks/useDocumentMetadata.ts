import { useEffect } from 'react';
import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE_PATH,
  DEFAULT_DOCUMENT_TITLE,
  formatDocumentDescription,
  toPublicHttpUrl,
} from '@/domain/documentMetadata';

export type DocumentMetadataOptions = {
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  type?: 'website' | 'article';
};

const setMetaContent = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.setAttribute('content', content);
};

const setCanonicalUrl = (url: string) => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.append(link);
  }
  link.href = url;
};

const applyMetadata = (title: string, description: string, options: DocumentMetadataOptions = {}) => {
  const pageUrl = toPublicHttpUrl(options.canonicalUrl || window.location.pathname, window.location.origin)
    || window.location.origin;
  const imageUrl = toPublicHttpUrl(options.imageUrl || DEFAULT_SOCIAL_IMAGE_PATH, window.location.origin)
    || `${window.location.origin}${DEFAULT_SOCIAL_IMAGE_PATH}`;
  document.title = title;
  setMetaContent('meta[name="description"]', 'name', 'description', description);
  setMetaContent('meta[property="og:title"]', 'property', 'og:title', title);
  setMetaContent('meta[property="og:description"]', 'property', 'og:description', description);
  setMetaContent('meta[property="og:type"]', 'property', 'og:type', options.type || 'website');
  setMetaContent('meta[property="og:url"]', 'property', 'og:url', pageUrl);
  setMetaContent('meta[property="og:image"]', 'property', 'og:image', imageUrl);
  setMetaContent('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMetaContent('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMetaContent('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
  setCanonicalUrl(pageUrl);
};

/**
 * Keeps the tab title and description metas in sync with the current page.
 * Pass `null` as title while data is loading to leave the previous title in place.
 */
export function useDocumentMetadata(
  title: string | null,
  description?: string | null,
  options: DocumentMetadataOptions = {},
) {
  const { canonicalUrl, imageUrl, type } = options;
  useEffect(() => {
    if (title === null) return;
    applyMetadata(
      title,
      description ? formatDocumentDescription(description) : DEFAULT_DOCUMENT_DESCRIPTION,
      { canonicalUrl, imageUrl, type },
    );
  }, [title, description, canonicalUrl, imageUrl, type]);

  useEffect(() => () => applyMetadata(DEFAULT_DOCUMENT_TITLE, DEFAULT_DOCUMENT_DESCRIPTION), []);
}
