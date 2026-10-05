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
    notifyPurchase: vi.fn(async () => {}),
    mintLicense: vi.fn(async () => ({ licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD' })),
    setLicenseStatusBySubscription: vi.fn(async () => ({ found: true })),
    grantPluginEntitlement: vi.fn(async () => {}),
    revokePluginEntitlement: vi.fn(async () => {}),
    notifyLicensePurchase: vi.fn(async () => {}),
    countLicensesByCondition: vi.fn(async () => 0),
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

  it('membership subscription.deleted does NOT revoke a plugin entitlement', async () => {
    const s = fakeStore();
    await handleStripeEvent(subDeleted as unknown as Stripe.Event, s);
    expect(s.revokePluginEntitlement).not.toHaveBeenCalled();
  });

  it('is idempotent: a processed event writes nothing', async () => {
    const s = fakeStore({ hasProcessedEvent: vi.fn(async () => true) });
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(s.grantPackEntitlement).not.toHaveBeenCalled();
    expect(s.markEventProcessed).not.toHaveBeenCalled();
  });

  it('sends a one-click receipt on a pack checkout', async () => {
    const s = fakeStore();
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.notifyPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@example.com', kind: 'pack', packId: 'pack_saas', amountCents: 4900 }),
    );
  });

  it('sends a receipt on a membership checkout', async () => {
    const s = fakeStore();
    await handleStripeEvent(membership as unknown as Stripe.Event, s);
    expect(s.notifyPurchase).toHaveBeenCalledWith(expect.objectContaining({ kind: 'membership' }));
  });

  it('does NOT send a receipt on subscription.updated', async () => {
    const s = fakeStore();
    await handleStripeEvent(subUpdated as unknown as Stripe.Event, s);
    expect(s.notifyPurchase).not.toHaveBeenCalled();
  });

  it('a failing notifyPurchase does not fail the webhook (event still processed)', async () => {
    const s = fakeStore({ notifyPurchase: vi.fn(async () => { throw new Error('resend down'); }) });
    await expect(handleStripeEvent(pack as unknown as Stripe.Event, s)).resolves.toBeUndefined();
    expect(s.markEventProcessed).toHaveBeenCalled();
  });
});

