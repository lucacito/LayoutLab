// Transport-agnostic license API logic over a LicenseStore (same pattern as
// lib/stripe/fulfillment.ts): routes stay thin, tests use an in-memory store.
import {
  effectiveStatus, isLicenseUsable, isNewerVersion, normalizeSiteUrl,
  type LicenseRecord,
} from './core';

export interface LicenseStore {
  findByKey(key: string): Promise<LicenseRecord | null>;
  upsertActivation(a: { licenseId: string; siteUrl: string; pluginVersion?: string; wpVersion?: string }): Promise<void>;
  markDeactivated(licenseId: string, siteUrl: string): Promise<void>;
  latestRelease(productSlug: string): Promise<{ version: string; blobKey: string; changelog: string | null } | null>;
}

export type LicenseApiResult = { status: number; body: Record<string, unknown> };

const invalidRequest: LicenseApiResult = { status: 400, body: { error: 'invalid_request' } };
const invalidKey: LicenseApiResult = { status: 404, body: { error: 'invalid_key' } };

function licenseBody(l: LicenseRecord, now: Date): Record<string, unknown> {
  return {
    status: effectiveStatus(l, now),
    product: l.productSlug,
    expires: l.currentPeriodEnd ? l.currentPeriodEnd.toISOString() : null,
  };
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
  now: Date = new Date(),
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;
  await store.upsertActivation({
    licenseId: r.license.id, siteUrl: site,
    pluginVersion: input.pluginVersion, wpVersion: input.wpVersion,
  });
  return { status: 200, body: licenseBody(r.license, now) };
}

export async function handleValidate(
  input: { key: string; siteUrl: string; product: string },
  store: LicenseStore,
  now: Date = new Date(),
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;
  await store.upsertActivation({ licenseId: r.license.id, siteUrl: site }); // refresh last_seen
  return { status: 200, body: licenseBody(r.license, now) };
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
  siteUrl: string, // the store's public origin, e.g. env.NEXT_PUBLIC_SITE_URL
  now: Date = new Date(),
): Promise<LicenseApiResult> {
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
      body.package = `${siteUrl}/api/plugin/download?product=${encodeURIComponent(input.product)}&key=${encodeURIComponent(input.key)}`;
    }
  }
  return { status: 200, body };
}
