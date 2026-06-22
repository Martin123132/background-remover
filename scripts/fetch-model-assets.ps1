. "$PSScriptRoot\env.ps1"

$version = "1.7.0"
$assetUrl = "https://staticimgly.com/@imgly/background-removal-data/$version/package.tgz"
$archivePath = Join-Path $script:ProjectRoot ".cache\models\background-removal-data-$version.tgz"
$partialPath = "$archivePath.partial"
$extractRoot = Join-Path $script:ProjectRoot ".tmp\background-removal-data-$version"
$publicPath = Join-Path $script:ProjectRoot "public\models\background-removal"

if ((Test-Path $publicPath) -and ((Get-ChildItem -Path $publicPath -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)) {
  Write-Host "Model assets already exist at $publicPath"
  exit 0
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $archivePath), $extractRoot, $publicPath | Out-Null

if (Test-Path $archivePath) {
  tar -tf $archivePath *> $null
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}

if (-not (Test-Path $archivePath)) {
  if (Test-Path $partialPath) {
    Remove-Item -LiteralPath $partialPath -Force
  }

  Write-Host "Downloading $assetUrl"
  Invoke-WebRequest -Uri $assetUrl -OutFile $partialPath
  Move-Item -LiteralPath $partialPath -Destination $archivePath -Force
}

if (Test-Path $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

tar -xzf $archivePath -C $extractRoot

$distPath = Join-Path $extractRoot "package\dist"
if (-not (Test-Path $distPath)) {
  throw "Expected model asset dist folder was not found: $distPath"
}

Copy-Item -Path (Join-Path $distPath "*") -Destination $publicPath -Recurse -Force
Write-Host "Model assets copied to $publicPath"
