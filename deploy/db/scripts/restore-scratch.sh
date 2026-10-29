#!/bin/bash
# Restore the database as it was at a chosen moment into a SIDE container named hearth_scratch,
# so you can inspect it or copy back just the rows you lost. The live database is not touched.
#
#   restore-scratch.sh --time "2026-10-29 15:06:00+00"    state at that moment (UTC unless +hh given)
#   restore-scratch.sh                                    latest state (everything archived so far)
#   restore-scratch.sh --time "..." --repo 2              read from the off-server bucket instead
#
# Then look around (the superuser needs no password inside the container):
#   docker exec -it -u postgres hearth_scratch psql -d hearth
# Copy a table's rows back into the live database, for example:
#   docker exec -u postgres hearth_scratch pg_dump -d hearth --data-only -t '"user"' | \
#       docker exec -i -u postgres hearth_pg_<env> psql -d hearth      (check for conflicts first!)
# Remove it when done:
#   docker rm -f hearth_scratch
set -euo pipefail
HDB="$(cd "$(dirname "$0")/.." && pwd)"; source "$HDB/.env"
TIME=""; REPO=1
while [ $# -gt 0 ]; do case "$1" in --time) TIME="$2"; shift;; --repo) REPO="$2"; shift;; *) echo "unknown option $1"; exit 2;; esac; shift; done
NAME=hearth_scratch
docker rm -f $NAME >/dev/null 2>&1 || true
MOUNT_REPO="-v ${DATA_DIR:-/var/lib/hearth-db}/pgbackrest:/var/lib/pgbackrest:ro"; [ "$REPO" != 1 ] && MOUNT_REPO=""
docker run -d --name $NAME --memory 768m $MOUNT_REPO -p 127.0.0.1:55499:5432 \
  -v "$HDB/pgbackrest.rendered.conf":/etc/pgbackrest/pgbackrest.conf:ro \
  -v "$HDB/postgresql.conf":/etc/postgresql/postgresql.conf:ro \
  --entrypoint sleep hearth-postgres:18 infinity >/dev/null
docker exec $NAME bash -c 'mkdir -p /var/lib/postgresql/18/docker && chown -R postgres:postgres /var/lib/postgresql && chmod 700 /var/lib/postgresql/18/docker'
ARGS=""; [ -n "$TIME" ] && ARGS="--type=time --target=\"$TIME\" --target-action=promote"
echo "restoring ${TIME:-the latest state} from repo$REPO ..."
docker exec -u postgres $NAME bash -c "pgbackrest --stanza=hearth --repo=$REPO restore $ARGS" 2>&1 | grep -E "ERROR|completed|restore backup set"
docker exec -d -u postgres $NAME bash -c "postgres -D /var/lib/postgresql/18/docker -c config_file=/etc/postgresql/postgresql.conf -c archive_mode=off -c shared_buffers=64MB -c listen_addresses='*' > /tmp/scratch_pg.log 2>&1"
for i in $(seq 1 180); do
  [ "$(docker exec -u postgres $NAME psql -h /var/run/postgresql -d hearth -tAc 'select pg_is_in_recovery()' 2>/dev/null)" = f ] && { echo "READY: restored database is running in container '$NAME'"; echo "  look:   docker exec -it -u postgres $NAME psql -d hearth"; echo "  remove: docker rm -f $NAME"; exit 0; }
  [ "$i" -gt 5 ] && ! docker exec $NAME pgrep -x postgres >/dev/null 2>&1 && { docker exec $NAME tail -n 15 /tmp/scratch_pg.log; echo "restored database stopped during recovery"; exit 1; }
  sleep 2
done
echo "did not finish recovery in 6 minutes"; exit 1
