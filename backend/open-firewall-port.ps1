# Run once as Administrator: allow inbound TCP to the dev API port (default 8000).
param([int]$Port = 8080)
$RuleName = "Aegis dev API $Port"
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $RuleName"
    exit 0
}
New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port
Write-Host "Added inbound TCP allow rule for port $Port"
