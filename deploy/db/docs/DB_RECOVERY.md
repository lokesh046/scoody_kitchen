# Hearth & One database: backups, recovery and monitoring

Read this when something is wrong with the database, or when you are setting it up on a new server.
What was actually tested on the beta database while writing this: the side-copy recovery (section 1, with real deleted rows), the in-place restore command (section 2, into a temporary folder), the dump restore (section 4), the weekly restore drill, the point-in-time drill, a database restart, and the alert emails. Also tested: the first full backup to the Backblaze bucket (about 11 minutes) and a full restore drill from the bucket alone (`--repo 2`: 38 tables, 3624 rows, integrity clean, 364 s). **Not yet tested**: section 3 end to end on a new server (the bucket restore itself is proven by the drill).

- Code and config for all of this: `deploy/db/` in the repo.
- On the server, one folder per environment: `/opt/hearth-db-beta` (and later `/opt/hearth-db-prod`).
- Replace `beta` with `prod` everywhere when working on production.

## What you have

| Piece | What it does | Where |
|---|---|---|
| **Postgres 18** (`hearth_pg_beta`) | The database. Two databases: `hearth` (the app) and `hearth_colleges` (the colleges list). | Docker container, data in `/var/lib/hearth-db-beta/pgdata` |
| **Continuous archiving** | Every change is shipped to the backup repository within about a minute (`archive_timeout = 60s`). | automatic |
| **pgBackRest backups** | Full backup every Sunday 02:30, differential Mon-Sat 02:30. Keeps 3 fulls, so any minute of the last 14+ days can be restored. | `/var/lib/hearth-db-beta/pgbackrest` |
| **Nightly dump** | A plain `pg_dump` file of each database at 03:15, kept 14 days. A second, independent layer. | `/var/lib/hearth-db-beta/dumps` |
| **Restore drill** | Every Sunday 05:00 the newest backup is rebuilt in a throwaway container, compared with the live database and integrity-checked. | log: `/var/log/hearth-db/beta-restore-drill.log` |
| **Point-in-time drill** | Every Wednesday 05:30: writes a row, notes the time, writes another, restores to the moment between and checks. | `/var/log/hearth-db/beta-pitr-drill.log` |
| **Monitoring** | Prometheus + Grafana dashboard + 18 alert rules, emailed through the app's own mail account. | see "Looking at it" |
| **Daily email** | 08:00 plain-English health report. If it stops arriving, the monitoring is down. | `lokeshlearn1@gmail.com`, `yesh.8989@gmail.com` |

How good is the protection?

- **Data loss window (RPO):** about 1 minute, because changes are archived at least every 60 seconds when anything changed.
- **Recovery time (RTO):** the restore drill takes 6 s from the local copy and about 6 minutes from the bucket (a database is thousands of small files, each downloaded separately). It grows with data size; the drill records the real number every week (Grafana, "Restore test duration").
- **Not protected without the off-server copy:** losing the whole server. See "Off-server copy" below. Until it is set up, the daily email says so every day.

## Looking at it

Nothing is open to the internet. Everything listens on the server's `127.0.0.1`. From your Mac:

```bash
# Grafana (dashboard) at http://localhost:3001 , login admin / <GRAFANA_PASSWORD>
ssh -N -L 3001:127.0.0.1:3001 root@187.53.133.231
# Database tools such as DBeaver: host localhost, port 55432, database hearth, user hearth_ro
ssh -N -L 55432:127.0.0.1:55432 root@187.53.133.231
```

Passwords are in `/opt/hearth-db-beta/.env` on the server (root only): `GRAFANA_PASSWORD`, `RO_PW` (read-only user for looking around). Never paste them into chat or commit them.

Which database user is for what:

| User | Use | Can |
|---|---|---|
| `postgres` | You, on the server (`docker exec -u postgres hearth_pg_beta psql ...`) and pgBackRest | everything |
| `hearth_owner` | Migrations and schema scripts | change tables. The app never uses it. |
| `hearth_app` | The backend | read and write rows. Cannot create, alter, drop or truncate tables, cannot reach other databases. |
| `hearth_ro` | DBeaver, ad-hoc looking | read only |
| `hearth_monitor` | The metrics exporter | metrics only |

