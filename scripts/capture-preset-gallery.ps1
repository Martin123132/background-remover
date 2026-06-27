$ErrorActionPreference = "Stop"

. "$PSScriptRoot\env.ps1"
. "$PSScriptRoot\app-server.ps1"

$previousQaUrl = $env:BACKGROUND_REMOVER_QA_URL
$hasExplicitQaUrl = -not [string]::IsNullOrWhiteSpace($env:BACKGROUND_REMOVER_QA_URL)
$demoUrl = if ($hasExplicitQaUrl) {
  $env:BACKGROUND_REMOVER_QA_URL
} else {
  Resolve-BackgroundRemoverLocalUrl -PreferredUrl "http://127.0.0.1:5175/"
}

$serverProcess = $null
$serverLog = Join-Path $script:ProjectRoot ".tmp\preset-gallery-server.log"
$serverErr = Join-Path $script:ProjectRoot ".tmp\preset-gallery-server.err.log"

try {
  if (-not (Test-BackgroundRemoverUrl -Url $demoUrl)) {
    if ($hasExplicitQaUrl) {
      throw "Configured BACKGROUND_REMOVER_QA_URL does not serve Background Remover: $demoUrl"
    }

    $serverProcess = Start-BackgroundRemoverDevServer -Url $demoUrl -StdOutPath $serverLog -StdErrPath $serverErr

    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-BackgroundRemoverUrl -Url $demoUrl)) {
      if ((Get-Date) -gt $deadline) {
        throw "Timed out waiting for preset gallery server at $demoUrl. See $serverLog and $serverErr."
      }
      Start-Sleep -Milliseconds 500
    }
  }

  $env:BACKGROUND_REMOVER_QA_URL = $demoUrl
  node (Join-Path $script:ProjectRoot "scripts\capture-preset-gallery.mjs")
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
