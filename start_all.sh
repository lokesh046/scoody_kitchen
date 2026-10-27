#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🐾 =========================================="
echo "🐾 Starting Scooby's Kitchen Platform"
echo "🐾 =========================================="

# 1. Start Redis if not already running on port 6379
if ! nc -z 127.0.0.1 6379 2>/dev/null; then
    echo "📦 Starting Redis Server on port 6379..."
    if command -v brew >/dev/null 2>&1 && brew services list | grep -q redis; then
        brew services start redis
    elif command -v redis-server >/dev/null 2>&1; then
        redis-server --daemonize yes
    else
        echo "⚠️  Redis not found on port 6379. Some features (caching/pubsub) may run in fallback mode."
    fi
else
    echo "✅ Redis is already running on port 6379."
fi

# Track child PIDs for clean exit on Ctrl+C
PIDS=()

cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null
    echo "👋 All services stopped cleanly."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 2. Start Core Backend (Port 8000)
echo "🚀 [1/6] Starting Backend on http://127.0.0.1:8000 ..."
(cd "$PROJECT_ROOT/pet-platform-backend" && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
PIDS+=($!)

# 3. Start MCP Server (Port 8001)
echo "🚀 [2/6] Starting FastMCP Server on http://127.0.0.1:8001 ..."
(cd "$PROJECT_ROOT/pet-platform-mcp-server" && .venv/bin/python main.py) &
PIDS+=($!)

# 4. Start ML Inference Service (Port 8010) — chatbot-service's embedder.py
# calls this over HTTP for every RAG embedding (see its module docstring);
# started before Chatbot Service below so the dependency is up first. Without
# it, chatbot-service silently falls back to all-zero embedding vectors on
# every query (embedder.py's exception path), which then score near-zero
# against every document regardless of topic and never clear the similarity
# threshold — the chatbot looks like it's ignoring the knowledge base
# entirely, for every question, not just a specific topic.
echo "🚀 [3/6] Starting ML Inference Service on http://127.0.0.1:8010 ..."
(cd "$PROJECT_ROOT/ml-inference-service" && .venv/bin/python main.py) &
PIDS+=($!)

# 5. Start Chatbot Service (Port 8002)
echo "🚀 [4/6] Starting AI Chatbot Service on http://127.0.0.1:8002 ..."
(cd "$PROJECT_ROOT/chatbot-service" && .venv/bin/python main.py) &
PIDS+=($!)

# 6. Start Pet Vision Service (Port 8003)
echo "🚀 [5/6] Starting Pet Vision Service on http://127.0.0.1:8003 ..."
(cd "$PROJECT_ROOT/pet-vision-service" && .venv/bin/python main.py) &
PIDS+=($!)

# 7. Start Frontend Web App (Port 3000)
echo "🚀 [6/6] Starting Frontend on http://localhost:3000 ..."
(cd "$PROJECT_ROOT/frontend" && npm run dev) &
PIDS+=($!)

echo ""
echo "✨ All services launched!"
echo "   - Frontend:    http://localhost:3000"
echo "   - Backend API: http://localhost:8000 (Docs: http://localhost:8000/docs)"
echo "   - MCP Server:  http://localhost:8001/sse"
echo "   - ML Inference: http://localhost:8010/health"
echo "   - Chatbot:     http://localhost:8002 (Docs: http://localhost:8002/docs)"
echo "   - Pet Vision:  http://localhost:8003 (Docs: http://localhost:8003/docs)"
echo ""
echo "Press [Ctrl+C] to gracefully stop all services."

# Wait for all background jobs to finish
wait
