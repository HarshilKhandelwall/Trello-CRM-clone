@echo off
title Trello CRM - Production Server
color 0A

echo.
echo  ==========================================
echo   Trello CRM Clone - Production Startup
echo  ==========================================
echo.

REM ── Set environment variables ─────────────────────────────────────────────
set DJANGO_DEBUG=False
set DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
set DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:8000
set DJANGO_CHANNEL_BACKEND=memory
set DJANGO_DB_ENGINE=django.db.backends.sqlite3
set DJANGO_SECRET_KEY=FvXjWCHZHFozmAd4rt7WKrXoE84AuZvZappmsdVLvJzqeyjNDmXyD-J8YCLcB5AXE64

REM ── Step 1: Build React frontend ──────────────────────────────────────────
echo [1/3] Building React frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo.
    echo  ERROR: React build failed.
    pause
    exit /b 1
)
cd ..
echo  React build complete.
echo.

REM ── Step 2: Collect Django static files ───────────────────────────────────
echo [2/3] Collecting static files...
cd backend
venv\Scripts\python manage.py collectstatic --noinput
echo  Static files collected.
echo.

REM ── Step 3: Start Daphne ASGI server ──────────────────────────────────────
echo [3/3] Starting production server...
echo.
echo  ==========================================
echo   App running at http://localhost:8000
echo   Press Ctrl+C to stop
echo  ==========================================
echo.
venv\Scripts\daphne -b 0.0.0.0 -p 8000 config.asgi:application
