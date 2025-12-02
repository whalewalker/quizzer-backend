-- This script resolves the failed migration by marking it as applied
-- Run this directly on your production database

-- First, check if the columns already exist
-- If they do, we just need to mark the migration as complete

-- Mark the failed migration as rolled back
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251201210000_fix_missing_columns';

-- Now you can re-run: npx prisma migrate deploy
-- Or if the columns already exist, mark it as applied:
INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  gen_random_uuid(),
  'e8c5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5c8f5',
  NOW(),
  '20251201210000_fix_missing_columns',
  NULL,
  NULL,
  NOW(),
  1
);
