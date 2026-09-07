#!/usr/bin/env bash
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMULATOR_CMD="$HOME/Android/Sdk/emulator/emulator"

echo "=========================================="
echo "🐾 Scooby's Kitchen - Android App Launcher"
echo "=========================================="

# 1. Check if emulator or physical phone is connected
if ! adb devices | grep -w "device" > /dev/null 2>&1; then
    echo "🚀 Launching Pixel 8 Pro Emulator..."
    nohup "$EMULATOR_CMD" -avd Pixel_8_Pro_API_36 -netdelay none -netspeed full > /dev/null 2>&1 &
    
    echo "⏳ Waiting for emulator to connect..."
    adb wait-for-device
    
    echo "⏳ Waiting for Android OS to finish booting..."
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
    done
    echo "✅ Android Emulator is online and ready!"
else
    echo "✅ Android device/emulator is already connected."
fi

# 2. Set up reverse port tunnels for all microservices
echo "🔌 Bridging microservice ports (adb reverse)..."
adb reverse tcp:8000 tcp:8000 >/dev/null 2>&1 || true  # Backend API
adb reverse tcp:8001 tcp:8001 >/dev/null 2>&1 || true  # MCP Server
adb reverse tcp:8002 tcp:8002 >/dev/null 2>&1 || true  # Chatbot AI
adb reverse tcp:8003 tcp:8003 >/dev/null 2>&1 || true  # Pet Vision AI
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true  # Expo Metro
adb reverse tcp:5173 tcp:5173 >/dev/null 2>&1 || true  # Web Frontend
echo "✅ All service ports bridged (8000, 8001, 8002, 8003, 8081, 5173)."

# 3. Start Expo and open directly on Android
echo "📱 Launching mobile app..."
cd "$PROJECT_ROOT/mobile"
npx expo start --android
