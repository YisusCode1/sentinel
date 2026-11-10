#!/usr/bin/env bash
set -e

echo "==================================================="
echo "       SENTINEL - ONE-CLICK LOCAL DEPLOYMENT"
echo "==================================================="
echo ""

if [ ! -f ".env" ]; then
    echo "[*] .env not found. Creating default from .env.example..."
    cp ".env.example" ".env"
    echo "[*] Created .env file. You can configure GEMINI_API_KEY there anytime."
fi

echo "[*] Starting all Sentinel services with Docker Compose..."
echo "[*] Services:"
echo "    - Database:   PostgreSQL (port 5432)"
echo "    - AI Engine:  FastAPI + Gemini (port 8002)"
echo "    - Backend:    FastAPI Security Gateway (port 8001)"
echo "    - Frontend:   React + Vite UI (port 5173)"
echo ""

docker compose up --build
