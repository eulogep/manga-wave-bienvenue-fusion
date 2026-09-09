export type ContinueReadingAuthState = 'loading' | 'anonymous' | 'authenticated';

export function getContinueReadingAuthState(authLoading: boolean, userId?: string): ContinueReadingAuthState {
  if (authLoading) return 'loading';
  return userId ? 'authenticated' : 'anonymous';
}

export function shouldFetchContinueReading(authState: ContinueReadingAuthState) {
  return authState !== 'loading';
}

export function getContinueReadingPlaceholder<T>(
  authState: ContinueReadingAuthState,
  localItems: T[],
): T[] | undefined {
  return authState === 'anonymous' ? localItems : undefined;
}

export function resolveContinueReadingItems<T>(
  authState: ContinueReadingAuthState,
  localItems: T[],
  remoteItems: T[],
): T[] {
  return authState === 'authenticated' ? remoteItems : localItems;
}

export function continueReadingQueryKey(
  authState: ContinueReadingAuthState,
  userId: string | undefined,
  localRevision: string,
) {
  const scope = authState === 'authenticated' ? userId : authState;
  const revision = authState === 'anonymous' ? localRevision : '';
  return ['continue-reading-universal', scope, revision] as const;
}
