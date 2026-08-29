export type SourceCircuitState = 'closed' | 'open' | 'half-open';

export type SourceResolutionCandidate = {
  sourceId: string;
  available: boolean;
  circuit: SourceCircuitState;
  language: string;
  preferredLanguage: string;
  averageLatencyMs: number | null;
  requestCount: number;
  failureCount: number;
  chapterCount: number;
  maximumChapterCount: number;
  imageQualityScore: number | null;
  lastSuccessfulRequest: string | null;
};

export type SourceScoreBreakdown = {
  availability: number;
  latency: number;
  language: number;
  chapterCoverage: number;
  imageQuality: number;
  errorRate: number;
  freshness: number;
};

export type RankedSource = SourceResolutionCandidate & {
  eligible: boolean;
  sourceScore: number;
  breakdown: SourceScoreBreakdown;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Math.round(value * 100) / 100;
const baseLanguage = (value: string) => value.trim().toLowerCase().split(/[-_]/)[0];

const languageScore = (language: string, preferredLanguage: string): number => {
  const actual = baseLanguage(language);
  const preferred = baseLanguage(preferredLanguage);
  if (actual === preferred && actual !== '') return 20;
  if (actual === 'multi') return 15;
  if (actual === 'und' || actual === '') return 8;
  return 2;
};

const freshnessScore = (lastSuccessfulRequest: string | null, now: Date): number => {
  if (!lastSuccessfulRequest) return 0;
  const timestamp = new Date(lastSuccessfulRequest).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageHours = Math.max(0, now.getTime() - timestamp) / 3_600_000;
  if (ageHours <= 24) return 5;
  if (ageHours <= 24 * 7) return 3;
  return 1;
};

export function scoreSource(candidate: SourceResolutionCandidate, now = new Date()): RankedSource {
  const eligible = candidate.available && candidate.circuit !== 'open';
  const breakdown: SourceScoreBreakdown = {
    availability: candidate.available ? (candidate.circuit === 'half-open' ? 10 : 20) : 0,
    latency: candidate.requestCount > 0 && candidate.averageLatencyMs !== null
      ? 15 * (1 - clamp(candidate.averageLatencyMs, 0, 5_000) / 5_000)
      : 7.5,
    language: languageScore(candidate.language, candidate.preferredLanguage),
    chapterCoverage: candidate.maximumChapterCount > 0
      ? 20 * clamp(candidate.chapterCount / candidate.maximumChapterCount, 0, 1)
      : 10,
    imageQuality: candidate.imageQualityScore === null
      ? 5
      : 10 * clamp(candidate.imageQualityScore, 0, 100) / 100,
    errorRate: candidate.requestCount > 0
      ? 10 * (1 - clamp(candidate.failureCount / candidate.requestCount, 0, 1))
      : 5,
    freshness: freshnessScore(candidate.lastSuccessfulRequest, now),
  };
  const roundedBreakdown = Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, round(value)]),
  ) as SourceScoreBreakdown;
  const sourceScore = eligible
    ? round(Object.values(roundedBreakdown).reduce((total, component) => total + component, 0))
    : 0;

  return { ...candidate, eligible, sourceScore, breakdown: roundedBreakdown };
}

export function rankSources(candidates: SourceResolutionCandidate[], now = new Date()): RankedSource[] {
  return candidates
    .map((candidate) => scoreSource(candidate, now))
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      if (left.sourceScore !== right.sourceScore) return right.sourceScore - left.sourceScore;
      return left.sourceId.localeCompare(right.sourceId);
    });
}
