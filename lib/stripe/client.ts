import Stripe from 'stripe';
import { env } from '@/lib/env';

// Server-only. STRIPE_SECRET_KEY is required at runtime by the commerce routes,
// but NOT at build time — so the SDK is constructed lazily on first use. Building
// `new Stripe('')` at module load (no key) throws and breaks `next build` when the
// API routes are collected. The lazy proxy below defers construction to request time.
let instance: Stripe | null = null;

function client(): Stripe {
  if (!instance) {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    instance = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return instance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(c) : value;
  },
});
