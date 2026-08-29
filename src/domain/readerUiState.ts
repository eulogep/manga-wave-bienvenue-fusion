export type ReaderSettingsAction = 'open' | 'close' | 'toggle';

export function nextReaderSettingsState(current: boolean, action: ReaderSettingsAction): boolean {
  if (action === 'open') return true;
  if (action === 'close') return false;
  return !current;
}
