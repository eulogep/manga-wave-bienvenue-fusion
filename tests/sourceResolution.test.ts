import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSources, scoreSource, type SourceResolutionCandidate } from '../src/domain/sourceResolution.ts';

const now = new Date('2026-08-29T12:00:00.000Z');
const healthyCandidate: SourceResolutionCandidate = {
  sourceId: 'healthy-fr', available: true, circuit: 'closed', language: 'fr', preferredLanguage: 'fr-FR',
  averageLatencyMs: 250, requestCount: 100, failureCount: 2, chapterCount: 100, maximumChapterCount: 100,
  imageQualityScore: 90, lastSuccessfulRequest: '2026-08-29T11:00:00.000Z',
};

test('scores every required source-resolution signal', () => {
  const ranked = scoreSource(healthyCandidate, now);
  assert.equal(ranked.eligible, true);
  assert.equal(ranked.breakdown.availability, 20);
  assert.equal(ranked.breakdown.language, 20);
  assert.equal(ranked.breakdown.chapterCoverage, 20);
  assert.equal(ranked.breakdown.imageQuality, 9);
  assert.equal(ranked.breakdown.freshness, 5);
  assert.ok(ranked.breakdown.latency > 14);
  assert.ok(ranked.breakdown.errorRate > 9);
  assert.ok(ranked.sourceScore > 97);
});

test('makes unavailable and open-circuit sources ineligible', () => {
  const unavailable = scoreSource({ ...healthyCandidate, sourceId: 'unavailable', available: false }, now);
  const open = scoreSource({ ...healthyCandidate, sourceId: 'open', circuit: 'open' }, now);
  assert.equal(unavailable.eligible, false);
  assert.equal(open.eligible, false);
  assert.equal(unavailable.sourceScore, 0);
  assert.equal(open.sourceScore, 0);
});

test('prefers language, coverage, quality and reliability without hard-coded provider priority', () => {
  const ranked = rankSources([
    { ...healthyCandidate, sourceId: 'slow-en', language: 'en', averageLatencyMs: 4_000, failureCount: 30, chapterCount: 30, imageQualityScore: 40 },
    healthyCandidate,
  ], now);
  assert.equal(ranked[0].sourceId, 'healthy-fr');
});

test('uses neutral values for unobserved metrics', () => {
  const ranked = scoreSource({
    ...healthyCandidate,
    sourceId: 'new-source',
    requestCount: 0,
    failureCount: 0,
    averageLatencyMs: null,
    maximumChapterCount: 0,
    chapterCount: 0,
    imageQualityScore: null,
    lastSuccessfulRequest: null,
  }, now);
  assert.equal(ranked.breakdown.latency, 7.5);
  assert.equal(ranked.breakdown.chapterCoverage, 10);
  assert.equal(ranked.breakdown.imageQuality, 5);
  assert.equal(ranked.breakdown.errorRate, 5);
});

test('breaks equal scores deterministically by source id', () => {
  const ranked = rankSources([
    { ...healthyCandidate, sourceId: 'zeta' },
    { ...healthyCandidate, sourceId: 'alpha' },
  ], now);
  assert.deepEqual(ranked.map((source) => source.sourceId), ['alpha', 'zeta']);
});
