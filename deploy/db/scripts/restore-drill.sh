#!/bin/bash
# Proves that the backups can really be restored. Never touches the live database's data.
#
#   restore-drill.sh                  restore the newest backup + all archived WAL into a throwaway
#                                     container, compare it with the live database, run an integrity check
#   restore-drill.sh --pitr           "oops" test: write a probe row, note the time, write another row,
#                                     restore to the moment between them and check only the first exists
#   restore-drill.sh --repo 2         restore from the off-server bucket instead of this server
#
# Exit 0 = passed. Writes metrics for Prometheus and a log; job.sh emails on failure.
set -uo pipefail
HDB="$(cd "$(dirname "$0")/.." && pwd)"
source "$HDB/.env"
PG=${PG_CONTAINER:-hearth_pg}
DATA=${DATA_DIR:-/var/lib/hearth-db}
IMG=hearth-postgres:18
MODE=latest; REPO=1
while [ $# -gt 0 ]; do case "$1" in --pitr) MODE=pitr;; --repo) REPO="$2"; shift;; esac; shift; done
NAME=hearth_drill_$$
START=$(date +%s)
PROM=$DATA/textfile/${MODE/latest/restore}_drill.prom
[ "$MODE" = pitr ] && PROM=$DATA/textfile/pitr_drill.prom
METRIC=restore_drill; [ "$MODE" = pitr ] && METRIC=pitr_drill

LIVE() { docker exec -u postgres "$PG" psql -d hearth -tAq -v ON_ERROR_STOP=1 "$@"; }
SCR()  { docker exec -u postgres "$NAME" psql -h /var/run/postgresql -d hearth -tAq -v ON_ERROR_STOP=1 "$@"; }

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; [ "$MODE" = pitr ] && LIVE -c "DROP SCHEMA IF EXISTS ops_probe CASCADE" >/dev/null 2>&1; }
trap cleanup EXIT

finish() {   # $1 = 1 pass / 0 fail, $2 = message
  local ok=$1 now; now=$(date +%s)
  local last=$now
  if [ "$ok" != 1 ]; then
    last=$(grep -oE "^hearth_${METRIC}_last_success_timestamp_seconds [0-9]+" "$PROM" 2>/dev/null | awk '{print $2}'); last=${last:-0}
  fi
  cat > "$PROM.tmp" <<EOF
hearth_${METRIC}_ok $ok
hearth_${METRIC}_last_run_timestamp_seconds $now
hearth_${METRIC}_last_success_timestamp_seconds $last
hearth_${METRIC}_duration_seconds $((now - START))
EOF
  mv "$PROM.tmp" "$PROM"
  echo "RESULT: $([ "$ok" = 1 ] && echo PASS || echo FAIL) - $2 (took $((now - START))s)"
  [ "$ok" = 1 ]; exit $?
}
fail() { echo "FAIL: $*" >&2; finish 0 "$*"; }

COUNTS_SQL="select table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
            from information_schema.tables where table_schema in ('public') and table_type = 'BASE TABLE' order by 1"

TARGET_ARGS=""; T1=""
if [ "$MODE" = pitr ]; then
  echo "--- PITR drill: writing probe rows to the live database"
  LIVE -c "CREATE SCHEMA IF NOT EXISTS ops_probe; DROP TABLE IF EXISTS ops_probe.drill; CREATE TABLE ops_probe.drill(id serial PRIMARY KEY, label text, at timestamptz DEFAULT clock_timestamp());" \
    || fail "cannot create probe table"
  LIVE -c "INSERT INTO ops_probe.drill(label) VALUES ('A-before')" || fail "insert A"
  sleep 2
  T1=$(LIVE -c "select to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'")
  sleep 2
  LIVE -c "INSERT INTO ops_probe.drill(label) VALUES ('B-after-the-restore-point')" || fail "insert B"
  BEFORE=$(LIVE -c "select archived_count from pg_stat_archiver")
  LIVE -c "select pg_switch_wal()" >/dev/null
  echo "restore point: $T1; waiting for the WAL holding row B to be archived"
  for i in $(seq 1 60); do
    NOW_A=$(LIVE -c "select archived_count from pg_stat_archiver"); [ "$NOW_A" -gt "$BEFORE" ] && break; sleep 2
  done
  [ "$NOW_A" -gt "$BEFORE" ] || fail "WAL was not archived within 2 minutes (archiving is broken)"
  TARGET_ARGS="--type=time --target=\"$T1\" --target-action=promote"
fi

