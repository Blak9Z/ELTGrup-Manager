# Postgres Database Migration Runbook

This runbook migrates ELTGRUP Manager data from the current Postgres database to a new Postgres target (for example self-hosted / friend server) using environment variables only.

## Goals

- Preserve all existing application data from `public` schema.
- Keep Prisma migration history compatible (`_prisma_migrations` is included in `public` dump).
- Avoid accidental data overwrite from seed after migration.
- Keep rollback artifacts for recovery.

## Required Environment Variables

- `OLD_DATABASE_URL` = current source database connection.
- `NEW_DATABASE_URL` = target Postgres database connection.
- `NEW_DIRECT_URL` (optional) = direct connection for Prisma migrate deploy (defaults to `NEW_DATABASE_URL`).

Do not hardcode credentials in source files.

## Safe Migration Flow

1. Confirm both source and target are reachable.
2. Export `public` schema + data from source (`pg_dump` custom format).
3. Backup target `public` schema before restore.
4. Restore source dump into target with `--clean --if-exists`.
5. Run `prisma generate`.
6. Run `prisma migrate deploy`.
7. Run DB integrity checks for auth + domain modules.
8. Compare source/target row counts for key tables.
9. Switch app env to new `DATABASE_URL`/`DIRECT_URL`.

## Execute

```bash
OLD_DATABASE_URL="..." \
NEW_DATABASE_URL="..." \
NEW_DIRECT_URL="..." \
bash scripts/migrate-postgres.sh
```

Artifacts are stored in `artifacts/db-migration/<timestamp>/`:

- `source_public.dump`
- `target_before_restore_public.dump`
- `source_counts.csv`
- `target_counts.csv`
- `target_counts_post_migrate.csv`
- `verify_report.json`

## Rollback

If the target migration is invalid, restore the target pre-migration backup:

```bash
pg_restore \
  --dbname="$NEW_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  artifacts/db-migration/<timestamp>/target_before_restore_public.dump
```

## Seed Safety

- Default seed mode is `safe`.
- In `safe` mode, only RBAC metadata is refreshed.
- In `bootstrap` mode, exactly one initial `SUPER_ADMIN` can be created, but only when the target database has no users yet.
- In `demo` mode:
  - `SEED_DEMO_CONFIRM` must be exactly `RUN_DEMO_SEED`;
  - `SEED_PASSWORD` must be set explicitly;
  - the database must be empty of operational data;
  - do not use it on migrated or live databases.

Examples:

```bash
npm run db:seed
```

```bash
SEED_MODE=bootstrap \
SEED_BOOTSTRAP_EMAIL="admin@eltgrup.local" \
SEED_BOOTSTRAP_FIRST_NAME="Admin" \
SEED_BOOTSTRAP_LAST_NAME="Platforma" \
SEED_BOOTSTRAP_PASSWORD="schimba-cu-o-parola-lunga" \
npm run db:seed
```

```bash
SEED_MODE=demo \
SEED_DEMO_CONFIRM=RUN_DEMO_SEED \
SEED_PASSWORD="schimba-cu-o-parola-lunga" \
npm run db:seed
```
