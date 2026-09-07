@echo off
title SAT-THERM INTELLIGENCE Launcher
echo ===============================================================================
echo   🛰️ SAT-THERM INTELLIGENCE — Smart India Hackathon Prototype Launcher
echo ===============================================================================
echo.
echo [1/3] Starting Python FastAPI ML Service on port 8000...
start "SAT-THERM: ML Service (Port 8000)" cmd /k "cd /d %~dp0ml-service && ..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Node.js Express Backend on port 5000...
start "SAT-THERM: Express Backend (Port 5000)" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 2 /nobreak >nul

echo [3/3] Starting React + Vite GIS Frontend on port 5173...
start "SAT-THERM: Vite Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===============================================================================
echo   ✅ All 3 tiers launched in separate console windows:
echo      • React GIS Frontend:  http://localhost:5173
echo      • Node.js Backend API: http://localhost:5000/api/health
echo      • FastAPI ML Service:  http://localhost:8000/docs
echo ===============================================================================
echo Press any key to exit this launcher window (services will stay running).
pause >nul
