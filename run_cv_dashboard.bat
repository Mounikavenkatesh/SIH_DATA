@echo off
echo ==============================================================================
echo   AI Thermal Intelligence - Computer Vision Subsystem Launcher
echo   Satellite Thermal Anomaly Characterization & Hotspot Detection Engine
echo ==============================================================================
echo.

cd /d "%~dp0\cv-module"

if exist "..\.venv\Scripts\streamlit.exe" (
    echo [INFO] Launching Streamlit using local virtual environment...
    ..\.venv\Scripts\streamlit.exe run app.py
) else (
    echo [INFO] Local .venv streamlit not found, falling back to system streamlit...
    streamlit run app.py
)

pause
