# deploy/db

Production-grade Postgres for Hearth & One: continuous backups with point-in-time recovery,
automatic restore tests, monitoring and email alerts. Start with [docs/DB_RECOVERY.md](docs/DB_RECOVERY.md).

```
Dockerfile              Postgres 18 + pgBackRest
postgresql.conf         database settings (archiving on, sized for the shared VPS)
pgbackrest.conf         backup retention and options (the off-server repo is added by deploy.sh)
init-roles.sql          locked-down roles: owner / app / read-only / monitor
docker-compose.yml      the database and the monitoring stack (all ports on 127.0.0.1)
deploy.sh               installs or updates one environment on the server (safe to re-run)
scripts/                backup, restore drill, point-in-time drill, side-restore, dump, daily report, alert email
monitoring/             Prometheus config, alert rules, Alertmanager template, Grafana dashboard
```

Install on a server (as root, from a copy of this folder at `/opt/hearth-db-<env>`):

```bash
./deploy.sh --env beta --network <app docker network> \
            --backend-env /path/to/backend/.env --alert-to a@example.com,b@example.com
```

Secrets (`.env`, `smtp.env`, `offsite.env`, `*.rendered.*`) are generated on the server and are
never part of the repo.
