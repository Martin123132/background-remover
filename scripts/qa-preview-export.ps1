$ErrorActionPreference = "Stop"

. "$PSScriptRoot\env.ps1"
. "$PSScriptRoot\app-server.ps1"

$previousQaUrl = $env:BACKGROUND_REMOVER_QA_URL
$hasExplicitQaUrl = -not [string]::IsNullOrWhiteSpace($env:BACKGROUND_REMOVER_QA_URL)
$qaUrl = if ($hasExplicitQaUrl) {
  $env:BACKGROUND_REMOVER_QA_URL
} else {
  Resolve-BackgroundRemoverLocalUrl -PreferredUrl "http://127.0.0.1:5175/"
}

$serverProcess = $null
$serverLog = Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.log"
$serverErr = Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.err.log"

try {
  if (-not (Test-BackgroundRemoverUrl -Url $qaUrl)) {
    if ($hasExplicitQaUrl) {
      throw "Configured BACKGROUND_REMOVER_QA_URL does not serve Background Remover: $qaUrl"
    }

    $serverProcess = Start-BackgroundRemoverDevServer -Url $qaUrl -StdOutPath $serverLog -StdErrPath $serverErr

    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-BackgroundRemoverUrl -Url $qaUrl)) {
      if ((Get-Date) -gt $deadline) {
        throw "Timed out waiting for QA server at $qaUrl. See $serverLog and $serverErr."
      }
      Start-Sleep -Milliseconds 500
    }
  }

  $env:BACKGROUND_REMOVER_QA_URL = $qaUrl
  node (Join-Path $script:ProjectRoot "scripts\qa-preview-export.mjs")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($null -eq $previousQaUrl) {
    Remove-Item Env:\BACKGROUND_REMOVER_QA_URL -ErrorAction SilentlyContinue
  } else {
    $env:BACKGROUND_REMOVER_QA_URL = $previousQaUrl
  }

  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
