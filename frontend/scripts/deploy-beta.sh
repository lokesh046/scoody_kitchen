#!/bin/bash
# Rebuilds the BETA web frontend on the beta VPS (/var/www/scooby_pets-beta),
# always with VITE_FORCE_FLAGS_ENABLED=true -- the whole point of beta is
# testing every feature regardless of the real (often all-off) backend flag
# state. A plain `npm run build` here silently drops that override and
# makes beta behave exactly like production, which is a regression that's
# easy to miss since nothing errors -- it just shows nothing.
#
# Run this ON THE BETA VPS, from /var/www/scooby_pets-beta/frontend:
#   bash scripts/deploy-beta.sh
#
# Never used for production -- scripts/deploy-production.sh (if it exists)
# or the DEPLOY.md redeploy steps should never set VITE_FORCE_FLAGS_ENABLED.
set -euo pipefail

cd "$(dirname "$0")/.."

export SITE_URL="${SITE_URL:-https://beta.hearthandone.com}"
unset VITE_FORCE_FLAGS_ENABLED  # beta now follows its real flags, like production

echo "Building beta frontend following real flags (no force override), SITE_URL=$SITE_URL ..."
npm run build
echo "Done."
