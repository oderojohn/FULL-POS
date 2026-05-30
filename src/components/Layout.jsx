import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FaBarcode, FaBell, FaBoxes, FaBuilding, FaCashRegister, FaChartLine, FaChevronDown,
  FaChevronRight, FaClipboardList, FaCog, FaDatabase, FaExchangeAlt, FaFileInvoiceDollar,
  FaHome, FaMoneyBillWave, FaReceipt, FaShieldAlt, FaShoppingCart, FaTags,
  FaTruck, FaUserShield, FaUsers, FaWarehouse, FaBars, FaTimes
} from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'
import { ADMIN_ROUTE_POLICIES, ROUTE_POLICIES } from '../auth/rbac'
import { posApi } from '../api/posApi'

const menuStructure = [
  { path: '/dashboard', icon: FaHome, ...ROUTE_POLICIES['/dashboard'] },
  { path: '/pos', icon: FaShoppingCart, ...ROUTE_POLICIES['/pos'] },
  {
    icon: FaCashRegister,
    label: 'Sales Control',
    submenu: [
      { path: '/sales-control/transactions', icon: FaReceipt, ...ROUTE_POLICIES['/sales-control/transactions'] },
      { path: '/sales-control/voids', icon: FaTimes, ...ROUTE_POLICIES['/sales-control/voids'] },
      { path: '/sales-control/returns-refunds', icon: FaExchangeAlt, ...ROUTE_POLICIES['/sales-control/returns-refunds'] },
      { path: '/sales-control/cash-management', icon: FaMoneyBillWave, ...ROUTE_POLICIES['/sales-control/cash-management'] },
      { path: '/sales-control/cashier-summary', icon: FaCashRegister, ...ROUTE_POLICIES['/sales-control/cashier-summary'] },
      { path: '/sales-control/payments', icon: FaReceipt, ...ROUTE_POLICIES['/sales-control/payments'] },
      { path: '/sales-control/discounts-log', icon: FaTags, ...ROUTE_POLICIES['/sales-control/discounts-log'] },
      { path: '/sales-control/customer-sales', icon: FaUsers, ...ROUTE_POLICIES['/sales-control/customer-sales'] },
      { path: '/sales-control/reports', icon: FaChartLine, ...ROUTE_POLICIES['/sales-control/reports'] },
      { path: '/sales-control/audit-logs', icon: FaShieldAlt, ...ROUTE_POLICIES['/sales-control/audit-logs'] },
    ],
  },
  {
    label: 'Inventory',
    icon: FaWarehouse,
    submenu: [
      { path: '/inventory/products', icon: FaBoxes, ...ROUTE_POLICIES['/inventory/products'] },
      { path: '/inventory/purchase-orders', icon: FaFileInvoiceDollar, ...ROUTE_POLICIES['/inventory/purchase-orders'] },
      { path: '/inventory/goods-receiving', icon: FaClipboardList, ...ROUTE_POLICIES['/inventory/goods-receiving'] },
      { path: '/inventory/stock-management', icon: FaWarehouse, ...ROUTE_POLICIES['/inventory/stock-management'] },
      { path: '/inventory/stocktake', icon: FaBarcode, ...ROUTE_POLICIES['/inventory/stocktake'] },
      { path: '/inventory/monthly-variance', icon: FaChartLine, ...ROUTE_POLICIES['/inventory/monthly-variance'] },
      { path: '/inventory/warehouses', icon: FaBuilding, ...ROUTE_POLICIES['/inventory/warehouses'] },
      { path: '/inventory/suppliers', icon: FaTruck, ...ROUTE_POLICIES['/inventory/suppliers'] },
      { path: '/inventory/reports', icon: FaChartLine, ...ROUTE_POLICIES['/inventory/reports'] },
    ],
  },
  {
    label: 'Administration',
    icon: FaUserShield,
    submenu: [
      { path: '/admin/business', icon: FaBuilding, ...ADMIN_ROUTE_POLICIES['/admin/business'] },
      { path: '/admin/branches', icon: FaWarehouse, ...ADMIN_ROUTE_POLICIES['/admin/branches'] },
      { path: '/admin/users', icon: FaUsers, ...ADMIN_ROUTE_POLICIES['/admin/users'] },
      { path: '/admin/roles-permissions', icon: FaShieldAlt, ...ADMIN_ROUTE_POLICIES['/admin/roles-permissions'] },
      { path: '/admin/security', icon: FaUserShield, ...ADMIN_ROUTE_POLICIES['/admin/security'] },
      { path: '/admin/system-settings', icon: FaCog, ...ADMIN_ROUTE_POLICIES['/admin/system-settings'] },
      { path: '/admin/pos-operations', icon: FaCashRegister, ...ADMIN_ROUTE_POLICIES['/admin/pos-operations'] },
      { path: '/admin/stock-controls', icon: FaBoxes, ...ADMIN_ROUTE_POLICIES['/admin/stock-controls'] },
      { path: '/admin/audit-logs', icon: FaClipboardList, ...ADMIN_ROUTE_POLICIES['/admin/audit-logs'] },
      { path: '/admin/notifications', icon: FaBell, ...ADMIN_ROUTE_POLICIES['/admin/notifications'] },
      { path: '/admin/financial-control', icon: FaMoneyBillWave, ...ADMIN_ROUTE_POLICIES['/admin/financial-control'] },
      { path: '/admin/pricing-control', icon: FaTags, ...ADMIN_ROUTE_POLICIES['/admin/pricing-control'] },
      { path: '/admin/backup-data', icon: FaDatabase, ...ADMIN_ROUTE_POLICIES['/admin/backup-data'] },
      { path: '/admin/integrations', icon: FaExchangeAlt, ...ADMIN_ROUTE_POLICIES['/admin/integrations'] },
      { path: '/admin/mpesa-logs', icon: FaExchangeAlt, label: 'M-Pesa Logs', ...ADMIN_ROUTE_POLICIES['/admin/mpesa-logs'] },
      { path: '/admin/super-admin', icon: FaUserShield, ...ADMIN_ROUTE_POLICIES['/admin/super-admin'] },
      { path: '/admin/reports', icon: FaChartLine, ...ADMIN_ROUTE_POLICIES['/admin/reports'] },
      { path: '/admin/alerts', icon: FaBell, ...ADMIN_ROUTE_POLICIES['/admin/alerts'] },
      { path: '/admin/settings', icon: FaCog, ...ADMIN_ROUTE_POLICIES['/admin/settings'] },
    ],
  },
  { path: '/reports', icon: FaChartLine, label: 'Reports', permissions: ROUTE_POLICIES['/sales-control/reports'].permissions },
  { path: '/alerts', icon: FaBell, label: 'Alerts', permissions: ['alerts.view'] },
  { path: '/settings', icon: FaCog, ...ROUTE_POLICIES['/settings'] },
]

