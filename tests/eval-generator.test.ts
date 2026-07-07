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
  return {
    generated: 0,
    repaired: 0,
    qualityDropped: 0,
    errored: 0,
    deduped: 0,
    ingested: 0,
    nearDuped: 0,
    renderFailed: 0,
    renderBlank: 0,
    ...over,
  };
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
    const m = acc.finalize(summary({ generated: 2, ingested: 1, qualityDropped: 1 }));
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

  // T2.2: a target whose per-target processing THREW (e.g. render/upload/ingest
  // infra failure, exhausted retries) is now reported via a distinct `errored`
  // event (code-keyed), never via `dropped` — `dropped`/`dropReasonCounts` is
  // QUALITY-only now (validation/content/vision-critic). The two must not be
  // conflated: an infra error says nothing about whether the generator
  // produced invalid output.
  it('tracks `errored` events (by code) separately from quality `dropReasonCounts`, and excludes them from validatorPassRate', () => {
    const acc = new MetricsAccumulator('baseline', 2);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's1' },
      { type: 'llm_usage', target, usage: { costUsd: 0.01, inputTokens: 10, outputTokens: 5 }, outcome: 'ingested' },
      { type: 'generated', target },
      { type: 'errored', target, class: 'transient_infra', code: 'network', detail: 'render failed: ECONNREFUSED', attempts: 3 },
      { type: 'llm_usage', target, usage: { costUsd: 0.02, inputTokens: 20, outputTokens: 8 }, outcome: 'errored' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, errored: 1 }));
    expect(m.errorCodeCounts).toEqual({ network: 1 });
    expect(m.dropReasonCounts).toEqual({}); // an infra error must never land in the quality drop-reason breakdown
    expect(m.dropReasonCounts.validation).toBeUndefined();
    // validatorPassRate only subtracts 'validation' drops — an errored target must
    // not count against it (2 generated, 0 validation drops → 100%, even though
    // 1 of 2 errored out).
    expect(m.validatorPassRate).toBe(1);
    expect(m.costPerAcceptedUsd).toBeCloseTo(0.01, 5);
  });

  it('counts one retryCount per `retry` RunEvent (one per backoff-and-retry, not per target)', () => {
    const acc = new MetricsAccumulator('baseline', 1);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'retry', target, attempt: 1, code: 'network', detail: 'ECONNRESET' },
      { type: 'retry', target, attempt: 2, code: 'network', detail: 'ECONNRESET' },
      { type: 'ingested', target, slug: 's1' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 1, ingested: 1 }));
    expect(m.retryCount).toBe(2);
  });

  it('computes nearDupeRate from RunSummary.nearDuped (T1.2), and null when nothing was generated', () => {
    const acc = new MetricsAccumulator('baseline', 4);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'near_duplicate', target, distance: 2 },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, nearDuped: 1 }));
    expect(m.nearDupeRate).toBeCloseTo(0.5, 5);

    const empty = new MetricsAccumulator('empty', 0).finalize(summary());
    expect(empty.nearDupeRate).toBeNull();
  });

  it('carries the config label through to the finalized metrics', () => {
    const acc = new MetricsAccumulator('my-config', 3);
    const m = acc.finalize(summary());
    expect(m.label).toBe('my-config');
    expect(m.targetsPlanned).toBe(3);
  });

  it('computes renderFailedRate from RunSummary.renderFailed (T1.3), and null when nothing was generated', () => {
    const acc = new MetricsAccumulator('baseline', 4);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'render_failed', target },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, renderFailed: 1 }));
    expect(m.renderFailedRate).toBeCloseTo(0.5, 5);

    const empty = new MetricsAccumulator('empty', 0).finalize(summary());
    expect(empty.renderFailedRate).toBeNull();
  });

  // T2.1: renderBlank is a distinct counter/rate from renderFailed — a
  // confirmed-blank page, not a generic no-previews/exception miss.
  it('computes renderBlankRate from RunSummary.renderBlank (T2.1), distinct from renderFailedRate, and null when nothing was generated', () => {
    const acc = new MetricsAccumulator('baseline', 4);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'render_blank', target },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 1, renderBlank: 1 }));
    expect(m.renderBlankRate).toBeCloseTo(0.5, 5);
    expect(m.renderFailedRate).toBe(0);

    const empty = new MetricsAccumulator('empty', 0).finalize(summary());
    expect(empty.renderBlankRate).toBeNull();
  });

  // Review fix (T1.3): a below-threshold vision-critic drop now also emits a
  // `dropped` RunEvent (reason: 'vision_critic'), and a critic that throws
  // emits one with reason 'vision_critic_error' — both must roll up into
  // dropReasonCounts like every other drop reason, so the eval scoreboard's
  // drop-reason breakdown totals match RunSummary.qualityDropped. T2.2
  // reaffirms this: a vision-critic-throws is a deliberate content-quality
  // policy decision ("no unscored layout ships"), not an infra failure, so it
  // stays a `dropped`/qualityDropped event — never `errored`.
  it('rolls vision-critic drops (score-based and critic-error) into dropReasonCounts', () => {
    const acc = new MetricsAccumulator('baseline', 2);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'vision_critic', target, score: 2, issues: ['overlap'], passed: false },
      { type: 'dropped', target, reason: 'vision_critic', detail: 'score 2 issues=overlap' },
      { type: 'generated', target },
      { type: 'dropped', target, reason: 'vision_critic_error', detail: 'claude CLI exited non-zero' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, qualityDropped: 2 }));
    expect(m.dropReasonCounts).toEqual({ vision_critic: 1, vision_critic_error: 1 });
  });

  it('builds a vision-critic score distribution + mean from vision_critic events (T1.3), null when the critic never ran', () => {
    const acc = new MetricsAccumulator('baseline', 3);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'vision_critic', target, score: 4, issues: [], passed: true },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'vision_critic', target, score: 2, issues: ['overlap'], passed: false },
      { type: 'generated', target },
      { type: 'vision_critic', target, score: 4, issues: [], passed: true },
      { type: 'ingested', target, slug: 's2' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 3, ingested: 2, qualityDropped: 1 }));
    expect(m.visionScoreDistribution).toEqual({ '2': 1, '4': 2 });
    expect(m.visionScoreMean).toBeCloseTo((4 + 2 + 4) / 3, 5);

    const empty = new MetricsAccumulator('empty', 0).finalize(summary());
    expect(empty.visionScoreDistribution).toBeNull();
    expect(empty.visionScoreMean).toBeNull();
  });

  // T2.4: SEO quality-floor misses are flagged, never dropped — they must
  // still be counted somewhere in the scoreboard so a run that's silently
  // shipping thin metadata is visible.
  it('counts seo_floor_miss events without affecting qualityDropped/ingested', () => {
    const acc = new MetricsAccumulator('baseline', 2);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'seo_floor_miss', target, metaDescriptionLength: 12, keywordCount: 1 },
      { type: 'ingested', target, slug: 's1' },
      { type: 'generated', target },
      { type: 'ingested', target, slug: 's2' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 2, ingested: 2 }));
    expect(m.seoFloorMissCount).toBe(1);
    expect(m.qualityDropped).toBe(0);
  });

  it('counts seo_clamped events by axis', () => {
    const acc = new MetricsAccumulator('baseline', 1);
    const events: RunEvent[] = [
      { type: 'generated', target },
      { type: 'seo_clamped', target, axis: 'type', proposed: 'bogus', clamped: 'hero' },
      { type: 'seo_clamped', target, axis: 'colors', proposed: ['blue', 'nope'], clamped: ['blue'] },
      { type: 'seo_clamped', target, axis: 'type', proposed: 'also-bogus', clamped: 'hero' },
      { type: 'ingested', target, slug: 's1' },
    ];
    for (const e of events) acc.add(e);
    const m = acc.finalize(summary({ generated: 1, ingested: 1 }));
    expect(m.seoClampCountsByAxis).toEqual({ type: 2, colors: 1 });
    expect(m.seoClampCount).toBe(3);
  });

  it('leaves seo floor/clamp counts at zero when neither event ever fires', () => {
    const acc = new MetricsAccumulator('baseline', 1);
    acc.add({ type: 'generated', target });
    acc.add({ type: 'ingested', target, slug: 's1' });
    const m = acc.finalize(summary({ generated: 1, ingested: 1 }));
    expect(m.seoFloorMissCount).toBe(0);
    expect(m.seoClampCount).toBe(0);
    expect(m.seoClampCountsByAxis).toEqual({});
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
    expect(table).toContain('vision score');
    expect(table).toContain('render-failed');
    // T2.2: quality drops and infra errors must both be visible, distinctly, in
    // the scoreboard (the task's "drop-reasons-by-class" requirement).
    expect(table).toContain('quality dropped');
    expect(table).toContain('errored');
    expect(table).toContain('drop reasons (quality)');
    expect(table).toContain('error codes (infra)');
    // T2.4: SEO quality-floor misses + axis/color clamp visibility.
    expect(table).toContain('seo floor misses');
    expect(table).toContain('seo axis clamps');
    expect(table).toContain('seo clamps by axis');
  });
});
