import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlatformMac,
  getShortcutLabel,
  shouldEnableCommandSearch,
} from '../src/domain/commandSearch.ts';
import {
  searchCanonicalWorks,
  scoreSearchResult,
  type SearchWork,
} from '../src/domain/canonicalSearch.ts';

const SAMPLE_WORKS: SearchWork[] = [
  {
    id: 1,
    title: 'Solo Leveling',
    aliases: ['Na Honjaman Rebeleop', 'Only I Level Up', 'Ore dake Level Up na Ken'],
    author: 'Chugong',
    genre: ['Action', 'Fantasy', 'Adventure'],
    manga_type: 'manhwa',
    status: 'completed',
    cover_image: 'https://example.com/solo.jpg',
    rating: 9.2,
    views: 15000,
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Solo Leveling: Ragnarok',
    aliases: ['Na Honjaman Rebeleop: Ragnarok'],
    author: 'Daul',
    genre: ['Action', 'Fantasy'],
    manga_type: 'manhwa',
    status: 'ongoing',
    cover_image: 'https://example.com/rag.jpg',
    rating: 8.5,
    views: 8000,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    title: 'One Piece',
    aliases: ['OP'],
    author: 'Oda Eiichiro',
    genre: ['Action', 'Adventure', 'Comedy'],
    manga_type: 'manga',
    status: 'ongoing',
    cover_image: 'https://example.com/op.jpg',
    rating: 9.5,
    views: 50000,
    created_at: '2022-01-01T00:00:00Z',
  },
  {
    id: 4,
    title: 'Tales of Demons and Gods',
    aliases: ['Yao Shen Ji'],
    author: 'Mad Snail',
    genre: ['Action', 'Fantasy', 'Martial Arts'],
    manga_type: 'manhua',
    status: 'ongoing',
    cover_image: 'https://example.com/todg.jpg',
    rating: 8.1,
    views: 9000,
    created_at: '2023-05-01T00:00:00Z',
  },
  {
    id: 5,
    title: 'Sono Bisque Doll wa Koi o Suru',
    aliases: ['My Dress-Up Darling', 'Sexy Cosplay Doll'],
    author: 'Fukuda Shinichi',
    genre: ['Romance', 'Comedy', 'Slice of Life'],
    manga_type: 'manga',
    status: 'ongoing',
    cover_image: 'https://example.com/bisque.jpg',
    rating: 8.8,
    views: 12000,
    created_at: '2023-03-01T00:00:00Z',
  },
];

test('platform shortcut label correctly identifies Mac vs non-Mac platforms', () => {
  // Mac user agents
  assert.equal(isPlatformMac('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), true);
  assert.equal(getShortcutLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), '⌘K');

  assert.equal(isPlatformMac('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone'), true);
  assert.equal(getShortcutLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone'), '⌘K');

  // Windows user agents
  assert.equal(isPlatformMac('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), false);
  assert.equal(getShortcutLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), 'Ctrl+K');

  // Linux user agents
  assert.equal(isPlatformMac('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), false);
  assert.equal(getShortcutLabel('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), 'Ctrl+K');
});

test('Reader route guard disables Command Search inside autonomous reader', () => {
  // Standard routes allow command search
  assert.equal(shouldEnableCommandSearch('/'), true);
  assert.equal(shouldEnableCommandSearch('/search'), true);
  assert.equal(shouldEnableCommandSearch('/manga/1'), true);
  assert.equal(shouldEnableCommandSearch('/library'), true);
  assert.equal(shouldEnableCommandSearch('/history'), true);
  assert.equal(shouldEnableCommandSearch('/auth'), true);

  // Autonomous reader route must NEVER enable or intercept command search
  assert.equal(shouldEnableCommandSearch('/read/mangadex/123/456'), false);
  assert.equal(shouldEnableCommandSearch('/read/origin/abc/def?page=2'), false);
  assert.equal(shouldEnableCommandSearch('/read'), false);
});

test('command palette instant catalog search matches exact title with highest relevance', () => {
  const results = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'Solo Leveling',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.ok(results.length >= 2);
  assert.equal(results[0].id, 1);
  assert.equal(results[0].title, 'Solo Leveling');
  assert.equal(results[1].id, 2);
  assert.equal(results[1].title, 'Solo Leveling: Ragnarok');
});

test('command palette instant catalog search matches alternate titles/aliases', () => {
  // Matching Korean romanized alias
  const results = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'Na Honjaman Rebeleop',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.ok(results.length >= 1);
  assert.equal(results[0].id, 1);
  assert.equal(results[0].title, 'Solo Leveling');

  // Matching Japanese alias
  const resultsJa = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'Ore dake Level Up na Ken',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.ok(resultsJa.length >= 1);
  assert.equal(resultsJa[0].id, 1);

  // Matching Chinese Pinyin alias
  const resultsCn = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'Yao Shen Ji',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.equal(resultsCn[0].id, 4);
  assert.equal(resultsCn[0].title, 'Tales of Demons and Gods');
});

test('command palette instant catalog search matches typos with bounded Levenshtein distance', () => {
  // 'solo levling' has 1 deletion edit
  const results = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'solo levling',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.ok(results.length >= 1);
  assert.equal(results[0].id, 1);
});

test('command palette instant catalog search matches author name', () => {
  const results = searchCanonicalWorks(SAMPLE_WORKS, {
    q: 'Fukuda Shinichi',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  assert.equal(results[0].id, 5);
  assert.equal(results[0].title, 'Sono Bisque Doll wa Koi o Suru');
});

test('command palette limits display to top 8 items without merging canonical IDs', () => {
  // Generate 15 distinct works matching 'Manga' in title
  const manyWorks: SearchWork[] = Array.from({ length: 15 }, (_, i) => ({
    id: 100 + i,
    title: `Manga Adventure ${i + 1}`,
    aliases: [],
    author: `Author ${i}`,
    genre: ['Adventure'],
    manga_type: 'manga',
    status: 'ongoing',
    cover_image: null,
    rating: 8.0,
    views: 100 * (15 - i),
    created_at: '2023-01-01T00:00:00Z',
  }));

  const results = searchCanonicalWorks(manyWorks, {
    q: 'Manga Adventure',
    type: '',
    status: '',
    genre: '',
    sort: 'relevance',
    page: 1,
  });

  // Domain search returns all matching
  assert.equal(results.length, 15);
  // Slice simulation matching CommandSearchDialog's .slice(0, 8)
  const top8 = results.slice(0, 8);
  assert.equal(top8.length, 8);
  // All 8 have unique IDs
  const uniqueIds = new Set(top8.map((w) => w.id));
  assert.equal(uniqueIds.size, 8);
});
