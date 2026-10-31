#!/bin/bash
# Installs or updates the database stack for one environment. Run as root on the server, from the
# folder holding these files (e.g. /opt/hearth-db-beta). Safe to run again at any time: it only
# creates what is missing, re-renders configs, and re-applies roles and permissions.
#
#   ./deploy.sh --env beta --network scooby_pets-beta_scooby_net_beta \
#               --backend-env /var/www/scooby_pets-beta/pet-platform-backend/.env \
#               --alert-to a@example.com,b@example.com
#
# First run generates every password into ./.env (mode 600). Nothing secret is ever printed or
# committed. Add an off-server bucket later by creating ./offsite.env (see docs/DB_RECOVERY.md)
# and running this script again.
set -euo pipefail
HDB="$(cd "$(dirname "$0")" && pwd)"
cd "$HDB"

ENV_NAME=""; APP_NETWORK=""; BACKEND_ENV=""; ALERT_TO=""
while [ $# -gt 0 ]; do case "$1" in
  --env) ENV_NAME="$2"; shift;; --network) APP_NETWORK="$2"; shift;;
  --backend-env) BACKEND_ENV="$2"; shift;; --alert-to) ALERT_TO="$2"; shift;;
  *) echo "unknown option $1"; exit 2;; esac; shift; done

gen() { openssl rand -hex 18; }

if [ ! -f .env ]; then
  [ -n "$ENV_NAME" ] && [ -n "$APP_NETWORK" ] && [ -n "$BACKEND_ENV" ] || { echo "first run needs --env --network --backend-env"; exit 2; }
  case "$ENV_NAME" in
    beta) PORTS="55432 9090 9093 3001";; prod) PORTS="55433 9091 9094 3002";; *) echo "env must be beta or prod"; exit 2;;
  esac
  set -- $PORTS
  umask 077
  cat > .env <<EOF
ENV_NAME=$ENV_NAME
ENV_LABEL=$ENV_NAME
APP_NETWORK=$APP_NETWORK
PG_CONTAINER=hearth_pg_$ENV_NAME
DATA_DIR=/var/lib/hearth-db-$ENV_NAME
PG_HOST_PORT=$1
PROMETHEUS_PORT=$2
ALERTMANAGER_PORT=$3
GRAFANA_PORT=$4
BACKEND_ENV=$BACKEND_ENV
ALERT_TO=${ALERT_TO:-}
POSTGRES_PASSWORD=$(gen)
OWNER_PW=$(gen)
APP_PW=$(gen)
RO_PW=$(gen)
MONITOR_PW=$(gen)
GRAFANA_PASSWORD=$(gen)
EOF
  echo "generated $HDB/.env (passwords created, not shown)"
fi
set -a; source .env; set +a
[ -n "${ALERT_TO:-}" ] || { echo "ALERT_TO missing in .env"; exit 2; }
umask 022

echo "== folders"
mkdir -p "$DATA_DIR"/{pgdata,pgbackrest,spool,log,textfile,prometheus,alertmanager,grafana} /var/log/hearth-db
echo "== build image"
docker compose build hearth_pg >/dev/null
PGUID=$(docker run --rm --entrypoint id hearth-postgres:18 -u postgres)
chown -R "$PGUID:$PGUID" "$DATA_DIR"/{pgdata,pgbackrest,spool,log}
chown -R 65534:65534 "$DATA_DIR"/{prometheus,alertmanager}
chown -R 472:472 "$DATA_DIR/grafana"

echo "== mail settings (from the backend's own .env, same account as the app and fail2ban)"
python3 - <<'PY'
import os, json, pathlib
env = {}
for line in pathlib.Path(os.environ["BACKEND_ENV"]).read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("="); env[k.strip()] = v.strip().strip('"').strip("'")
need = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]
missing = [k for k in need if not env.get(k)]
if missing: raise SystemExit(f"backend .env lacks {missing}: cannot send alert emails")
port = env.get("SMTP_PORT", "587"); sender = env.get("EMAILS_FROM") or env["SMTP_USER"]
smtp = pathlib.Path("smtp.env"); smtp.write_text(
    f"SMTP_HOST={env['SMTP_HOST']}\nSMTP_PORT={port}\nSMTP_USER={env['SMTP_USER']}\nSMTP_PASSWORD={env['SMTP_PASSWORD']}\n"
    f"EMAILS_FROM={sender}\nALERT_TO={os.environ['ALERT_TO']}\n"); smtp.chmod(0o600)
tpl = pathlib.Path("monitoring/alertmanager.yml.tmpl").read_text()
for k, v in {"__SMTP_SMARTHOST__": f"{env['SMTP_HOST']}:{port}", "__SMTP_FROM__": sender, "__SMTP_USER__": env["SMTP_USER"],
             "__SMTP_PASSWORD__": env["SMTP_PASSWORD"], "__ALERT_TO__": os.environ["ALERT_TO"].replace(",", ", "),
             "__ENV_LABEL__": os.environ.get("ENV_LABEL", "")}.items():
    tpl = tpl.replace(k, json.dumps(v))           # JSON strings are valid YAML strings
