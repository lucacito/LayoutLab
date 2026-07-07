// pipeline/eval/metrics.ts
//
// Turns a stream of `RunEvent`s (+ the run's own `RunSummary`) into one flat,
// comparable scoreboard row — the thing `scripts/eval-generator.ts` prints
// side-by-side for an A/B config comparison (T4.1).
//
// Kept as a pure reducer (`MetricsAccumulator.add`) over `RunEvent` so later
// quality gates that don't exist yet — T1.3 vision critic, T2.2 error
// classification — can be wired in by adding a new `RunEvent` variant + a case
// here + a field on `EvalMetrics`, without reshaping this module or the
// harness that calls it. (T1.2 near-dupe wired this way: `near_duplicate`
// RunEvent + `RunSummary.nearDuped` + `nearDupeRate` below.)
import type { RunEvent, RunSummary } from '@/pipeline/run';

export interface EvalMetrics {
  label: string;
  targetsPlanned: number;
  generated: number;
  ingested: number;
  dropped: number;
  deduped: number;
  /** Fraction of generated layouts NOT dropped for a structural-validation reason. */
  validatorPassRate: number | null;
  /** Mean repair-loop iterations (structural + content) per generated layout. */
  meanRepairAttempts: number | null;
  /** Fraction of content-lint checks (one per non-full_landing target that reached
   * the content gate) that found at least one violation before any repair. */
  contentLintHitRate: number | null;
  /** Counts of `dropped` events by reason ('validation' | 'content' | 'error'). */
  dropReasonCounts: Record<string, number>;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Mean LLM cost across only the layouts that were actually ingested. */
  costPerAcceptedUsd: number | null;
  /** Mean input+output tokens across only the layouts that were actually ingested. */
  tokensPerAccepted: number | null;
  /** Fraction of generated layouts dropped by the perceptual near-duplicate gate (T1.2). */
  nearDupeRate: number | null;
  /** Fraction of generated layouts dropped by the render-miss gate (T1.3) — a
   * renderer was wired but produced no real previews. Distinct from `dropped`. */
  renderFailedRate: number | null;
  /** Histogram of vision-critic scores (T1.3), rounded to the nearest integer
   * and keyed by that integer as a string (e.g. `{"2": 1, "4": 3}`). Counts
   * EVERY scored target (pass and drop), not just accepted ones — this is a
   * generator-quality signal, not an acceptance-rate one. `null` when the
   * critic never ran (not wired, or no target reached the gate). */
  visionScoreDistribution: Record<string, number> | null;
  /** Mean vision-critic score across every scored target. `null` under the same
   * conditions as `visionScoreDistribution`. */
  visionScoreMean: number | null;
}

export class MetricsAccumulator {
  private repairAttempts = 0;
  private contentLintSeen = 0;
  private contentLintHits = 0;
  private dropReasonCounts: Record<string, number> = {};
  private acceptedCostUsd = 0;
  private acceptedInputTokens = 0;
  private acceptedOutputTokens = 0;
  private totalCostUsd = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  /** Raw vision-critic scores (T1.3) — one entry per scored target, pass or drop. */
  private visionScores: number[] = [];

  constructor(
    private readonly label: string,
    private readonly targetsPlanned: number,
  ) {}

  add(event: RunEvent): void {
    switch (event.type) {
      case 'generated':
        // Headline `generated` count comes from the run's authoritative
        // `RunSummary` at finalize() — this event only needs to exist so
        // switch exhaustiveness is checked; nothing to accumulate here.
        break;
      case 'repair_attempt':
        this.repairAttempts++;
        break;
      case 'content_lint':
        this.contentLintSeen++;
        if (event.hit) this.contentLintHits++;
        break;
      case 'dropped':
        this.dropReasonCounts[event.reason] = (this.dropReasonCounts[event.reason] ?? 0) + 1;
        break;
      case 'deduped':
        break; // tracked via RunSummary.deduped at finalize()
      case 'near_duplicate':
        break; // tracked via RunSummary.nearDuped at finalize()
      case 'render_failed':
        break; // tracked via RunSummary.renderFailed at finalize()
      case 'vision_critic':
        this.visionScores.push(event.score);
        break;
      case 'ingested':
        break; // tracked via RunSummary.ingested at finalize()
      case 'llm_usage':
        this.totalCostUsd += event.usage.costUsd;
        this.totalInputTokens += event.usage.inputTokens;
        this.totalOutputTokens += event.usage.outputTokens;
        if (event.outcome === 'ingested') {
          this.acceptedCostUsd += event.usage.costUsd;
          this.acceptedInputTokens += event.usage.inputTokens;
          this.acceptedOutputTokens += event.usage.outputTokens;
        }
        break;
    }
  }