describe('plugin license fulfillment', () => {
  it('checkout.session.completed with kind=plugin mints a license + entitlement, no all-access', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p1', type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_1', customer: 'cus_1', subscription: 'sub_plugin_1',
        customer_details: { email: 'buyer@x.com' }, amount_total: 4900,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.mintLicense).toHaveBeenCalledWith({
      userId: 'user_1', productSlug: 'elementor-to-divi5-pro',
      stripeSubscriptionId: 'sub_plugin_1', currentPeriodEnd: null,
    });
    expect(store.grantPluginEntitlement).toHaveBeenCalledWith('user_1', 'elementor-to-divi5-pro');
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@x.com', productSlug: 'elementor-to-divi5-pro' }),
    );
    expect(store.grantAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
  });

  it('subscription.updated with plugin metadata updates the license, not membership', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p2', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'past_due',
        current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_plugin_1', status: 'past_due',
      currentPeriodEnd: new Date(1780000000 * 1000),
    });
    expect(store.grantAllAccess).not.toHaveBeenCalled();
    expect(store.revokeAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
  });

  it('subscription.deleted with plugin metadata cancels the license', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p3', type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'canceled',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_plugin_1', status: 'canceled', currentPeriodEnd: null,
    });
    expect(store.revokeAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
    expect(store.findUserBySubscriptionId).not.toHaveBeenCalled();
  });

  it('subscription.deleted with plugin metadata revokes the plugin entitlement by subscription id', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p8', type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'canceled',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.revokePluginEntitlement).toHaveBeenCalledWith('sub_plugin_1');
  });

  it('subscription.updated with plugin metadata (e.g. past_due) does NOT revoke the plugin entitlement', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p9', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'past_due',
        current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.revokePluginEntitlement).not.toHaveBeenCalled();
  });

  // Regression: 2026-08-13 incident. Stripe delivered subscription.created
  // (payload status 'incomplete' — snapshotted before payment confirmed) AFTER
  // checkout.session.completed and subscription.updated(active), and the stale
  // 'incomplete' mapped to 'canceled', bricking a just-paid license.
  it('subscription.created with plugin metadata and status incomplete is ignored (out-of-order pre-payment snapshot)', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p_incomplete', type: 'customer.subscription.created',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'incomplete',
        current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).not.toHaveBeenCalled();
    expect(store.markEventProcessed).toHaveBeenCalledWith('evt_p_incomplete', 'customer.subscription.created');
  });

  it('subscription.updated with plugin metadata and status incomplete_expired is ignored', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p_incexp', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'incomplete_expired',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).not.toHaveBeenCalled();
    expect(store.markEventProcessed).toHaveBeenCalledWith('evt_p_incexp', 'customer.subscription.updated');
  });

  it('membership subscription.created with status incomplete does NOT revoke all-access (same race)', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_m_incomplete', type: 'customer.subscription.created',
      data: { object: {
        id: 'sub_123', customer: 'cus_123', status: 'incomplete',
        current_period_end: 1780000000,
        metadata: {},
      } },
    } as never, store);
    expect(store.revokeAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
    expect(store.markEventProcessed).toHaveBeenCalledWith('evt_m_incomplete', 'customer.subscription.created');
  });

  it('subscription.deleted with plugin metadata does NOT revoke the entitlement when the license is not minted yet', async () => {
    const store = fakeStore({
      setLicenseStatusBySubscription: vi.fn(async () => ({ found: false })),
    });
    await expect(handleStripeEvent({
      id: 'evt_p10', type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'canceled',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store)).rejects.toThrow('license not minted yet');
    expect(store.revokePluginEntitlement).not.toHaveBeenCalled();
  });

  it('subscription.updated with plugin metadata throws (not marks processed) when the license is not minted yet', async () => {
    const store = fakeStore({
      setLicenseStatusBySubscription: vi.fn(async () => ({ found: false })),
    });
    await expect(handleStripeEvent({
      id: 'evt_p4', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'active',
        current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store)).rejects.toThrow('license not minted yet');
    expect(store.markEventProcessed).not.toHaveBeenCalled();
  });

  it('subscription.deleted with plugin metadata throws (not marks processed) when the license is not minted yet', async () => {
    const store = fakeStore({
      setLicenseStatusBySubscription: vi.fn(async () => ({ found: false })),
    });
    await expect(handleStripeEvent({
      id: 'evt_p5', type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'canceled',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store)).rejects.toThrow('license not minted yet');
    expect(store.markEventProcessed).not.toHaveBeenCalled();
  });

  it('a failing notifyLicensePurchase does not fail the webhook (event still processed, license still minted)', async () => {
    const store = fakeStore({
      notifyLicensePurchase: vi.fn(async () => { throw new Error('resend down'); }),
    });
    await expect(handleStripeEvent({
      id: 'evt_p6', type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_6', customer: 'cus_1', subscription: 'sub_plugin_6',
        customer_details: { email: 'buyer@x.com' }, amount_total: 4900,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store)).resolves.toBeUndefined();
    expect(store.mintLicense).toHaveBeenCalledWith({
      userId: 'user_1', productSlug: 'elementor-to-divi5-pro',
      stripeSubscriptionId: 'sub_plugin_6', currentPeriodEnd: null,
    });
    expect(store.grantPluginEntitlement).toHaveBeenCalledWith('user_1', 'elementor-to-divi5-pro');
    expect(store.markEventProcessed).toHaveBeenCalled();
  });

  it('membership subscription events still work exactly as before (no metadata)', async () => {
    const store = fakeStore();
    (store.findUserBySubscriptionId as any).mockResolvedValue('user_1');
    await handleStripeEvent({
      id: 'evt_m1', type: 'customer.subscription.updated',
      data: { object: { id: 'sub_m', customer: 'cus_1', status: 'active', current_period_end: 1780000000 } },
    } as never, store);
    expect(store.upsertSubscription).toHaveBeenCalled();
    expect(store.grantAllAccess).toHaveBeenCalled();
    expect(store.setLicenseStatusBySubscription).not.toHaveBeenCalled();
  });

  it('subscription.updated with plugin metadata reads current_period_end from items when absent at top level (2025+ API versions)', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_p7', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'active',
        items: { data: [{ current_period_end: 1780000000 }] },
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_plugin_1', status: 'active',
      currentPeriodEnd: new Date(1780000000 * 1000),
    });
  });

  it('membership subscription.updated reads current_period_end from items when absent at top level (2025+ API versions)', async () => {
    const store = fakeStore();
    (store.findUserBySubscriptionId as any).mockResolvedValue('user_1');
    await handleStripeEvent({
      id: 'evt_m2', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_m2', customer: 'cus_1', status: 'active',
        items: { data: [{ current_period_end: 1780000000 }] },
      } },
    } as never, store);
    expect((store.upsertSubscription as any).mock.calls[0][0]).toMatchObject({
      userId: 'user_1', stripeSubscriptionId: 'sub_m2', status: 'active',
      currentPeriodEnd: new Date(1780000000 * 1000),
    });
    expect(store.grantAllAccess).toHaveBeenCalledWith('user_1', new Date(1780000000 * 1000));
  });
});

