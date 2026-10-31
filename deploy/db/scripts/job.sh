#!/bin/bash
# Runs a scheduled job and makes sure a failure is noticed.
#   job.sh <name> <command...>
# - appends output to /var/log/hearth-db/<env>-<name>.log
# - writes metrics for Prometheus (exit code, last success time)
# - emails the log tail on failure, directly, so it works even if the monitoring stack is down
set -u
NAME="$1"; shift
BASE="$(cd "$(dirname "$0")/.." && pwd)"
source "$BASE/.env"
LOG=/var/log/hearth-db/${ENV_NAME:-hearth}-$NAME.log
PROM=${DATA_DIR:-/var/lib/hearth-db}/textfile/job_$NAME.prom
mkdir -p /var/log/hearth-db "$(dirname "$PROM")"
echo "=== $(date -u +%FT%TZ) start: $*" >> "$LOG"
"$@" >> "$LOG" 2>&1
RC=$?
echo "=== $(date -u +%FT%TZ) end: exit $RC" >> "$LOG"
NOW=$(date +%s)
LAST_OK=$NOW
if [ $RC -ne 0 ]; then
  LAST_OK=$(grep -oE '^hearth_job_last_success_timestamp_seconds\{job="'"$NAME"'"\} [0-9]+' "$PROM" 2>/dev/null | awk '{print $2}')
  LAST_OK=${LAST_OK:-0}
fi
cat > "$PROM.tmp" <<PROMEOF
hearth_job_last_exit_code{job="$NAME"} $RC
hearth_job_last_run_timestamp_seconds{job="$NAME"} $NOW
hearth_job_last_success_timestamp_seconds{job="$NAME"} $LAST_OK
PROMEOF
mv "$PROM.tmp" "$PROM"
if [ $RC -ne 0 ]; then
  { echo "The scheduled database job '$NAME' failed (exit $RC) on $(hostname) at $(date -u +%FT%TZ)."; echo;
    echo "Last lines of $LOG:"; echo; tail -n 40 "$LOG"; echo;
    echo "What to do: see deploy/db/docs/DB_RECOVERY.md in the repo."; } \
  | python3 "$BASE/scripts/send-alert.py" "[Hearth & One ${ENV_LABEL:-}] FAILED: database job $NAME" || true
fi
exit $RC