out = pathlib.Path("monitoring/alertmanager.rendered.yml"); out.write_text(tpl); out.chmod(0o644)
PY
chmod 600 smtp.env

echo "== pgBackRest settings"
cp pgbackrest.conf pgbackrest.rendered.conf
if [ -f offsite.env ]; then
  set -a; source offsite.env; set +a
  cat >> pgbackrest.rendered.conf <<EOF

# --- off-server copy (generated from offsite.env)
EOF
  python3 - <<'PY'
import os, pathlib
p = pathlib.Path("pgbackrest.rendered.conf"); s = p.read_text()
extra = f"""repo2-type=s3
repo2-s3-endpoint={os.environ['S3_ENDPOINT']}
repo2-s3-region={os.environ['S3_REGION']}
repo2-s3-bucket={os.environ['S3_BUCKET']}
repo2-s3-key={os.environ['S3_KEY']}
repo2-s3-key-secret={os.environ['S3_SECRET']}
repo2-s3-uri-style={os.environ.get('S3_URI_STYLE', 'path')}
repo2-path=/hearth-{os.environ['ENV_NAME']}
repo2-retention-full=3
repo2-retention-diff=7
repo2-cipher-type=aes-256-cbc
repo2-cipher-pass={os.environ['CIPHER_PASS']}
"""
head, sep, rest = s.partition("\n[hearth]")
p.write_text(head.rstrip("\n") + "\n" + extra + "\n[hearth]" + rest)
PY
  echo "off-server repository configured (repo2)"
else
  echo "no offsite.env: backups are on this server only"
fi
if [ -f offsite.env ]; then
  # holds the bucket key and encryption passphrase: readable only by the container's postgres user
  chown "$PGUID:$PGUID" pgbackrest.rendered.conf; chmod 600 pgbackrest.rendered.conf
else
  chmod 644 pgbackrest.rendered.conf
fi

echo "== database"
docker compose up -d hearth_pg
for i in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null)" = healthy ] && break; sleep 3
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER")" = healthy ] || { echo "database did not become healthy"; docker logs --tail 30 "$PG_CONTAINER"; exit 1; }
# Application databases in this cluster: the main one, plus the separate colleges list.
for DB in hearth hearth_colleges; do
  if [ "$DB" != hearth ] && [ "$(docker exec -u postgres $PG_CONTAINER psql -d postgres -tAc "select count(*) from pg_database where datname='$DB'")" = 0 ]; then
    docker exec -u postgres $PG_CONTAINER psql -d postgres -v ON_ERROR_STOP=1 -qc "CREATE DATABASE $DB TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C.UTF-8'"
    echo "created database $DB"
  fi
  docker exec -i -u postgres $PG_CONTAINER psql -d "$DB" -v ON_ERROR_STOP=1 -tAq \
    -v dbname="$DB" -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -v ro_pw="$RO_PW" -v monitor_pw="$MONITOR_PW" < init-roles.sql
done
echo "roles and permissions applied to hearth and hearth_colleges"

echo "== backups"
PGB="docker exec -u postgres $PG_CONTAINER pgbackrest --stanza=hearth"
$PGB stanza-create 2>&1 | tail -2
$PGB check 2>&1 | tail -3
if ! $PGB info --output=json | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d and d[0].get('backup') else 1)"; then
  echo "no backup yet: taking the first full backup"
  "$HDB/scripts/backup.sh" full
fi

echo "== monitoring"
docker compose up -d
chmod +x scripts/*.sh scripts/*.py

echo "== schedule"
cat > "/etc/cron.d/hearth-db-$ENV_NAME" <<EOF
# Hearth & One database ($ENV_NAME). Generated by deploy.sh: edit the repo, not this file.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * *   root $HDB/scripts/metrics.py
15 3 * * *  root $HDB/scripts/job.sh dump $HDB/scripts/dump.sh
30 2 * * 0  root $HDB/scripts/job.sh backup-full $HDB/scripts/backup.sh full
30 2 * * 1-6 root $HDB/scripts/job.sh backup-diff $HDB/scripts/backup.sh diff
0 5 * * 0   root $HDB/scripts/job.sh restore-drill $HDB/scripts/restore-drill.sh
30 5 * * 3  root $HDB/scripts/job.sh pitr-drill $HDB/scripts/restore-drill.sh --pitr
0 8 * * *   root $HDB/scripts/job.sh daily-report /usr/bin/python3 $HDB/scripts/digest.py
EOF
chmod 644 "/etc/cron.d/hearth-db-$ENV_NAME"
cat > /etc/logrotate.d/hearth-db <<'LR'
/var/log/hearth-db/*.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
LR

echo
echo "DONE ($ENV_NAME). Database container: $PG_CONTAINER   (127.0.0.1:$PG_HOST_PORT)"
echo "Grafana 127.0.0.1:$GRAFANA_PORT   Prometheus 127.0.0.1:$PROMETHEUS_PORT   Alertmanager 127.0.0.1:$ALERTMANAGER_PORT"
echo "Connection string for the app (role hearth_app) is in .env as APP_PW; see docs/DB_RECOVERY.md."
