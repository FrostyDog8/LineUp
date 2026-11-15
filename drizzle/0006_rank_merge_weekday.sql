ALTER TABLE "ranks" ADD COLUMN IF NOT EXISTS "merge_weekday" integer;--> statement-breakpoint
ALTER TABLE "ranks" ADD COLUMN IF NOT EXISTS "merge_time" text;
