import React, { useEffect, useState } from 'react'
import { posApi } from '../api/posApi'

export default function PosMpesaLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await posApi.mpesaStkLogs({ phone })
      setLogs(data.results || data)
    } catch (e) {
      console.error(e)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-3">M-Pesa STK Push Logs</h2>
      <div className="mb-3 flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Search phone" className="border px-2 py-1 rounded" />
        <button onClick={fetchLogs} className="bg-emerald-600 text-white px-3 py-1 rounded">Search</button>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Phone</th>
                <th className="px-2 py-1">Amount</th>
                <th className="px-2 py-1">Reference</th>
                <th className="px-2 py-1">Success</th>
                <th className="px-2 py-1">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan="6" className="px-2 py-2">No logs found.</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-2 py-1">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{log.phone}</td>
                  <td className="px-2 py-1">{log.amount}</td>
                  <td className="px-2 py-1">{log.reference}</td>
                  <td className="px-2 py-1">{log.success ? 'Yes' : 'No'}</td>
                  <td className="px-2 py-1">{log.message || (log.response && JSON.stringify(log.response).slice(0,200))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
