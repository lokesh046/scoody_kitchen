#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/.tunnel_logs"
MOBILE_ENV="$PROJECT_ROOT/mobile/.env"

echo "🐾 =========================================="
echo "🐾 Tunneling Scooby's Kitchen services via Cloudflare"
echo "🐾 =========================================="

if ! command -v cloudflared >/dev/null 2>&1; then
    echo "❌ cloudflared is not installed. Install it first:"
    echo "   brew install cloudflared"
    exit 1
fi

# These are Cloudflare's free, no-account "quick tunnels" — each restart of
# this script gets brand-new random *.trycloudflare.com URLs, since that free
# domain doesn't support the persistent named-tunnel + custom-hostname setup
# (that mode requires owning a domain in your own Cloudflare account).
#
# Only the three ports the mobile app actually calls directly are tunneled —
# mcp-server (8001) is purely an internal dependency of chatbot-service and
# is never reached by the app itself, so it doesn't need a public URL here.

mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/*.log

PIDS=()

cleanup() {
    echo ""
    echo "🛑 Stopping all tunnels..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    echo "👋 All tunnels stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

start_tunnel() {
    local name="$1"
    local port="$2"
    local logfile="$LOG_DIR/${name}.log"
    cloudflared tunnel --url "http://localhost:${port}" >"$logfile" 2>&1 &
    PIDS+=($!)
}

echo "🚀 Starting tunnels for backend (8000), chatbot (8002), vision (8003)..."
start_tunnel backend 8000
start_tunnel chatbot 8002
start_tunnel vision 8003

echo "⏳ Waiting for Cloudflare to assign URLs (usually ~5-10s)..."

extract_url() {
    local logfile="$1"
    local attempt=0
    while [ $attempt -lt 30 ]; do
        local url
        url=$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$logfile" 2>/dev/null | head -n1)
        if [ -n "$url" ]; then
            echo "$url"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    echo ""
}

BACKEND_URL=$(extract_url "$LOG_DIR/backend.log")
CHATBOT_URL=$(extract_url "$LOG_DIR/chatbot.log")
VISION_URL=$(extract_url "$LOG_DIR/vision.log")

if [ -z "$BACKEND_URL" ] || [ -z "$CHATBOT_URL" ] || [ -z "$VISION_URL" ]; then
    echo "⚠️  One or more tunnel URLs didn't show up in time. Check the logs in $LOG_DIR/"
    echo "   (Make sure backend/chatbot/vision are actually running locally first — see start_all.sh)"
fi

echo ""
echo "✨ Tunnel URLs:"
echo "   Backend:  ${BACKEND_URL:-<not ready yet>}"
echo "   Chatbot:  ${CHATBOT_URL:-<not ready yet>}"
echo "   Vision:   ${VISION_URL:-<not ready yet>}"
echo ""

if [ -n "$BACKEND_URL" ] && [ -n "$CHATBOT_URL" ] && [ -n "$VISION_URL" ]; then
    if [ -f "$MOBILE_ENV" ]; then
        cp "$MOBILE_ENV" "$MOBILE_ENV.bak"
        grep -v -E '^EXPO_PUBLIC_(API|CHATBOT|VISION)_URL=' "$MOBILE_ENV.bak" > "$MOBILE_ENV" || true
    fi
    {
        echo "EXPO_PUBLIC_API_URL=${BACKEND_URL}"
        echo "EXPO_PUBLIC_CHATBOT_URL=${CHATBOT_URL}"
        echo "EXPO_PUBLIC_VISION_URL=${VISION_URL}"
    } >> "$MOBILE_ENV"
    echo "✅ Wrote all three URLs into mobile/.env (previous version backed up to mobile/.env.bak)."
    echo "   Now run: cd mobile && npx expo start --clear"
fi

echo ""
echo "Press [Ctrl+C] to stop all tunnels."
wait
