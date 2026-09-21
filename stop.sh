#!/usr/bin/env bash
# ==============================================================================
# UrbanTwin - Stop Services Script (Bash)
# ==============================================================================

echo "Stopping UrbanTwin services on ports 5173, 8082, 5001, 5000..."

for port in 5173 8082 5001 5000; do
    pid=$(lsof -ti tcp:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "  - Stopping PID $pid on port $port"
        kill -9 $pid 2>/dev/null || true
    fi
done

echo "All UrbanTwin services stopped."
