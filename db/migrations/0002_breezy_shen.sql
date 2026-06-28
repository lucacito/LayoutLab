CREATE TABLE IF NOT EXISTS "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_user_scope_uq" ON "entitlements" USING btree ("user_id","scope");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_checkout_uq" ON "orders" USING btree ("stripe_checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_sub_uq" ON "subscriptions" USING btree ("stripe_subscription_id");