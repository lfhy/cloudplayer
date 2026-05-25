# Regenerates the Windows runner icon from the shared macOS app icon asset so
# dev and release builds stay on the same branded bitmap source.

param(
  [string]$SourcePng = "macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_256.png",
  [string]$OutputIco = "windows/runner/resources/app_icon.ico"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-ScaledBitmap {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($Source, 0, 0, $Size, $Size)
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

$sourcePath = Join-Path (Get-Location) $SourcePng
$outputPath = Join-Path (Get-Location) $OutputIco
$outputDirectory = Split-Path -Parent $outputPath
if (!(Test-Path -LiteralPath $sourcePath)) {
  throw "Source image not found: $sourcePath"
}
if (!(Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$sizes = @(16, 32, 48, 64, 128, 256)
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$frames = @()

try {
  foreach ($size in $sizes) {
    $bitmap = New-ScaledBitmap -Source $sourceImage -Size $size
    $pngStream = New-Object System.IO.MemoryStream
    try {
      $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
      $frames += [PSCustomObject]@{
        Size = $size
        Bytes = $pngStream.ToArray()
      }
    } finally {
      $pngStream.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}

$fileStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($fileStream)

try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$frames.Count)

  $offset = 6 + (16 * $frames.Count)
  foreach ($frame in $frames) {
    $dimension = if ($frame.Size -ge 256) { 0 } else { [byte]$frame.Size }
    $writer.Write([byte]$dimension)
    $writer.Write([byte]$dimension)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$frame.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $frame.Bytes.Length
  }

  foreach ($frame in $frames) {
    $writer.Write($frame.Bytes)
  }
} finally {
  $writer.Dispose()
  $fileStream.Dispose()
}

Write-Output "Generated $OutputIco from $SourcePng"
