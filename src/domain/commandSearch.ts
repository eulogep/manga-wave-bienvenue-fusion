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
