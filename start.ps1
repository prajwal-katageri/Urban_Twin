<#
.SYNOPSIS
    UrbanTwin - Predictive Urban Digital Twin Launcher for PowerShell
.DESCRIPTION
    Launches the Python Flask Simulation Engine (port 5001), Spring Boot Backend (port 8082),
    and Vite React Frontend (port 5173).
.PARAMETER Mode
    Specify which components to run: 'All' (default), 'Backend', 'Frontend', or 'Simulation'.
.PARAMETER OpenBrowser
    Switch to automatically open the frontend in the default browser.
.EXAMPLE
    .\start.ps1
.EXAMPLE
    .\start.ps1 -Mode All -OpenBrowser
#>
[CmdletBinding()]
param (
    [ValidateSet("All", "Backend", "Frontend", "Simulation")]
    [string]$Mode = "All",
    [switch]$OpenBrowser
)

$RootDir = $PSScriptRoot
Set-Location $RootDir

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  UrbanTwin - Predictive Urban Digital Twin Launcher (PowerShell)" -ForegroundColor Cyan
Write-Host "  Disaster Resilience & Infrastructure Predictive Modeling" -ForegroundColor DarkCyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Prerequisites Check
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

# Node.js check
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (node -v).Trim()
    Write-Host "  - Node.js: $nodeVer" -ForegroundColor Green
} else {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# Java check
if (Get-Command java -ErrorAction SilentlyContinue) {
    $javaVer = (java -version 2>&1 | Select-Object -First 1)
    Write-Host "  - Java: $javaVer" -ForegroundColor Green
} else {
    Write-Error "Java JDK is not installed or not in PATH. Please install JDK 17+ or 21."
    exit 1
}

# Maven check
if (Get-Command mvn -ErrorAction SilentlyContinue) {
    $mvnVer = (mvn -v 2>&1 | Select-Object -First 1)
    Write-Host "  - Maven: $mvnVer" -ForegroundColor Green
} else {
    Write-Error "Maven is not installed or not in PATH. Please install Apache Maven."
    exit 1
}

# Python check
$simVenvPython = Join-Path $RootDir "simulation-engine\.venv\Scripts\python.exe"
$pythonExe = ""

if (Test-Path $simVenvPython) {
    $pythonExe = $simVenvPython
    Write-Host "  - Python: Using simulation-engine virtual environment ($pythonExe)" -ForegroundColor Green
} elseif (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Host "  - Python: uv found. Setting up simulation-engine virtual environment..." -ForegroundColor Yellow
    Push-Location (Join-Path $RootDir "simulation-engine")
    uv venv .venv
    uv pip install -r requirements.txt
    Pop-Location
    $pythonExe = $simVenvPython
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
    Write-Host "  - Python: Using system 'py' launcher" -ForegroundColor Green
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = "python"
    Write-Host "  - Python: Using system 'python'" -ForegroundColor Green
} else {
    Write-Error "Python 3.10+ is required. Please install Python or uv."
    exit 1
}

Write-Host ""
# 2. Dependencies Check
Write-Host "[2/4] Verifying dependencies..." -ForegroundColor Yellow
$nodeModulesPath = Join-Path $RootDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  - Installing frontend npm dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  - Frontend dependencies: node_modules found" -ForegroundColor Green
}

Write-Host ""
# 3. Starting Services
Write-Host "[3/4] Launching microservices (Mode: $Mode)..." -ForegroundColor Yellow

if ($Mode -eq "All" -or $Mode -eq "Simulation") {
    Write-Host "  - Starting Flask Simulation Engine (port 5001)..." -ForegroundColor Cyan
    $simDir = Join-Path $RootDir "simulation-engine"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k title UrbanTwin Simulation Engine [Port 5001] && cd /d `"$simDir`" && `"$pythonExe`" app.py"
}

if ($Mode -eq "All" -or $Mode -eq "Backend") {
    Write-Host "  - Starting Flask Backend (port 5000)..." -ForegroundColor Cyan
    $backendDir = Join-Path $RootDir "backend"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k title UrbanTwin Flask Backend [Port 5000] && cd /d `"$backendDir`" && `"$pythonExe`" app.py"
}

if ($Mode -eq "All" -or $Mode -eq "Frontend") {
    Write-Host "  - Starting Vite React Frontend (port 5173)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k title UrbanTwin Frontend [Port 5173] && cd /d `"$RootDir`" && npm run dev"
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  UrbanTwin Services Launched Successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend Dashboard:    http://localhost:5173" -ForegroundColor White
Write-Host "  Flask Backend:         http://localhost:5000/api" -ForegroundColor White
Write-Host "  Simulation Engine:     http://localhost:5001" -ForegroundColor White
Write-Host "  Database:              Neon Cloud PostgreSQL (Pre-configured)" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""

if ($OpenBrowser) {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5173"
}

Write-Host "Tip: Run '.\stop.ps1' or '.\stop.bat' to terminate all services when done." -ForegroundColor DarkGray
