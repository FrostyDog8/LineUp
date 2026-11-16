CREATE TABLE IF NOT EXISTS "occurrence_rank_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"rank_id" uuid NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "occurrence_rank_merges" ADD CONSTRAINT "occurrence_rank_merges_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence_rank_merges" ADD CONSTRAINT "occurrence_rank_merges_rank_id_ranks_id_fk" FOREIGN KEY ("rank_id") REFERENCES "public"."ranks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "occurrence_rank_merges_occurrence_rank_uid" ON "occurrence_rank_merges" USING btree ("occurrence_id","rank_id");--> statement-breakpoint
-- Default ranks: main-eligible from registration open (was "manual" wait-until-button).
UPDATE "ranks" SET "merge_mode" = 'from_open' WHERE "is_default" = true AND "merge_mode" = 'manual';
