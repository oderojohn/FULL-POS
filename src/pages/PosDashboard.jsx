import React, { useEffect, useMemo, useState } from 'react'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'
import { FaArrowDown, FaArrowUp, FaBell, FaBoxes, FaCashRegister, FaChartLine, FaExclamationTriangle, FaFileExport, FaMoneyBillWave, FaShoppingCart } from 'react-icons/fa'

const money = (value) => `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
const startOfWeek = (date) => {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setDate(next.getDate() - day + 1)
  return next
}
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const paymentLabels = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', credit: 'Credit' }

const buildPeriod = (key) => {
  const today = new Date()
  if (key === 'week') {
    const start = startOfWeek(today)
    return { date_from: isoDate(start), date_to: isoDate(addDays(start, 6)), label: 'This week' }
  }
  if (key === '7days') return { date_from: isoDate(addDays(today, -6)), date_to: isoDate(today), label: 'Last 7 days' }
  return { date_from: isoDate(today), date_to: isoDate(today), label: 'Today' }
}

const StatCard = ({ title, value, icon: Icon, tone, change, trend = 'up' }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2.5 rounded-lg ${tone}`}><Icon className="text-white text-lg" /></div>
      <div className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
        {trend === 'up' ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
        {change}
      </div>
    </div>
    <p className="text-sm text-slate-500">{title}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
)

const EmptyChart = () => (
  <div className="flex h-56 items-center justify-center text-sm font-medium text-slate-400">No data in this period.</div>
)

const SalesTrendChart = ({ rows }) => {
  const max = Math.max(...rows.map((row) => row.total), 0)
  if (!rows.length || max <= 0) return <EmptyChart />
  const width = 640
  const height = 220
  const pad = 28
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1)
    const y = height - pad - (row.total / max) * (height - pad * 2)
    return { ...row, x, y }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="h-56 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Sales trend">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" strokeWidth="1" />
        <path d={path} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="5" fill="#047857" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[20px]">{dateLabel(point.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

