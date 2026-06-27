$ErrorActionPreference = "Stop"

function Get-AppServerPort {
  param([Parameter(Mandatory = $true)][string]$Url)

  $uri = [System.Uri]$Url
  if (-not $uri.IsDefaultPort) {
    return $uri.Port
  }

  if ($uri.Scheme -eq "https") {
    return 443
  }

  return 80
}

function Test-BackgroundRemoverUrl {
  param([Parameter(Mandatory = $true)][string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 500) {
      return $false
    }

    return $response.Content -match "<title>\s*Background Remover\s*</title>"
  } catch {
    return $false
  }
}

function Find-AvailableLocalPort {
  param(
    [int]$StartPort = 5175,
    [int]$EndPort = 5199
  )

  for ($port = $StartPort; $port -le $EndPort; $port++) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $listener) {
      return $port
    }
  }

  throw "No available local port found between $StartPort and $EndPort."
}

function Set-AppServerPort {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$Port
  )

  $builder = [System.UriBuilder]$Url
  $builder.Port = $Port
  return $builder.Uri.AbsoluteUri
}

function Find-BackgroundRemoverLocalUrl {
  param(
    [Parameter(Mandatory = $true)][string]$PreferredUrl,
    [int]$StartPort = 5175,
    [int]$EndPort = 5199
  )

  for ($port = $StartPort; $port -le $EndPort; $port++) {
    $candidate = Set-AppServerPort -Url $PreferredUrl -Port $port
    if (Test-BackgroundRemoverUrl -Url $candidate) {
      return $candidate
    }
  }

  return $null
}

function Resolve-BackgroundRemoverLocalUrl {
  param([Parameter(Mandatory = $true)][string]$PreferredUrl)

  if (Test-BackgroundRemoverUrl -Url $PreferredUrl) {
    return $PreferredUrl
  }

  $existingUrl = Find-BackgroundRemoverLocalUrl -PreferredUrl $PreferredUrl
  if ($existingUrl) {
    return $existingUrl
  }

  $preferredPort = Get-AppServerPort -Url $PreferredUrl
  $listener = Get-NetTCPConnection -LocalPort $preferredPort -State Listen -ErrorAction SilentlyContinue
  $port = if ($listener) {
    Find-AvailableLocalPort -StartPort ($preferredPort + 1)
  } else {
    $preferredPort
  }

  return Set-AppServerPort -Url $PreferredUrl -Port $port
}

function Start-BackgroundRemoverDevServer {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$StdOutPath,
    [Parameter(Mandatory = $true)][string]$StdErrPath
  )

  $port = Get-AppServerPort -Url $Url
  return Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--port", "$port", "--strictPort") `
    -WorkingDirectory $script:ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdOutPath `
    -RedirectStandardError $StdErrPath `
    -PassThru
}
