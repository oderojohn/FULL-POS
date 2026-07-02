import { useCallback, useEffect, useRef, useState } from 'react'
import { syncPendingSales } from '../offline/offlineQueue'
import { countPendingSales } from '../offline/db'
import { pullCatalog } from '../offline/catalogSync'

const API_BASE = import.meta.env.VITE_POS_API_URL || '/api/pos'
const PING_INTERVAL_MS = 30000
const PING_TIMEOUT_MS = 4000

async function pingServer() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/auth/ping/`, {
      method: 'HEAD',
      credentials: 'include',
      signal: controller.signal,
    })
    return res.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {number|null} branchId - pass the active branch ID to enable auto catalog sync
 */
export function useOfflineStatus(branchId = null) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [serverReachable, setServerReachable] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [catalogSyncing, setCatalogSyncing] = useState(false)
  const [lastCatalogSync, setLastCatalogSync] = useState(null)
  const intervalRef = useRef(null)
  const branchIdRef = useRef(branchId)
  branchIdRef.current = branchId

  const refreshPendingCount = useCallback(async () => {
    const count = await countPendingSales().catch(() => 0)
    setPendingCount(count)
  }, [])

  const syncCatalog = useCallback(async (overrideBranchId) => {
    const bid = overrideBranchId ?? branchIdRef.current
    if (!bid) return
    setCatalogSyncing(true)
    try {
      const result = await pullCatalog(bid)
      if (result.success) setLastCatalogSync(new Date().toISOString())
    } catch {
      // Non-critical — catalog pull failure is silent
    } finally {
      setCatalogSyncing(false)
    }
  }, [])

  const checkServer = useCallback(async () => {
    if (!navigator.onLine) {
      setServerReachable(false)
      return false
    }
    const reachable = await pingServer()
    setServerReachable(reachable)
    if (reachable) {
      const count = await countPendingSales().catch(() => 0)
      if (count > 0) {
        setSyncing(true)
        try {
          await syncPendingSales()
        } finally {
          setSyncing(false)
          refreshPendingCount()
        }
      }
      syncCatalog()
    }
    return reachable
  }, [refreshPendingCount, syncCatalog])

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); checkServer() }
    const handleOffline = () => { setIsOnline(false); setServerReachable(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkServer])

  useEffect(() => {
    checkServer()
    refreshPendingCount()
    intervalRef.current = setInterval(checkServer, PING_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [checkServer, refreshPendingCount])

  const effectivelyOnline = isOnline && serverReachable

  return {
    isOnline, serverReachable, effectivelyOnline,
    pendingCount, syncing,
    catalogSyncing, lastCatalogSync,
    refreshPendingCount, syncCatalog,
  }
}
