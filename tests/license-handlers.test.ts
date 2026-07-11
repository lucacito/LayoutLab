import { describe, it, expect, beforeEach } from 'vitest';
import type { LicenseRecord } from '@/lib/license-server/core';
import { PAST_DUE_GRACE_MS } from '@/lib/license-server/core';
import {
  handleActivate, handleValidate, handleDeactivate, handleUpdateCheck,
  type LicenseStore,
} from '@/lib/license-server/handlers';

const NOW = new Date('2026-07-11T12:00:00Z');
const KEY = 'JHMG-AAAA-BBBB-CCCC-DDDD';

function makeStore(license: LicenseRecord | null, release?: { version: string; blobKey: string; changelog: string | null }) {
  const activations: Array<{ licenseId: string; siteUrl: string }> = [];
  const deactivated: Array<{ licenseId: string; siteUrl: string }> = [];
  const store: LicenseStore = {
    async findByKey(k) { return license && k === license.licenseKey ? license : null; },
    async upsertActivation(a) { activations.push({ licenseId: a.licenseId, siteUrl: a.siteUrl }); },
    async markDeactivated(licenseId, siteUrl) { deactivated.push({ licenseId, siteUrl }); },
    async latestRelease() { return release ?? null; },
  };
  return { store, activations, deactivated };
}

const LICENSE: LicenseRecord = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: KEY, status: 'active', currentPeriodEnd: new Date('2027-07-11T00:00:00Z'),
};

describe('handleActivate', () => {
  it('activates a usable license and records the normalized site', async () => {
    const { store, activations } = makeStore(LICENSE);
    const res = await handleActivate(
      { key: KEY, siteUrl: 'https://www.Client-Site.com/', product: 'elementor-to-divi5-pro', pluginVersion: '1.0.0' },
      store, NOW,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'active', product: 'elementor-to-divi5-pro' });
    expect(res.body.expires).toBe('2027-07-11T00:00:00.000Z');
    expect(activations).toEqual([{ licenseId: 'lic_1', siteUrl: 'client-site.com' }]);
  });
  it('404s an unknown key', async () => {
    const { store } = makeStore(null);
    const res = await handleActivate({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', siteUrl: 'a.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'invalid_key' });
  });
  it('403s a key for the other product', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleActivate({ key: KEY, siteUrl: 'a.com', product: 'divi-to-elementor-pro' }, store, NOW);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'product_mismatch' });
  });
  it('403s an expired license with its effective status', async () => {
    const old = { ...LICENSE, status: 'past_due' as const, currentPeriodEnd: new Date(NOW.getTime() - PAST_DUE_GRACE_MS - 1000) };
    const { store } = makeStore(old);
    const res = await handleActivate({ key: KEY, siteUrl: 'a.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'license_not_usable', status: 'expired' });
  });
  it('400s a garbage site url', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleActivate({ key: KEY, siteUrl: '!!!', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_request' });
  });
});

describe('handleValidate', () => {
  it('returns status and refreshes last-seen via upsertActivation', async () => {
    const { store, activations } = makeStore(LICENSE);
    const res = await handleValidate({ key: KEY, siteUrl: 'client-site.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'active' });
    expect(activations.length).toBe(1);
  });
  it('past_due within grace validates as past_due (still usable)', async () => {
    const pd = { ...LICENSE, status: 'past_due' as const, currentPeriodEnd: new Date(NOW.getTime() - 1000) };
    const { store } = makeStore(pd);
    const res = await handleValidate({ key: KEY, siteUrl: 'client-site.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'past_due' });
  });
});

describe('handleDeactivate', () => {
  it('marks the site deactivated and is idempotent-shaped (200 even if unknown site)', async () => {
    const { store, deactivated } = makeStore(LICENSE);
    const res = await handleDeactivate({ key: KEY, siteUrl: 'https://client-site.com' }, store);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(deactivated).toEqual([{ licenseId: 'lic_1', siteUrl: 'client-site.com' }]);
  });
});

describe('handleUpdateCheck', () => {
  const RELEASE = { version: '1.2.0', blobKey: 'plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip', changelog: 'Fixes' };
  it('licensed + newer release => update with package URL carrying the key', async () => {
    const { store } = makeStore(LICENSE, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ update: true, version: '1.2.0', changelog: 'Fixes' });
    expect(res.body.package).toBe(`https://divi5lab.com/api/plugin/download?product=elementor-to-divi5-pro&key=${encodeURIComponent(KEY)}`);
  });
  it('unusable license => update metadata visible but NO package (renewal nudge)', async () => {
    const dead = { ...LICENSE, status: 'canceled' as const };
    const { store } = makeStore(dead, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ update: true, version: '1.2.0' });
    expect(res.body.package).toBeUndefined();
  });
  it('already newest => update: false', async () => {
    const { store } = makeStore(LICENSE, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.2.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ update: false });
  });
  it('no release row => update: false', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.body).toEqual({ update: false });
  });
});
