. "$PSScriptRoot\env.ps1"

Write-Host "Installing dependencies with npm cache at $env:npm_config_cache"
npm.cmd install

Write-Host "Fetching self-hosted background-removal model assets"
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\fetch-model-assets.ps1"

Write-Host "Bootstrap complete."