const unwrapRows = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

const Layout = ({ children }) => {
  const {
    user,
    profile,
    logout,
    can,
    switchBranch,
    switchCompany,
    branch,
    company,
    company_branches,
    canSwitchBranch,
    canSwitchCompany,
    reloadSignal,
    canAccessPolicy,
  } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({ 'Sales Control': true, Inventory: true })
  const [companies, setCompanies] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedCompany')) || null } catch { return null }
  })
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedBranch')) || null } catch { return null }
  })
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false)
  const [switchError, setSwitchError] = useState(null)

  const isAdmin = can('*') || can('company.manage') || can('branch.manage')
  const profileBranchId = profile?.branch
  const profileBranch = branches.find((branch) => branch.id === profileBranchId)
  const profileCompanyId = typeof profileBranch?.company === 'object' ? profileBranch.company?.id : profileBranch?.company
  const availableCompanies = useMemo(() => (
    isAdmin
      ? companies
      : companies.filter((company) => Number(company.id) === Number(profileCompanyId))
  ), [companies, isAdmin, profileCompanyId])

  const visibleBranches = useMemo(() => (
    (selectedCompany
      ? branches.filter((branch) => {
          const companyId = typeof branch.company === 'object' ? branch.company?.id : branch.company
          return Number(companyId) === Number(selectedCompany.id)
        })
      : branches
    ).filter((branch) => {
      if (isAdmin) return true
      if (profile?.role === 'manager' || profile?.role === 'inventory') return true
      return Number(branch.id) === Number(profileBranchId)
    })
  ), [branches, isAdmin, profile?.role, profileBranchId, selectedCompany])

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('selectedCompany', JSON.stringify(selectedCompany))
      localStorage.setItem('currentCompany', selectedCompany.id)
    } else {
      localStorage.removeItem('selectedCompany')
      localStorage.removeItem('currentCompany')
    }
  }, [selectedCompany])

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch))
      localStorage.setItem('currentBranch', selectedBranch.id)
      window.dispatchEvent(new CustomEvent('companyBranchChange', {
        detail: { companyId: selectedCompany?.id || null, branchId: selectedBranch.id },
      }))
    } else {
      localStorage.removeItem('selectedBranch')
      localStorage.removeItem('currentBranch')
    }
  }, [selectedBranch, selectedCompany?.id])

  const canViewItem = useCallback((item) => {
    if (can('*')) return true
    if (item.submenu) return item.submenu.some((sub) => canAccessPolicy(sub))
    return canAccessPolicy(item)
  }, [can, canAccessPolicy])

  const visibleMenu = menuStructure.filter((item) => {
    if (item.submenu) return item.submenu.some((sub) => canViewItem(sub))
    return canViewItem(item)
  })

  const toggleSubmenu = (label) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const handleBranchChange = useCallback(async (branchId) => {
    if (!canSwitchBranch) return
    setSwitchError(null)
    setIsSwitchingBranch(true)
    try {
      await switchBranch(branchId)
      const branch = visibleBranches.find(b => b.id === Number(branchId))
      setSelectedBranch(branch)
      
      // Dispatch event for other components to reload
      window.dispatchEvent(new CustomEvent('companyBranchChange', {
        detail: { companyId: selectedCompany?.id, branchId: Number(branchId) },
      }))
    } catch (error) {
      setSwitchError(error.data?.detail || 'Failed to switch branch')
      console.error('Branch switch error:', error)
    } finally {
      setIsSwitchingBranch(false)
    }
  }, [canSwitchBranch, switchBranch, visibleBranches, selectedCompany?.id])

  const handleCompanyChange = useCallback(async (companyId) => {
    const nextCompany = availableCompanies.find(c => c.id === Number(companyId))
    if (!canSwitchCompany) {
      setSelectedCompany(nextCompany)
      setSelectedBranch(null)
      return
    }
    setSwitchError(null)
    setIsSwitchingBranch(true)
    try {
      await switchCompany(Number(companyId))
      setSelectedCompany(nextCompany)
      setSelectedBranch(null)
    } catch (error) {
      setSwitchError(error.data?.detail || 'Failed to switch company')
      console.error('Company switch error:', error)
    } finally {
      setIsSwitchingBranch(false)
    }
  }, [availableCompanies, canSwitchCompany, switchCompany])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [companiesResponse, branchesResponse] = await Promise.all([
          posApi.companies?.() || [],
          posApi.branches()
        ])
        setCompanies(unwrapRows(companiesResponse))
        setBranches(unwrapRows(branchesResponse))
      } catch {
        setCompanies([])
        setBranches([])
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (company) setCompanies((current) => (current.some((item) => item.id === company.id) ? current : [company]))
    if (company_branches?.length) setBranches(company_branches)
    else if (branch) setBranches([branch])
  }, [branch, company, company_branches])

  // Handle branch reload signal
  useEffect(() => {
    if (reloadSignal > 0) {
      // Dispatch reload event for other components to refresh branch-scoped data
      window.dispatchEvent(new CustomEvent('branchReload', {
        detail: { timestamp: Date.now() },
      }))
    }
  }, [reloadSignal])

  useEffect(() => {
    if (!availableCompanies.length) {
      setSelectedCompany(null)
      return
    }

    setSelectedCompany((current) => {
      const currentCompany = current && availableCompanies.find((company) => company.id === current.id)
      if (currentCompany) return currentCompany

      return availableCompanies.find((company) => company.id === profileCompanyId) || availableCompanies[0]
    })
  }, [availableCompanies, profileCompanyId])

  useEffect(() => {
    if (!visibleBranches.length) {
      setSelectedBranch(null)
      return
    }

    setSelectedBranch((current) => {
      const currentBranch = current && visibleBranches.find((branch) => branch.id === current.id)
      if (currentBranch) return currentBranch

      const profileBranch = visibleBranches.find((branch) => branch.id === profile?.branch)
      return profileBranch || visibleBranches[0]
    })
  }, [profile?.branch, visibleBranches])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] bg-slate-950 shadow-xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
          <div className="flex items-center min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <FaCashRegister className="text-white text-xl" />
            </div>
            <div className="ml-3 min-w-0">
              <h1 className="text-white text-lg font-bold leading-tight truncate">Nexa POS</h1>
              <p className="text-slate-400 text-xs">Backoffice control center</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-300 hover:text-white p-2" aria-label="Close navigation">
            <FaTimes />
          </button>
        </div>

        <nav className="py-3 h-[calc(100vh-4rem)] overflow-y-auto">
          {visibleMenu.map((item) => {
            const Icon = item.icon
            const hasSubmenu = Boolean(item.submenu?.length)
            const expanded = expandedMenus[item.label]

            if (hasSubmenu) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-900 hover:text-white transition-colors font-medium"
                  >
                    <span className="flex items-center"><Icon className="mr-3" />{item.label}</span>
                    {expanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  </button>
                  {expanded && (
                    <div className="bg-slate-900/70">
                      {item.submenu.filter((sub) => canViewItem(sub)).map((sub) => {
                        const SubIcon = sub.icon
                        return (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center px-10 py-2.5 text-sm transition-colors ${isActive ? 'text-emerald-300 bg-slate-800 font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
                            }
                          >
                            <SubIcon className="mr-2 text-xs" />
                            <span>{sub.label}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 font-medium transition-colors ${isActive ? 'bg-emerald-500/15 text-emerald-300 border-r-4 border-emerald-400' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`
                }
              >
                <Icon className="mr-3" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 lg:ml-72">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-2 -ml-2" aria-label="Open navigation">
              <FaBars size={22} />
            </button>
            <div className="flex gap-3 min-w-0">
              {availableCompanies.length > 0 ? (
                <div className="flex flex-col">
                  <p className="text-xs text-slate-500">Company</p>
                  <select
                    value={selectedCompany?.id || ''}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    disabled={!canSwitchCompany || availableCompanies.length <= 1 || isSwitchingBranch}
                    className="max-w-[9rem] sm:max-w-[14rem] text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer disabled:cursor-default"
                  >
                    {availableCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex flex-col">
                <p className="text-xs text-slate-500">Active branch</p>
                <select
                  value={selectedBranch?.id || ''}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  disabled={!canSwitchBranch || visibleBranches.length <= 1 || isSwitchingBranch}
                  className="max-w-[9rem] sm:max-w-[14rem] text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer disabled:cursor-default disabled:opacity-50"
                >
                  {visibleBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                {switchError && <p className="text-xs text-red-600 mt-1">{switchError}</p>}
                {isSwitchingBranch && <p className="text-xs text-slate-500 mt-1">Switching...</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-500 hover:text-slate-900">
              <FaBell />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <span className="hidden sm:inline text-sm text-slate-700">Welcome, {user?.username || 'User'} ({profile?.role || 'pos'})</span>
            <button onClick={logout} className="rounded bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Logout</button>
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-semibold">{(user?.username || 'U')[0].toUpperCase()}</div>
          </div>
        </header>

        <main className="p-4 sm:p-5 lg:p-6">{children}</main>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}

export default Layout
