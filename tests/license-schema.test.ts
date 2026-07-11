import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { licenses, licenseActivations, pluginReleases } from '@/db/schema';

describe('licensing schema', () => {
  it('defines the licenses table with key/status/subscription columns', () => {
    expect(getTableName(licenses)).toBe('licenses');
    expect(licenses.licenseKey.name).toBe('license_key');
    expect(licenses.productSlug.name).toBe('product_slug');
    expect(licenses.stripeSubscriptionId.name).toBe('stripe_subscription_id');
    expect(licenses.currentPeriodEnd.name).toBe('current_period_end');
    expect(licenses.status.name).toBe('status');
  });

  it('defines license_activations keyed by license + site', () => {
    expect(getTableName(licenseActivations)).toBe('license_activations');
    expect(licenseActivations.siteUrl.name).toBe('site_url');
    expect(licenseActivations.lastSeenAt.name).toBe('last_seen_at');
    expect(licenseActivations.deactivatedAt.name).toBe('deactivated_at');
  });

  it('defines plugin_releases with product/version/blob', () => {
    expect(getTableName(pluginReleases)).toBe('plugin_releases');
    expect(pluginReleases.productSlug.name).toBe('product_slug');
    expect(pluginReleases.version.name).toBe('version');
    expect(pluginReleases.blobKey.name).toBe('blob_key');
  });
});
