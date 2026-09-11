import { describe, it, expect } from 'vitest';
import { pluginCoverageReports } from '@/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { coveragePayloadSchema } from '@/lib/coverage/schema';

describe('plugin_coverage_reports', () => {
  it('stores anonymous per-report widget type lists', () => {
    const t = getTableConfig(pluginCoverageReports);
    expect(t.name).toBe('plugin_coverage_reports');
    const cols = t.columns.map((c) => c.name).sort();
    expect(cols).toEqual(['id', 'product', 'received_at', 'widget_types']);
  });

  it('carries no column that could identify a site', () => {
    const cols = getTableConfig(pluginCoverageReports).columns.map((c) => c.name);
    for (const forbidden of ['site_url', 'site_hash', 'ip', 'user_id', 'email', 'license_key']) {
      expect(cols).not.toContain(forbidden);
    }
  });
});

describe('coveragePayloadSchema', () => {
  it('accepts every shipped converter product, WPBakery included', () => {
    for (const product of ['elementor-to-divi5', 'divi-to-elementor', 'beaver-to-divi5', 'wpbakery-to-divi5']) {
      const parsed = coveragePayloadSchema.safeParse({ product, widget_types: ['vc_pie'] });
      expect(parsed.success, product).toBe(true);
    }
  });

  it('still rejects a product it does not ship', () => {
    expect(coveragePayloadSchema.safeParse({ product: 'bricks-to-divi5', widget_types: ['x'] }).success).toBe(false);
  });
});
