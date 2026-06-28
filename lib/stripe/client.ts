import Stripe from 'stripe';
import { env } from '@/lib/env';

// Server-only. STRIPE_SECRET_KEY is required at runtime by the commerce routes;
// the SDK is constructed with the test/live key from the environment.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');
