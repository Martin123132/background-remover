. "$PSScriptRoot\env.ps1"

$previousQaUrl = $env:BACKGROUND_REMOVER_QA_URL

try {
  $env:BACKGROUND_REMOVER_QA_URL = "https://martin123132.github.io/background-remover/"
  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "qa-preview-export.ps1")
} finally {
  if ($null -eq $previousQaUrl) {
    Remove-Item Env:\BACKGROUND_REMOVER_QA_URL -ErrorAction SilentlyContinue
  } else {
    $env:BACKGROUND_REMOVER_QA_URL = $previousQaUrl
  }
}
