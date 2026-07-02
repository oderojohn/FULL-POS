import React, { useEffect, useState } from 'react'
import { FaCheckCircle, FaMobileAlt, FaSearch, FaSyncAlt, FaTimesCircle } from 'react-icons/fa'
import { posApi } from '../api/posApi'
import { SkeletonList } from '../components/LoadingKit'

const money = (v) => `KES ${Number(v || 0).toLocaleString()}`
const timeLabel = (iso) => new Date(iso).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })

export default function PosMpesaLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await posApi.mpesaStkLogs({ phone })
      setLogs(data.results || data)
    } catch {
      setError('Could not load M-Pesa logs. Check your connection and try again.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FaMobileAlt className="text-emerald-600" />
            M-Pesa STK Push Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time payment transaction history</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="Filter by phone number…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition"
          />
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* table header */}
        <div className="hidden sm:grid grid-cols-[1fr_100px_100px_1fr_80px] gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
          {['Time', 'Phone', 'Amount', 'Reference', 'Status'].map((h) => (
            <span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <SkeletonList rows={8} />
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FaMobileAlt className="text-3xl text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No transactions found</p>
            <p className="text-xs text-slate-400">{phone ? `No results for "${phone}"` : 'Transactions will appear here after M-Pesa payments.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_1fr_80px] gap-1 sm:gap-2 px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm text-slate-700">{timeLabel(log.created_at)}</span>
                <span className="text-sm font-medium text-slate-900">{log.phone}</span>
                <span className="text-sm font-semibold text-slate-900 pos-terminal">{money(log.amount)}</span>
                <span className="text-xs text-slate-500 truncate">{log.reference || '—'}</span>
                <span className="flex items-center gap-1.5">
                  {log.success
                    ? <FaCheckCircle className="text-emerald-500 flex-none" />
                    : <FaTimesCircle className="text-red-400 flex-none" />
                  }
                  <span className={`text-xs font-semibold ${log.success ? 'text-emerald-700' : 'text-red-600'}`}>
                    {log.success ? 'Paid' : 'Failed'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
