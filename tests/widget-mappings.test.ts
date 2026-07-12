import { describe, it, expect } from 'vitest';
import { WIDGET_MAPPING_GROUPS, WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';

describe('widget mappings data', () => {
  it('counts every widget across groups', () => {
    const sum = WIDGET_MAPPING_GROUPS.reduce((n, g) => n + g.widgets.length, 0);
    expect(WIDGET_TYPES_MAPPED).toBe(sum);
    expect(WIDGET_TYPES_MAPPED).toBeGreaterThanOrEqual(120);
  });
  it('has no duplicate widget names', () => {
    const all = WIDGET_MAPPING_GROUPS.flatMap((g) => g.widgets);
    expect(new Set(all).size).toBe(all.length);
  });
  it('groups the major ecosystems', () => {
    const names = WIDGET_MAPPING_GROUPS.map((g) => g.group).join(' ');
    expect(names).toMatch(/Elementor core/);
    expect(names).toMatch(/Essential Addons/);
  });
});
