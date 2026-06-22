$ErrorActionPreference = "Stop"

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not $script:ProjectRoot.StartsWith("D:\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Project root must be on D:. Current root: $script:ProjectRoot"
}

$artifactPaths = @(
  (Join-Path $script:ProjectRoot ".tmp\qa-preview-export"),
  (Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.log"),
  (Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.err.log")
)

foreach ($artifactPath in $artifactPaths) {
  if (Test-Path -LiteralPath $artifactPath) {
    Remove-Item -LiteralPath $artifactPath -Recurse -Force
    Write-Host "Removed $artifactPath"
  }
}

Write-Host "QA artifacts cleaned."
