# Start Aegis API so phones on your LAN can connect (listen on all interfaces).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$port = 8000
if (Test-Path ".env") {
    foreach ($line in Get-Content ".env") {
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') {
            $port = [int]$Matches[1]
            break
        }
    }
}

Write-Host "Starting Aegis on 0.0.0.0:$port (phones use this PC's Wi-Fi IPv4, not 127.0.0.1)"
python -m uvicorn main:app --host 0.0.0.0 --port $port --reload
