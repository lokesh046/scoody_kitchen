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
# Shows every flagged feature regardless of the backend's real flag state,
# so beta testing isn't limited by what's currently toggled on in
# production (or beta, which mirrors production's flags). Never set in
# scripts/build-production.sh -- see useFeatureFlag.ts for why that means
# production can never pick this up.
export EXPO_PUBLIC_FORCE_FLAGS_ENABLED="true"

cd "$(dirname "$0")/../android"
SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew installBetaRelease "$@"
