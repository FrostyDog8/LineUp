-- Optional hardening: enable RLS so PostgREST anon/authenticated cannot
-- read/write rows via the publishable key. The Next.js app uses DATABASE_URL
-- (Postgres role) for Drizzle — not the anon key — so empty RLS policies are OK
-- until explicit policies are designed.
--
-- Apply when ready (Supabase SQL editor or drizzle migrate):
--   npm run db:migrate
-- Or run statements below manually.

ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."verification_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."registration_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ranks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."manager_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."occurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."policy_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."registration_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."registration_entries" ENABLE ROW LEVEL SECURITY;
