$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $appDir
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Install Python 3.11 and the Windows Python launcher, then try again.' }
& py -3.11 -m venv .venv311
if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python 3.11 environment. Install Python 3.11 and try again.' }
$venvPython = Join-Path $appDir '.venv311\Scripts\python.exe'
& $venvPython -m pip install --index-url 'https://pypi.org/simple' -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Could not install DevSight dependencies.' }
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
Write-Host ''
Write-Host 'Setup complete. Add your own GEMINI_API_KEY to .env for Gemma analysis.' -ForegroundColor Green
Write-Host 'Run .\run.ps1 to start DevSight AI.'
