ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_uq" ON "users" USING btree ("stripe_customer_id");