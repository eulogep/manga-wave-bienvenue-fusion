export const COMICK_SEARCH_ENABLED = false;

export function isRetryableProviderStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
