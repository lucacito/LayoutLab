import { randomUUID } from 'node:crypto';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, orders, entitlements, subscriptions, stripeEvents, packs, licenses } from '@/db/schema';
import { findOrCreateUserByEmail } from '@/lib/users/find-or-create';
import { createMagicSignInUrl, signInUrlDeps } from '@/lib/auth/sign-in-url';
import { purchaseReceiptEmail } from '@/lib/email/receipt';
import { sendEmail } from '@/lib/email';
import { generateLicenseKey, PRODUCT_TITLES, type PluginProduct } from '@/lib/license-server/core';
import { licenseKeyEmail } from '@/lib/email/license-email';
import type { FulfillmentStore } from './fulfillment';

export const dbStore: FulfillmentStore = {
  async hasProcessedEvent(id) {
    const rows = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, id)).limit(1);
    return rows.length > 0;
  },
  async markEventProcessed(id, type) {
    await db.insert(stripeEvents).values({ id, type }).onConflictDoNothing();
  },
  findOrCreateUserByEmail,
  async findUserBySubscriptionId(subId) {
    const rows = await db.select({ userId: subscriptions.userId }).from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
    return rows[0]?.userId ?? null;
  },
  async linkStripeCustomer(userId, customerId) {
    await db.update(users)
      .set({ stripeCustomerId: customerId })
      .where(and(eq(users.id, userId), or(isNull(users.stripeCustomerId), eq(users.stripeCustomerId, customerId))));
  },
  async findUserByStripeCustomerId(customerId) {
    if (!customerId) return null;
    const rows = await db.select({ id: users.id }).from(users)
      .where(eq(users.stripeCustomerId, customerId)).limit(1);
    return rows[0]?.id ?? null;
  },
  async recordOrder(o) {
    await db.insert(orders).values({
      id: randomUUID(), userId: o.userId, stripeCheckoutId: o.stripeCheckoutId, amountCents: o.amountCents, status: 'paid',
    }).onConflictDoNothing();
  },
  async grantPackEntitlement(userId, packId) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: `pack:${packId}`, source: 'order',
    }).onConflictDoNothing();
  },
  async upsertSubscription(s) {
    await db.insert(subscriptions).values({
      id: randomUUID(), userId: s.userId, stripeSubscriptionId: s.stripeSubscriptionId, status: s.status, currentPeriodEnd: s.currentPeriodEnd,
    }).onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: { status: s.status, currentPeriodEnd: s.currentPeriodEnd },
    });
  },
  async grantAllAccess(userId, expiresAt) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: 'all_access', source: 'subscription', expiresAt,
    }).onConflictDoUpdate({
      target: [entitlements.userId, entitlements.scope],
      set: { expiresAt },
    });
  },
  async revokeAllAccess(userId) {
    await db.delete(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.scope, 'all_access')));
  },
  async notifyPurchase(input) {
    const signInUrl = await createMagicSignInUrl(input.email, '/account/downloads', signInUrlDeps);
    let packTitle: string | undefined;
    if (input.packId) {
      const rows = await db.select({ title: packs.title }).from(packs).where(eq(packs.id, input.packId)).limit(1);
      packTitle = rows[0]?.title;
    }
    const { subject, html, text } = purchaseReceiptEmail({ kind: input.kind, packTitle, amountCents: input.amountCents, signInUrl });
    const { sent } = await sendEmail({ to: input.email, subject, html, text });
    if (!sent) console.log(`[receipt:dev] sign-in link for ${input.email}:\n${signInUrl}`);
  },
  async mintLicense(l) {
    const licenseKey = generateLicenseKey();
    await db.insert(licenses).values({
      id: randomUUID(), userId: l.userId, productSlug: l.productSlug,
      licenseKey, status: 'active',
      stripeSubscriptionId: l.stripeSubscriptionId, currentPeriodEnd: l.currentPeriodEnd,
    }).onConflictDoNothing({ target: licenses.stripeSubscriptionId });
    // Idempotency: if this subscription already minted a key (webhook retry),
    // return the existing one instead of a dangling fresh key.
    if (l.stripeSubscriptionId) {
      const rows = await db.select({ licenseKey: licenses.licenseKey }).from(licenses)
        .where(eq(licenses.stripeSubscriptionId, l.stripeSubscriptionId)).limit(1);
      if (rows[0]) return { licenseKey: rows[0].licenseKey };
    }
    return { licenseKey };
  },
  async setLicenseStatusBySubscription(s) {
    await db.update(licenses)
      .set({ status: s.status === 'canceled' ? 'canceled' : s.status, ...(s.currentPeriodEnd ? { currentPeriodEnd: s.currentPeriodEnd } : {}) })
      .where(eq(licenses.stripeSubscriptionId, s.stripeSubscriptionId));
  },
  async grantPluginEntitlement(userId, productSlug) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: `plugin:${productSlug}`, source: 'order',
    }).onConflictDoNothing();
  },
  async notifyLicensePurchase(input) {
    const signInUrl = await createMagicSignInUrl(input.email, '/account/licenses', signInUrlDeps);
    const title = PRODUCT_TITLES[input.productSlug as PluginProduct] ?? input.productSlug;
    const { subject, html, text } = licenseKeyEmail({ productTitle: title, licenseKey: input.licenseKey, signInUrl });
    const { sent } = await sendEmail({ to: input.email, subject, html, text });
    if (!sent) console.log(`[license:dev] key for ${input.email}: ${input.licenseKey}\n${signInUrl}`);
  },
};
