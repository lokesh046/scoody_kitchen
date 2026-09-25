#!/usr/bin/env bash
# The certbot service (docker-compose.yml) auto-renews the certificate
# files, but nginx doesn't notice a changed cert file on disk by itself —
# it needs an explicit reload to pick it up. Add this to a daily crontab on
# the VPS (not inside any container):
#
#   0 3 * * * /path/to/scooby_pets/reload-nginx-cron.sh >> /var/log/nginx-reload.log 2>&1
#
# Daily is deliberately generous: certbot only actually renews within 30
# days of expiry, so a daily reload just means the new cert is live within
# 24h of that renewal, not that anything renews daily. `nginx -s reload` is
# a graceful reload (existing connections finish normally), so running it
# on a schedule even when nothing changed is harmless.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose exec nginx nginx -s reload
