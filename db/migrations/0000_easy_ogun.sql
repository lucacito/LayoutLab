CREATE TYPE "public"."layout_status" AS ENUM('pending', 'approved', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"niche" text,
	"style" text,
	"colors" jsonb DEFAULT '[]'::jsonb,
	"divi_json_blob_key" text NOT NULL,
	"preview_image_keys" jsonb DEFAULT '[]'::jsonb,
	"content_hash" text NOT NULL,
	"perceptual_hash" text,
	"validator_passed" boolean DEFAULT false NOT NULL,
	"seo" jsonb,
	"status" "layout_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "layouts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "layouts_content_hash_unique" UNIQUE("content_hash")
);
