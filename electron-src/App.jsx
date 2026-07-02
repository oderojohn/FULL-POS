import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../src/auth/AuthContext'
import ElectronLayout from './components/ElectronLayout'
import Login from '../src/pages/Login'
import PosTerminal from '../src/pages/PosTerminal'
import SalesControl from '../src/pages/PosSalesControl'
import OfflineSyncStatus from './pages/OfflineSyncStatus'
import DeviceSettings from './pages/DeviceSettings'

const RequireAuth = ({ children }) => {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function App() {
  const { session } = useAuth()
  const location = useLocation()

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return (
    <ElectronLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<RequireAuth><PosTerminal /></RequireAuth>} />
        <Route path="/cash-management" element={<RequireAuth><SalesControl initialSection="Cash Management" /></RequireAuth>} />
        <Route path="/cashier-summary" element={<RequireAuth><SalesControl initialSection="Cashier Summary" /></RequireAuth>} />
        <Route path="/receipts" element={<RequireAuth><SalesControl initialSection="Transactions" /></RequireAuth>} />
        <Route path="/sync-status" element={<RequireAuth><OfflineSyncStatus /></RequireAuth>} />
        <Route path="/device-settings" element={<RequireAuth><DeviceSettings /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </ElectronLayout>
  )
}

export default App
