$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json
$version = $packageJson.version
$tag = if ($env:RELEASE_TAG) { $env:RELEASE_TAG } else { "v$version" }
$owner = if ($env:GITHUB_OWNER) { $env:GITHUB_OWNER } else { 'MiloRuback' }
$repo = if ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { 'MiloDex' }
$token = if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { $null }

if (-not $token) {
  throw 'Set GITHUB_TOKEN or GH_TOKEN with permission to write repository releases.'
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

$assets = @(
  @{
    Path = Join-Path $root "dist\MiloDex-Setup-$version.exe"
    Name = "MiloDex-Setup-$version.exe"
    ContentType = 'application/vnd.microsoft.portable-executable'
  },
  @{
    Path = Join-Path $root "dist\android\MiloDex-Android-$version-debug.apk"
    Name = "MiloDex-Android-$version-debug.apk"
    ContentType = 'application/vnd.android.package-archive'
  }
)

foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath $asset.Path)) {
    throw "Release asset not found: $($asset.Path)"
  }
}

$releaseApi = "https://api.github.com/repos/$owner/$repo/releases"
$release = $null

try {
  $release = Invoke-RestMethod -Method Get -Uri "$releaseApi/tags/$tag" -Headers $headers
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 404) {
    throw
  }
}

if (-not $release) {
  $body = @{
    tag_name = $tag
    target_commitish = 'main'
    name = "MiloDex $version"
    body = @"
## Downloads

- Windows: MiloDex-Setup-$version.exe
- Android: MiloDex-Android-$version-debug.apk

O APK Android e assinado com chave debug para instalacao manual.
"@
    draft = $false
    prerelease = $false
  } | ConvertTo-Json

  $release = Invoke-RestMethod -Method Post -Uri $releaseApi -Headers $headers -ContentType 'application/json' -Body $body
}

foreach ($asset in $assets) {
  foreach ($existing in $release.assets) {
    if ($existing.name -eq $asset.Name) {
      Invoke-RestMethod -Method Delete -Uri $existing.url -Headers $headers | Out-Null
    }
  }

  $uploadUrl = $release.upload_url -replace '\{\?name,label\}', "?name=$([uri]::EscapeDataString($asset.Name))"
  Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -ContentType $asset.ContentType -InFile $asset.Path | Out-Null
  Write-Host "Uploaded $($asset.Name)"
}

Write-Host "Release ready: $($release.html_url)"
