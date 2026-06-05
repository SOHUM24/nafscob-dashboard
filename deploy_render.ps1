# Deploy NAFSCOB dashboard to Render via API (optional — or use one-click link in DEPLOY_RENDER.md)
# Get API key: https://dashboard.render.com/u/settings#api-keys
param(
    [string]$ApiKey = $env:RENDER_API_KEY
)

$repo = "https://github.com/SOHUM24/nafscob-dashboard"

if (-not $ApiKey) {
    Write-Host "No RENDER_API_KEY set."
    Write-Host "Option 1 (easiest): open this URL in your browser while logged into Render:"
    Write-Host "  https://render.com/deploy?repo=$repo"
    Write-Host ""
    Write-Host "Option 2: set API key and re-run:"
    Write-Host '  $env:RENDER_API_KEY = "rnd_..."'
    Write-Host "  .\deploy_render.ps1"
    exit 1
}

$body = @{ repo = $repo; branch = "main" } | ConvertTo-Json
$headers = @{
    Authorization = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

try {
    $resp = Invoke-RestMethod -Uri "https://api.render.com/v1/blueprints" -Method Post -Headers $headers -Body $body
    Write-Host "Blueprint created. Check dashboard: https://dashboard.render.com"
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Deploy failed: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    exit 1
}
