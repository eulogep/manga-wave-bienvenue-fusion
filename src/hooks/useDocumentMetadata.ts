import { useEffect } from 'react';
import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  DEFAULT_DOCUMENT_TITLE,
  formatDocumentDescription,
} from '@/domain/documentMetadata';

const setMetaContent = (selector: string, content: string) => {
  document.querySelectorAll<HTMLMetaElement>(selector).forEach((meta) => meta.setAttribute('content', content));
};

const applyMetadata = (title: string, description: string) => {
  document.title = title;
  setMetaContent('meta[property="og:title"], meta[name="twitter:title"]', title);
  setMetaContent('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', description);
};

/**
 * Keeps the tab title and description metas in sync with the current page.
 * Pass `null` as title while data is loading to leave the previous title in place.
 */
export function useDocumentMetadata(title: string | null, description?: string | null) {
  useEffect(() => {
    if (title === null) return;
    applyMetadata(title, description ? formatDocumentDescription(description) : DEFAULT_DOCUMENT_DESCRIPTION);
  }, [title, description]);

  useEffect(() => () => applyMetadata(DEFAULT_DOCUMENT_TITLE, DEFAULT_DOCUMENT_DESCRIPTION), []);
}
