import assert from 'node:assert/strict';
import test from 'node:test';
import { nextReaderSettingsState } from '../src/domain/readerUiState.ts';

test('Reader source selector opens and remains open until explicitly closed', () => {
  const opened = nextReaderSettingsState(false, 'open');
  assert.equal(opened, true);
  assert.equal(nextReaderSettingsState(opened, 'open'), true);
  assert.equal(nextReaderSettingsState(opened, 'close'), false);
});
