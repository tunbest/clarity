param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/tunbest/clarity.git"
$WorkDir = Join-Path $env:TEMP ("clarity-source-" + [guid]::NewGuid().ToString("N"))
$ExtractDir = Join-Path $WorkDir "extract"
$RepoDir = Join-Path $WorkDir "repo"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "Archive introuvable : $ZipPath"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git doit être installé sur ce PC."
}

New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null
Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractDir -Force

$ProjectDir = Join-Path $ExtractDir "cpp-main"
if (-not (Test-Path (Join-Path $ProjectDir "package.json"))) {
  $ProjectDir = Get-ChildItem -Path $ExtractDir -Directory -Recurse |
    Where-Object { Test-Path (Join-Path $_.FullName "package.json") } |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $ProjectDir) {
  throw "package.json introuvable dans l'archive."
}

git clone $RepoUrl $RepoDir
if ($LASTEXITCODE -ne 0) { throw "Échec du clonage GitHub." }

# Copier le code en conservant le README et le .gitignore du dépôt
# (ils contiennent les consignes de déploiement et les exclusions de secrets).
Get-ChildItem -LiteralPath $ProjectDir -Force -Recurse | ForEach-Object {
  $relative = $_.FullName.Substring($ProjectDir.Length).TrimStart('\','/')
  if (-not $relative) { return }

  $parts = $relative -split '[\\/]'
  if ($parts -contains "node_modules" -or $parts -contains "dist" -or
      $parts -contains "build" -or $parts -contains ".git" -or
      $parts -contains "backups") { return }

  if (-not $_.PSIsContainer) {
    if ($_.Name -eq ".env" -or ($_.Name -like ".env.*" -and $_.Name -ne ".env.example")) { return }
    if ($relative -eq "README.md" -or $relative -eq ".gitignore") { return }
    $target = Join-Path $RepoDir $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
}

Set-Location $RepoDir
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Aucun changement à publier."
  exit 0
}

git commit -m "feat: add complete Clarity PM source"
if ($LASTEXITCODE -ne 0) { throw "Échec du commit." }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Échec du push. Vérifie l'authentification GitHub et les droits d'accès." }

Write-Host "Code source Clarity PM publié sur https://github.com/tunbest/clarity"
Write-Host "Répertoire de travail : $RepoDir"
