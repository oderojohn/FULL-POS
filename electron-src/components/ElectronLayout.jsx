import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  FaCashRegister, FaMoneyBillWave, FaUserClock, FaReceipt,
  FaWifi, FaCog, FaSignOutAlt, FaExclamationCircle,
} from 'react-icons/fa'
import { useAuth } from '../../src/auth/AuthContext'
import { countPendingSales, getSyncMeta } from '../../src/offline/db'

const NAV = [
  { to: '/pos',             icon: FaCashRegister,  label: 'POS Terminal' },
  { to: '/cash-management', icon: FaMoneyBillWave,  label: 'Cash Management' },
  { to: '/cashier-summary', icon: FaUserClock,      label: 'Cashier Summary' },
  { to: '/receipts',        icon: FaReceipt,        label: 'Reprint Receipt' },
  { to: '/sync-status',     icon: FaWifi,           label: 'Sync Status', badge: true },
  { to: '/device-settings', icon: FaCog,            label: 'Device Settings' },
]

export default function ElectronLayout({ children }) {
  const { logout, user, branch } = useAuth()
  const navigate = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  // Track browser online/offline events
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Poll pending upload count every 15s
  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        const n = await countPendingSales()
        if (mounted) setPendingCount(n)
      } catch {
        // IndexedDB unavailable — ignore
      }
    }
    refresh()
    const t = setInterval(refresh, 15000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-56 bg-slate-900 text-white shrink-0">
        {/* Wordmark */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2 mb-1">
            <FaCashRegister className="text-emerald-400 text-lg" />
            <span className="font-black text-white tracking-tight text-base">Nexa POS</span>
          </div>
          {/* Online status */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`text-xs font-medium ${online ? 'text-emerald-400' : 'text-amber-400'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          {/* Branch name */}
          {branch?.name && (
            <p className="text-xs text-slate-400 mt-1 truncate">{branch.name}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="text-[15px] shrink-0" />
              <span className="truncate flex-1">{label}</span>
              {badge && pendingCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 pb-4 pt-2 border-t border-slate-700/60">
          {user && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold text-white truncate">
                {user.first_name || user.username}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.username}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <FaSignOutAlt className="text-[15px] shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