echo "--- starting throwaway container $NAME (repo$REPO)"
NET=""; MOUNT_REPO="-v $DATA/pgbackrest:/var/lib/pgbackrest:ro"
[ "$REPO" != 1 ] && MOUNT_REPO=""   # off-server repo is reached over the network
docker run -d --name "$NAME" --memory 768m $MOUNT_REPO \
  -v "$HDB/pgbackrest.rendered.conf":/etc/pgbackrest/pgbackrest.conf:ro \
  -v "$HDB/postgresql.conf":/etc/postgresql/postgresql.conf:ro \
  --entrypoint sleep "$IMG" infinity >/dev/null || fail "cannot start the throwaway container"
docker exec "$NAME" bash -c 'mkdir -p /var/lib/postgresql/18/docker && chown -R postgres:postgres /var/lib/postgresql && chmod 700 /var/lib/postgresql/18/docker' || fail "prepare data dir"

echo "--- restoring from backup"
docker exec -u postgres "$NAME" bash -c "pgbackrest --stanza=hearth --repo=$REPO restore $TARGET_ARGS" || fail "pgbackrest restore failed"

echo "--- starting the restored database and replaying WAL"
# Recovery requires these settings to be at least what the original server had, so only the memory
# size is reduced; everything else comes from the same postgresql.conf as the live database.
docker exec -d -u postgres "$NAME" bash -c "postgres -D /var/lib/postgresql/18/docker -c config_file=/etc/postgresql/postgresql.conf \
  -c archive_mode=off -c shared_buffers=64MB -c listen_addresses= > /tmp/drill_pg.log 2>&1"
READY=0
for i in $(seq 1 180); do
  if [ "$(SCR -c 'select pg_is_in_recovery()' 2>/dev/null)" = "f" ]; then READY=1; break; fi
  if [ "$i" -gt 5 ] && ! docker exec "$NAME" pgrep -x postgres >/dev/null 2>&1; then
    docker exec "$NAME" tail -n 15 /tmp/drill_pg.log >&2
    fail "restored database stopped during recovery (its log is above)"
  fi
  sleep 2
done
[ $READY = 1 ] || { docker exec "$NAME" tail -n 15 /tmp/drill_pg.log >&2; fail "restored database did not finish recovery in 6 minutes"; }

if [ "$MODE" = pitr ]; then
  LABELS=$(SCR -c "select string_agg(label, ',' order by id) from ops_probe.drill" 2>&1)
  echo "rows in the restored probe table: $LABELS"
  [ "$LABELS" = "A-before" ] || fail "point-in-time restore wrong: expected only A-before, got '$LABELS'"
  finish 1 "restored to $T1: row A present, row B (written after) correctly absent"
fi

echo "--- comparing with the live database"
LIVE -c "$COUNTS_SQL" > /tmp/drill_live_$$.txt || fail "cannot read live counts"
SCR  -c "$COUNTS_SQL" > /tmp/drill_rest_$$.txt || fail "cannot read restored counts"
TABLES_LIVE=$(wc -l < /tmp/drill_live_$$.txt); TABLES_REST=$(wc -l < /tmp/drill_rest_$$.txt)
[ "$TABLES_LIVE" -gt 0 ] || fail "live database has no tables?"
[ "$(cut -d' ' -f1 /tmp/drill_live_$$.txt | md5sum)" = "$(cut -d' ' -f1 /tmp/drill_rest_$$.txt | md5sum)" ] || fail "table lists differ (live $TABLES_LIVE, restored $TABLES_REST)"
BAD=$(join /tmp/drill_live_$$.txt /tmp/drill_rest_$$.txt | awk '{d=$2-$3; if (d<0) d=-d; t=($2*0.01<5)?5:$2*0.01; if (d>t) print $1": live "$2", restored "$3}')
ROWS_LIVE=$(awk '{s+=$2} END {print s}' /tmp/drill_live_$$.txt); ROWS_REST=$(awk '{s+=$2} END {print s}' /tmp/drill_rest_$$.txt)
rm -f /tmp/drill_live_$$.txt /tmp/drill_rest_$$.txt
echo "tables: $TABLES_LIVE; rows live $ROWS_LIVE vs restored $ROWS_REST"
[ -z "$BAD" ] || fail "row counts differ too much: $BAD"

echo "--- integrity check (amcheck: table and index structure)"
SCR -c "CREATE EXTENSION IF NOT EXISTS amcheck" >/dev/null || fail "cannot enable amcheck"
docker exec -u postgres "$NAME" pg_amcheck -h /var/run/postgresql -d hearth --install-missing >/tmp/amcheck_$$.txt 2>&1 || { cat /tmp/amcheck_$$.txt; fail "integrity check found corruption"; }
rm -f /tmp/amcheck_$$.txt

finish 1 "restored from repo$REPO: $TABLES_LIVE tables, $ROWS_REST rows (live $ROWS_LIVE), integrity check clean"
