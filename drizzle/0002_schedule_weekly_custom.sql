-- Migrate schedule_mode: one_time/recurring_simple -> weekly/custom
CREATE TYPE "public"."schedule_mode_new" AS ENUM('weekly', 'custom');--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "schedule_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "schedule_mode" TYPE "public"."schedule_mode_new" USING (
  CASE "schedule_mode"::text
    WHEN 'recurring_simple' THEN 'custom'::"public"."schedule_mode_new"
    WHEN 'one_time' THEN 'custom'::"public"."schedule_mode_new"
    WHEN 'weekly' THEN 'weekly'::"public"."schedule_mode_new"
    WHEN 'custom' THEN 'custom'::"public"."schedule_mode_new"
    ELSE 'custom'::"public"."schedule_mode_new"
  END
);--> statement-breakpoint
DROP TYPE "public"."schedule_mode";--> statement-breakpoint
ALTER TYPE "public"."schedule_mode_new" RENAME TO "schedule_mode";--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "schedule_mode" SET DEFAULT 'custom'::"public"."schedule_mode";--> statement-breakpoint

ALTER TABLE "activities" ADD COLUMN "weekly_weekday" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "weekly_time" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "default_place" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "schedule_defaults_json" text DEFAULT '{}' NOT NULL;--> statement-breakpoint

ALTER TABLE "occurrences" ADD COLUMN "place" text;
