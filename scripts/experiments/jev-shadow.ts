/** Server/CLI-only, never imported by the application. No model action is executed. */
export type ChoiceAnswer = {
  type: 'choice'; choice: 'retry' | 'stop'; probabilities: { retry: number; stop: number }; confidence: number;
};
export function parseAnswer(value: unknown): ChoiceAnswer | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ChoiceAnswer>;
  if (item.type !== 'choice' || !['retry','stop'].includes(item.choice || '') || !item.probabilities) return null;
  const probabilities = item.probabilities;
  if (Object.keys(probabilities).sort().join(',') !== 'retry,stop') return null;
  if (![probabilities.retry, probabilities.stop, item.confidence].every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1)) return null;
  if (Math.abs(probabilities.retry + probabilities.stop - 1) > 0.001) return null;
  if (probabilities[item.choice!] < Math.max(probabilities.retry, probabilities.stop)) return null;
  // Official binary Choice confidence is 2*p_max - 1, not p(correct).
  if (Math.abs(item.confidence! - (2 * Math.max(probabilities.retry, probabilities.stop) - 1)) > 0.01) return null;
  return item as ChoiceAnswer;
}

export async function observeJev(input: {
  state: Record<string, unknown>; baseline: 'retry' | 'stop'; apiKey?: string;
  fetcher?: typeof fetch; timeoutMs?: number;
}) {
  const started = performance.now();
  const base = { executedDecision: input.baseline, mode: 'shadow' as const };
  if (!input.apiKey) return { ...base, status: 'NOT_CONFIGURED', elapsedMs: 0, answer: null, inputTokens: null };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('TIMEOUT')); }, input.timeoutMs ?? 1500);
    });
    const operation = async () => {
      const response = await (input.fetcher || fetch)('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jev-1.13.0', state: input.state, questions: {
          retry: { type: 'choice', instructions: 'Classify this HTTP response under the existing Manga Wave transport policy. Retry only transient 408, 429 or 5xx with remaining budget; stop on forbidden or other deterministic errors. This question is transport classification, not permission to call a disabled source.', criteria: { retry: 'Transient status, budget available.', stop: 'Terminal status or exhausted budget.' } },
        } }),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const body = await response.json();
      const answer = parseAnswer(body?.answers?.retry);
      if (!answer || body.model !== 'jev-1.13.0') throw new Error('INVALID_RESPONSE');
      const tokens = body?.usage?.input_tokens;
      return { answer, inputTokens: Number.isSafeInteger(tokens) && tokens >= 0 ? tokens as number : null };
    };
    const result = await Promise.race([operation(), timeout]);
    return { ...base, status: 'OBSERVED', elapsedMs: performance.now() - started, ...result };
  } catch (error) {
    // Never log provider body, key, or error messages that may contain request data.
    const message = error instanceof Error ? error.message : '';
    const status = /^(HTTP_\d{3}|TIMEOUT|INVALID_RESPONSE)$/.test(message) ? message : 'UNAVAILABLE';
    return { ...base, status, elapsedMs: performance.now() - started, answer: null, inputTokens: null };
  } finally { clearTimeout(timer); }
}
