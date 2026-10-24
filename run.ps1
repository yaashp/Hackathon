$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $appDir
$baseUrl = 'http://127.0.0.1:8000'

# Reuse an existing DevSight server instead of starting a duplicate.
try {
    $null = Invoke-RestMethod -Uri "$baseUrl/api/status" -TimeoutSec 2
    Write-Host "DevSight AI is already running at $baseUrl/" -ForegroundColor Green
    Write-Host 'Open that address in your browser. This launcher will not start a duplicate server.'
    exit 0
}
catch {
    $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        throw "Port 8000 is already being used by another process (PID $($listener.OwningProcess)), and it did not respond as DevSight AI. Close that process or change the port before starting DevSight."
    }
}

$python = Join-Path $appDir '.venv311\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Run .\setup.ps1 once before starting DevSight AI.' }
Write-Host "Starting DevSight AI at $baseUrl/ ..." -ForegroundColor Cyan
& $python -m uvicorn main:app --host 127.0.0.1 --port 8000
