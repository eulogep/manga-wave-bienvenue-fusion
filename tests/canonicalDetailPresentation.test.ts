import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalAliases,
  canonicalMetadataSourceLabel,
  canonicalOriginLabel,
  canonicalTypeLabel,
} from '../src/domain/canonicalDetailPresentation.ts';

test('canonical detail exposes only the three validated publication types', () => {
  assert.equal(canonicalTypeLabel('manga'), 'Manga');
  assert.equal(canonicalTypeLabel('manhwa'), 'Manhwa');
  assert.equal(canonicalTypeLabel('manhua'), 'Manhua');
  assert.equal(canonicalTypeLabel('web comic'), null);
});

test('canonical detail presents reviewed origin and provenance labels', () => {
  assert.equal(canonicalOriginLabel('jp'), 'Japon');
  assert.equal(canonicalOriginLabel('KR'), 'Corée du Sud');
  assert.equal(canonicalOriginLabel(null), null);
  assert.equal(canonicalMetadataSourceLabel('jikan'), 'MyAnimeList / Jikan');
  assert.equal(canonicalMetadataSourceLabel('reviewed-import'), 'reviewed-import');
});

test('aliases are canonical-title aware, normalized, deduplicated and bounded', () => {
  assert.deepEqual(canonicalAliases('Solo Leveling', [
    ' Solo Leveling ',
    'Na Honjaman Level Up',
    '나 혼자만 레벨업',
    'na-honjaman level up',
    '',
    'I Level Up Alone',
  ], 2), ['Na Honjaman Level Up', '나 혼자만 레벨업']);
});
