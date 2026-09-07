#!/usr/bin/env bash

echo "🛑 Stopping all Scooby's Kitchen services..."

# Kill services listening on ports 8000, 8001, 8002, 5173, 8081
fuser -k 8000/tcp 8001/tcp 8002/tcp 8003/tcp 5173/tcp 8081/tcp 3000/tcp 2>/dev/null || true

# Kill background workers & services by process signature
pkill -f "celery -A app.core.celery_app" 2>/dev/null || true
pkill -f "chatbot-service/main.py" 2>/dev/null || true
pkill -f "pet-platform-mcp-server" 2>/dev/null || true
pkill -f "pet-vision-service" 2>/dev/null || true

echo "✅ All Scooby's Kitchen servers and background workers stopped."
