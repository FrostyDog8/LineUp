ALTER TABLE "ranks" ADD COLUMN IF NOT EXISTS "merge_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "ranks" ADD COLUMN IF NOT EXISTS "merge_at" timestamp with time zone;
