#!/bin/bash
# Builds and installs the production variant (com.scooby.kitchen) onto a
# connected device, pointed at the production backend (mobile/.env's
# defaults -- no overrides needed here).
#
# Usage: scripts/build-production.sh [extra gradlew args]
set -e

cd "$(dirname "$0")/../android"
SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew installProductionRelease "$@"