const BranchBars = ({ rows }) => {
  const max = Math.max(...rows.map((row) => row.salesToday), 0)
  if (!rows.length || max <= 0) return <EmptyChart />
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{row.name}</span>
            <span className="shrink-0 font-semibold text-slate-900">{money(row.salesToday)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (row.salesToday / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const PaymentMix = ({ rows }) => {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  if (!rows.length || total <= 0) return <EmptyChart />
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = (row.total / total) * 100
        return (
          <div key={row.method}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{paymentLabels[row.method] || row.method}</span>
              <span className="font-semibold text-slate-900">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Dashboard = () => {
  const { branch, company_branches: companyBranches, reloadSignal } = useAuth()
  const [products, setProducts] = useState([])
  const [allSales, setAllSales] = useState([])
  const [todayShifts, setTodayShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodKey, setPeriodKey] = useState('today')
  const [branchFilter, setBranchFilter] = useState('active')

  const accessibleBranches = useMemo(() => {
    const rows = (companyBranches?.length ? companyBranches : branch ? [branch] : [])
      .filter((row) => row?.id && row?.is_active !== false)
    return rows
  }, [branch, companyBranches])

  const period = useMemo(() => buildPeriod(periodKey), [periodKey])
  const dashboardBranches = useMemo(() => {
    if (branchFilter === 'all') return accessibleBranches
    const activeBranch = accessibleBranches.find((row) => row.id === branch?.id)
    return activeBranch ? [activeBranch] : accessibleBranches.slice(0, 1)
  }, [accessibleBranches, branch?.id, branchFilter])

  useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      if (!dashboardBranches.length) {
        setProducts([])
        setAllSales([])
        setTodayShifts([])
        setLoading(false)
        return
      }

      try {
        const branchIds = dashboardBranches.map((row) => row.id)
        const [productResponses, salesResponses, shiftResponses] = await Promise.all([
          Promise.all(branchIds.map((id) => posApi.products({ branch: id, page_size: 1000 }))),
          Promise.all(branchIds.map((id) => posApi.sales({ branch: id, status: 'paid', date_from: period.date_from, date_to: period.date_to, page_size: 1000 }))),
          Promise.all(branchIds.map((id) => posApi.todayShifts({ branch: id, date_from: period.date_from, date_to: period.date_to, page_size: 1000 }))),
        ])

        if (cancelled) return

        const productList = productResponses.flatMap((response) => response.results || response || [])
        const saleList = salesResponses.flatMap((response) => response.results || response || [])
        const shiftList = shiftResponses
          .flatMap((response) => response.results || response || [])
          .filter((shift) => {
            const opened = isoDate(new Date(shift.opened_at))
            return opened >= period.date_from && opened <= period.date_to
          })

        setProducts(productList)
        setAllSales(saleList)
        setTodayShifts(shiftList)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
        if (!cancelled) {
          setProducts([])
          setAllSales([])
          setTodayShifts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    fetchAll()
    return () => { cancelled = true }
  }, [dashboardBranches, period.date_from, period.date_to, reloadSignal])

  const paidSales = useMemo(
    () => allSales.filter((sale) => sale.status === 'paid' || sale.status === 'PAID'),
    [allSales],
  )

  const periodTotalSales = useMemo(
    () => paidSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [paidSales],
  )

  const lowStockCount = useMemo(
    () => products.filter((product) => Number(product.stock) <= Number(product.reorder_point)).length,
    [products],
  )

  const totalStockValue = useMemo(
    () => products.reduce((sum, product) => sum + Number(product.cost_price || 0) * Number(product.stock || 0), 0),
    [products],
  )

  const branchStats = useMemo(() => {
    const shiftByBranch = {}
    for (const shift of todayShifts) {
      const key = shift.branch || shift.branch_id
      if (!shiftByBranch[key]) shiftByBranch[key] = { expected: 0, counted: 0 }
      shiftByBranch[key].expected += Number(shift.expected_cash || 0)
      shiftByBranch[key].counted += Number(shift.counted_cash || 0)
    }

    return dashboardBranches.map((branchRow) => {
      const branchSales = paidSales.filter((sale) => sale.branch === branchRow.id || sale.branch_id === branchRow.id)
      const revenue = branchSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
      const shiftData = shiftByBranch[branchRow.id] || { expected: 0, counted: 0 }
      const cashVariance = Math.round(shiftData.counted - shiftData.expected)
      const cogs = branchSales.reduce((sum, sale) => (
        sum + (sale.items || []).reduce((itemSum, item) => {
          const costPrice = Number(item.product?.cost_price || 0)
          const unitPrice = Number(item.unit_price || 0)
          const qty = Number(item.quantity || 0)
          return itemSum + (unitPrice - costPrice) * qty
        }, 0)
      ), 0)

      return {
        id: branchRow.id,
        name: branchRow.name,
        location: branchRow.location || '',
        salesToday: revenue,
        cashVariance,
        grossProfit: cogs,
      }
    })
  }, [dashboardBranches, paidSales, todayShifts])

  const totalGrossProfit = useMemo(() => branchStats.reduce((sum, row) => sum + (row.grossProfit || 0), 0), [branchStats])
  const totalCashVariance = useMemo(() => branchStats.reduce((sum, row) => sum + (row.cashVariance || 0), 0), [branchStats])
  const salesTrend = useMemo(() => {
    const rows = []
    let cursor = new Date(`${period.date_from}T00:00:00`)
    const end = new Date(`${period.date_to}T00:00:00`)
    while (cursor <= end) {
      rows.push({ date: isoDate(cursor), total: 0, count: 0 })
      cursor = addDays(cursor, 1)
    }
    const byDate = Object.fromEntries(rows.map((row) => [row.date, row]))
    paidSales.forEach((sale) => {
      const key = isoDate(new Date(sale.created_at))
      if (byDate[key]) {
        byDate[key].total += Number(sale.total || 0)
        byDate[key].count += 1
      }
    })
    return rows
  }, [paidSales, period.date_from, period.date_to])
  const paymentMix = useMemo(() => {
    const totals = {}
    paidSales.forEach((sale) => {
      ;(sale.payments || []).forEach((payment) => {
        totals[payment.method] = (totals[payment.method] || 0) + Number(payment.amount || 0)
      })
    })
    return Object.entries(totals)
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total)
  }, [paidSales])

  const alerts = useMemo(() => {
    const stockAlerts = products
      .filter((product) => Number(product.stock) <= Number(product.reorder_point))
      .slice(0, 8)
      .map((product) => ({
        id: `stock-${product.id}`,
        type: 'Low stock',
        message: `${product.name} is below reorder point`,
        severity: product.stock === 0 ? 'Critical' : 'High',
      }))

    const varianceAlerts = branchStats
      .filter((row) => row.cashVariance !== 0)
      .map((row) => ({
        id: `variance-${row.id}`,
        type: 'Cash variance',
        message: `${row.name} drawer variance is ${money(row.cashVariance)}`,
        severity: row.cashVariance < 0 ? 'Critical' : 'Low',
      }))

    return [...stockAlerts, ...varianceAlerts]
  }, [products, branchStats])

  const recentSales = useMemo(
    () => [...paidSales]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10),
    [paidSales],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-slate-900" />
        <span className="ml-3 text-sm text-slate-500">Loading dashboard…</span>
      </div>
    )
  }

  if (!accessibleBranches.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm font-semibold text-amber-800">
        No active branch is assigned to this account. Ask an administrator to assign a branch before using the dashboard.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">POS Backoffice Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Showing {period.label.toLowerCase()} for {dashboardBranches.length} branch{dashboardBranches.length === 1 ? '' : 'es'}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="7days">Last 7 days</option>
          </select>
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            <option value="active">Active branch</option>
            {accessibleBranches.length > 1 && <option value="all">All accessible branches</option>}
          </select>
          <button className="flex items-center justify-center px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-800">
            <FaFileExport className="mr-2" />
            Export Summary
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Sales" value={money(periodTotalSales)} icon={FaCashRegister} tone="bg-emerald-600" change={period.label} />
        <StatCard title="Gross Profit" value={money(totalGrossProfit)} icon={FaChartLine} tone="bg-blue-600" change="Live" />
        <StatCard
          title="Cash Variance"
          value={money(totalCashVariance)}
          icon={FaMoneyBillWave}
          tone="bg-amber-500"
          change="Review"
          trend={totalCashVariance === 0 ? 'up' : 'down'}
        />
        <StatCard title="Stock Value" value={money(totalStockValue)} icon={FaBoxes} tone="bg-violet-600" change={`${lowStockCount} alerts`} trend="down" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Sales Trend</h2>
            <span className="text-xs font-medium text-slate-500">{period.date_from} to {period.date_to}</span>
          </div>
          <SalesTrendChart rows={salesTrend} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Payment Mix</h2>
          <PaymentMix rows={paymentMix} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Branch Sales Graph</h2>
          <span className="text-xs text-slate-500">{dashboardBranches.length} branch scope</span>
        </div>
        <BranchBars rows={branchStats} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Branch Sales</h2>
            <span className="text-xs text-slate-500">{period.label}</span>
          </div>
          <div style={{ minWidth: 0, overflowX: 'auto' }}>
            <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Branch</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Location</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Sales</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Cash Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branchStats.map((branchRow) => (
                  <tr key={branchRow.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">{branchRow.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{branchRow.location}</td>
                    <td className="px-5 py-4 text-sm text-right font-semibold text-slate-900">{money(branchRow.salesToday)}</td>
                    <td className={`px-5 py-4 text-sm text-right font-medium ${branchRow.cashVariance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {money(branchRow.cashVariance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center">
            <FaBell className="text-amber-500 mr-2" />
            <h2 className="font-semibold text-slate-900">Priority Alerts</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert.id} className="p-4">
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle className={`${alert.severity === 'Critical' || alert.severity === 'High' ? 'text-red-500' : 'text-amber-500'} mt-1`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{alert.type}</p>
                    <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-sm text-slate-400">No active alerts.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center">
          <FaShoppingCart className="text-emerald-600 mr-2" />
          <h2 className="font-semibold text-slate-900">Recent Sales</h2>
        </div>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Receipt</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cashier</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentSales.map((sale) => {
                const primaryPayment = (sale.payments || []).find((payment) => payment.method === 'cash') || (sale.payments || [])[0]
                return (
                  <tr key={sale.id || sale.receipt_no} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">{sale.receipt_no}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{sale.cashier_name || '—'}</td>
                    <td className="px-5 py-4 text-sm text-right font-semibold">{money(sale.total)}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{primaryPayment?.method || '—'}</td>
                  </tr>
                )
              })}
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">No sales recorded in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
