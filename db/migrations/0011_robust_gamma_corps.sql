CREATE TABLE "plugin_coverage_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"product" text NOT NULL,
	"widget_types" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plugin_coverage_product_idx" ON "plugin_coverage_reports" USING btree ("product");--> statement-breakpoint
CREATE INDEX "plugin_coverage_received_idx" ON "plugin_coverage_reports" USING btree ("received_at");