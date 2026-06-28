// Drizzle schema for LayoutLab.
//
// This is a Phase 0/1 stub showing the intended shape. Flesh out per CLAUDE.md §6
// (users, layouts, packs, pack_layouts, categories/tags, layout_tags, orders,
// order_items, subscriptions, entitlements, downloads, email_captures) +
// the Auth.js adapter tables. Build these test-first (TDD).

import { pgTable, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const layoutStatus = pgEnum('layout_status', [
  'pending',
  'approved',
  'published',
  'rejected',
]);

// Example anchor table — expand to the full model in §6.
export const layouts = pgTable('layouts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  niche: text('niche'),
  style: text('style'),
  colors: jsonb('colors').$type<string[]>().default([]),
  diviJsonBlobKey: text('divi_json_blob_key').notNull(),
  previewImageKeys: jsonb('preview_image_keys').$type<string[]>().default([]),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
});
