# Postgres 18 with pgBackRest, so WAL archiving and backups run next to the data files.
# The official image already uses the PostgreSQL apt repo, so pgbackrest comes from there at a
# version that supports Postgres 18.
FROM postgres:18

RUN apt-get update \
 && apt-get install -y --no-install-recommends pgbackrest ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /var/lib/pgbackrest /var/spool/pgbackrest /var/log/pgbackrest /etc/pgbackrest \
 && chown -R postgres:postgres /var/lib/pgbackrest /var/spool/pgbackrest /var/log/pgbackrest /etc/pgbackrest
