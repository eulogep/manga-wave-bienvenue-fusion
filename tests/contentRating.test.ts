import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyContentRatingFromGenres } from '../src/domain/contentRating.ts';

test('a genre list with no explicit marker classifies as null (unknown, never guessed)', () => {
  assert.equal(classifyContentRatingFromGenres(['Action', 'Aventure', 'Drame']), null);
});

test('an exact "Érotique" tag (accented, as the site publishes it) classifies as erotica', () => {
  assert.equal(classifyContentRatingFromGenres(['Action', 'Érotique']), 'erotica');
});

test('an exact "Pornhwa" tag classifies as erotica', () => {
  assert.equal(classifyContentRatingFromGenres(['Romance', 'Pornhwa', 'Harem']), 'erotica');
});

test('matching is exact-tag, never substring: an unrelated genre containing a similar fragment is not misclassified', () => {
  assert.equal(classifyContentRatingFromGenres(['Superheroes', 'Zero']), null);
});

test('an empty genre list classifies as null', () => {
  assert.equal(classifyContentRatingFromGenres([]), null);
});

test('case and accent variations of the same marker are still recognized', () => {
  assert.equal(classifyContentRatingFromGenres(['EROTIQUE']), 'erotica');
  assert.equal(classifyContentRatingFromGenres(['erotique']), 'erotica');
});
