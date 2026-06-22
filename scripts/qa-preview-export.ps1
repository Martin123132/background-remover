$ErrorActionPreference = "Stop"

. "$PSScriptRoot\env.ps1"

$qaUrl = if ($env:BACKGROUND_REMOVER_QA_URL) {
  $env:BACKGROUND_REMOVER_QA_URL
} else {
  "http://127.0.0.1:5175/"
}

$serverProcess = $null
$serverLog = Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.log"
$serverErr = Join-Path $script:ProjectRoot ".tmp\qa-preview-export-server.err.log"

function Test-QAUrl {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $qaUrl -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

try {
  if (-not (Test-QAUrl)) {
    $serverProcess = Start-Process `
      -FilePath "npm.cmd" `
      -ArgumentList @("run", "dev", "--", "--port", "5175") `
      -WorkingDirectory $script:ProjectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $serverLog `
      -RedirectStandardError $serverErr `
      -PassThru

    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-QAUrl)) {
      if ((Get-Date) -gt $deadline) {
        throw "Timed out waiting for QA server at $qaUrl. See $serverLog and $serverErr."
      }
      Start-Sleep -Milliseconds 500
    }
  }

  node (Join-Path $script:ProjectRoot "scripts\qa-preview-export.mjs")
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
