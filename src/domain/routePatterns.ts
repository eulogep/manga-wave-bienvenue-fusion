/**
 * Route patterns of App.tsx, used to name monitoring transactions after the route
 * (/manga/:id) instead of the URL (/manga/573). A unit test keeps this list in sync
 * with the <Route path> declarations.
 */
export const ROUTE_PATTERNS = [
  '/',
  '/auth',
  '/search',
  '/manga/:id',
  '/read/:source/:mangaId/:chapterId',
  '/history',
  '/stats',
  '/pour-toi',
  '/library',
  '/trending',
  '/ranking',
  '/random',
  '/collections',
  '/collections/:slug',
] as const;

const segments = (path: string) => path.split('/').filter(Boolean);

/** The matching route pattern, or "<unmatched>" for the 404 route. Query and hash are ignored. */
export function routeNameFor(pathname: string): string {
  const parts = segments(pathname.split(/[?#]/)[0]);
  const match = ROUTE_PATTERNS.find((pattern) => {
    const expected = segments(pattern);
    return expected.length === parts.length
      && expected.every((segment, index) => segment.startsWith(':') ? parts[index] !== '' : segment === parts[index]);
  });
  return match ?? '<unmatched>';
}
