@echo off
echo ========================================
echo Insightalysis AI - Starting Backend
echo ========================================
echo.

cd /d "%~dp0backend"

echo Starting Flask server...
timeout /t 2 /nobreak

python app.py

pause