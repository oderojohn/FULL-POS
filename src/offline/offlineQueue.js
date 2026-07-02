/**
 * Handles uploading offline-queued sales to the server when connectivity returns.
 */
import { getDeviceId } from './deviceId'
import { getPendingSales, markSaleSynced, markSaleFailed } from './db'

const API_BASE = import.meta.env.VITE_POS_API_URL || '/api/pos'

function authHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('nexa-pos-session') || 'null')?.token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function pushSingleSale(sale) {
  const res = await fetch(`${API_BASE}/sync/push/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify({ device_id: getDeviceId(), sales: [sale] }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`)
  const result = json.results?.[0]
  if (!result?.success && !result?.duplicate) {
    throw new Error(result?.error || 'Server rejected the sale.')
  }
  return result
}

let _syncing = false

export async function syncPendingSales({ onProgress } = {}) {
  if (_syncing) return { skipped: true }
  _syncing = true
  const results = { total: 0, succeeded: 0, failed: 0, errors: [] }
  try {
    const pending = await getPendingSales()
    results.total = pending.length
    for (const sale of pending) {
      try {
        await pushSingleSale(sale)
        await markSaleSynced(sale.receipt_no)
        results.succeeded++
        onProgress?.({ ...results, current: sale.receipt_no })
      } catch (err) {
        await markSaleFailed(sale.receipt_no, err.message)
        results.failed++
        results.errors.push({ receipt_no: sale.receipt_no, error: err.message })
      }
    }
  } finally {
    _syncing = false
  }
  return results
}

export async function deviceCheckin(branchId) {
  try {
    await fetch(`${API_BASE}/sync/device-checkin/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'include',
      body: JSON.stringify({ device_id: getDeviceId(), branch: branchId }),
    })
  } catch {
    // Non-critical — silently ignore check-in failures
  }
}
