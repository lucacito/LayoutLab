CREATE TYPE "public"."license_status" AS ENUM('active', 'past_due', 'expired', 'canceled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_activations" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text NOT NULL,
	"site_url" text NOT NULL,
	"plugin_version" text,
	"wp_version" text,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"deactivated_at" timestamp,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"license_key" text NOT NULL,
	"status" "license_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"version" text NOT NULL,
	"blob_key" text NOT NULL,
	"changelog" text,
	"released_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "license_activations_license_site_uq" ON "license_activations" USING btree ("license_id","site_url");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "licenses_stripe_sub_uq" ON "licenses" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_user_idx" ON "licenses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plugin_releases_product_version_uq" ON "plugin_releases" USING btree ("product_slug","version");