export type SourceOperation = 'search' | 'popular' | 'detail' | 'pages';
export type CircuitState = 'closed' | 'open' | 'half-open';

export type SourceHealthSnapshot = {
  sourceId: string;
  circuit: CircuitState;
  score: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  averageLatencyMs: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  retryAt: string | null;
};

type SourceState = Omit<SourceHealthSnapshot, 'score' | 'averageLatencyMs'> & { totalLatencyMs: number };

const FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;
const OPERATION_TIMEOUTS: Record<SourceOperation, number> = {
  search: 35_000,
  popular: 35_000,
  detail: 45_000,
  pages: 55_000,
};

export class SourceCircuitOpenError extends Error {
  constructor(public readonly sourceId: string, public readonly retryAt: string | null) {
    super(`La source ${sourceId} est temporairement désactivée après plusieurs échecs.`);
    this.name = 'SourceCircuitOpenError';
  }
}

function createState(sourceId: string): SourceState {
  return {
    sourceId,
    circuit: 'closed',
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    totalLatencyMs: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    retryAt: null,
  };
}

export class SourceManager {
  private readonly states = new Map<string, SourceState>();

  register(sourceIds: string[]): void {
    sourceIds.forEach((sourceId) => this.getState(sourceId));
  }

  private getState(sourceId: string): SourceState {
    const existing = this.states.get(sourceId);
    if (existing) return existing;
    const state = createState(sourceId);
    this.states.set(sourceId, state);
    return state;
  }

  private prepareAttempt(state: SourceState): void {
    if (state.circuit !== 'open') return;
    const retryTime = state.retryAt ? Date.parse(state.retryAt) : 0;
    if (Date.now() < retryTime) throw new SourceCircuitOpenError(state.sourceId, state.retryAt);
    state.circuit = 'half-open';
  }

  async execute<T>(sourceId: string, operation: SourceOperation, task: () => Promise<T>): Promise<T> {
    const state = this.getState(sourceId);
    this.prepareAttempt(state);
    state.requestCount += 1;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${operation} a dépassé ${OPERATION_TIMEOUTS[operation] / 1000}s sur ${sourceId}.`)),
          OPERATION_TIMEOUTS[operation],
        );
      });
      const result = await Promise.race([task(), timeout]);
      state.successCount += 1;
      state.consecutiveFailures = 0;
      state.totalLatencyMs += Date.now() - startedAt;
      state.lastSuccessAt = new Date().toISOString();
      state.lastError = null;
      state.retryAt = null;
      state.circuit = 'closed';
      return result;
    } catch (error: unknown) {
      state.failureCount += 1;
      state.consecutiveFailures += 1;
      state.totalLatencyMs += Date.now() - startedAt;
      state.lastFailureAt = new Date().toISOString();
      state.lastError = error instanceof Error ? error.message : String(error);
      if (state.circuit === 'half-open' || state.consecutiveFailures >= FAILURE_THRESHOLD) {
        state.circuit = 'open';
        state.retryAt = new Date(Date.now() + CIRCUIT_RESET_MS).toISOString();
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  snapshots(): SourceHealthSnapshot[] {
    return [...this.states.values()]
      .map((state) => {
        const averageLatencyMs = state.requestCount > 0 ? Math.round(state.totalLatencyMs / state.requestCount) : 0;
        const errorRate = state.requestCount > 0 ? state.failureCount / state.requestCount : 0;
        const latencyPenalty = Math.min(35, averageLatencyMs / 500);
        const score = state.circuit === 'open'
          ? 0
          : Math.max(1, Math.round(100 - errorRate * 50 - latencyPenalty - state.consecutiveFailures * 10));
        const { totalLatencyMs: _totalLatencyMs, ...snapshot } = state;
        return { ...snapshot, averageLatencyMs, score };
      })
      .sort((left, right) => right.score - left.score);
  }
}

export const sourceManager = new SourceManager();
