<#
.SYNOPSIS
    UrbanTwin - Stop all running services
#>
Set-Location $PSScriptRoot
Write-Host "Stopping UrbanTwin services on ports 5173, 8082, 5001, 5000..." -ForegroundColor Yellow

$ports = @(5173, 8082, 5001, 5000)

foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $procId = $conn.OwningProcess
                if ($procId -gt 0) {
                    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "  - Stopping process $($proc.ProcessName) (PID: $procId) on port $port" -ForegroundColor Cyan
                        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    } catch {
        # Ignore individual lookup errors
    }
}

Write-Host "All UrbanTwin services stopped." -ForegroundColor Green
