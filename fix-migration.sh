#!/bin/bash

# Script to resolve failed Prisma migration in production
# This uses Prisma's built-in migration resolution

echo "Resolving failed migration..."

# Option 1: Mark the migration as rolled back and re-apply
npx prisma migrate resolve --rolled-back "20251201210000_fix_missing_columns"

echo "Migration marked as rolled back. Now deploying migrations..."

# Deploy migrations (this will re-apply the migration)
npx prisma migrate deploy

echo "Done! Migration should now be applied."