Running a migration or schema script now needs the owner, not the app role: connect as `hearth_owner` (password `OWNER_PW` in the same `.env`).

## Alerts and what to do

Each alert email explains itself. The short version:

| Alert | Meaning | First step |
|---|---|---|
| DatabaseDown | Postgres is not answering | `docker ps`, `docker logs --tail 50 hearth_pg_beta`. If it will not start, see "Whole database broken". |
| WalArchivingFailing | Continuous backup is failing; you can only restore to the last backup, and the disk slowly fills | `docker exec -u postgres hearth_pg_beta pgbackrest --stanza=hearth check` and read the error |
| BackupTooOld / FullBackupTooOld | A nightly or weekly backup did not finish | Read `/var/log/hearth-db/beta-backup-*.log`; run it by hand: `/opt/hearth-db-beta/scripts/job.sh backup-diff /opt/hearth-db-beta/scripts/backup.sh diff` |
| RestoreDrillFailed / Stale | A backup could not be restored. **Treat as urgent.** | Read the newest `beta-restore-drill.log` |
| OffsiteCopyMissing | Backups exist only on this server | Set up the bucket (below) |
| DiskAlmostFull / DiskFillingFast | The disk is filling | `du -xh / 2>/dev/null \| sort -h \| tail`; old website backups are in `/var/www/dist-*-backup-*` and can be deleted |
| TooManyConnections / LongRunningTransaction | A stuck request or leak | `docker exec -u postgres hearth_pg_beta psql -d hearth -c "select pid,usename,state,now()-xact_start as age,left(query,80) from pg_stat_activity where datname='hearth' order by xact_start"` |

Scheduled jobs also email you directly when they fail, even if the monitoring stack itself is down.

## Recovery

First rule: **do not panic and do not restore over the live database as your first move.** Almost every problem is cheaper to fix by restoring a *side copy* and taking from it only what you need.

### 1. Someone deleted or changed the wrong data (most common)

You need the time. Take it from the user, the logs, or a guess a few minutes *before* the mistake. Times are UTC.

```bash
cd /opt/hearth-db-beta
./scripts/restore-scratch.sh --time "2026-10-29 15:06:00+00"
# look at the old data:
docker exec -it -u postgres hearth_scratch psql -d hearth
# copy one table's rows back (check for conflicts first), for example:
docker exec -u postgres hearth_scratch pg_dump -d hearth --data-only -t '"user"' \
  | docker exec -i -u postgres hearth_pg_beta psql -d hearth
# when done:
docker rm -f hearth_scratch
```

This is exactly what was done in the test: rows deleted, side copy restored to a moment before, 5 rows copied back.

### 2. The database is broken, or a bad migration needs undoing (restore in place)

This replaces the live data with a backup. You lose everything after the restore point.

```bash
cd /opt/hearth-db-beta && source .env
docker stop pet_platform_backend_beta          # stop the app writing (use the production backend name in prod)
# keep the broken data in case it is needed for diagnosis:
docker stop $PG_CONTAINER && mv $DATA_DIR/pgdata $DATA_DIR/pgdata.broken-$(date +%Y%m%d%H%M) && mkdir $DATA_DIR/pgdata
chown 999:999 $DATA_DIR/pgdata   # the postgres user id inside the image (docker run --rm --entrypoint id hearth-postgres:18 -u postgres)
# restore (omit --type/--target for "latest"; for a moment in time use: --type=time --target="2026-10-29 15:06:00+00" --target-action=promote)
docker run --rm -v $DATA_DIR/pgdata:/var/lib/postgresql -v $DATA_DIR/pgbackrest:/var/lib/pgbackrest \
  -v /opt/hearth-db-beta/pgbackrest.rendered.conf:/etc/pgbackrest/pgbackrest.conf:ro --user postgres --entrypoint pgbackrest \
  hearth-postgres:18 --stanza=hearth restore
docker start $PG_CONTAINER && docker logs -f $PG_CONTAINER   # wait for "database system is ready to accept connections"
docker start pet_platform_backend_beta
```

