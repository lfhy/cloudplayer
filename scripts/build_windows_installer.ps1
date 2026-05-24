# Build a per-architecture Inno Setup installer from a staged Flutter bundle.
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][ValidateSet('amd64', 'arm64')][string]$Arch
)

$ErrorActionPreference = 'Stop'

function Resolve-IsccPath {
  $command = Get-Command iscc.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 7\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw 'Unable to locate ISCC.exe. Install Inno Setup or add it to PATH.'
}

$sourceDirPath = (Resolve-Path -LiteralPath $SourceDir).Path
$outputDirPath = (Resolve-Path -LiteralPath $OutputDir).Path
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$issPath = Join-Path $scriptRoot '..\windows\installer\CloudPlayer.iss'
$issPath = (Resolve-Path -LiteralPath $issPath).Path
$isccPath = Resolve-IsccPath

$archConfig = switch ($Arch) {
  'amd64' {
    @{
      Allowed = 'x64compatible'
      InstallMode = 'x64compatible'
      Display = 'amd64'
    }
  }
  'arm64' {
    @{
      Allowed = 'arm64'
      InstallMode = 'arm64'
      Display = 'arm64'
    }
  }
}

$outputBaseName = "cloudplayer-windows-$($archConfig.Display)-installer"

& $isccPath `
  '/Qp' `
  "/DSourceDir=$sourceDirPath" `
  "/DOutputDir=$outputDirPath" `
  "/DOutputBaseName=$outputBaseName" `
  "/DAppVersion=$Version" `
  "/DArchSlug=$($archConfig.Display)" `
  "/DArchitecturesAllowed=$($archConfig.Allowed)" `
  "/DArchitecturesInstallIn64BitMode=$($archConfig.InstallMode)" `
  $issPath
