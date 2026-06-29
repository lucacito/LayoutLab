// Drizzle schema for LayoutLab — full §6 data model.
import {
  pgTable, text, timestamp, integer, boolean, jsonb, pgEnum, primaryKey, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// ---- Enums ---------------------------------------------------------------
export const layoutStatus = pgEnum('layout_status', ['pending', 'approved', 'published', 'rejected']);
export const packKind = pgEnum('pack_kind', ['free', 'paid']);
export const packStatus = pgEnum('pack_status', ['draft', 'published']);
export const userRole = pgEnum('user_role', ['user', 'admin']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'past_due', 'canceled']);
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'refunded']);
export const tagAxis = pgEnum('tag_axis', ['type', 'niche', 'style', 'feature']);

// ---- Accounts (Auth.js adapter shape) -----------------------------------
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id'),
}, (t) => ({
  stripeCustomerUq: uniqueIndex('users_stripe_customer_uq').on(t.stripeCustomerId),
}));

export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }));

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }));

// ---- Catalog -------------------------------------------------------------
export const layouts = pgTable('layouts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  niche: text('niche'),
  style: text('style'),
  colors: text('colors').array().notNull().default([]),
  diviJsonBlobKey: text('divi_json_blob_key').notNull(),
  previewImageKeys: jsonb('preview_image_keys').$type<string[]>().notNull().default([]),
  contentHash: text('content_hash').notNull().unique(),
  perceptualHash: text('perceptual_hash'),
  validatorPassed: boolean('validator_passed').notNull().default(false),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    ogImageKey?: string;
    keywords?: string[];
  }>(),
  status: layoutStatus('status').notNull().default('pending'),
  // Structured variant attributes for cross-linking sibling variations (same group,
  // different column count / icon placement).
  variant: jsonb('variant').$type<{ group?: string; columns?: number; icons?: 'none' | 'top' | 'left' }>(),
  // Denormalized rating aggregate for fast catalog display (avg = sum / count).
  ratingCount: integer('rating_count').notNull().default(0),
  ratingSum: integer('rating_sum').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
}, (t) => ({
  statusIdx: index('layouts_status_idx').on(t.status),
  typeIdx: index('layouts_type_idx').on(t.type),
  nicheIdx: index('layouts_niche_idx').on(t.niche),
  styleIdx: index('layouts_style_idx').on(t.style),
}));

export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  kind: packKind('kind').notNull(),
  priceCents: integer('price_cents'),
  stripePriceId: text('stripe_price_id'),
  coverImageKey: text('cover_image_key'),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    ogImageKey?: string;
    keywords?: string[];
  }>(),
  status: packStatus('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const packLayouts = pgTable('pack_layouts', {
  packId: text('pack_id').notNull().references(() => packs.id, { onDelete: 'cascade' }),
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.packId, t.layoutId] }) }));

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  axis: tagAxis('axis').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    intro?: string;
  }>(),
}, (t) => ({ axisSlugUq: uniqueIndex('tags_axis_slug_uq').on(t.axis, t.slug) }));

export const layoutTags = pgTable('layout_tags', {
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({ pk: primaryKey({ columns: [t.layoutId, t.tagId] }) }));

// ---- Commerce (defined now, exercised in Phase 4) ------------------------
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCheckoutId: text('stripe_checkout_id'),
  amountCents: integer('amount_cents').notNull().default(0),
  status: orderStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  stripeCheckoutUq: uniqueIndex('orders_stripe_checkout_uq').on(t.stripeCheckoutId),
}));

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  packId: text('pack_id').notNull().references(() => packs.id),
  priceCents: integer('price_cents').notNull().default(0),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: subscriptionStatus('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
}, (t) => ({
  stripeSubUq: uniqueIndex('subscriptions_stripe_sub_uq').on(t.stripeSubscriptionId),
}));

export const entitlements = pgTable('entitlements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(), // 'pack:<id>' | 'all_access'
  source: text('source').notNull(), // 'order' | 'subscription' | 'free'
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (t) => ({
  userScopeUq: uniqueIndex('entitlements_user_scope_uq').on(t.userId, t.scope),
}));

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(), // Stripe event id
  type: text('type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const downloads = pgTable('downloads', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  ip: text('ip'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const emailCaptures = pgTable('email_captures', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  packId: text('pack_id').references(() => packs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  loopsSynced: boolean('loops_synced').notNull().default(false),
});

// ---- Element ratings ------------------------------------------------------
// One rating per (layout, rater). raterId is an anonymous client id (no account
// needed) or the user id when signed in.
export const ratings = pgTable('ratings', {
  id: text('id').primaryKey(),
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  raterId: text('rater_id').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  stars: integer('stars').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  layoutRaterUniq: uniqueIndex('ratings_layout_rater_uniq').on(t.layoutId, t.raterId),
  layoutIdx: index('ratings_layout_idx').on(t.layoutId),
}));

// ---- Taxonomy landing pages (Phase 6a) -----------------------------------
export const taxonomyPages = pgTable('taxonomy_pages', {
  axis: text('axis').notNull(),
  value: text('value').notNull(),
  intro: text('intro').notNull(),
  metaTitle: text('meta_title').notNull(),
  metaDescription: text('meta_description').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.axis, t.value] }) }));
