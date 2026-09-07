# SAT-THERM INTELLIGENCE — Unified PowerShell Launcher
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  🛰️ SAT-THERM INTELLIGENCE — Multi-Tier System Launcher" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Python FastAPI ML Service
Write-Host "[1/3] Starting FastAPI ML Service on port 8000..." -ForegroundColor Yellow
$PythonExe = Join-Path $Root ".venv\Scripts\python.exe"
Start-Process -FilePath $PythonExe -ArgumentList "-m uvicorn app:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory (Join-Path $Root "ml-service")
Start-Sleep -Seconds 2

# 2. Start Node.js Express Backend
Write-Host "[2/3] Starting Node.js Express Backend on port 5000..." -ForegroundColor Green
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory (Join-Path $Root "backend")
Start-Sleep -Seconds 2

# 3. Start React + Vite Frontend
Write-Host "[3/3] Starting React + Vite GIS Frontend on port 5173..." -ForegroundColor Magenta
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory (Join-Path $Root "frontend")

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  ✅ All services launched successfully!" -ForegroundColor Green
Write-Host "     • Frontend Dashboard:   http://localhost:5173" -ForegroundColor White
Write-Host "     • Express Backend API:  http://localhost:5000/api/health" -ForegroundColor White
Write-Host "     • FastAPI ML Swagger:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan
