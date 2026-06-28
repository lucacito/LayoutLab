CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pack_kind" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TYPE "public"."pack_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."tag_axis" AS ENUM('type', 'niche', 'style', 'feature');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"layout_id" text NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"pack_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"loops_synced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"source" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layout_tags" (
	"layout_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "layout_tags_layout_id_tag_id_pk" PRIMARY KEY("layout_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_checkout_id" text,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pack_layouts" (
	"pack_id" text NOT NULL,
	"layout_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pack_layouts_pack_id_layout_id_pk" PRIMARY KEY("pack_id","layout_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "pack_kind" NOT NULL,
	"price_cents" integer,
	"stripe_price_id" text,
	"cover_image_key" text,
	"seo" jsonb,
	"status" "pack_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"axis" "tag_axis" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"seo" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" timestamp,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "layouts" ALTER COLUMN "colors" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "layouts" ALTER COLUMN "colors" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "layouts" ALTER COLUMN "colors" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "layouts" ALTER COLUMN "preview_image_keys" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downloads" ADD CONSTRAINT "downloads_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_captures" ADD CONSTRAINT "email_captures_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layout_tags" ADD CONSTRAINT "layout_tags_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layout_tags" ADD CONSTRAINT "layout_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pack_layouts" ADD CONSTRAINT "pack_layouts_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pack_layouts" ADD CONSTRAINT "pack_layouts_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_axis_slug_uq" ON "tags" USING btree ("axis","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layouts_status_idx" ON "layouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layouts_type_idx" ON "layouts" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layouts_niche_idx" ON "layouts" USING btree ("niche");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layouts_style_idx" ON "layouts" USING btree ("style");