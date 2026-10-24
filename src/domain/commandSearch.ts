export function isPlatformMac(userAgent?: string, platform?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const plat = platform ?? (typeof navigator !== 'undefined' ? (navigator as { platform?: string }).platform : '');
  return /(Mac|iPhone|iPod|iPad)/i.test(`${ua} ${plat}`);
}

export function getShortcutLabel(userAgent?: string, platform?: string): string {
  return isPlatformMac(userAgent, platform) ? '⌘K' : 'Ctrl+K';
}

export function shouldEnableCommandSearch(pathname: string): boolean {
  // Preserve autonomous Reader immersion: never intercept or popup in /read/*
  return !pathname.startsWith('/read');
}

/**
 * Canonical manga id of the page the palette was opened from, or null.
 * Provider-scoped detail pages (?source=…) have no canonical id in the URL.
 */
export function canonicalMangaIdFromLocation(pathname: string, search: string): number | null {
  const match = /^\/manga\/(\d+)\/?$/.exec(pathname);
  if (!match || new URLSearchParams(search).has('source')) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
