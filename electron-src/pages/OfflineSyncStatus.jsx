import React, { useEffect, useState, useCallback } from 'react'
import { FaWifi, FaSync, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'
import { getAllSales, countPendingSales, getSyncMeta } from '../../src/offline/db'
import { syncPendingSales } from '../../src/offline/offlineQueue'

const STATUS_LABEL = { pending: 'Pending', uploading: 'Uploading', synced: 'Synced', failed: 'Failed' }
const STATUS_COLOR = {
  pending:   'bg-amber-100 text-amber-700',
  uploading: 'bg-sky-100 text-sky-700',
  synced:    'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-700',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLOR[status] || 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function saleTotal(sale) {
  if (sale.payments?.length) {
    return sale.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  }
  return null
}

export default function OfflineSyncStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [allSales, setAllSales] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [all, count, meta] = await Promise.all([
        getAllSales(),
        countPendingSales(),
        getSyncMeta('lastSyncAt'),
      ])
      setAllSales(all || [])
      setPendingCount(count || 0)
      setLastSync(meta || null)
    } catch {
      // IndexedDB not available
    }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    refresh()
    const t = setInterval(refresh, 10000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      clearInterval(t)
    }
  }, [refresh])

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      if (window.electronAPI?.syncNow) {
        await window.electronAPI.syncNow()
      }
      if (online) {
        await syncPendingSales()
      }
      setSyncMsg({ type: 'success', text: 'Sync completed successfully.' })
      await refresh()
    } catch (err) {
      setSyncMsg({ type: 'error', text: `Sync failed: ${err.message || 'Unknown error'}` })
    } finally {
      setSyncing(false)
    }
  }

  const unsyncedSales = allSales.filter(s => s.status !== 'synced')
  const failedCount = allSales.filter(s => s.status === 'failed').length

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Status banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          online ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {online
            ? <FaWifi className="text-emerald-500 text-xl shrink-0" />
            : <FaExclamationTriangle className="text-amber-500 text-xl shrink-0" />
          }
          <div>
            <p className={`font-semibold text-sm ${online ? 'text-emerald-700' : 'text-amber-700'}`}>
              {online ? 'Online — connected to cloud' : 'Offline — operating on local data'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {online
                ? 'Sales will sync automatically. Manual sync available below.'
                : 'Sales are queued locally and will upload when connection is restored.'
              }
            </p>
          </div>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !online}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
          >
            <FaSync className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {syncMsg && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            syncMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {syncMsg.text}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-black text-slate-800 font-mono">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1">Pending Upload</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-black font-mono ${failedCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {failedCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">Failed</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Last Synced</p>
            <p className="text-xs font-semibold text-slate-700">
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>

        {/* Unsynced sales table */}
        {unsyncedSales.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Queued Sales ({unsyncedSales.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Receipt #</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Saved At</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unsyncedSales.map(sale => {
                    const total = saleTotal(sale)
                    return (
                      <tr key={sale.receipt_no} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{sale.receipt_no}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800 font-mono">
                          {total != null ? total.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {sale.saved_at ? new Date(sale.saved_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={sale.status || 'pending'} />
                          {sale.sync_error && (
                            <p className="text-xs text-red-600 mt-0.5 max-w-xs truncate">{sale.sync_error}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FaCheckCircle className="text-emerald-400 text-3xl mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">All sales are synced</p>
            <p className="text-xs text-slate-400 mt-1">No pending uploads in the local queue.</p>
          </div>
        )}
      </div>
    </div>
  )
}
