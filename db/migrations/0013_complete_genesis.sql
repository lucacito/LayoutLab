CREATE TABLE "license_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text NOT NULL,
	"days" integer NOT NULL,
	"period_end" timestamp NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "tier" text;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "founding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "lifetime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "license_reminders" ADD CONSTRAINT "license_reminders_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "license_reminders_license_days_period_uq" ON "license_reminders" USING btree ("license_id","days","period_end");