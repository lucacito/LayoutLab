import { describe, it, expect } from 'vitest';
import { STATS } from '@/lib/site/stats';
import { WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';

describe('marketing stats', () => {
  it('derives the widget count from the mapping data (single source of truth)', () => {
    expect(STATS.elementorWidgetsMapped).toBe(WIDGET_TYPES_MAPPED);
  });
  it('carries the verified validator and catalog numbers', () => {
    expect(STATS.validatorViolationClasses).toBe(15);
    expect(STATS.validatorBlockTypes).toBe(61);
    expect(STATS.freeLayoutsPublished).toBeGreaterThanOrEqual(190);
  });
});
