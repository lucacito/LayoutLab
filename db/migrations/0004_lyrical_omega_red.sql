CREATE TABLE IF NOT EXISTS "taxonomy_pages" (
	"axis" text NOT NULL,
	"value" text NOT NULL,
	"intro" text NOT NULL,
	"meta_title" text NOT NULL,
	"meta_description" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_pages_axis_value_pk" PRIMARY KEY("axis","value")
);
