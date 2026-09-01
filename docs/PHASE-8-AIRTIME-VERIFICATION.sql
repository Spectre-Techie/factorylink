-- Phase 8 migration verification. Run after applying server/sql/004_airtime_rewards.sql.

SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'airtime_rewards'
) AS airtime_rewards_exists;

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'airtime_rewards'
ORDER BY ordinal_position;

SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.airtime_rewards'::regclass
ORDER BY conname;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'airtime_rewards'
ORDER BY indexname;

SELECT EXISTS (
  SELECT 1
  FROM pg_constraint
  WHERE conrelid = 'public.airtime_rewards'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%sales_report_id%'
) AS sales_report_id_unique;

SELECT
  COUNT(*) AS sales_reports_count
FROM sales_reports;

SELECT
  COUNT(*) AS airtime_rewards_count
FROM airtime_rewards;
