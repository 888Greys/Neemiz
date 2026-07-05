# Database restore runbook

Backups are produced by [`db-backup.sh`](./db-backup.sh) — custom-format
(`pg_dump -Fc`) dumps in `/opt/neemiz/backups` on **nez**, created by the
`neemiz-db-backup` systemd timer. This is independent of Supabase's own managed
backups (use whichever is faster to recover from).

> **A backup you've never restored is not a backup.** Test-restore monthly.

## 1. Test a backup is restorable (do this regularly — safe, throwaway)

Restores the dump into a disposable local Postgres container and checks it. Never
touches prod.

```bash
DUMP=/opt/neemiz/backups/neemiz-XXXXXXXX.dump        # pick a recent one

docker run -d --name pg-restore-test -e POSTGRES_PASSWORD=test postgres:17-alpine
sleep 5
docker cp "$DUMP" pg-restore-test:/tmp/d.dump
# --no-owner: ignore prod roles. Errors about missing roles/extensions are normal.
docker exec pg-restore-test pg_restore -U postgres -d postgres --no-owner /tmp/d.dump

# sanity: table + key row counts should look like prod
docker exec pg-restore-test psql -U postgres -d postgres -c \
  "select count(*) tables from information_schema.tables where table_schema='public';"
docker exec pg-restore-test psql -U postgres -d postgres -c \
  'select count(*) users from "User";'

docker rm -f pg-restore-test                          # tear down
```

If the row counts are sane, that backup is good.

## 2. Real recovery (production incident — proceed carefully)

**Never `pg_restore` over the live database.** Restore into a *new* empty
database/project, verify it, then cut the app over by swapping `DATABASE_URL`.

```bash
# Into a fresh Supabase project (or any empty PG17), using the SESSION connection
# (port 5432, NOT the 6543 transaction pooler):
pg_restore --no-owner --no-privileges \
  -d 'postgresql://USER:PASS@NEW-HOST:5432/postgres?sslmode=require' \
  /opt/neemiz/backups/neemiz-XXXXXXXX.dump
```

Then:
1. Verify row counts + spot-check recent transactions/balances.
2. Update `DATABASE_URL` (and `DIRECT_URL` if set) in `/opt/neemiz/*.env` to the
   new database; recreate the app container.
3. Re-point the wallet watcher / settlement crons if their env differs.

## Restore the schema only (fast structural check)

```bash
docker run --rm -v /opt/neemiz/backups:/b postgres:17-alpine \
  pg_restore --schema-only --no-owner -f - /b/neemiz-XXXXXXXX.dump | less
```
