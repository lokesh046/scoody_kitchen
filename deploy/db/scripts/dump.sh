#!/bin/bash
# Nightly logical dump (pg_dump, custom format) of every application database.
# A second, independent safety layer next to pgBackRest: plain files you can restore into any
# Postgres, and the quickest way to restore one table or compare data by hand.
# Each file is checked with pg_restore --list; files older than 14 days are deleted.
set -eu
HDB="$(cd "$(dirname "$0")/.." && pwd)"
source "$HDB/.env"
DIR="${DATA_DIR:-/var/lib/hearth-db}/dumps"
umask 077; mkdir -p "$DIR"
for DB in hearth hearth_colleges; do
  F="$DIR/${DB}_$(date +%Y%m%d_%H%M%S).dump"
  docker exec -u postgres "$PG_CONTAINER" pg_dump -Fc "$DB" > "$F"
  [ -s "$F" ] || { echo "empty dump for $DB"; rm -f "$F"; exit 1; }
  docker exec -i -u postgres "$PG_CONTAINER" pg_restore --list < "$F" >/dev/null || { echo "dump of $DB is unreadable"; rm -f "$F"; exit 1; }
  echo "$DB: $(basename "$F") $(stat -c%s "$F") bytes, readable"
done
find "$DIR" -name '*.dump' -mtime +14 -delete
