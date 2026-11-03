#!/bin/bash
# Rebuilds the BACKEND and the WEBSITE on one server (beta or production) from the code that is
# already checked out there. Runs ON the server; the wrapper on your Mac pipes it in over ssh.
#
# Order:
#   1. Pre-checks (memory, disk, node, node_modules). Stops early if the server looks too tight.
#   2. Backend: tags the current image for rollback, rebuilds ONLY the backend service, waits for
#      its health check. (A few seconds of API downtime.)
#   3. Website: builds in a SEPARATE COPY (so visitors never see a half-built site), checks the
#      result, then swaps it in with two quick renames. The old site is kept as dist.old-<time>.
#
# Environment variables (set by the wrapper):
#   ROOT             checkout folder, e.g. /var/www/scooby_pets
#   COMPOSE_FILE     e.g. docker-compose.prod.yml
#   BACKEND_SERVICE  compose service name, e.g. backend
#   BACKEND_CONTAINER container name, e.g. pet_platform_backend
#   HEALTH_URL       e.g. https://api.hearthandone.com/health
#   SITE_URL         e.g. https://hearthandone.com
#   FORCE_FLAGS      "true" for beta only (beta forces every flag on, see scripts/deploy-beta.sh)
#   MARKER           text that must appear in the new website bundle to prove it is the new build
set -euo pipefail

ROOT="${ROOT:?}"; COMPOSE_FILE="${COMPOSE_FILE:?}"; BACKEND_SERVICE="${BACKEND_SERVICE:?}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:?}"; HEALTH_URL="${HEALTH_URL:?}"; SITE_URL="${SITE_URL:?}"
FORCE_FLAGS="${FORCE_FLAGS:-}"; MARKER="${MARKER:-}"
TS=$(date +%Y%m%d-%H%M%S)

cd "$ROOT"
echo "Folder: $ROOT   commit: $(git rev-parse --short HEAD) on $(git branch --show-current)"
echo

# ---- 1. pre-checks ----------------------------------------------------------------------------
echo "1. Pre-checks"
AVAIL_MB=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
DISK_MB=$(df -Pm /root | awk 'NR==2{print $4}')
echo "   free memory: ${AVAIL_MB} MB   free disk (/root): ${DISK_MB} MB"
[ "$AVAIL_MB" -ge 1200 ] || { echo "STOP: less than 1200 MB of memory is free. The website build could slow or crash the live site. Try again at a quiet hour."; exit 1; }
[ "$DISK_MB" -ge 2500 ] || { echo "STOP: less than 2500 MB of disk is free."; exit 1; }
command -v node >/dev/null && command -v npm >/dev/null || { echo "STOP: node/npm not found"; exit 1; }
[ -d frontend/node_modules ] || { echo "STOP: frontend/node_modules is missing, so the website cannot be built here. Tell Claude."; exit 1; }
echo "   ok"

# ---- 2. backend --------------------------------------------------------------------------------
echo; echo "2. Backend ($BACKEND_SERVICE)"
OLD_IMG=$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)
if [ -n "$OLD_IMG" ]; then
  docker tag "$OLD_IMG" "rollback/$BACKEND_CONTAINER:$TS" && echo "   old image saved as rollback/$BACKEND_CONTAINER:$TS"
fi
docker compose -f "$COMPOSE_FILE" up -d --build "$BACKEND_SERVICE" 2>&1 | tail -4
echo -n "   waiting for health"
OK=0
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$CODE" = "200" ]; then OK=1; break; fi
  echo -n "."; sleep 3
done
echo
[ $OK -eq 1 ] || { echo "STOP: the backend did not become healthy (last status $CODE)."; echo "Roll back: docker tag rollback/$BACKEND_CONTAINER:$TS <image used by $BACKEND_SERVICE>, or see the header of the wrapper script."; exit 1; }
echo "   backend healthy (200)"

# ---- 3. website --------------------------------------------------------------------------------
echo; echo "3. Website (built in a separate copy, then swapped in)"
BUILD="/root/web-build-$TS"
mkdir -p "$BUILD"
# "/dist" is anchored on purpose: a bare "dist" would also strip node_modules/*/dist and break the build.
if command -v rsync >/dev/null; then
  rsync -a --exclude '/dist' "$ROOT/frontend/" "$BUILD/"
else
  cp -a "$ROOT/frontend/." "$BUILD/" && rm -rf "$BUILD/dist"
fi
cd "$BUILD"
echo "   building (this takes a few minutes; it runs at low priority)..."
export SITE_URL
[ -n "$FORCE_FLAGS" ] && export VITE_FORCE_FLAGS_ENABLED="$FORCE_FLAGS"
nice -n 10 npm run build > "$BUILD/build.log" 2>&1 || { echo "STOP: the website build failed. Last lines:"; tail -15 "$BUILD/build.log"; echo "The live site was NOT changed."; exit 1; }
[ -s "$BUILD/dist/index.html" ] || { echo "STOP: build produced no index.html. The live site was NOT changed."; exit 1; }
FILES=$(find "$BUILD/dist" -type f | wc -l)
echo "   built: $FILES files"
if [ -n "$MARKER" ]; then
  HITS=$(grep -rl --include=*.js -- "$MARKER" "$BUILD/dist/assets" | wc -l)
  [ "$HITS" -ge 1 ] || { echo "STOP: the new build does not contain '$MARKER', so it is not the new code. The live site was NOT changed."; exit 1; }
  echo "   new code present ('$MARKER' found in $HITS file(s))"
fi

cd "$ROOT/frontend"
cp -a "$BUILD/dist" "dist.new-$TS"
mv dist "dist.old-$TS"
mv "dist.new-$TS" dist
echo "   swapped in. Old site kept as $ROOT/frontend/dist.old-$TS"
rm -rf "$BUILD"

echo
echo -n "Site check: "; curl -s -o /dev/null -w "%{http_code}\n" "$SITE_URL/"
echo
echo "Done."
echo "Rollback website : cd $ROOT/frontend && mv dist dist.bad-$TS && mv dist.old-$TS dist"
echo "Rollback backend : the old image is rollback/$BACKEND_CONTAINER:$TS (ask Claude for the exact steps)"
echo "Tidy up later    : delete dist.old-* and dist.bad-* folders and unused rollback images after a few days."
