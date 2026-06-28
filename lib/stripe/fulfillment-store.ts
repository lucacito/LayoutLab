import { randomUUID } from 'node:crypto';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, orders, entitlements, subscriptions, stripeEvents } from '@/db/schema';
import type { FulfillmentStore } from './fulfillment';

export const dbStore: FulfillmentStore = {
  async hasProcessedEvent(id) {
    const rows = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, id)).limit(1);
    return rows.length > 0;
  },
  async markEventProcessed(id, type) {
    await db.insert(stripeEvents).values({ id, type }).onConflictDoNothing();
  },
  async findOrCreateUserByEmail(email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0].id;
    const id = randomUUID();
    await db.insert(users).values({ id, email, role: 'user' }).onConflictDoNothing();
    const row = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return row[0]?.id ?? id;
  },
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
};
