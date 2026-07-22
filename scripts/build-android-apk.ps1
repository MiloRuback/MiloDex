$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sdkRoot = if ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} elseif ($env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$jdkCandidates = @()
if ($env:JAVA_HOME) {
  $jdkCandidates += $env:JAVA_HOME
}
$jdkCandidates += @(
  (Join-Path $env:LOCALAPPDATA 'JDownloader 2\jre'),
  (Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.4297127D64EC6_8wekyb3d8bbwe\LocalCache\Local\runtime\java-runtime-delta\windows-x64\java-runtime-delta'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium'),
  'C:\Program Files\Eclipse Adoptium',
  'C:\Program Files\Java'
)

$javaHome = $null
foreach ($candidate in $jdkCandidates) {
  if (-not (Test-Path -LiteralPath $candidate)) {
    continue
  }

  $possibleHomes = @($candidate)
  if ((Get-Item -LiteralPath $candidate).PSIsContainer) {
    $possibleHomes += Get-ChildItem -LiteralPath $candidate -Directory -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty FullName
  }

  foreach ($possibleHome in $possibleHomes) {
    if (
      (Test-Path -LiteralPath (Join-Path $possibleHome 'bin\java.exe')) -and
      (Test-Path -LiteralPath (Join-Path $possibleHome 'bin\javac.exe')) -and
      (Test-Path -LiteralPath (Join-Path $possibleHome 'bin\jlink.exe'))
    ) {
      $javaHome = $possibleHome
      break
    }
  }

  if ($javaHome) {
    break
  }
}

if (-not $javaHome) {
  throw 'A full JDK 17+ with java.exe, javac.exe, and jlink.exe is required to build the Android APK.'
}

if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'platforms\android-36'))) {
  throw "Android SDK platform android-36 was not found in $sdkRoot."
}

if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'build-tools\36.0.0'))) {
  throw "Android SDK build-tools 36.0.0 was not found in $sdkRoot."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$javaHome\bin;$sdkRoot\cmdline-tools\latest\bin;$sdkRoot\platform-tools;$env:PATH"

Push-Location $root
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE."
  }

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) {
    throw "cap sync android failed with exit code $LASTEXITCODE."
  }

  Push-Location (Join-Path $root 'android')
  try {
    & .\gradlew.bat assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  $sourceApk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
  $targetDir = Join-Path $root 'dist\android'
  $targetApk = Join-Path $targetDir 'MiloDex-debug.apk'
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
  Write-Host "APK written to $targetApk"
} finally {
  Pop-Location
}
