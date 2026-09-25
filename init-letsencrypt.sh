#!/usr/bin/env bash
# One-time TLS bootstrap. Run this ONCE on the actual VPS, after DNS for
# your domain already points at this server's IP — Let's Encrypt verifies
# domain ownership by fetching a file from this exact machine over port 80,
# so it will fail if DNS isn't live yet.
#
# The problem this solves: nginx.conf's 443/8002/8003 blocks reference a
# certificate file that doesn't exist until Let's Encrypt issues one — but
# nginx won't even start with a config pointing at a missing file, and
# Let's Encrypt can't issue a cert until nginx is running to serve its
# verification challenge on port 80. This script breaks that cycle: create
# a throwaway self-signed cert so nginx can boot, get the real cert while
# nginx is up, then reload nginx onto the real cert.
set -euo pipefail

DOMAIN="${DOMAIN:-scoobyskitchen.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.$DOMAIN}"
EMAIL="${EMAIL:-}"   # set this — Let's Encrypt uses it for expiry notices
STAGING="${STAGING:-0}"  # set to 1 first to test against LE's staging environment (no real-cert rate limits)

if [ -z "$EMAIL" ]; then
  echo "Set EMAIL=you@example.com before running this (used for Let's Encrypt renewal notices)."
  exit 1
fi

CERT_PATH="./certbot-conf-data/live/$DOMAIN"

echo "== 1/5: creating a temporary self-signed cert so nginx can start =="
mkdir -p "$CERT_PATH"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERT_PATH/privkey.pem" \
  -out "$CERT_PATH/fullchain.pem" \
  -subj "/CN=localhost"

# Seed the certbot-conf volume with the dummy cert at the exact path
# nginx.conf expects, so nginx's initial startup succeeds.
docker compose run --rm --entrypoint "\
  mkdir -p /etc/letsencrypt/live/$DOMAIN && \
  cp /tmp/seed/privkey.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem && \
  cp /tmp/seed/fullchain.pem /etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -v "$(pwd)/$CERT_PATH:/tmp/seed:ro" \
  certbot
rm -rf ./certbot-conf-data

echo "== 2/5: starting nginx (and the rest of the stack) with the dummy cert =="
docker compose up -d nginx

echo "== 3/5: deleting the dummy cert so certbot issues a real one in its place =="
docker compose run --rm --entrypoint "rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

STAGING_ARG=""
if [ "$STAGING" = "1" ]; then
  STAGING_ARG="--staging"
  echo "(Using Let's Encrypt's STAGING environment — this cert will NOT be trusted by browsers. Re-run with STAGING=0 once this succeeds.)"
fi

echo "== 4/5: requesting the real certificate from Let's Encrypt =="
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email $STAGING_ARG \
  -d "$DOMAIN" -d "$WWW_DOMAIN"

echo "== 5/5: reloading nginx onto the real certificate =="
docker compose exec nginx nginx -s reload

echo ""
echo "Done. https://$DOMAIN should now serve a real certificate."
echo "The certbot service in docker-compose.yml auto-renews it going forward."
echo "Add reload-nginx-cron.sh to a daily crontab so a renewed cert actually gets picked up (see that script's own comment)."
