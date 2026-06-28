import type Stripe from 'stripe';

export interface FulfillmentStore {
  hasProcessedEvent(id: string): Promise<boolean>;
  markEventProcessed(id: string, type: string): Promise<void>;
  findOrCreateUserByEmail(email: string): Promise<string>;
  findUserBySubscriptionId(subId: string): Promise<string | null>;
  linkStripeCustomer(userId: string, customerId: string): Promise<void>;
  findUserByStripeCustomerId(customerId: string): Promise<string | null>;
  recordOrder(o: { userId: string; stripeCheckoutId: string; amountCents: number }): Promise<void>;
  grantPackEntitlement(userId: string, packId: string): Promise<void>;
  upsertSubscription(s: { userId: string; stripeSubscriptionId: string; status: 'active' | 'past_due' | 'canceled'; currentPeriodEnd: Date | null }): Promise<void>;
  grantAllAccess(userId: string, expiresAt: Date | null): Promise<void>;
  revokeAllAccess(userId: string): Promise<void>;
  notifyPurchase(input: { email: string; kind: 'pack' | 'membership'; packId?: string; amountCents?: number }): Promise<void>;
}

function mapStatus(s: string): 'active' | 'past_due' | 'canceled' {
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid') return 'past_due';
  return 'canceled';
}

export async function handleStripeEvent(event: Stripe.Event, store: FulfillmentStore): Promise<void> {
  if (await store.hasProcessedEvent(event.id)) return;

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const email = s.customer_details?.email ?? s.customer_email ?? null;
      if (!email) break;
      const userId = await store.findOrCreateUserByEmail(email);
      const customerId = typeof s.customer === 'string' ? s.customer : null;
      if (customerId) await store.linkStripeCustomer(userId, customerId);
      const meta = (s.metadata ?? {}) as Record<string, string>;
      if (meta.kind === 'pack' && meta.packId) {
        await store.recordOrder({ userId, stripeCheckoutId: s.id, amountCents: s.amount_total ?? 0 });
        await store.grantPackEntitlement(userId, meta.packId);
      } else if (meta.kind === 'membership') {
        await store.grantAllAccess(userId, null);
        if (typeof s.subscription === 'string') {
          await store.upsertSubscription({ userId, stripeSubscriptionId: s.subscription, status: 'active', currentPeriodEnd: null });
        }
      }
      try {
        if (meta.kind === 'pack' && meta.packId) {
          await store.notifyPurchase({ email, kind: 'pack', packId: meta.packId, amountCents: s.amount_total ?? 0 });
        } else if (meta.kind === 'membership') {
          await store.notifyPurchase({ email, kind: 'membership' });
        }
      } catch (err) {
        console.error('[webhook] receipt email failed:', err);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : null;
      let userId = await store.findUserBySubscriptionId(sub.id);
      if (!userId && customerId) userId = await store.findUserByStripeCustomerId(customerId);
      if (!userId) throw new Error(`subscription event: user not resolvable yet for ${sub.id}`);
      const status = mapStatus(sub.status);
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      await store.upsertSubscription({ userId, stripeSubscriptionId: sub.id, status, currentPeriodEnd: periodEnd });
      if (status === 'active') await store.grantAllAccess(userId, periodEnd);
      else await store.revokeAllAccess(userId);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : null;
      let userId = await store.findUserBySubscriptionId(sub.id);
      if (!userId && customerId) userId = await store.findUserByStripeCustomerId(customerId);
      if (!userId) throw new Error(`subscription event: user not resolvable yet for ${sub.id}`);
      await store.upsertSubscription({ userId, stripeSubscriptionId: sub.id, status: 'canceled', currentPeriodEnd: null });
      await store.revokeAllAccess(userId);
      break;
    }
    default:
      break;
  }

  await store.markEventProcessed(event.id, event.type);
}
