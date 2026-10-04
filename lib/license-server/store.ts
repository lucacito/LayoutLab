// Drizzle-backed LicenseStore (same idiom as lib/stripe/fulfillment-store.ts):
// deliberately thin SQL. Behavioral coverage lives in the handler tests
// (lib/license-server/handlers.ts consumers) plus the e2e.
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
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
      id: r.id,
      userId: r.userId,
      productSlug: r.productSlug,
      licenseKey: r.licenseKey,
      status: r.status as LicenseRecord['status'],
      currentPeriodEnd: r.currentPeriodEnd,
      tier: r.tier,
      founding: r.founding,
      lifetime: r.lifetime,
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
  async countActiveActivations(licenseId) {
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, licenseId), isNull(licenseActivations.deactivatedAt)));
    return rows[0]?.count ?? 0;
  },
  async upsertActivationWithinLimit(a, limit) {
    // Unlimited tier always succeeds
    if (limit === null) {
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
      const count = await dbLicenseStore.countActiveActivations(a.licenseId);
      return { ok: true, used: count };
    }

    // For limited tiers: transactional check + insert/reactivate
    // This must be atomic to prevent race conditions at the boundary
    return await db.transaction(async (tx) => {
      // Lock the license row to prevent concurrent updates
      const licenseRows = await tx.select().from(licenses)
        .where(eq(licenses.id, a.licenseId));
      if (!licenseRows[0]) {
        return { ok: false, used: 0 };
      }

      // Count currently active activations
      const countRows = await tx.select({ count: sql<number>`count(*)` })
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, a.licenseId), isNull(licenseActivations.deactivatedAt)));
      const activeCount = countRows[0]?.count ?? 0;

      // Check if site is already active
      const existingRows = await tx.select().from(licenseActivations)
        .where(and(
          eq(licenseActivations.licenseId, a.licenseId),
          eq(licenseActivations.siteUrl, a.siteUrl),
          isNull(licenseActivations.deactivatedAt),
        ));
      const isAlreadyActive = existingRows.length > 0;

      // If already at limit but site is already active, allow reactivation
      if (activeCount >= limit && !isAlreadyActive) {
        return { ok: false, used: activeCount };
      }

      // Insert or reactivate
      await tx.insert(licenseActivations).values({
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

      // Recount to get the new total
      const newCountRows = await tx.select({ count: sql<number>`count(*)` })
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, a.licenseId), isNull(licenseActivations.deactivatedAt)));
      const newCount = newCountRows[0]?.count ?? 0;

      return { ok: true, used: newCount };
    });
  },
};

// Account page query: a user's licenses with their currently-active sites.
export async function getLicensesForUser(userId: string): Promise<Array<{
  id: string; productSlug: string; licenseKey: string;
  status: StoredLicenseStatus; currentPeriodEnd: Date | null; activeSites: string[];
  tier: string | null; founding: boolean; lifetime: boolean;
}>> {
  const rows = await db.select().from(licenses).where(eq(licenses.userId, userId));
  const out = [];
  for (const r of rows) {
    const sites = await db.select({ siteUrl: licenseActivations.siteUrl })
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, r.id), isNull(licenseActivations.deactivatedAt)));
    out.push({
      id: r.id,
      productSlug: r.productSlug,
      licenseKey: r.licenseKey,
      status: effectiveStatus({ status: r.status as StoredLicenseStatus, currentPeriodEnd: r.currentPeriodEnd }, new Date()),
      currentPeriodEnd: r.currentPeriodEnd,
      activeSites: sites.map((s) => s.siteUrl),
      tier: r.tier,
      founding: r.founding,
      lifetime: r.lifetime,
    });
  }
  return out;
}
