@echo off
setlocal EnableDelayedExpansion

title UrbanTwin - Stopping Services
cd /d "%~dp0"
echo ===============================================================================
echo   Stopping UrbanTwin Services on Ports 5173, 8082, 5001, 5000...
echo ===============================================================================
echo.

set PORTS=5173 8082 5001 5000

for %%P in (%PORTS%) do (
    echo Checking port %%P...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%P "') do (
        set PID=%%a
        if not "!PID!"=="0" (
            echo  - Killing PID !PID! on port %%P...
            taskkill /f /pid !PID! >nul 2>&1
        )
    )
)

echo.
echo [UrbanTwin] All services stopped cleanly.
echo.
pause
