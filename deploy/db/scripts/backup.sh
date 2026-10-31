#!/bin/bash
# Backup to every configured repository: repo1 (this server) and repo2 (cloud bucket, if configured).
#   backup.sh <full|diff|incr>
set -eu
HDB="$(cd "$(dirname "$0")/.." && pwd)"
source "$HDB/.env"
TYPE=${1:-diff}
PG=${PG_CONTAINER:-hearth_pg}
REPOS=1
grep -q '^repo2-' "$HDB/pgbackrest.rendered.conf" && REPOS="1 2"
for r in $REPOS; do
  echo "--- $TYPE backup to repo$r"
  docker exec -u postgres "$PG" pgbackrest --stanza=hearth --type="$TYPE" --repo="$r" backup
done
docker exec -u postgres "$PG" pgbackrest --stanza=hearth info
