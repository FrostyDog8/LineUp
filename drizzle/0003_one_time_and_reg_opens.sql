-- Restore one_time schedule mode alongside weekly/custom.
ALTER TYPE "public"."schedule_mode" ADD VALUE IF NOT EXISTS 'one_time';
