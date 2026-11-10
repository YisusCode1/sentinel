@echo off
setlocal

echo ===================================================
echo        SENTINEL - ONE-CLICK LOCAL DEPLOYMENT
echo ===================================================
echo.

if not exist ".env" (
    echo [*] .env not found. Creating default from .env.example...
    copy ".env.example" ".env" >nul
    echo [*] Created .env file. You can configure GEMINI_API_KEY there anytime.
)

echo [*] Starting all Sentinel services with Docker Compose...
echo [*] Services:
echo     - Database:   PostgreSQL (port 5432)
echo     - AI Engine:  FastAPI + Gemini (port 8002)
echo     - Backend:    FastAPI Security Gateway (port 8001)
echo     - Frontend:   React + Vite UI (port 5173)
echo.

docker compose up --build