  /** Reconcile with the run's authoritative `RunSummary` for the headline counts
   * (generated/ingested/dropped/deduped) — `RunSummary` is the pipeline's stable
   * contract; the accumulated events supply the richer breakdown. */
  finalize(summary: RunSummary): EvalMetrics {
    const validationDrops = this.dropReasonCounts['validation'] ?? 0;
    return {
      label: this.label,
      targetsPlanned: this.targetsPlanned,
      generated: summary.generated,
      ingested: summary.ingested,
      dropped: summary.dropped,
      deduped: summary.deduped,
      validatorPassRate: summary.generated ? (summary.generated - validationDrops) / summary.generated : null,
      meanRepairAttempts: summary.generated ? this.repairAttempts / summary.generated : null,
      contentLintHitRate: this.contentLintSeen ? this.contentLintHits / this.contentLintSeen : null,
      dropReasonCounts: { ...this.dropReasonCounts },
      totalCostUsd: this.totalCostUsd,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      costPerAcceptedUsd: summary.ingested ? this.acceptedCostUsd / summary.ingested : null,
      tokensPerAccepted: summary.ingested ? (this.acceptedInputTokens + this.acceptedOutputTokens) / summary.ingested : null,
      nearDupeRate: summary.generated ? summary.nearDuped / summary.generated : null,
      renderFailedRate: summary.generated ? summary.renderFailed / summary.generated : null,
      visionScoreDistribution: this.visionScores.length ? this.visionScoreDistribution() : null,
      visionScoreMean: this.visionScores.length
        ? this.visionScores.reduce((a, b) => a + b, 0) / this.visionScores.length
        : null,
    };
  }

  /** Buckets raw scores by nearest integer (the rubric asks for 1-5 integers,
   * but nothing downstream enforces that, so round rather than assume). */
  private visionScoreDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const s of this.visionScores) {
      const key = String(Math.round(s));
      dist[key] = (dist[key] ?? 0) + 1;
    }
    return dist;
  }
}

function fmtPct(v: number | null): string {
  return v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
}
function fmtNum(v: number | null, digits = 2): string {
  return v == null ? 'n/a' : v.toFixed(digits);
}
function fmtUsd(v: number | null): string {
  return v == null ? 'n/a' : `$${v.toFixed(4)}`;
}
function fmtVisionDist(dist: Record<string, number> | null): string {
  if (!dist || !Object.keys(dist).length) return 'n/a';
  return Object.entries(dist)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([score, n]) => `${score}:${n}`)
    .join(' ');
}

/** Render a side-by-side comparison table for N config runs (2 for a classic A/B,
 * but not limited to 2 — later tasks may want a 3-way comparison). */
export function formatComparisonTable(rows: EvalMetrics[]): string {
  const cols = rows.map((r) => r.label);
  const lines: [string, string[]][] = [
    ['targets planned', rows.map((r) => String(r.targetsPlanned))],
    ['generated', rows.map((r) => String(r.generated))],
    ['ingested (accepted)', rows.map((r) => String(r.ingested))],
    ['dropped', rows.map((r) => String(r.dropped))],
    ['deduped', rows.map((r) => String(r.deduped))],
    ['validator pass-rate', rows.map((r) => fmtPct(r.validatorPassRate))],
    ['mean repair attempts', rows.map((r) => fmtNum(r.meanRepairAttempts))],
    ['content-lint hit-rate', rows.map((r) => fmtPct(r.contentLintHitRate))],
    ['near-dupe rate', rows.map((r) => fmtPct(r.nearDupeRate))],
    ['render-failed rate', rows.map((r) => fmtPct(r.renderFailedRate))],
    ['vision score mean', rows.map((r) => fmtNum(r.visionScoreMean))],
    ['vision score dist', rows.map((r) => fmtVisionDist(r.visionScoreDistribution))],
    ['cost / accepted layout', rows.map((r) => fmtUsd(r.costPerAcceptedUsd))],
    ['tokens / accepted layout', rows.map((r) => fmtNum(r.tokensPerAccepted, 0))],
    ['total cost', rows.map((r) => fmtUsd(r.totalCostUsd))],
    [
      'drop reasons',
      rows.map((r) =>
        Object.keys(r.dropReasonCounts).length
          ? Object.entries(r.dropReasonCounts)
              .map(([reason, n]) => `${reason}:${n}`)
              .join(' ')
          : 'none',
      ),
    ],
  ];

  const labelWidth = Math.max('metric'.length, ...lines.map(([label]) => label.length));
  const colWidths = cols.map((c, i) => Math.max(c.length, ...lines.map(([, vals]) => vals[i].length)));

  const pad = (s: string, w: number) => s.padEnd(w);
  const row = (label: string, vals: string[]) =>
    `${pad(label, labelWidth)}  ${vals.map((v, i) => pad(v, colWidths[i])).join('  ')}`;

  const out: string[] = [];
  out.push(row('metric', cols));
  out.push('-'.repeat(labelWidth + 2 + colWidths.reduce((a, w) => a + w + 2, 0)));
  for (const [label, vals] of lines) out.push(row(label, vals));
  return out.join('\n');
}
