/**
 * Electron main process.
 *
 * Development:  Vite dev server on :5173, Django on :8000
 * Production:   Django bundled executable (nexapos-server.exe) runs locally;
 *               SQLite database stored in user's AppData folder (persists across updates).
 */
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { execFile } = require('child_process')
const http = require('http')
const https = require('https')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const DJANGO_PORT = 18000
// electron:dev uses port 5173 (full web app); electron:dev:pos uses port 5174 (POS-only build)
const DEV_FRONTEND_URL = process.env.ELECTRON_DEV_URL || 'http://127.0.0.1:5173'
const CLOUD_SYNC_INTERVAL_MS = 5 * 60 * 1000   // try cloud sync every 5 minutes

let mainWindow = null
let djangoProcess = null
let cloudSyncTimer = null

// ── Paths ─────────────────────────────────────────────────────────────────────

function getDjangoExecutablePath() {
  if (isDev) return null
  const execName = process.platform === 'win32' ? 'nexapos-server.exe' : 'nexapos-server'
  return path.join(process.resourcesPath, 'server', execName)
}

function readLocalEnvFile(userDataPath) {
  // Operators drop a nexapos.env file in AppData\Nexa POS\ to configure:
  //   BRANCH_ID=<id>        — limits cloud sync to this branch only
  //   CLOUD_API_URL=https://... — cloud backend URL
  //   CLOUD_SYNC_TOKEN=...  — bearer token for cloud sync
  const envFile = path.join(userDataPath, 'nexapos.env')
  const overrides = {}
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (key) overrides[key] = val
    }
  } catch (_) {
    // File absent on first run — that's fine
  }
  return overrides
}

function getDjangoEnv() {
  const userDataPath = app.getPath('userData')
  // Ensure userData dir exists (first run)
  fs.mkdirSync(userDataPath, { recursive: true })

  const localOverrides = readLocalEnvFile(userDataPath)

  return {
    ...process.env,
    DJANGO_SETTINGS_MODULE: 'config.settings',
    // SQLite stored in userData — survives app updates and PyInstaller temp-dir cleanup
    SQLITE_PATH: path.join(userDataPath, 'nexapos.db'),
    // Deterministic secret key tied to this install location
    SECRET_KEY: Buffer.from(userDataPath).toString('base64').slice(0, 64),
    PORT: String(DJANGO_PORT),
    DESKTOP_MODE: 'True',
    // 8-hour token TTL covers a full cashier shift without re-login
    POS_AUTH_TOKEN_MAX_AGE: '28800',
    // Disable HTTPS redirect — local server is HTTP only
    SECURE_SSL_REDIRECT: 'False',
    SESSION_COOKIE_SECURE: 'False',
    CSRF_COOKIE_SECURE: 'False',
    // Local overrides from nexapos.env (BRANCH_ID, CLOUD_API_URL, CLOUD_SYNC_TOKEN, etc.)
    ...localOverrides,
  }
}

// ── Django process management ─────────────────────────────────────────────────

function spawnDjangoCommand(args) {
  const execPath = getDjangoExecutablePath()
  const env = getDjangoEnv()
  return new Promise((resolve, reject) => {
    const proc = execFile(execPath, args, { env }, (err) => {
      if (err && !err.killed) reject(err)
      else resolve()
    })
    proc.stdout?.on('data', (d) => process.stdout.write('[Django] ' + d))
    proc.stderr?.on('data', (d) => process.stderr.write('[Django] ' + d))
  })
}

async function startDjango() {
  if (isDev) return

  const execPath = getDjangoExecutablePath()
  const env = getDjangoEnv()

  // Step 1: run migrations (creates schema on first install, upgrades on update)
  console.log('[Electron] Running database migrations...')
  await spawnDjangoCommand(['migrate', '--run-syncdb', '--no-input'])
  console.log('[Electron] Migrations complete.')

  // Step 2: start the HTTP server
  return new Promise((resolve, reject) => {
    djangoProcess = execFile(
      execPath,
      ['runserver', `127.0.0.1:${DJANGO_PORT}`, '--noreload'],
      { env },
      (err) => {
        if (err && !err.killed) {
          dialog.showErrorBox('Server error', `Django server exited:\n${err.message}`)
        }
      },
    )

    djangoProcess.stdout?.on('data', (d) => process.stdout.write('[Django] ' + d))
    djangoProcess.stderr?.on('data', (d) => process.stderr.write('[Django] ' + d))

    // Poll until server responds (up to 90 seconds)
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const req = http.get(`http://127.0.0.1:${DJANGO_PORT}/api/pos/auth/ping/`, (res) => {
        if (res.statusCode < 500) {
          clearInterval(poll)
          resolve()
        }
      })
      req.on('error', () => {})
      req.setTimeout(1000, () => req.destroy())
      if (attempts > 90) {
        clearInterval(poll)
        reject(new Error('Django did not start within 90 seconds.'))
      }
    }, 1000)
  })
}

