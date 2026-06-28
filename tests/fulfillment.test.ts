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
    linkStripeCustomer: vi.fn(async () => {}),
    findUserByStripeCustomerId: vi.fn(async () => 'user_1'),
    recordOrder: vi.fn(async () => {}),
    grantPackEntitlement: vi.fn(async () => {}),
    upsertSubscription: vi.fn(async () => {}),
    grantAllAccess: vi.fn(async () => {}),
    revokeAllAccess: vi.fn(async () => {}),
    ...over,
  };
}

describe('handleStripeEvent', () => {
  it('pack checkout → user + order + pack entitlement + customer link, then marks the event', async () => {
    const s = fakeStore();
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('buyer@example.com');
    expect(s.linkStripeCustomer).toHaveBeenCalledWith('user_1', 'cus_123');
    expect(s.recordOrder).toHaveBeenCalledWith({ userId: 'user_1', stripeCheckoutId: 'cs_pack_1', amountCents: 4900 });
    expect(s.grantPackEntitlement).toHaveBeenCalledWith('user_1', 'pack_saas');
    expect(s.markEventProcessed).toHaveBeenCalledWith('evt_pack_1', 'checkout.session.completed');
  });

  it('membership checkout → grants all_access immediately + links customer + upserts subscription', async () => {
    const s = fakeStore();
    await handleStripeEvent(membership as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('member@example.com');
    expect(s.linkStripeCustomer).toHaveBeenCalledWith('user_1', 'cus_123');
    expect(s.grantAllAccess).toHaveBeenCalledWith('user_1', null);
    expect((s.upsertSubscription as any).mock.calls[0][0]).toMatchObject({ userId: 'user_1', stripeSubscriptionId: 'sub_123', status: 'active' });
  });

  it('membership checkout grants all_access even when subscription id is missing', async () => {
    const noSubMembership = {
      id: 'evt_mem_nosub',
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_mem_nosub',
        mode: 'subscription',
        customer: 'cus_123',
        customer_details: { email: 'member@example.com' },
        metadata: { kind: 'membership', plan: 'monthly' },
      } },
    };
    const s = fakeStore();
    await handleStripeEvent(noSubMembership as unknown as Stripe.Event, s);
    expect(s.grantAllAccess).toHaveBeenCalledWith('user_1', null);
    expect(s.upsertSubscription).not.toHaveBeenCalled();
    expect(s.markEventProcessed).toHaveBeenCalled();
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

  it('subscription.updated falls back to findUserByStripeCustomerId when sub id not found', async () => {
    const s = fakeStore({
      findUserBySubscriptionId: vi.fn(async () => null),
      findUserByStripeCustomerId: vi.fn(async () => 'user_1'),
    });
    await handleStripeEvent(subUpdated as unknown as Stripe.Event, s);
    expect(s.findUserByStripeCustomerId).toHaveBeenCalledWith('cus_123');
    expect(s.grantAllAccess).toHaveBeenCalled();
  });

  it('subscription.updated throws (not marks processed) when user is unresolvable', async () => {
    const s = fakeStore({
      findUserBySubscriptionId: vi.fn(async () => null),
      findUserByStripeCustomerId: vi.fn(async () => null),
    });
    await expect(handleStripeEvent(subUpdated as unknown as Stripe.Event, s)).rejects.toThrow('user not resolvable yet');
    expect(s.markEventProcessed).not.toHaveBeenCalled();
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
