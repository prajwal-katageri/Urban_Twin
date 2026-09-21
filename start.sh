#!/usr/bin/env bash
# ==============================================================================
# UrbanTwin - Predictive Urban Digital Twin Launcher (Bash)
# Runs Simulation Engine (5001), Spring Boot Backend (8082), and React Frontend (5173)
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==============================================================================="
echo "  UrbanTwin - Predictive Urban Digital Twin Launcher (Bash/Linux/macOS)"
echo "==============================================================================="

# 1. Prerequisites
echo "[1/4] Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo >&2 "[ERROR] Node.js is required. Aborting."; exit 1; }
command -v java >/dev/null 2>&1 || { echo >&2 "[ERROR] Java 17+ is required. Aborting."; exit 1; }
command -v mvn >/dev/null 2>&1 || { echo >&2 "[ERROR] Maven is required. Aborting."; exit 1; }

# Python detection
PYTHON_BIN=""
if [ -f "$ROOT_DIR/simulation-engine/.venv/bin/python" ]; then
    PYTHON_BIN="$ROOT_DIR/simulation-engine/.venv/bin/python"
elif [ -f "$ROOT_DIR/simulation-engine/.venv/Scripts/python.exe" ]; then
    PYTHON_BIN="$ROOT_DIR/simulation-engine/.venv/Scripts/python.exe"
elif command -v uv >/dev/null 2>&1; then
    echo "Creating virtualenv with uv in simulation-engine..."
    (cd "$ROOT_DIR/simulation-engine" && uv venv .venv && uv pip install -r requirements.txt)
    PYTHON_BIN="$ROOT_DIR/simulation-engine/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
    echo >&2 "[ERROR] Python 3.10+ is required. Aborting."
    exit 1
fi

echo "  - Node.js: $(node -v)"
echo "  - Java: $(java -version 2>&1 | head -n 1)"
echo "  - Maven: $(mvn -v | head -n 1)"
echo "  - Python: $PYTHON_BIN"

# 2. Dependencies
echo ""
echo "[2/4] Verifying dependencies..."
if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "  - Running npm install..."
    npm install
else
    echo "  - Frontend node_modules found."
fi

# 3. Environment Variables for Spring Boot
export POSTGRES_JDBC_URL="${POSTGRES_JDBC_URL:-jdbc:postgresql://ep-snowy-darkness-b3g2skxt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require}"
export POSTGRES_USER="${POSTGRES_USER:-neondb_owner}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-npg_4nGMfFDJ1oXe}"
export FLASK_SIM_URL="${FLASK_SIM_URL:-http://localhost:5001}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://localhost:5173}"

# 4. Process cleanup on termination
cleanup() {
    echo ""
    echo "[UrbanTwin] Shutting down all services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 5. Launch Services
echo ""
echo "[3/4] Launching microservices..."

# Service 1: Simulation Engine
echo "  - Starting Flask Simulation Engine on port 5001..."
(cd "$ROOT_DIR/simulation-engine" && "$PYTHON_BIN" app.py) &
SIM_PID=$!

# Service 2: Spring Boot Backend
echo "  - Starting Spring Boot Backend on port 8082..."
(cd "$ROOT_DIR/springboot-backend" && mvn spring-boot:run -q) &
SPRING_PID=$!

# Service 3: Frontend
echo "  - Starting Vite React Frontend on port 5173..."
(npm run dev) &
FRONTEND_PID=$!

echo ""
echo "==============================================================================="
echo "  UrbanTwin Services Running!"
echo "  Frontend Dashboard:    http://localhost:5173"
echo "  Spring Boot Backend:   http://localhost:8082/api"
echo "  Simulation Engine:     http://localhost:5001"
echo "  Database:              Neon Cloud PostgreSQL"
echo "==============================================================================="
echo "Press Ctrl+C to terminate all services."

# Wait for background jobs
wait
