@echo off
setlocal EnableDelayedExpansion

title UrbanTwin - Predictive Urban Digital Twin Launcher
color 0B

echo ===============================================================================
echo   _    _      _                   _______          _         
echo  ^| ^|  ^| ^|    ^| ^|                 ^|__   __^|        (_)        
echo  ^| ^|  ^| ^|____^| ^|__   __ _ _ __     ^| ^|_      ___ _ _ __   
echo  ^| ^|  ^| ^| '__^| '_ \ / _` ^| '_ \    ^| \ \ /\ / / ^| '_ \  
echo  ^| ^|__^| ^| ^|  ^| ^|_) ^| (_^| ^| ^| ^| ^|   ^| ^|\ V  V /^| ^| ^| ^| ^| 
echo   \____/^|_^|  ^|_.__/ \__,_^|_^| ^|_^|   ^|_^| \_/\_/ ^|_^|_^| ^|_^| 
echo.
echo   Predictive Urban Digital Twin for Disaster Resilience & Infrastructure
echo ===============================================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM ---------------------------------------------------------------------------
REM 1. Prerequisites Check
REM ---------------------------------------------------------------------------
echo [1/4] Checking prerequisites...

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  - Node.js: %NODE_VER% (OK)

REM Check Java
where java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java JDK is not installed or not in PATH.
    echo Please install Java 17+ or 21 (Eclipse Adoptium / OpenJDK).
    pause
    exit /b 1
)
echo  - Java JDK: Detected (OK)

REM Check Maven
where mvn >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Apache Maven is not installed or not in PATH.
    echo Please install Apache Maven from https://maven.apache.org/
    pause
    exit /b 1
)
echo  - Maven: Detected (OK)

REM Detect Python executable (prefer simulation-engine\.venv, fallback to uv, py, python)
set PYTHON_EXE=
if exist "%ROOT_DIR%simulation-engine\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT_DIR%simulation-engine\.venv\Scripts\python.exe"
    echo  - Python: Using virtual environment (%PYTHON_EXE%)
) else (
    where uv >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo  - Python: uv detected. Creating virtualenv for simulation-engine...
        cd /d "%ROOT_DIR%simulation-engine"
        uv venv .venv
        uv pip install -r requirements.txt
        set "PYTHON_EXE=%ROOT_DIR%simulation-engine\.venv\Scripts\python.exe"
        cd /d "%ROOT_DIR%"
    ) else (
        where py >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            set "PYTHON_EXE=py"
            echo  - Python: Using py launcher
        ) else (
            where python >nul 2>&1
            if %ERRORLEVEL% EQU 0 (
                set "PYTHON_EXE=python"
                echo  - Python: Using system python
            ) else (
                echo [ERROR] Python 3.10+ is not found.
                echo Please install Python from https://www.python.org/ or install uv.
                pause
                exit /b 1
            )
        )
    )
)

echo.
REM ---------------------------------------------------------------------------
REM 2. Dependencies Check
REM ---------------------------------------------------------------------------
echo [2/4] Verifying dependencies...

if not exist "%ROOT_DIR%node_modules" (
    echo  - Installing frontend npm dependencies...
    call npm install
) else (
    echo  - Frontend dependencies: node_modules found (OK)
)

echo.
REM ---------------------------------------------------------------------------
REM 3. Starting Services
REM ---------------------------------------------------------------------------
echo [3/4] Launching UrbanTwin Microservices...

REM 1. Simulation Engine (Python Flask - Port 5001)
echo  - Starting Flask Simulation Engine on port 5001...
start "UrbanTwin - Simulation Engine [Port 5001]" cmd /k "cd /d ""%ROOT_DIR%simulation-engine"" && title UrbanTwin Simulation Engine [Port 5001] && ""%PYTHON_EXE%"" app.py"

REM 2. Flask Backend (Python - Port 5000)
echo  - Starting Flask Backend on port 5000...
start "UrbanTwin - Flask Backend [Port 5000]" cmd /k "cd /d ""%ROOT_DIR%backend"" && title UrbanTwin Flask Backend [Port 5000] && ""%PYTHON_EXE%"" app.py"

REM 3. Frontend Vite Server (React - Port 5173)
echo  - Starting Vite React Frontend on port 5173...
start "UrbanTwin - Frontend [Port 5173]" cmd /k "cd /d ""%ROOT_DIR%"" && title UrbanTwin Frontend [Port 5173] && npm run dev"

echo.
REM ---------------------------------------------------------------------------
REM 4. System Status & Control Menu
REM ---------------------------------------------------------------------------
echo ===============================================================================
echo   All UrbanTwin services are launching in dedicated console windows:
echo.
echo   [1] Frontend UI:         http://localhost:5173
echo   [2] Flask API:           http://localhost:5000/api
echo   [3] Simulation Engine:   http://localhost:5001
echo   [4] Database:            Neon Cloud PostgreSQL (Pre-configured)
echo ===============================================================================
echo.

:menu
echo Choose an option:
echo  [1] Open UrbanTwin in Default Browser
echo  [2] Open Spring Boot Health Check (http://localhost:8082/api/health)
echo  [3] Open Simulation Engine Health Check (http://localhost:5001/health)
echo  [4] Stop all UrbanTwin services (Kill ports 5173, 8082, 5001)
echo  [Q] Exit this launcher (Services remain running in their windows)
echo.
set /p CHOICE="Enter choice [1-4, Q]: "

if /i "%CHOICE%"=="1" (
    start http://localhost:5173
    goto menu
)
if /i "%CHOICE%"=="2" (
    start http://localhost:8082/api/health
    goto menu
)
if /i "%CHOICE%"=="3" (
    start http://localhost:5001/health
    goto menu
)
if /i "%CHOICE%"=="4" (
    call "%ROOT_DIR%stop.bat"
    goto menu
)
if /i "%CHOICE%"=="Q" (
    echo Exiting launcher. Services are still active.
    exit /b 0
)

echo Invalid selection, please try again.
goto menu
