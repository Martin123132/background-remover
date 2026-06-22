$ErrorActionPreference = "Stop"

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not $script:ProjectRoot.StartsWith("D:\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Project root must be on D:. Current root: $script:ProjectRoot"
}

$cacheRoot = Join-Path $script:ProjectRoot ".cache"
$tmpRoot = Join-Path $script:ProjectRoot ".tmp"

New-Item -ItemType Directory -Force -Path `
  $cacheRoot, `
  (Join-Path $cacheRoot "npm"), `
  (Join-Path $cacheRoot "pip"), `
  (Join-Path $cacheRoot "models"), `
  $tmpRoot, `
  (Join-Path $script:ProjectRoot "outputs") | Out-Null

$env:npm_config_cache = Join-Path $cacheRoot "npm"
$env:NPM_CONFIG_CACHE = Join-Path $cacheRoot "npm"
$env:PIP_CACHE_DIR = Join-Path $cacheRoot "pip"
$env:XDG_CACHE_HOME = $cacheRoot
$env:HF_HOME = Join-Path $cacheRoot "huggingface"
$env:ORT_CACHE_DIR = Join-Path $cacheRoot "onnxruntime"
$env:TEMP = $tmpRoot
$env:TMP = $tmpRoot
$env:VITE_BG_ASSET_PATH = "/models/background-removal/"

Set-Location $script:ProjectRoot
