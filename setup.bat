@echo off
echo ========================================
echo Insightalysis AI - Setup Script
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo [2] Creating required directories...
if not exist "uploads" mkdir uploads
if not exist "models" mkdir models

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the backend:
echo   python app.py
echo.
echo Backend will run on: http://127.0.0.1:5000
echo Frontend will run on: file:///c:/AI-T/index.html
echo.
pause