// tests/eval-generator.test.ts
// Metric aggregation correctness for the eval harness (T4.1). Exercises
// MetricsAccumulator against a synthetic RunEvent stream + RunSummary — no
// pipeline, no claude CLI, no network. The harness script itself (scripts/
// eval-generator.ts) is a thin wrapper around this module; the aggregation
// logic lives here so it's independently testable.
import { describe, it, expect } from 'vitest';
import { MetricsAccumulator, formatComparisonTable } from '@/pipeline/eval/metrics';
import type { RunEvent, RunSummary } from '@/pipeline/run';

const target = { type: 'hero', niche: 'saas', style: 'minimal' };

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return { generated: 0, repaired: 0, dropped: 0, deduped: 0, ingested: 0, ...over };
}

describe('MetricsAccumulator', () => {
  it('computes a 100% validator pass-rate and 0 mean repairs on an all-clean run', () => {
    const acc = new MetricsAccumulator('baseline', 2);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'content_lint', target, hit: false, codes: [] },
      { type: 'llm_usage', target, usage: { costUsd: 0.01, inputTokens: 100, outputTokens: 50 }, outcome: 'ingested' },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'content_lint', target, hit: false, codes: [] },
      { type: 'llm_usage', target, usage: { costUsd: 0.02, inputTokens: 200, outputTokens: 60 }, outcome: 'ingested' },
      { type: 'ingested', target, slug: 's2' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 2 }));
    expect(m.validatorPassRate).toBe(1);
    expect(m.meanRepairAttempts).toBe(0);
    expect(m.contentLintHitRate).toBe(0);
    expect(m.ingested).toBe(2);
    expect(m.costPerAcceptedUsd).toBeCloseTo(0.015, 5);
    expect(m.tokensPerAccepted).toBeCloseTo((100 + 50 + 200 + 60) / 2, 5);
  });

  it('counts repairs and content-lint hits, and excludes dropped-layout cost from the accepted average', () => {
    const acc = new MetricsAccumulator('exemplars', 2);
    const events: RunEvent[] = [
      // target 1: one structural repair, then validates, content-lint hit + one content repair, then ingests.
      { type: 'generated', target },
      { type: 'repair_attempt', target, kind: 'structural' },
      { type: 'content_lint', target, hit: true, codes: ['LOREM_IPSUM'] },
      { type: 'repair_attempt', target, kind: 'content' },
      { type: 'llm_usage', target, usage: { costUsd: 0.10, inputTokens: 500, outputTokens: 300 }, outcome: 'ingested' },
      { type: 'ingested', target, slug: 's1' },
      // target 2: never validates, dropped — its cost must NOT count toward "per accepted".
      { type: 'generated', target },
      { type: 'repair_attempt', target, kind: 'structural' },
      { type: 'repair_attempt', target, kind: 'structural' },
      { type: 'dropped', target, reason: 'validation', detail: 'E_X' },
      { type: 'llm_usage', target, usage: { costUsd: 0.50, inputTokens: 900, outputTokens: 900 }, outcome: 'dropped' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, dropped: 1 }));
    expect(m.meanRepairAttempts).toBeCloseTo(4 / 2, 5); // (1 structural + 1 content) + 2 structural = 4 attempts / 2 generated
    expect(m.contentLintHitRate).toBe(1); // 1 of 1 content_lint events seen was a hit
    expect(m.validatorPassRate).toBeCloseTo(0.5, 5); // 1 of 2 generated dropped for validation
    expect(m.dropReasonCounts.validation).toBe(1);
    expect(m.costPerAcceptedUsd).toBeCloseTo(0.10, 5); // only the accepted target's cost
    expect(m.tokensPerAccepted).toBeCloseTo(800, 5);
    expect(m.totalCostUsd).toBeCloseTo(0.60, 5); // all usage, accepted + dropped
  });

  it('leaves rate metrics null (not NaN) when a run generates nothing', () => {
    const acc = new MetricsAccumulator('empty', 0);
    const m = acc.finalize(summary());
    expect(m.validatorPassRate).toBeNull();
    expect(m.meanRepairAttempts).toBeNull();
    expect(m.contentLintHitRate).toBeNull();
    expect(m.costPerAcceptedUsd).toBeNull();
    expect(m.tokensPerAccepted).toBeNull();
  });

  it('tracks the "error" drop-reason path separately from "validation", and excludes it from validatorPassRate', () => {
    // A target that throws mid-pipeline (e.g. render/upload failure) is tagged
    // reason:'error', not 'validation' — the two must not be conflated: an error
    // drop is an infra failure, not evidence the generator produced invalid output.
    const acc = new MetricsAccumulator('baseline', 2);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's1' },
      { type: 'llm_usage', target, usage: { costUsd: 0.01, inputTokens: 10, outputTokens: 5 }, outcome: 'ingested' },
      { type: 'generated', target },
      { type: 'dropped', target, reason: 'error', detail: 'render failed: ECONNREFUSED' },
      { type: 'llm_usage', target, usage: { costUsd: 0.02, inputTokens: 20, outputTokens: 8 }, outcome: 'dropped' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, dropped: 1 }));
    expect(m.dropReasonCounts).toEqual({ error: 1 });
    expect(m.dropReasonCounts.validation).toBeUndefined();
    // validatorPassRate only subtracts 'validation' drops — an error drop must not
    // count against it (2 generated, 0 validation drops → 100%, even though 1 of 2 was dropped).
    expect(m.validatorPassRate).toBe(1);
    expect(m.costPerAcceptedUsd).toBeCloseTo(0.01, 5);
  });

  it('carries the config label through to the finalized metrics', () => {
    const acc = new MetricsAccumulator('my-config', 3);
    const m = acc.finalize(summary());
    expect(m.label).toBe('my-config');
    expect(m.targetsPlanned).toBe(3);
  });
});

describe('formatComparisonTable', () => {
  it('renders a side-by-side table with both config labels and key metric rows', () => {
    const a = new MetricsAccumulator('baseline', 1).finalize(summary({ generated: 1, ingested: 1 }));
    const b = new MetricsAccumulator('exemplars', 1).finalize(summary({ generated: 1, ingested: 1 }));
    const table = formatComparisonTable([a, b]);
    expect(table).toContain('baseline');
    expect(table).toContain('exemplars');
    expect(table).toContain('validator pass');
    expect(table).toContain('repair');
    expect(table).toContain('content-lint');
    expect(table).toContain('cost');
  });
});
