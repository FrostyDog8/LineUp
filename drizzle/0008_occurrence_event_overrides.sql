ALTER TABLE "occurrences" ADD COLUMN IF NOT EXISTS "registration_opens_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "occurrence_rank_merge_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"rank_id" uuid NOT NULL,
	"merge_mode" text NOT NULL,
	"merge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "occurrence_rank_merge_overrides" ADD CONSTRAINT "occurrence_rank_merge_overrides_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence_rank_merge_overrides" ADD CONSTRAINT "occurrence_rank_merge_overrides_rank_id_ranks_id_fk" FOREIGN KEY ("rank_id") REFERENCES "public"."ranks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "occurrence_rank_merge_overrides_occurrence_rank_uid" ON "occurrence_rank_merge_overrides" USING btree ("occurrence_id","rank_id");
