// Drizzle-backed LicenseStore (same idiom as lib/stripe/fulfillment-store.ts):
// deliberately thin SQL — behavioral coverage lives in the handler tests
// (lib/license-server/handlers.ts consumers) plus the e2e.
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { licenses, licenseActivations, pluginReleases } from '@/db/schema';
import { effectiveStatus, type LicenseRecord, type StoredLicenseStatus } from './core';
import type { LicenseStore } from './handlers';

export const dbLicenseStore: LicenseStore = {
  async findByKey(key) {
    const rows = await db.select().from(licenses).where(eq(licenses.licenseKey, key)).limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id, userId: r.userId, productSlug: r.productSlug, licenseKey: r.licenseKey,
      status: r.status as LicenseRecord['status'], currentPeriodEnd: r.currentPeriodEnd,
    };
  },
  async upsertActivation(a) {
    await db.insert(licenseActivations).values({
      id: randomUUID(), licenseId: a.licenseId, siteUrl: a.siteUrl,
      pluginVersion: a.pluginVersion, wpVersion: a.wpVersion,
    }).onConflictDoUpdate({
      target: [licenseActivations.licenseId, licenseActivations.siteUrl],
      set: {
        lastSeenAt: new Date(), deactivatedAt: null,
        ...(a.pluginVersion ? { pluginVersion: a.pluginVersion } : {}),
        ...(a.wpVersion ? { wpVersion: a.wpVersion } : {}),
      },
    });
  },
  async markDeactivated(licenseId, siteUrl) {
    await db.update(licenseActivations)
      .set({ deactivatedAt: new Date() })
      .where(and(eq(licenseActivations.licenseId, licenseId), eq(licenseActivations.siteUrl, siteUrl)));
  },
  async latestRelease(productSlug) {
    const rows = await db.select().from(pluginReleases)
      .where(eq(pluginReleases.productSlug, productSlug))
      .orderBy(desc(pluginReleases.releasedAt)).limit(1);
    const r = rows[0];
    return r ? { version: r.version, blobKey: r.blobKey, changelog: r.changelog } : null;
  },
};

// Account page query: a user's licenses with their currently-active sites.
export async function getLicensesForUser(userId: string): Promise<Array<{
  id: string; productSlug: string; licenseKey: string;
  status: StoredLicenseStatus; currentPeriodEnd: Date | null; activeSites: string[];
}>> {
  const rows = await db.select().from(licenses).where(eq(licenses.userId, userId));
  const out = [];
  for (const r of rows) {
    const sites = await db.select({ siteUrl: licenseActivations.siteUrl })
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, r.id), isNull(licenseActivations.deactivatedAt)));
    out.push({
      id: r.id, productSlug: r.productSlug, licenseKey: r.licenseKey,
      status: effectiveStatus({ status: r.status as StoredLicenseStatus, currentPeriodEnd: r.currentPeriodEnd }, new Date()),
      currentPeriodEnd: r.currentPeriodEnd,
      activeSites: sites.map((s) => s.siteUrl),
    });
  }
  return out;
}
