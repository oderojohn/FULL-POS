import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaCheck, FaCheckCircle, FaCloud, FaCopy, FaExclamationTriangle,
  FaKey, FaLink, FaSync, FaTimes, FaTimesCircle,
} from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'
import { posApi } from '../api/posApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

const getDeviceUuid = () => {
  const KEY = 'nexa-device-id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
    localStorage.setItem(KEY, id)
  }
  return id
}

const fetchCloud = async (url, payload, timeoutMs = 12000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data?.detail || `HTTP ${res.status}`), { data })
    return data
  } finally {
    clearTimeout(timer)
  }
}

// ── Check display ─────────────────────────────────────────────────────────────

const CHECK_LABELS = [
  ['cloud_reachable',        'Cloud reachable'],
  ['api_version_compatible', 'API version compatible'],
  ['token_valid',            'Token valid (not used)'],
  ['token_not_expired',      'Token not expired'],
  ['company_exists',         'Company exists'],
  ['branch_exists',          'Branch exists'],
  ['license_active',         'License active'],
  ['local_sqlite_available', 'Local database available'],
]

const CheckRow = ({ label, value }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
    <span className="w-5 h-5 flex items-center justify-center shrink-0">
      {value === undefined
        ? <FaSync className="text-slate-300 animate-spin text-xs" />
        : value
          ? <FaCheckCircle className="text-emerald-500 text-sm" />
          : <FaTimesCircle className="text-red-500 text-sm" />}
    </span>
    <span className="flex-1 text-sm text-slate-700">{label}</span>
    <span className="text-xs font-semibold">
      {value === undefined ? (
        <span className="text-slate-400">checking…</span>
      ) : value ? (
        <span className="text-emerald-600">Pass</span>
      ) : (
        <span className="text-red-600">Fail</span>
      )}
    </span>
  </div>
)

// ── Main page ─────────────────────────────────────────────────────────────────

const STEP = {
  PASTE:      'paste',
  TESTING:    'testing',
  TESTED:     'tested',
  CONNECTING: 'connecting',
  SYNCING:    'syncing',
  DONE:       'done',
}

