import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { ADMIN_ROUTE_POLICIES, ROUTE_POLICIES } from './auth/rbac'
import Layout from './components/Layout'
import Dashboard from './pages/PosDashboard'
import PosTerminal from './pages/PosTerminal'
import Settings from './pages/PosSettings'
import SalesControl from './pages/PosSalesControl'
import InventoryModule from './pages/PosInventory'
import Administration from './pages/PosAdministration'
import PosMpesaLogs from './pages/PosMpesaLogs'
import Login from './pages/Login'
import PosConnect from './pages/PosConnect'

const RequireAuth = ({ children }) => {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

const AccessDenied = ({ label = 'this page' }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">
    You do not have permission to view {label}.
  </div>
)

const RequirePolicy = ({ policy, children }) => {
  const { canAccessPolicy } = useAuth()
  if (!canAccessPolicy(policy)) return <AccessDenied label={policy?.label} />
  return children
}

const GuardedRoute = ({ path, children }) => (
  <RequirePolicy policy={ROUTE_POLICIES[path]}>
    {children}
  </RequirePolicy>
)

const AdminRoute = ({ path, section }) => (
  <RequirePolicy policy={ADMIN_ROUTE_POLICIES[path]}>
    <Administration section={section} />
  </RequirePolicy>
)

function App() {
  const location = useLocation()
  const { session } = useAuth()

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  if (location.pathname === '/pos' || location.pathname === '/terminal') {
    return (
      <Routes>
        <Route path="/pos" element={<RequireAuth><GuardedRoute path="/pos"><PosTerminal /></GuardedRoute></RequireAuth>} />
        <Route path="/terminal" element={<Navigate to="/pos" />} />
      </Routes>
    )
  }

  if (location.pathname === '/connect') {
    return (
      <Routes>
        <Route path="/connect" element={<PosConnect />} />
      </Routes>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<GuardedRoute path="/dashboard"><Dashboard /></GuardedRoute>} />
        <Route path="/pos" element={<GuardedRoute path="/pos"><PosTerminal /></GuardedRoute>} />
        <Route path="/terminal" element={<Navigate to="/pos" />} />
        <Route path="/sales-control" element={<Navigate to="/sales-control/transactions" />} />
        <Route path="/sales-control/transactions" element={<GuardedRoute path="/sales-control/transactions"><SalesControl initialSection="Transactions" /></GuardedRoute>} />
        <Route path="/sales-control/voids" element={<GuardedRoute path="/sales-control/voids"><SalesControl initialSection="Voids" /></GuardedRoute>} />
        <Route path="/sales-control/returns-refunds" element={<GuardedRoute path="/sales-control/returns-refunds"><SalesControl initialSection="Returns & Refunds" /></GuardedRoute>} />
        <Route path="/sales-control/cash-management" element={<GuardedRoute path="/sales-control/cash-management"><SalesControl initialSection="Cash Management" /></GuardedRoute>} />
        <Route path="/sales-control/cashier-summary" element={<GuardedRoute path="/sales-control/cashier-summary"><SalesControl initialSection="Cashier Summary" /></GuardedRoute>} />
        <Route path="/sales-control/cashier-shifts" element={<Navigate to="/sales-control/cashier-summary" replace />} />
        <Route path="/sales-control/payments" element={<GuardedRoute path="/sales-control/payments"><SalesControl initialSection="Payments" /></GuardedRoute>} />
        <Route path="/sales-control/discounts-log" element={<GuardedRoute path="/sales-control/discounts-log"><SalesControl initialSection="Discounts Log" /></GuardedRoute>} />
        <Route path="/sales-control/discount-engine" element={<GuardedRoute path="/sales-control/discount-engine"><SalesControl initialSection="Discount Engine" /></GuardedRoute>} />
        <Route path="/sales-control/price-scheduler" element={<GuardedRoute path="/sales-control/price-scheduler"><SalesControl initialSection="Price Scheduler" /></GuardedRoute>} />
        <Route path="/sales-control/customer-sales" element={<GuardedRoute path="/sales-control/customer-sales"><SalesControl initialSection="Customer Sales" /></GuardedRoute>} />
        <Route path="/sales-control/reports" element={<GuardedRoute path="/sales-control/reports"><SalesControl initialSection="Reports" /></GuardedRoute>} />
        <Route path="/sales-control/audit-logs" element={<GuardedRoute path="/sales-control/audit-logs"><SalesControl initialSection="Audit Logs" /></GuardedRoute>} />
        <Route path="/sales" element={<Navigate to="/sales-control/transactions" />} />
        <Route path="/finance" element={<Navigate to="/sales-control/cash-management" />} />
        <Route path="/reports" element={<Navigate to="/sales-control/reports" />} />
        <Route path="/inventory" element={<Navigate to="/inventory/products" />} />
        <Route path="/inventory/products" element={<GuardedRoute path="/inventory/products"><InventoryModule section="Products" /></GuardedRoute>} />
        <Route path="/inventory/purchase-orders" element={<GuardedRoute path="/inventory/purchase-orders"><InventoryModule section="Purchase Orders" /></GuardedRoute>} />
        <Route path="/inventory/goods-receiving" element={<GuardedRoute path="/inventory/goods-receiving"><InventoryModule section="Goods Receiving" /></GuardedRoute>} />
        <Route path="/inventory/stock-management" element={<GuardedRoute path="/inventory/stock-management"><InventoryModule section="Stock Management" /></GuardedRoute>} />
        <Route path="/inventory/stocktake" element={<GuardedRoute path="/inventory/stocktake"><InventoryModule section="Stocktake" /></GuardedRoute>} />
        <Route path="/inventory/monthly-variance" element={<GuardedRoute path="/inventory/monthly-variance"><InventoryModule section="Monthly Variance" /></GuardedRoute>} />
        <Route path="/inventory/warehouses" element={<GuardedRoute path="/inventory/warehouses"><InventoryModule section="Warehouses" /></GuardedRoute>} />
        <Route path="/inventory/suppliers" element={<GuardedRoute path="/inventory/suppliers"><InventoryModule section="Suppliers" /></GuardedRoute>} />
        <Route path="/inventory/reports" element={<GuardedRoute path="/inventory/reports"><InventoryModule section="Inventory Reports" /></GuardedRoute>} />
        <Route path="/products" element={<Navigate to="/inventory/products" />} />
        <Route path="/categories" element={<Navigate to="/inventory/products" />} />
        <Route path="/transfers" element={<Navigate to="/inventory/warehouses" />} />
        <Route path="/purchases" element={<Navigate to="/inventory/purchase-orders" />} />
        <Route path="/suppliers" element={<Navigate to="/inventory/suppliers" />} />
        <Route path="/admin" element={<Navigate to="/admin/business" />} />
        <Route path="/admin/business" element={<AdminRoute path="/admin/business" section="Business Setup" />} />
        <Route path="/admin/branches" element={<AdminRoute path="/admin/branches" section="Branches" />} />
        <Route path="/admin/users" element={<AdminRoute path="/admin/users" section="Users" />} />
        <Route path="/admin/roles-permissions" element={<AdminRoute path="/admin/roles-permissions" section="Roles & Permissions" />} />
        <Route path="/admin/stock-controls" element={<AdminRoute path="/admin/stock-controls" section="Stock Controls" />} />
        <Route path="/admin/audit-logs" element={<AdminRoute path="/admin/audit-logs" section="Audit Logs" />} />
        <Route path="/admin/notifications" element={<AdminRoute path="/admin/notifications" section="Notifications" />} />
        <Route path="/admin/financial-control" element={<AdminRoute path="/admin/financial-control" section="Financial Control" />} />
        <Route path="/admin/pricing-control" element={<AdminRoute path="/admin/pricing-control" section="Pricing Control" />} />
        <Route path="/admin/backup-data" element={<AdminRoute path="/admin/backup-data" section="Backup & Data" />} />
        <Route path="/admin/integrations" element={<AdminRoute path="/admin/integrations" section="Integrations" />} />
        <Route path="/admin/mpesa-logs" element={<RequirePolicy policy={ADMIN_ROUTE_POLICIES['/admin/integrations']}><PosMpesaLogs /></RequirePolicy>} />
        <Route path="/admin/super-admin" element={<AdminRoute path="/admin/super-admin" section="Super Admin" />} />
        <Route path="/admin/reports" element={<AdminRoute path="/admin/reports" section="Reports" />} />
        <Route path="/admin/scheduled-reports" element={<AdminRoute path="/admin/scheduled-reports" section="Scheduled Reports" />} />
        <Route path="/admin/alerts" element={<AdminRoute path="/admin/alerts" section="Alerts" />} />
        <Route path="/admin/settings" element={<AdminRoute path="/admin/settings" section="Settings" />} />
        <Route path="/admin/system-health" element={<AdminRoute path="/admin/system-health" section="System Health" />} />
        <Route path="/users" element={<Navigate to="/admin/users" />} />
        <Route path="/branches" element={<Navigate to="/admin/branches" />} />
        <Route path="/audit-logs" element={<Navigate to="/admin/audit-logs" />} />
        <Route path="/alerts" element={<Navigate to="/dashboard" />} />
        <Route path="/settings" element={<GuardedRoute path="/settings"><Settings /></GuardedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
  )
}

export default App
