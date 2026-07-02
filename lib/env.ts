import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  // GA4 Measurement ID (public). Override per-environment; falls back to the prod tag.
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  // Optional in Phase 0 — required by their owning features later.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MEMBERSHIP_MONTHLY: z.string().optional(),
  STRIPE_PRICE_MEMBERSHIP_YEARLY: z.string().optional(),
  // Set to '1'/'true' to require an express withdrawal-waiver checkbox at
  // Checkout (needed to lawfully deny refunds to EU/UK consumers). Requires a
  // Terms of Service URL configured in the Stripe Dashboard → pointing at /license.
  STRIPE_TERMS_CONSENT: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  LOOPS_API_KEY: z.string().optional(),
  INGEST_API_TOKEN: z.string().optional(),
  // Set to '1'/'true' to auto-publish layouts on ingest (skip the admin queue).
  // Default (unset) keeps the human approval gate: ingests land as `pending`.
  INGEST_AUTO_APPROVE: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return schema.parse(raw);
}

export const env: Env = parseEnv(process.env as Record<string, string | undefined>);
