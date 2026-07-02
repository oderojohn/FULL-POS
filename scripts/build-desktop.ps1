<#
.SYNOPSIS
  Full desktop build: Django (PyInstaller) + Frontend (Vite) + Electron installer

.USAGE
  cd C:\Users\SERVER\Desktop\sms
  .\scripts\build-desktop.ps1

.PREREQUISITES
  - Python 3.11+ virtual env at backend\.venv
      cd backend
      python -m venv .venv
      .venv\Scripts\pip install -r requirements.txt pyinstaller
  - Node.js 18+
      npm install
  - UPX (optional, for smaller exe): https://github.com/upx/upx/releases
#>

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "`n=== Nexa POS Desktop Build ===" -ForegroundColor Cyan

# ── Locate Python venv ────────────────────────────────────────────────────────
$BackendDir  = Join-Path $Root "backend"
# Look for venv in root first, then backend
$VenvPython  = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    $VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
}
if (-not (Test-Path $VenvPython)) {
    throw @"
Python venv not found. Set one up first:
  python -m venv .venv
  .venv\Scripts\pip install -r backend\requirements.txt pyinstaller
"@
}

# ── Step 1: Collect Django static files ──────────────────────────────────────
Write-Host "`n[1/4] Collecting Django static files..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    & $VenvPython manage.py collectstatic --noinput 2>&1 | Select-Object -First 5
    if ($LASTEXITCODE -ne 0) { throw "collectstatic failed" }
} finally { Pop-Location }

# ── Step 2: Bundle Django with PyInstaller ────────────────────────────────────
Write-Host "`n[2/4] Building Django server (PyInstaller)..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    & $VenvPython -m PyInstaller build.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
} finally { Pop-Location }

$ServerDist = Join-Path $BackendDir "dist\nexapos-server"
if (-not (Test-Path $ServerDist)) { throw "PyInstaller output missing at $ServerDist" }
Write-Host "  Server bundle: $ServerDist" -ForegroundColor Green

# ── Step 3: Build Vite frontend ───────────────────────────────────────────────
Write-Host "`n[3/4] Building frontend (Vite)..." -ForegroundColor Yellow
Push-Location $Root
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Vite build failed" }
} finally { Pop-Location }
Write-Host "  Frontend: $Root\dist" -ForegroundColor Green

# ── Step 4: Package Electron installer ───────────────────────────────────────
Write-Host "`n[4/4] Packaging Electron installer (NSIS)..." -ForegroundColor Yellow
Push-Location $Root
try {
    npx electron-builder build --win --x64
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
} finally { Pop-Location }

# ── Result ────────────────────────────────────────────────────────────────────
$InstallerDir = Join-Path $Root "dist-electron"
$Installer    = Get-ChildItem $InstallerDir -Filter "*.exe" -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match 'Setup|Install' } |
                Select-Object -First 1
if ($Installer) {
    Write-Host "`n=== Build complete ===" -ForegroundColor Cyan
    Write-Host "  Installer : $($Installer.FullName)" -ForegroundColor Green
    Write-Host "  Size      : $([math]::Round($Installer.Length/1MB, 1)) MB" -ForegroundColor Green
} else {
    Write-Host "`n=== Build complete — check dist-electron\ for the installer ===" -ForegroundColor Yellow
}

Write-Host @"

Next steps to enable cloud sync in the installed app:
  1. Deploy the backend to Vercel (or any host) with a PostgreSQL database.
  2. Create a super_admin user on the cloud.
  3. Log in via the web app and copy your bearer token.
  4. Set environment variables before launching NexaPOS:
       CLOUD_API_URL=https://your-cloud.vercel.app
       CLOUD_SYNC_TOKEN=<bearer-token>
     Or add them to a nexapos.env file in %APPDATA%\Nexa POS\

"@ -ForegroundColor DarkCyan
