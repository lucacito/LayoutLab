// Transport-agnostic license API logic over a LicenseStore (same pattern as
// lib/stripe/fulfillment.ts): routes stay thin, tests use an in-memory store.
import {
  effectiveStatus, isLicenseUsable, isNewerVersion, normalizeSiteUrl,
  type LicenseRecord,
} from './core';
import { PRICING, tierSiteLimit } from '@/lib/pricing/config';

export interface LicenseStore {
  findByKey(key: string): Promise<LicenseRecord | null>;
  upsertActivation(a: { licenseId: string; siteUrl: string; pluginVersion?: string; wpVersion?: string }): Promise<void>;
  markDeactivated(licenseId: string, siteUrl: string): Promise<void>;
  latestRelease(productSlug: string): Promise<{ version: string; blobKey: string; changelog: string | null } | null>;
  countActiveActivations(licenseId: string): Promise<number>;
  upsertActivationWithinLimit(a: { licenseId: string; siteUrl: string; pluginVersion?: string; wpVersion?: string }, limit: number | null): Promise<{ ok: true; used: number } | { ok: false; used: number }>;
}

export type LicenseApiResult = { status: number; body: Record<string, unknown> };

const invalidRequest: LicenseApiResult = { status: 400, body: { error: 'invalid_request' } };
const invalidKey: LicenseApiResult = { status: 404, body: { error: 'invalid_key' } };

interface LicenseBodyOptions {
  now: Date;
  origin: string;
  sitesUsed?: number;
}

function licenseBody(l: LicenseRecord, opts: LicenseBodyOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    status: effectiveStatus(l, opts.now),
    product: l.productSlug,
    expires: l.lifetime ? null : (l.currentPeriodEnd ? l.currentPeriodEnd.toISOString() : null),
  };

  // Add tier/sites fields only for the tiered product when tier is not null
  if (l.productSlug === PRICING.product && l.tier) {
    body.tier = l.tier;
    body.tier_label = (PRICING.tiers.find((t) => t.id === l.tier) ?? { label: l.tier }).label;
    body.sites_used = opts.sitesUsed ?? 0;
    body.sites_allowed = tierSiteLimit(l.tier);
    body.founding = l.founding;
    body.lifetime = l.lifetime;
    body.upgrade_url = `${opts.origin}${PRICING.urls.pricing}`;
    body.manage_url = `${opts.origin}${PRICING.urls.account}`;
  }

  return body;
}

async function findUsable(
  key: string, product: string | null, store: LicenseStore, now: Date,
): Promise<{ license: LicenseRecord } | { fail: LicenseApiResult }> {
  const license = await store.findByKey(key);
  if (!license) return { fail: invalidKey };
  if (product !== null && license.productSlug !== product) {
    return { fail: { status: 403, body: { error: 'product_mismatch' } } };
  }
  if (!isLicenseUsable(license, now)) {
    return { fail: { status: 403, body: { error: 'license_not_usable', status: effectiveStatus(license, now) } } };
  }
  return { license };
}

export async function handleActivate(
  input: { key: string; siteUrl: string; product: string; pluginVersion?: string; wpVersion?: string },
  store: LicenseStore,
  opts: { now?: Date; origin: string } = { origin: '' },
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const now = opts.now ?? new Date();
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;

  // For tiered products, check site limit
  if (r.license.productSlug === PRICING.product && r.license.tier) {
    const limit = tierSiteLimit(r.license.tier);
    const result = await store.upsertActivationWithinLimit(
      { licenseId: r.license.id, siteUrl: site, pluginVersion: input.pluginVersion, wpVersion: input.wpVersion },
      limit,
    );
    if (!result.ok) {
      return {
        status: 403,
        body: {
          error: 'site_limit_reached',
          tier: r.license.tier,
          tier_label: (PRICING.tiers.find((t) => t.id === r.license.tier) ?? { label: r.license.tier }).label,
          sites_used: result.used,
          sites_allowed: limit,
          upgrade_url: `${opts.origin}${PRICING.urls.pricing}`,
          manage_url: `${opts.origin}${PRICING.urls.account}`,
        },
      };
    }
    return { status: 200, body: licenseBody(r.license, { now, origin: opts.origin, sitesUsed: result.used }) };
  }

  // Non-tiered products: regular upsert
  await store.upsertActivation({
    licenseId: r.license.id, siteUrl: site,
    pluginVersion: input.pluginVersion, wpVersion: input.wpVersion,
  });
  return { status: 200, body: licenseBody(r.license, { now, origin: opts.origin }) };
}

export async function handleValidate(
  input: { key: string; siteUrl: string; product: string },
  store: LicenseStore,
  opts: { now?: Date; origin: string } = { origin: '' },
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const now = opts.now ?? new Date();
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;

  // For tiered products, check site limit (but never reject if site is already active)
  if (r.license.productSlug === PRICING.product && r.license.tier) {
    const limit = tierSiteLimit(r.license.tier);
    const result = await store.upsertActivationWithinLimit(
      { licenseId: r.license.id, siteUrl: site },
      limit,
    );
    if (!result.ok) {
      return {
        status: 403,
        body: {
          error: 'site_limit_reached',
          tier: r.license.tier,
          tier_label: (PRICING.tiers.find((t) => t.id === r.license.tier) ?? { label: r.license.tier }).label,
          sites_used: result.used,
          sites_allowed: limit,
          upgrade_url: `${opts.origin}${PRICING.urls.pricing}`,
          manage_url: `${opts.origin}${PRICING.urls.account}`,
        },
      };
    }
    return { status: 200, body: licenseBody(r.license, { now, origin: opts.origin, sitesUsed: result.used }) };
  }

  // Non-tiered: refresh last_seen
  await store.upsertActivation({ licenseId: r.license.id, siteUrl: site });
  return { status: 200, body: licenseBody(r.license, { now, origin: opts.origin }) };
}

export async function handleDeactivate(
  input: { key: string; siteUrl: string },
  store: LicenseStore,
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const license = await store.findByKey(input.key);
  if (!license) return invalidKey;
  await store.markDeactivated(license.id, site);
  return { status: 200, body: { ok: true } };
}

export async function handleUpdateCheck(
  input: { product: string; version: string; key?: string },
  store: LicenseStore,
  origin: string,
  opts: { now?: Date } = {},
): Promise<LicenseApiResult> {
  const now = opts.now ?? new Date();
  const release = await store.latestRelease(input.product);
  if (!release || !isNewerVersion(release.version, input.version)) {
    return { status: 200, body: { update: false } };
  }
  const body: Record<string, unknown> = {
    update: true, version: release.version, changelog: release.changelog ?? '',
  };
  if (input.key) {
    const license = await store.findByKey(input.key);
    if (license && license.productSlug === input.product && isLicenseUsable(license, now)) {
      body.package = `${origin}/api/plugin/download?product=${encodeURIComponent(input.product)}&key=${encodeURIComponent(input.key)}`;
    }
  }
  return { status: 200, body };
}
