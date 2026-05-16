# Stop whatever holds cloud-run PORT, then start dev server.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$port = 8080
if (Test-Path ".env") {
  foreach ($line in Get-Content ".env") {
    if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') {
      $port = [int]$Matches[1]
      break
    }
  }
}

$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $pid = $conn.OwningProcess
  Write-Host "Stopping process on port $port (PID $pid)..."
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

Write-Host "Starting cloud-run on 0.0.0.0:$port ..."
npm run dev
