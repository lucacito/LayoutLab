// pipeline/errors.ts — T2.2: classify errors caught by run.ts's per-target
// catch, and a small bounded retry-with-backoff helper for the retryable class.
//
// Only TWO classes exist here on purpose:
//   - 'transient_infra'  — a network/CLI/upload/render-infra blip; worth retrying.
//   - 'permanent_infra'  — usage-limit, budget, auth, or anything unrecognized;
//                          retrying would either hit the exact same wall again
//                          or waste budget on a bug that isn't going to fix
//                          itself. The SAFE DEFAULT for an unclassified error is
//                          'permanent_infra' (code 'unknown') — never blindly
//                          retry something we don't understand.
// A third class, 'quality' (validator/lint/content-lint/near-dupe/vision-critic),
// deliberately has NO representation here: those are existing `continue`-based
// drop paths in run.ts that never throw, so they never reach this classifier.
// See run.ts's per-target loop for where that boundary is enforced.
export type ErrorClass = 'transient_infra' | 'permanent_infra';

export interface ClassifiedError {
  class: ErrorClass;
  /** Narrower tag for logging/metrics. 'usage_limit' is special-cased by run.ts
   * to abort the whole remaining run (see run.ts's per-target catch) — every
   * other subsequent target would hit the exact same account-level wall. */
  code: 'usage_limit' | 'budget' | 'auth' | 'network' | 'validator_output' | 'unknown';
  message: string;
}

// Mirrors pipeline/generate.ts's pre-emptive usage-limit guard exactly — that
// file imports THIS regex (via `isUsageLimitMessage`) rather than keeping its
// own copy, so the "surface immediately, don't retry" decision and the
// post-hoc classification here can never drift apart.
const USAGE_LIMIT_RE = /hit your limit|usage limit|rate.?limit|rate.?limited/i;
const BUDGET_RE = /max.?budget|budget exceeded|exceeded.*budget|cost limit/i;
const AUTH_RE = /\b401\b|\b403\b|unauthorized|forbidden|invalid api.?key/i;
// Minor (T2.2 review): the original bare `network` and `try again` substrings
// were too broad — they'd also match a PERMANENT error whose message merely
// happens to contain that English phrasing (e.g. "invalid network
// configuration", or a validation message telling a human to "try again with
// a different value"), wrongly classifying it as transient/retryable. Tightened
// to require the phrasing actually look like a transient-infra signal: `network`
// must be followed by a failure-shaped qualifier, and `try again` must be the
// "please try again[, ...]" style wording APIs use for a retryable blip.
const TRANSIENT_RE =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ECONNABORTED|EAI_AGAIN|ENOTFOUND|ENETUNREACH|ENETDOWN|EPIPE|socket hang up|network (error|failure|issue|timeout|unreachable|unavailable)|fetch failed|timed?\s*out|temporarily unavailable|\b(429|500|502|503|504)\b|overloaded|too many requests|please try again\b/i;
// T2.3: pipeline/validate.ts's `validateLayout` throws this exact wording when
// the validator CLI produces output matching neither PASS nor FAIL shape on
// TWO consecutive invocations (it already retries once internally before
// giving up — see validate.ts). Given its own internal retry, TWO
// back-to-back failures to produce a parseable verdict reads as a real
// tooling problem (broken CLI wiring, validator crash, PHP fatal) rather
// than a one-off network blip, so — same as the module-level "safe default"
// rule above — it's classified 'permanent_infra', but with its OWN code
// ('validator_output') rather than falling through to 'unknown', so it's
// distinguishable in logs/metrics from an unrelated unclassified bug. This
// is deliberately checked BEFORE `TRANSIENT_RE`: the thrown message contains
// no transient-sounding substrings today, but keeping this check first means
// it stays correctly classified even if that message wording drifts to
// include one incidentally.
const VALIDATOR_OUTPUT_RE = /validator produced unexpected output/i;

export function isUsageLimitMessage(text: string): boolean {
  return USAGE_LIMIT_RE.test(text);
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  if (isUsageLimitMessage(message)) return { class: 'permanent_infra', code: 'usage_limit', message };
  if (BUDGET_RE.test(message)) return { class: 'permanent_infra', code: 'budget', message };
  if (AUTH_RE.test(message)) return { class: 'permanent_infra', code: 'auth', message };
  if (VALIDATOR_OUTPUT_RE.test(message)) return { class: 'permanent_infra', code: 'validator_output', message };
  if (TRANSIENT_RE.test(message)) return { class: 'transient_infra', code: 'network', message };
  return { class: 'permanent_infra', code: 'unknown', message };
}

export interface RetryOptions {
  /** Max number of RETRIES (not counting the first attempt). E.g. 2 → up to 3
   * total calls to `fn`. */
  retries: number;
  baseDelayMs: number;
  /** Injectable so tests run instantly — defaults to a real `setTimeout`-based
   * delay in production. */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; classified: ClassifiedError }) => void;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Bounded retry-with-exponential-backoff for the 'transient_infra' class only.
 * A 'permanent_infra' error (including 'unknown' — the safe default) is thrown
 * immediately on the first attempt, no retry, no delay.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? realSleep;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const classified = classifyError(err);
      const retryable = classified.class === 'transient_infra' && attempt < opts.retries;
      if (!retryable) throw err;
      attempt++;
      opts.onRetry?.({ attempt, classified });
      await sleep(opts.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
