#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

echo "🐾 Starting Scooby's Kitchen Services..."

# 1. Start Backend FastAPI (Port 8000)
echo "🚀 [1/6] Starting Backend API (Port 8000)..."
(cd "$PROJECT_ROOT/pet-platform-backend" && \
  nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &)

# 2. Start Celery Worker & Beat
echo "⚙️  [2/6] Starting Celery Worker & Scheduler..."
(cd "$PROJECT_ROOT/pet-platform-backend" && \
  nohup .venv/bin/celery -A app.core.celery_app worker -B --loglevel=info > "$LOG_DIR/celery.log" 2>&1 &)

# 3. Start MCP Server (Port 8001)
echo "🤖 [3/6] Starting Pet Platform MCP Server (Port 8001)..."
(cd "$PROJECT_ROOT/pet-platform-mcp-server" && \
  nohup python3 main.py > "$LOG_DIR/mcp.log" 2>&1 &)

# 4. Start Chatbot AI Service (Port 8002)
echo "💬 [4/6] Starting Chatbot AI Service (Port 8002)..."
(cd "$PROJECT_ROOT/chatbot-service" && \
  nohup .venv/bin/python main.py > "$LOG_DIR/chatbot.log" 2>&1 &)

# 5. Start Pet Vision AI Service (Port 8003)
echo "📷 [5/6] Starting Pet Vision AI Service (Port 8003)..."
(cd "$PROJECT_ROOT/pet-vision-service" && \
  nohup .venv/bin/python main.py > "$LOG_DIR/vision.log" 2>&1 &)

# 6. Start Web Frontend (Port 5173)
echo "🌐 [6/6] Starting Web Frontend (Port 5173)..."
(cd "$PROJECT_ROOT/frontend" && \
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &)

echo ""
echo "✅ All Scooby's Kitchen core services have been launched in the background!"
echo "📁 Live logs are saved in: $LOG_DIR"
echo "   - Backend:  tail -f .logs/backend.log"
echo "   - Celery:   tail -f .logs/celery.log"
echo "   - Chatbot:  tail -f .logs/chatbot.log"
echo "   - MCP:      tail -f .logs/mcp.log"
echo "   - Vision:   tail -f .logs/vision.log"
echo "   - Frontend: tail -f .logs/frontend.log"
echo ""
echo "📱 To run the mobile app on Android Emulator, run in your terminal:"
echo "   cd mobile && npx expo start --android"
echo ""
echo "🛑 To stop all servers anytime, run: ./stop_all.sh"
