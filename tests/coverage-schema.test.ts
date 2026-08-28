import { describe, it, expect } from 'vitest';
import { pluginCoverageReports } from '@/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

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
