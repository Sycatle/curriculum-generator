# Backups

The Postgres volume `pgdata` is the source of truth. Back it up with `pg_dump`
to a remote object store. The VPS is treated as cattle: anything not in git or
in backups is forfeit.

## One-shot dump

```bash
docker exec cv-generator-postgres \
  pg_dump --no-owner --clean --if-exists -U cv -d cv \
  | gzip > backup-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

## Daily cron (recommended)

Install [restic](https://restic.net/) on the VPS, then create
`/etc/cron.daily/cv-generator-backup` (mode `0750`):

```bash
#!/bin/sh
set -eu

export RESTIC_REPOSITORY=s3:s3.example.com/cv-generator-backups
export RESTIC_PASSWORD_FILE=/root/.restic/password
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

docker exec cv-generator-postgres pg_dump --no-owner --clean --if-exists -U cv -d cv \
  | restic backup --stdin --stdin-filename "cv-$(date -u +%F).sql"

restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

## Restore

```bash
restic dump latest cv-2026-05-11.sql > restore.sql
cat restore.sql | docker exec -i cv-generator-postgres psql -U cv -d cv
```

## Verifying

Once a quarter, restore the latest snapshot into a scratch Postgres container
and run a few read queries to make sure the dump is usable. A backup you have
never restored is not a backup.