describe('AI Editor tiered licences', () => {
  const completed = (metadata: Record<string, string>, extra: Record<string, unknown> = {}) => ({
    id: 'evt_t1', type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_t1', customer: 'cus_1', subscription: 'sub_t1', payment_status: 'paid',
      customer_details: { email: 'buyer@x.com' }, mode: 'subscription', metadata, ...extra,
    } },
  }) as never;

  it('mints the tier, founding and trial flags from the checkout metadata', async () => {
    const store = fakeStore();
    await handleStripeEvent(completed({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'freelancer', founding: '1', lifetime: '0', trial: '0' }), store);
    expect(store.mintLicense).toHaveBeenCalledWith({
      userId: 'user_1', productSlug: 'ai-editor-divi5-pro', stripeSubscriptionId: 'sub_t1', currentPeriodEnd: null,
      tier: 'freelancer', founding: true, lifetime: false, trial: false,
    });
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(expect.objectContaining({ tier: 'freelancer', lifetime: false }));
  });

  it('a trial checkout mints a trial licence', async () => {
    const store = fakeStore();
    await handleStripeEvent(completed({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'personal', founding: '0', lifetime: '0', trial: '1' }), store);
    expect(store.mintLicense).toHaveBeenCalledWith(expect.objectContaining({ tier: 'personal', trial: true, founding: false }));
  });

  it('a lifetime payment mints a lifetime licence keyed by the checkout session, never by a subscription', async () => {
    const store = fakeStore();
    await handleStripeEvent(completed({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'agency', founding: '0', lifetime: '1', trial: '0' }, { mode: 'payment', subscription: null }), store);
    expect(store.mintLicense).toHaveBeenCalledWith(expect.objectContaining({
      stripeSubscriptionId: 'cs_t1', currentPeriodEnd: null, tier: 'agency', lifetime: true,
    }));
  });

  it('a lifetime payment made with the founding coupon mints a licence that is both lifetime and founding', async () => {
    const store = fakeStore();
    await handleStripeEvent(completed({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'agency', founding: '1', lifetime: '1', trial: '0' }, { mode: 'payment', subscription: null }), store);
    expect(store.mintLicense).toHaveBeenCalledWith(expect.objectContaining({
      stripeSubscriptionId: 'cs_t1', tier: 'agency', lifetime: true, founding: true,
    }));
  });

  it('an unpaid lifetime payment mints nothing yet; async_payment_succeeded mints it', async () => {
    const store = fakeStore();
    const meta = { kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'agency', founding: '0', lifetime: '1', trial: '0' };
    await handleStripeEvent(completed(meta, { mode: 'payment', subscription: null, payment_status: 'unpaid' }), store);
    expect(store.mintLicense).not.toHaveBeenCalled();

    const later = { id: 'evt_t2', type: 'checkout.session.async_payment_succeeded', data: { object: {
      id: 'cs_t1', customer: 'cus_1', subscription: null, payment_status: 'paid', mode: 'payment',
      customer_details: { email: 'buyer@x.com' }, metadata: meta,
    } } } as never;
    await handleStripeEvent(later, store);
    expect(store.mintLicense).toHaveBeenCalledWith(expect.objectContaining({ lifetime: true }));
  });

  it('converter licences keep their exact old mint call (no tier keys)', async () => {
    const store = fakeStore();
    await handleStripeEvent(completed({ kind: 'plugin', product: 'wpbakery-to-divi5-pro' }), store);
    expect(store.mintLicense).toHaveBeenCalledWith({
      userId: 'user_1', productSlug: 'wpbakery-to-divi5-pro', stripeSubscriptionId: 'sub_t1', currentPeriodEnd: null,
    });
  });

  it('a subscription update re-derives the tier from the item Price, not from stale metadata', async () => {
    const store = fakeStore();
    const prev = process.env.STRIPE_PRICE_AI_EDITOR_AGENCY;
    const { env } = await import('@/lib/env');
    (env as Record<string, string | undefined>).STRIPE_PRICE_AI_EDITOR_AGENCY = 'price_agency_x';
    try {
      await handleStripeEvent({
        id: 'evt_u1', type: 'customer.subscription.updated',
        data: { object: {
          id: 'sub_t1', status: 'active', current_period_end: 1780000000,
          metadata: { kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'personal' },
          items: { data: [{ price: { id: 'price_agency_x' } }] },
        } },
      } as never, store);
    } finally {
      (env as Record<string, string | undefined>).STRIPE_PRICE_AI_EDITOR_AGENCY = prev;
    }
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_t1', status: 'active', currentPeriodEnd: new Date(1780000000 * 1000),
      tier: 'agency', trial: false,
    });
  });

  it('a trialing subscription marks the licence as a trial; an unknown Price leaves the tier alone', async () => {
    const store = fakeStore();
    await handleStripeEvent({
      id: 'evt_u2', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_t1', status: 'trialing', current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'ai-editor-divi5-pro' },
        items: { data: [{ price: { id: 'price_unknown' } }] },
      } },
    } as never, store);
    const arg = (store.setLicenseStatusBySubscription as any).mock.calls[0][0];
    expect(arg.trial).toBe(true);
    expect('tier' in arg).toBe(false);
  });
});

