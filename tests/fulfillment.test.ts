import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { handleStripeEvent, type FulfillmentStore } from '@/lib/stripe/fulfillment';
import pack from './fixtures/stripe/checkout-pack.json';
import membership from './fixtures/stripe/checkout-membership.json';
import subUpdated from './fixtures/stripe/subscription-updated.json';
import subDeleted from './fixtures/stripe/subscription-deleted.json';

function fakeStore(over: Partial<FulfillmentStore> = {}): FulfillmentStore {
  return {
    hasProcessedEvent: vi.fn(async () => false),
    markEventProcessed: vi.fn(async () => {}),
    findOrCreateUserByEmail: vi.fn(async () => 'user_1'),
    findUserBySubscriptionId: vi.fn(async () => 'user_1'),
    recordOrder: vi.fn(async () => {}),
    grantPackEntitlement: vi.fn(async () => {}),
    upsertSubscription: vi.fn(async () => {}),
    grantAllAccess: vi.fn(async () => {}),
    revokeAllAccess: vi.fn(async () => {}),
    ...over,
  };
}

describe('handleStripeEvent', () => {
  it('pack checkout → user + order + pack entitlement, then marks the event', async () => {
    const s = fakeStore();
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('buyer@example.com');
    expect(s.recordOrder).toHaveBeenCalledWith({ userId: 'user_1', stripeCheckoutId: 'cs_pack_1', amountCents: 4900 });
    expect(s.grantPackEntitlement).toHaveBeenCalledWith('user_1', 'pack_saas');
    expect(s.markEventProcessed).toHaveBeenCalledWith('evt_pack_1', 'checkout.session.completed');
  });

  it('membership checkout → subscription + all_access', async () => {
    const s = fakeStore();
    await handleStripeEvent(membership as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('member@example.com');
    expect((s.upsertSubscription as any).mock.calls[0][0]).toMatchObject({ userId: 'user_1', stripeSubscriptionId: 'sub_123', status: 'active' });
    expect(s.grantAllAccess).toHaveBeenCalledWith('user_1', null);
  });

  it('subscription.updated active → grants all_access with the period end', async () => {
    const s = fakeStore();
    await handleStripeEvent(subUpdated as unknown as Stripe.Event, s);
    expect(s.findUserBySubscriptionId).toHaveBeenCalledWith('sub_123');
    const [userId, expiresAt] = (s.grantAllAccess as any).mock.calls[0];
    expect(userId).toBe('user_1');
    expect(expiresAt).toBeInstanceOf(Date);
    expect((expiresAt as Date).getTime()).toBe(1788000000 * 1000);
  });

  it('subscription.deleted → revokes all_access', async () => {
    const s = fakeStore();
    await handleStripeEvent(subDeleted as unknown as Stripe.Event, s);
    expect(s.revokeAllAccess).toHaveBeenCalledWith('user_1');
    expect((s.upsertSubscription as any).mock.calls[0][0]).toMatchObject({ status: 'canceled' });
  });

  it('is idempotent: a processed event writes nothing', async () => {
    const s = fakeStore({ hasProcessedEvent: vi.fn(async () => true) });
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(s.grantPackEntitlement).not.toHaveBeenCalled();
    expect(s.markEventProcessed).not.toHaveBeenCalled();
  });
});