After a restore to a past moment Postgres starts a new timeline; take a full backup straight away: `./scripts/job.sh backup-full ./scripts/backup.sh full`.

### 3. The whole server is lost

You need: the off-server bucket (below), the **encryption passphrase** (`CIPHER_PASS`, which you must have stored somewhere other than that server), and this repo.

1. New server: install Docker, clone the repo, copy `deploy/db` to `/opt/hearth-db-prod`.
2. Create `offsite.env` with the same bucket details and the same `CIPHER_PASS`.
3. Run `./deploy.sh ...` as for a fresh install, but **before** the first backup is taken, stop at "== database" and restore instead: use the restore command from section 2 with `--repo=2` (add `--repo=2` before `restore`).
4. Start the database, point the backend at it, run a full backup.

Practise this once with `./scripts/restore-drill.sh --repo 2` (restores from the bucket into a throwaway container).

### 4. Only the nightly dump is left

```bash
# newest dump file in $DATA_DIR/dumps; restore into a fresh database
docker exec -i -u postgres hearth_pg_beta pg_restore -d hearth --clean --if-exists < /var/lib/hearth-db-beta/dumps/hearth_YYYYMMDD_HHMMSS.dump
```

## Off-server copy (do this: it is what protects against losing the server)

1. Create a **private** bucket at a cloud provider (Backblaze B2 and any S3-compatible service work). Create an access key limited to that bucket.
2. Choose a long random **encryption passphrase** for the backups. Store it in your password manager *and* somewhere else. Without it the off-server backups cannot be read, by anyone, ever.
3. On the server create `/opt/hearth-db-beta/offsite.env` (mode 600):
   ```
   S3_ENDPOINT=s3.eu-central-003.backblazeb2.com
   S3_REGION=eu-central-003
   S3_BUCKET=your-bucket-name
   S3_KEY=your-key-id
   S3_SECRET=your-application-key
   CIPHER_PASS=the-long-random-passphrase
   ```
4. `cd /opt/hearth-db-beta && ./deploy.sh`, then `./scripts/job.sh backup-full ./scripts/backup.sh full`.
5. Prove it works: `./scripts/restore-drill.sh --repo 2`.

From then on every backup and every WAL segment goes to both places, and the daily email says "off-server copy: yes".

## Everyday jobs

| Task | Command |
|---|---|
| Is everything fine? | Read the 08:00 email, or the Grafana dashboard |
| Backup status | `docker exec -u postgres hearth_pg_beta pgbackrest --stanza=hearth info` |
| Backup now | `/opt/hearth-db-beta/scripts/job.sh backup-full /opt/hearth-db-beta/scripts/backup.sh full` |
| Restore test now | `/opt/hearth-db-beta/scripts/job.sh restore-drill /opt/hearth-db-beta/scripts/restore-drill.sh` |
| Change the alert email addresses | edit `ALERT_TO` in `/opt/hearth-db-beta/.env`, then `./deploy.sh` |
| Rotate a database password | edit the value in `.env`, run `./deploy.sh` (re-applies roles), then update the app's `DATABASE_URL` and restart it |
| Change a Postgres setting | edit `postgresql.conf` in the repo, copy it to the server, `docker restart hearth_pg_beta` (a few seconds of downtime) |

## Server snapshots (extra layer)

Also take a snapshot of the whole VPS in the Hostinger panel before risky work (OS upgrades, big migrations) and about weekly. It is not a replacement for the above: it is a copy of a running disk, and it lives with the same provider as the server.

## Limits worth knowing

- This is one server. If it is down, the website is down; the backups make it recoverable, they do not make it highly available. A second server with a standby copy is the next step if you need that.
- pgBackRest needs the database container to be running to take backups. If the container is down the daily email and alerts say so.
- Postgres major upgrades (18 to 19) are a planned job: restore a backup into the new version in a side container, test, then switch.
