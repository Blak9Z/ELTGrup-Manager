#!/usr/bin/env bash

set -Eeuo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore
require_cmd npx

: "${OLD_DATABASE_URL:?OLD_DATABASE_URL is required}"
: "${NEW_DATABASE_URL:?NEW_DATABASE_URL is required}"

if [[ "$OLD_DATABASE_URL" == "$NEW_DATABASE_URL" ]]; then
  echo "OLD_DATABASE_URL and NEW_DATABASE_URL are identical. Aborting." >&2
  exit 1
fi

BACKUP_ROOT="${BACKUP_ROOT:-artifacts/db-migration}"
RESET_TARGET_PUBLIC_SCHEMA="${RESET_TARGET_PUBLIC_SCHEMA:-1}"
RUN_ID="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${BACKUP_ROOT}/${RUN_ID}"
mkdir -p "$RUN_DIR"

SOURCE_DUMP="${RUN_DIR}/source_public.dump"
TARGET_PRE_DUMP="${RUN_DIR}/target_before_restore_public.dump"
SOURCE_COUNTS="${RUN_DIR}/source_counts.csv"
TARGET_COUNTS="${RUN_DIR}/target_counts.csv"
TARGET_COUNTS_POST_MIGRATE="${RUN_DIR}/target_counts_post_migrate.csv"
VERIFY_REPORT="${RUN_DIR}/verify_report.json"

count_table() {
  local url="$1"
  local table_name="$2"
  local exists
  exists="$(psql "$url" -v ON_ERROR_STOP=1 -X -A -t -c "SELECT to_regclass('public.\"${table_name}\"') IS NOT NULL;")"
  exists="$(echo "$exists" | tr -d '[:space:]')"
  if [[ "$exists" == "t" ]]; then
    psql "$url" -v ON_ERROR_STOP=1 -X -A -t -c "SELECT count(*)::bigint FROM public.\"${table_name}\";"
  else
    echo "-1"
  fi
}

write_counts_csv() {
  local url="$1"
  local output="$2"
  local tables=(User Role UserRole Account Session Project WorkOrder Material Document DailySiteReport Notification InventoryItem)
  {
    echo "table_name,row_count"
    for table in "${tables[@]}"; do
      echo "${table},$(count_table "$url" "$table")"
    done
  } >"$output"
}

echo "Checking source connectivity..."
psql "$OLD_DATABASE_URL" -v ON_ERROR_STOP=1 -X -c "SELECT current_database(), now();"

echo "Checking target connectivity..."
psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -X -c "SELECT current_database(), now();"

echo "Collecting source table counts..."
write_counts_csv "$OLD_DATABASE_URL" "$SOURCE_COUNTS"

echo "Backing up target (public schema) before restore..."
pg_dump "$NEW_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$TARGET_PRE_DUMP"

echo "Exporting source (public schema)..."
pg_dump "$OLD_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$SOURCE_DUMP"

if [[ "$RESET_TARGET_PUBLIC_SCHEMA" == "1" ]]; then
  echo "Resetting target public schema (DROP/CREATE) before restore..."
  psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -X <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL
fi

echo "Restoring into target..."
pg_restore \
  --dbname="$NEW_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  "$SOURCE_DUMP"

echo "Collecting target table counts..."
write_counts_csv "$NEW_DATABASE_URL" "$TARGET_COUNTS"

echo "Running Prisma generate..."
DATABASE_URL="$NEW_DATABASE_URL" DIRECT_URL="${NEW_DIRECT_URL:-$NEW_DATABASE_URL}" npx prisma generate

echo "Running Prisma migrate deploy..."
DATABASE_URL="$NEW_DATABASE_URL" DIRECT_URL="${NEW_DIRECT_URL:-$NEW_DATABASE_URL}" npx prisma migrate deploy

echo "Collecting target table counts after migrations..."
write_counts_csv "$NEW_DATABASE_URL" "$TARGET_COUNTS_POST_MIGRATE"

echo "Running database module verification script..."
DATABASE_URL="$NEW_DATABASE_URL" DIRECT_URL="${NEW_DIRECT_URL:-$NEW_DATABASE_URL}" npx tsx scripts/verify-db-modules.ts >"$VERIFY_REPORT"

echo "Migration completed."
echo "Artifacts:"
echo "  Source dump: $SOURCE_DUMP"
echo "  Target pre-restore backup: $TARGET_PRE_DUMP"
echo "  Source counts: $SOURCE_COUNTS"
echo "  Target counts: $TARGET_COUNTS"
echo "  Target counts after migrations: $TARGET_COUNTS_POST_MIGRATE"
echo "  Verify report: $VERIFY_REPORT"
