$ErrorActionPreference = "Stop"

. "$PSScriptRoot\env.ps1"

$demoUrl = if ($env:BACKGROUND_REMOVER_QA_URL) {
  $env:BACKGROUND_REMOVER_QA_URL
} else {
  "http://127.0.0.1:5175/"
}

$serverProcess = $null
$serverLog = Join-Path $script:ProjectRoot ".tmp\demo-capture-server.log"
$serverErr = Join-Path $script:ProjectRoot ".tmp\demo-capture-server.err.log"

function Test-DemoUrl {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $demoUrl -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

try {
  if (-not (Test-DemoUrl)) {
    $serverProcess = Start-Process `
      -FilePath "npm.cmd" `
      -ArgumentList @("run", "dev", "--", "--port", "5175") `
      -WorkingDirectory $script:ProjectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $serverLog `
      -RedirectStandardError $serverErr `
      -PassThru

    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-DemoUrl)) {
      if ((Get-Date) -gt $deadline) {
        throw "Timed out waiting for demo server at $demoUrl. See $serverLog and $serverErr."
      }
      Start-Sleep -Milliseconds 500
    }
  }

  node (Join-Path $script:ProjectRoot "scripts\capture-demo.mjs")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
