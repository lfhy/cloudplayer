# One-command Windows development bootstrap for the Flutter desktop host.
param(
  [string]$ProxyUrl = 'http://192.168.1.36:7897',
  [switch]$SkipPubGet,
  [switch]$SkipRun,
  [switch]$UseCnMirror
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Add-ToPathIfExists {
  param([string]$PathEntry)

  if (-not (Test-Path -LiteralPath $PathEntry)) {
    return
  }
  $currentParts = @($env:PATH -split ';' | Where-Object { $_ -ne '' })
  if ($currentParts -contains $PathEntry) {
    return
  }
  $env:PATH = "$PathEntry;$env:PATH"
}

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path

Add-ToPathIfExists 'C:\Users\dumuc\dev\flutter\bin'
Add-ToPathIfExists 'C:\msys64\ucrt64\bin'
Add-ToPathIfExists 'C:\msys64\usr\bin'

Require-Command 'flutter'
Require-Command 'go'
Require-Command 'gcc'

if ($UseCnMirror) {
  $env:PUB_HOSTED_URL = 'https://pub.flutter-io.cn'
  $env:FLUTTER_STORAGE_BASE_URL = 'https://storage.flutter-io.cn'
} else {
  $env:PUB_HOSTED_URL = 'https://pub.dev'
  $env:FLUTTER_STORAGE_BASE_URL = 'https://storage.googleapis.com'
}

if ([string]::IsNullOrWhiteSpace($ProxyUrl)) {
  Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
  Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
  Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
} else {
  $env:HTTP_PROXY = $ProxyUrl
  $env:HTTPS_PROXY = $ProxyUrl
  $env:ALL_PROXY = $ProxyUrl
}

$env:CC = 'gcc'
$env:CXX = 'g++'
$env:CGO_ENABLED = '1'

$tempRoot = Join-Path $env:LOCALAPPDATA 'Temp'
$goTmpDir = Join-Path $tempRoot 'cloudplayer-go-tmp'
$goCacheDir = Join-Path $tempRoot 'cloudplayer-go-cache'
New-Item -ItemType Directory -Force -Path $goTmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $goCacheDir | Out-Null
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:GOTMPDIR = $goTmpDir
$env:GOCACHE = $goCacheDir

Push-Location $repoRoot
try {
  flutter config --enable-windows-desktop | Out-Host

  if (-not $SkipPubGet) {
    flutter pub get | Out-Host
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot 'bin\bridge') | Out-Null
  go build -buildmode=c-shared -o (Join-Path $repoRoot 'bin\bridge\cloudplayer_bridge.dll') ./bridge | Out-Host

  if ($SkipRun) {
    Write-Host 'Windows dev bootstrap finished. Skipped flutter run.'
    return
  }

  flutter run -d windows
} finally {
  Pop-Location
}
