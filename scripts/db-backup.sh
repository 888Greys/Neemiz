#!/usr/bin/env bash
# Off-site logical backup of the Neemiz Postgres (Supabase) database.
#
# Belt-and-suspenders on top of Supabase's managed backups: an independent,
# timestamped, integrity-checked dump we control. READ-ONLY against prod.
#
# Notes:
#  - pg_dump runs inside a version-matched postgres container, because the
#    server (Supabase, PG17) is usually newer than the host's pg_dump and a
#    lagging pg_dump refuses to run.
#  - Supabase's pooler exposes :6543 for TRANSACTION mode (pg_dump can't use it)
#    and :5432 for SESSION mode (pg_dump works). The app uses :6543 at runtime,
#    so we rewrite the port for the dump.
#
# Usage:   ./db-backup.sh
# Env:     BACKUP_DIR (default /opt/neemiz/backups), KEEP (default 14),
#          ENV_FILE (default /opt/neemiz/settle.env), PG_IMAGE (postgres:17-alpine),
#          DUMP_URL (override the derived session connection string entirely).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/neemiz/backups}"
KEEP="${KEEP:-14}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
ENV_FILE="${ENV_FILE:-/opt/neemiz/settle.env}"

if [ -z "${DUMP_URL:-}" ]; then
  set -a; . "$ENV_FILE"; set +a
  base="${DATABASE_URL%%\?*}"          # drop ?pgbouncer=true&... params
  base="${base/:6543/:5432}"           # transaction pooler -> session pooler
  DUMP_URL="${base}?sslmode=require"
fi

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
name="neemiz-${ts}.dump"

echo "[db-backup] $(date -u +%FT%TZ) dumping -> $BACKUP_DIR/$name"
# Custom format (-Fc): compressed + restorable selectively with pg_restore.
docker run --rm -e DUMP_URL="$DUMP_URL" -v "$BACKUP_DIR:/backups" "$PG_IMAGE" \
  sh -c "pg_dump \"\$DUMP_URL\" -Fc --no-owner --no-privileges -f \"/backups/$name\""

# Integrity: a corrupt archive fails to list. Catch it now, not during a crisis.
docker run --rm -v "$BACKUP_DIR:/backups" "$PG_IMAGE" \
  pg_restore --list "/backups/$name" > /dev/null
echo "[db-backup] verified archive: $name ($(du -h "$BACKUP_DIR/$name" | cut -f1))"

# Rotation: keep the newest $KEEP dumps.
ls -1t "$BACKUP_DIR"/neemiz-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[db-backup] retained newest $KEEP dump(s) in $BACKUP_DIR"
