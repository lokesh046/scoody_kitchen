#!/bin/bash
# Builds and installs the beta variant (com.scooby.kitchen.beta) onto a
# connected device, pointed at the beta backend. Installs alongside the
# production app instead of replacing it.
#
# Usage: scripts/build-beta.sh [extra gradlew args]
set -e

export EXPO_PUBLIC_API_URL="https://api-beta.hearthandone.com"
export EXPO_PUBLIC_CHATBOT_URL="https://api-beta.hearthandone.com/chatbot"
# No beta vision service exists yet; falls back to production's.
export EXPO_PUBLIC_VISION_URL="https://hearthandone.com/vision"
# Beta follows the beta backend's real flags, exactly like production
# (hide / coming soon / unavailable all work). Flip flags in the beta admin
# to test; do NOT set EXPO_PUBLIC_FORCE_FLAGS_ENABLED here.

cd "$(dirname "$0")/../android"
SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew installBetaRelease "$@"
