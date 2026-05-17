# Run PowerShell as Administrator once — allows phones on LAN/VPN to reach cloud-run :8080
$ErrorActionPreference = "Stop"
$port = 8080
$ruleName = "AEGIS Cloud Run $port"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $ruleName"
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port
  Write-Host "Created inbound allow rule for TCP $port"
}

Write-Host ""
Write-Host "Test from phone browser (same Wi-Fi or Tailscale):"
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '10.*' -or $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
if ($ip) {
  Write-Host "  http://${ip}:$port/health"
} else {
  Write-Host "  http://YOUR_PC_IP:$port/health"
}