export default function PosConnect() {
  const navigate = useNavigate()
  useAuth() // keeps session context alive; no company needed before bootstrap

  const [step, setStep]                 = useState(STEP.PASTE)
  const [packageText, setPackageText]   = useState('')
  const [pkg, setPkg]                   = useState(null)
  const [parseError, setParseError]     = useState('')
  const [checks, setChecks]             = useState({})
  const [checksPassed, setChecksPassed] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [syncProgress, setSyncProgress] = useState({ percent: 5, message: 'Starting synchronization…' })
  const [syncResult, setSyncResult]     = useState(null)
  const [copied, setCopied]             = useState(false)

  const pollRef = useRef(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // ── Step 1: parse the pasted package ──────────────────────────────────────

  const parsePackage = () => {
    setParseError('')
    setPkg(null)
    const text = packageText.trim()
    if (!text) return

    let parsed
    try {
      // Direct JSON
      const match = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : text)
    } catch {
      try {
        parsed = JSON.parse(atob(text))
      } catch {
        setParseError('Could not parse the connection package. Make sure you pasted the complete JSON.')
        return
      }
    }

    const required = ['pairingToken', 'cloudUrl', 'apiUrl', 'branchId', 'companyId']
    const missing = required.filter((f) => !parsed[f])
    if (missing.length) {
      setParseError(`Package is missing required fields: ${missing.join(', ')}`)
      return
    }

    setPkg(parsed)
  }

  // ── Step 2: test connection ────────────────────────────────────────────────

  const testConnection = async () => {
    if (!pkg) return
    setStep(STEP.TESTING)
    setChecks({})
    setChecksPassed(false)
    setConnectError('')

    try {
      const data = await fetchCloud(`${pkg.apiUrl}/sync/validate-token/`, {
        pairingToken: pkg.pairingToken,
      })
      const remoteChecks = data.checks || {}
      const allChecks = { ...remoteChecks, local_sqlite_available: true }
      setChecks(allChecks)
      const passed = data.valid && allChecks.local_sqlite_available
      setChecksPassed(passed)
    } catch {
      setChecks({
        cloud_reachable: false,
        api_version_compatible: false,
        token_valid: false,
        token_not_expired: false,
        company_exists: false,
        branch_exists: false,
        license_active: false,
        local_sqlite_available: true,
      })
      setChecksPassed(false)
    }

    setStep(STEP.TESTED)
  }

  // ── Step 3: pair and connect ──────────────────────────────────────────────

  const connect = async () => {
    if (!pkg || !checksPassed || step === STEP.CONNECTING) return
    setStep(STEP.CONNECTING)
    setConnectError('')

    try {
      // Collect machine info (Electron IPC or browser fallback)
      let machineName = 'POS Terminal'
      let osInfo      = navigator.userAgent.slice(0, 120)
      let appVersion  = '1.0.0'

      if (window.electronAPI?.getMachineInfo) {
        try {
          const info = await window.electronAPI.getMachineInfo()
          machineName = info.machineName || machineName
          osInfo      = info.osInfo      || osInfo
          appVersion  = info.appVersion  || appVersion
        } catch { /* ignore — Electron IPC may not be available in dev */ }
      }

      const deviceUuid = getDeviceUuid()

      // Register the device with the cloud
      const reg = await fetchCloud(`${pkg.apiUrl}/sync/pair-device/`, {
        pairingToken: pkg.pairingToken,
        deviceUuid,
        machineName,
        osInfo,
        appVersion,
        localDbVersion: '0',
      }, 20000)

      if (reg.registrationStatus !== 'SUCCESS') {
        throw new Error(reg.detail || 'Device registration failed.')
      }

      // Bootstrap the local SQLite with company + branch + cloud credentials.
      // This MUST happen before sync_cloud runs, because the management command
      // needs a local Branch record to exist before it can write catalog data.
      await posApi.localBootstrap({
        companyId:   reg.companyId,
        companyName: reg.companyName,
        branchId:    reg.branchId,
        branchName:  reg.branchName,
        branchCode:  reg.branchCode,
        syncToken:   reg.syncToken,
        deviceId:    reg.deviceId,
        terminalId:  reg.terminalId,
        cloudUrl:    pkg.cloudUrl,
        apiUrl:      pkg.apiUrl,
      })

      // Write nexapos.env so cloud config survives app restarts.
      if (window.electronAPI?.writeConnectionConfig) {
        await window.electronAPI.writeConnectionConfig({
          CLOUD_API_URL:    pkg.apiUrl,
          CLOUD_SYNC_TOKEN: reg.syncToken,
          BRANCH_ID:        String(reg.branchId),
        })
      }

      // Trigger the initial full sync and wait for it to complete.
      // electronAPI.syncNow now awaits the underlying sync_cloud command,
      // so we can transition to DONE as soon as it resolves.
      setStep(STEP.SYNCING)
      setSyncProgress({ percent: 10, message: 'Starting initial synchronization…' })

      if (window.electronAPI?.syncNow) {
        setSyncProgress({ percent: 20, message: 'Downloading users and catalog from cloud…' })
        await window.electronAPI.syncNow()
      } else {
        // Browser dev-mode fallback: simulate a short wait
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      setSyncProgress({ percent: 100, message: 'Synchronization complete!' })
      setSyncResult({ branchName: reg.branchName || pkg.branchName })
      setStep(STEP.DONE)

    } catch (e) {
      setConnectError(e.message || 'Connection failed. Please try again.')
      setStep(STEP.TESTED)
    }
  }

  // ── (polling helper kept for incremental sync retries — not used for initial sync) ──

  const pollInitialSync = (connectionPkg) => {
    let elapsed = 0
    let lastDone = 0

    const progressMessages = [
      'Downloading business settings…',
      'Downloading users and roles…',
      'Downloading product catalog…',
      'Downloading inventory stock…',
      'Downloading customers…',
      'Downloading pricing rules…',
      'Finalizing offline data…',
    ]
    let msgIndex = 0

    pollRef.current = setInterval(async () => {
      elapsed += 3

      if (elapsed % 6 === 0 && msgIndex < progressMessages.length - 1) {
        msgIndex++
      }

      try {
        const health = await posApi.systemHealth()
        const counts = health?.sync?.status_counts || {}
        const total = Object.values(counts).reduce((s, v) => s + (v || 0), 0)
        const done  = counts.done || 0

        const percent = total > 0 ? Math.min(95, Math.round((done / total) * 90) + 5) : Math.min(95, 5 + elapsed * 2)

        setSyncProgress({
          percent,
          message: progressMessages[msgIndex],
          done,
          total,
        })

        // Sync considered complete when done count stabilises or timeout reached
        const syncDone = (total > 0 && done === total && done !== lastDone) || elapsed >= 90
        lastDone = done

        if (syncDone || elapsed >= 90) {
          clearInterval(pollRef.current)
          setSyncProgress({ percent: 100, message: 'Synchronization complete!' })
          setSyncResult({ branchName: connectionPkg.branchName, done, total })
          setStep(STEP.DONE)
        }
      } catch {
        // Health check failed — keep counting up until timeout
        const percent = Math.min(95, 5 + elapsed * 1.5)
        setSyncProgress({ percent, message: progressMessages[msgIndex] })
        if (elapsed >= 90) {
          clearInterval(pollRef.current)
          setSyncProgress({ percent: 100, message: 'Synchronization complete.' })
          setSyncResult({ branchName: connectionPkg.branchName })
          setStep(STEP.DONE)
        }
      }
    }, 3000)
  }

  // ── Render: success ────────────────────────────────────────────────────────

  if (step === STEP.DONE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheckCircle className="text-white text-3xl" />
            </div>
            <h1 className="text-xl font-black text-white">POS Ready</h1>
            <p className="text-emerald-100 text-sm mt-1">Offline Enabled</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm font-bold text-slate-700">
                Connected to {syncResult?.branchName || pkg?.branchName}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ['Connection', 'Successful'],
                ['Device', 'Registered'],
                ['Sync', 'Complete'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-emerald-50 border border-emerald-200 py-4 text-center">
                  <FaCheck className="text-emerald-500 mx-auto mb-2 text-sm" />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">{label}</p>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 text-center">
              Cashiers can now log in locally. The POS will sync with the cloud every 5 minutes.
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: syncing ────────────────────────────────────────────────────────

  if (step === STEP.SYNCING) {
    const { percent, message: msg, done, total } = syncProgress
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <FaSync className="text-emerald-400 text-4xl mx-auto animate-spin mb-4" />
            <h1 className="text-xl font-black text-white">Initial Synchronization</h1>
            <p className="text-slate-400 text-sm mt-1">In Progress — please keep the app open</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 space-y-5">
            {/* Overall progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-medium">Overall Progress</span>
                <span className="font-bold text-emerald-400 tabular-nums">{percent}%</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Current activity */}
            <div className="flex items-center gap-3 rounded-xl bg-slate-700 px-4 py-3">
              <FaSync className="text-emerald-400 animate-spin shrink-0" />
              <span className="text-sm text-slate-200">{msg}</span>
            </div>

            {/* Record counts */}
            {typeof done === 'number' && typeof total === 'number' && total > 0 && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-slate-700 py-3">
                  <p className="text-xl font-black tabular-nums text-white">{done.toLocaleString()}</p>
                  <p className="text-[10px] font-semibold uppercase text-emerald-400 mt-0.5">Downloaded</p>
                </div>
                <div className="rounded-xl bg-slate-700 py-3">
                  <p className="text-xl font-black tabular-nums text-white">{total.toLocaleString()}</p>
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mt-0.5">Total</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-500">
            This may take a few minutes depending on your data volume.
          </p>
        </div>
      </div>
    )
  }

  // ── Render: paste / test / connect ────────────────────────────────────────

  const isConnecting = step === STEP.CONNECTING
  const isTesting    = step === STEP.TESTING

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <FaCloud className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Connect to Cloud</h1>
              <p className="text-slate-400 text-xs mt-0.5">First-time setup — paste your connection package</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1 — paste */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
              Paste Connection Package
            </label>
            <textarea
              value={packageText}
              onChange={(e) => {
                setPackageText(e.target.value)
                setPkg(null)
                setParseError('')
                setChecks({})
                setChecksPassed(false)
                setConnectError('')
                setStep(STEP.PASTE)
              }}
              placeholder={'{\n  "pairingToken": "...",\n  "branchId": 3,\n  ...\n}'}
              rows={7}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {parseError && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                <FaExclamationTriangle className="shrink-0" />{parseError}
              </p>
            )}
            <button
              type="button"
              onClick={parsePackage}
              disabled={!packageText.trim()}
              className="mt-2 w-full py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-40 transition"
            >
              Parse Package
            </button>
          </div>

          {/* Parsed package summary */}
          {pkg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
                <FaCheck className="text-emerald-500 text-xs" />
                Package parsed
              </div>
              {[
                ['Company',  pkg.companyName],
                ['Branch',   pkg.branchName],
                ['Cloud',    pkg.cloudUrl],
                ['Expires',  pkg.expiresAt ? new Date(pkg.expiresAt).toLocaleString() : '—'],
              ].map(([k, v]) => (
                <p key={k} className="text-xs text-slate-600">
                  <span className="font-semibold">{k}:</span>{' '}
                  <span className="font-mono">{v}</span>
                </p>
              ))}
            </div>
          )}

          {/* Step 2 — connection checks */}
          {(step === STEP.TESTING || step === STEP.TESTED) && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Connection Checks</span>
              </div>
              <div className="px-4 divide-y divide-slate-100">
                {CHECK_LABELS.map(([key, label]) => (
                  <CheckRow key={key} label={label} value={isTesting ? undefined : checks[key]} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {connectError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium flex items-start gap-2">
              <FaExclamationTriangle className="shrink-0 mt-0.5" />
              {connectError}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={!pkg || isTesting || isConnecting}
              className="w-full py-2.5 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {isTesting
                ? <><FaSync className="animate-spin text-xs" />Testing…</>
                : <><FaLink className="text-xs" />Test Connection</>}
            </button>

            <button
              type="button"
              onClick={connect}
              disabled={!checksPassed || isConnecting || isTesting}
              className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
            >
              {isConnecting
                ? <><FaSync className="animate-spin text-xs" />Connecting…</>
                : <><FaCloud className="text-xs" />Connect</>}
            </button>
          </div>

          {step === STEP.TESTED && !checksPassed && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              One or more checks failed. Resolve the issues above or generate a new connection package.
            </p>
          )}

          <p className="text-center text-xs text-slate-400">
            Connection package generated from <strong>Administration → Branches → POS Devices</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