describe('the purchase facts reach the licence email (it doubles as the receipt)', () => {
  const checkout = (over: Record<string, unknown>, metadata: Record<string, string>) => ({
    id: 'evt_receipt', type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_r1', customer: 'cus_1', created: 1790000000, currency: 'usd',
      customer_details: { email: 'buyer@x.com' },
      metadata: { kind: 'plugin', product: 'ai-editor-divi5-pro', ...metadata },
      ...over,
    } },
  }) as never;

  it('a founding Lifetime purchase passes the exact amount, the discount and the payment intent', async () => {
    const store = fakeStore();
    await handleStripeEvent(checkout(
      { payment_intent: 'pi_9', payment_status: 'paid', amount_total: 31430, total_details: { amount_discount: 13470 } },
      { tier: 'agency', founding: '1', lifetime: '1', trial: '0' },
    ), store);
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(expect.objectContaining({
      lifetime: true,
      trial: false,
      order: { amountCents: 31430, discountCents: 13470, currency: 'usd', paidAt: new Date(1790000000 * 1000), reference: 'pi_9' },
    }));
  });

  it('an annual subscription purchase uses the invoice as the reference', async () => {
    const store = fakeStore();
    await handleStripeEvent(checkout(
      { subscription: 'sub_1', invoice: 'in_5', amount_total: 4900, total_details: { amount_discount: 0 } },
      { tier: 'personal', founding: '0', lifetime: '0', trial: '0' },
    ), store);
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(expect.objectContaining({
      trial: false, order: expect.objectContaining({ amountCents: 4900, discountCents: 0, reference: 'in_5' }),
    }));
  });

  it('a no-card trial is flagged as a trial and carries a zero amount', async () => {
    const store = fakeStore();
    await handleStripeEvent(checkout(
      { subscription: 'sub_t', amount_total: 0, total_details: { amount_discount: 0 } },
      { tier: 'personal', founding: '0', lifetime: '0', trial: '1' },
    ), store);
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(expect.objectContaining({
      trial: true, order: expect.objectContaining({ amountCents: 0 }),
    }));
  });

  it('a converter purchase also carries its order', async () => {
    const store = fakeStore();
    await handleStripeEvent(checkout(
      { subscription: 'sub_c', amount_total: 2500, total_details: { amount_discount: 0 } },
      { product: 'elementor-to-divi5-pro' },
    ), store);
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(expect.objectContaining({
      productSlug: 'elementor-to-divi5-pro', order: expect.objectContaining({ amountCents: 2500 }),
    }));
  });

  it('when Stripe reports no amount there is no order (no invented receipt) and the purchase still completes', async () => {
    const store = fakeStore();
    await handleStripeEvent(checkout({ subscription: 'sub_n' }, { tier: 'personal' }), store);
    const arg = (store.notifyLicensePurchase as any).mock.calls[0][0];
    expect(arg.order).toBeUndefined();
    expect(store.mintLicense).toHaveBeenCalled();
    expect(store.markEventProcessed).toHaveBeenCalled();
  });
});