function stopDjango() {
  if (djangoProcess) {
    djangoProcess.kill()
    djangoProcess = null
  }
}

// ── Cloud sync ────────────────────────────────────────────────────────────────

function checkInternet(callback) {
  // Ping a reliable host to detect internet connectivity
  const req = https.get('https://www.google.com', { timeout: 4000 }, (res) => {
    callback(res.statusCode < 500)
    res.destroy()
  })
  req.on('error', () => callback(false))
  req.on('timeout', () => { req.destroy(); callback(false) })
}

function runCloudSyncAsync() {
  if (isDev) return Promise.resolve({ skipped: 'dev' })
  return new Promise((resolve) => {
    checkInternet((online) => {
      if (!online) { resolve({ skipped: 'offline' }); return }
      console.log('[Electron] Internet detected — running cloud sync...')
      spawnDjangoCommand(['sync_cloud'])
        .then(() => { console.log('[Electron] Cloud sync complete.'); resolve({ ok: true }) })
        .catch((err) => { console.error('[Electron] Cloud sync error:', err.message); resolve({ error: err.message }) })
    })
  })
}

function runCloudSync() {
  runCloudSyncAsync() // fire-and-forget for the timer
}

function startCloudSyncTimer() {
  // First sync after 30 seconds (give Django time to settle), then every 5 min
  setTimeout(() => {
    runCloudSync()
    cloudSyncTimer = setInterval(runCloudSync, CLOUD_SYNC_INTERVAL_MS)
  }, 30000)
}

function stopCloudSyncTimer() {
  if (cloudSyncTimer) {
    clearInterval(cloudSyncTimer)
    cloudSyncTimer = null
  }
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Nexa POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const appUrl = isDev
    ? DEV_FRONTEND_URL
    : `http://127.0.0.1:${DJANGO_PORT}`

  mainWindow.loadURL(appUrl)

  if (isDev) mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isLocal = url.startsWith('http://127.0.0.1') || url.startsWith(DEV_FRONTEND_URL)
    if (!isLocal) { shell.openExternal(url); return { action: 'deny' } }
    return { action: 'allow' }
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startDjango()
    createWindow()
    startCloudSyncTimer()
  } catch (err) {
    dialog.showErrorBox('Startup error', err.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  stopCloudSyncTimer()
  stopDjango()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

app.on('before-quit', () => {
  stopCloudSyncTimer()
  stopDjango()
})

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:userData', () => app.getPath('userData'))
ipcMain.handle('app:isPackaged', () => app.isPackaged)
ipcMain.handle('app:syncNow', () => runCloudSyncAsync())

ipcMain.handle('app:getMachineInfo', () => ({
  machineName: os.hostname(),
  osInfo: `${os.type()} ${os.release()} (${os.arch()})`,
  appVersion: app.getVersion(),
}))

ipcMain.handle('app:writeConnectionConfig', (_event, cfg = {}) => {
  const userDataPath = app.getPath('userData')
  const envFile = path.join(userDataPath, 'nexapos.env')
  // Preserve any existing keys not covered by the new config
  const existing = readLocalEnvFile(userDataPath)
  const merged = { ...existing, ...cfg }
  const lines = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  fs.writeFileSync(envFile, lines + '\n', 'utf8')
  return true
})
ipcMain.handle('app:restartToUpdate', () => {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.quitAndInstall()
  } catch (_) {
    app.relaunch()
    app.quit()
  }
})

// ── Hardware IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('hw:getPrinters', async () => {
  if (!mainWindow) return []
  try {
    return await mainWindow.webContents.getPrintersAsync()
  } catch {
    return []
  }
})

ipcMain.handle('hw:printReceipt', async (_event, opts = {}) => {
  if (!mainWindow) throw new Error('Window not ready')
  return new Promise((resolve, reject) => {
    const printOpts = {
      silent: opts.silent !== false,
      printBackground: true,
      deviceName: opts.printerName || undefined,
      margins: { marginType: 'none' },
    }
    mainWindow.webContents.print(printOpts, (success, errorType) => {
      if (success) resolve(true)
      else reject(new Error(errorType || 'Print failed'))
    })
  })
})

ipcMain.handle('hw:openCashDrawer', async (_event, opts = {}) => {
  // ESC/POS cash drawer kick sequence: ESC p 0 25 250
  const kickBytes = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])
  const port = opts.port || ''
  if (!port) return false

  return new Promise((resolve) => {
    try {
      // On Windows, writing to \\.\COMn opens the port directly
      const portPath = process.platform === 'win32'
        ? `\\\\.\\${port}`
        : `/dev/${port}`
      const stream = fs.createWriteStream(portPath, { flags: 'r+' })
      stream.write(kickBytes, () => {
        stream.end()
        resolve(true)
      })
      stream.on('error', (err) => {
        console.error('[Electron] Cash drawer error:', err.message)
        resolve(false)
      })
    } catch (err) {
      console.error('[Electron] Cash drawer error:', err.message)
      resolve(false)
    }
  })
})
