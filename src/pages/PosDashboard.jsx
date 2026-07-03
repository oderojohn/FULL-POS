import React, { useEffect, useMemo, useState } from 'react'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'
import {
  FaArrowDown, FaArrowUp, FaBell, FaBoxes, FaCashRegister, FaChartLine, FaChevronDown,
  FaExclamationTriangle, FaFileExport, FaMoneyBillWave, FaShoppingCart,
  FaStore, FaTags, FaUsers,
} from 'react-icons/fa'
import { SkeletonStatCard, SkeletonTable } from '../components/LoadingKit'

const money = (value) => `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const pct = (value) => `${Number(value || 0).toFixed(1)}%`

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d }
const startOfWeek = (date) => { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d }
const startOfMonth = (date) => { const d = new Date(date); d.setDate(1); return d }
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
]

const buildPeriod = (key) => {
  const today = new Date()
  if (key === 'yesterday') { const y = addDays(today, -1); return { date_from: isoDate(y), date_to: isoDate(y), label: 'Yesterday' } }
  if (key === 'week') { const s = startOfWeek(today); return { date_from: isoDate(s), date_to: isoDate(addDays(s, 6)), label: 'This week' } }
  if (key === '7days') return { date_from: isoDate(addDays(today, -6)), date_to: isoDate(today), label: 'Last 7 days' }
  if (key === 'month') return { date_from: isoDate(startOfMonth(today)), date_to: isoDate(today), label: 'This month' }
  return { date_from: isoDate(today), date_to: isoDate(today), label: 'Today' }
}

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, gradient, change, changeTone = 'neutral', sub }) => (
  <div className={`relative overflow-hidden rounded-xl p-5 shadow-sm ${gradient}`}>
    <Icon className="absolute right-3 top-3 text-7xl text-white/10 pointer-events-none" />
    <div className="relative z-10">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
        <Icon className="text-white text-base" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{title}</p>
      <p className="mt-1.5 text-3xl font-black leading-none text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/60">{sub}</p>}
      {change && (
        <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${changeTone === 'good' ? 'bg-white/25 text-white' : changeTone === 'bad' ? 'bg-black/20 text-red-100' : 'bg-white/15 text-white/80'}`}>
          {changeTone === 'good' && <FaArrowUp className="text-[8px]" />}
          {changeTone === 'bad' && <FaArrowDown className="text-[8px]" />}
          {change}
        </div>
      )}
    </div>
  </div>
)

// ── Empty placeholder ─────────────────────────────────────────────────────────
const EmptyChart = ({ text = 'No data in this period.' }) => (
  <div className="flex h-48 items-center justify-center text-sm font-medium text-slate-400">{text}</div>
)

// ── Sales Trend (area chart) ─────────────────────────────────────────────────
const SalesTrendChart = ({ rows }) => {
  const max = Math.max(...rows.map((r) => r.total), 1)
  if (!rows.length || max <= 0) return <EmptyChart />
  const W = 640, H = 200, PX = 52, PY = 16

  const pts = rows.map((r, i) => ({
    ...r,
    x: rows.length === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (rows.length - 1),
    y: H - PY - (r.total / max) * (H - PY * 2),
  }))

  // Smooth cubic bezier line
  const line = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = pts[i - 1]
    const cx = (prev.x + p.x) / 2
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`
  }).join(' ')

  const area = `${line} L ${pts[pts.length - 1].x} ${H - PY} L ${pts[0].x} ${H - PY} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: max * f,
    y: H - PY - f * (H - PY * 2),
  }))

  const fmt = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)

  return (
    <div className="h-52 w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* grid */}
        {yTicks.map((t) => (
          <line key={t.y} x1={PX} y1={t.y} x2={W - PX} y2={t.y} stroke="#f1f5f9" strokeWidth="1.5" />
        ))}
        {/* y-axis labels */}
        {yTicks.map((t) => (
          <text key={t.y} x={PX - 6} y={t.y + 4} textAnchor="end" fill="#94a3b8" fontSize="14">{fmt(t.v)}</text>
        ))}
        {/* area */}
        <path d={area} fill="url(#trendFill)" />
        {/* line */}
        <path d={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* points + x labels */}
        {pts.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r="4" fill="#047857" stroke="white" strokeWidth="2" />
            <text x={p.x} y={H - 1} textAnchor="middle" fill="#94a3b8" fontSize="13">{dateLabel(p.date)}</text>
          </g>
        ))}
        {/* baseline */}
        <line x1={PX} y1={H - PY} x2={W - PX} y2={H - PY} stroke="#e2e8f0" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

// ── Payment Mix (colored bars) ───────────────────────────────────────────────
const PAYMENT_COLORS = {
  cash: { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  mpesa: { bar: 'bg-blue-500', dot: 'bg-blue-500' },
  card: { bar: 'bg-violet-500', dot: 'bg-violet-500' },
  credit: { bar: 'bg-amber-500', dot: 'bg-amber-500' },
}
const paymentLabels = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', credit: 'Credit' }

const PaymentMix = ({ rows }) => {
  const total = rows.reduce((s, r) => s + r.total, 0)
  if (!rows.length || total <= 0) return <EmptyChart />
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const p = (r.total / total) * 100
        const colors = PAYMENT_COLORS[r.method] || { bar: 'bg-slate-400', dot: 'bg-slate-400' }
        return (
          <div key={r.method}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                <span className="text-sm font-medium text-slate-700">{paymentLabels[r.method] || r.method}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-xs text-slate-500">{money(r.total)}</span>
                <span className="w-9 text-right text-xs font-bold text-slate-900">{p.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${p}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Branch Bars ───────────────────────────────────────────────────────────────
const BRANCH_GRADIENTS = [
  'from-blue-500 to-blue-700',
  'from-violet-500 to-violet-700',
  'from-cyan-500 to-cyan-700',
  'from-pink-500 to-pink-700',
  'from-teal-500 to-teal-700',
]

const BranchBars = ({ rows }) => {
  const max = Math.max(...rows.map((r) => r.salesToday), 1)
  const total = rows.reduce((s, r) => s + r.salesToday, 0)
  if (!rows.length || max <= 0) return <EmptyChart />
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rows.map((row, i) => {
        const p = Math.max(4, (row.salesToday / max) * 100)
        const share = total > 0 ? ((row.salesToday / total) * 100).toFixed(0) : 0
        const g = BRANCH_GRADIENTS[i % BRANCH_GRADIENTS.length]
        return (
          <div key={row.id} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-800">{row.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{share}% of total</span>
            </div>
            <p className="text-xl font-black text-slate-900 mb-2">{money(row.salesToday)}</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full bg-gradient-to-r ${g}`} style={{ width: `${p}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, right, children, className }) => (
  <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className || ''}`}>
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-slate-400" />}
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {right && <div className="text-xs text-slate-500">{right}</div>}
    </div>
    <div className="p-5">{children}</div>
  </div>
)

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { branch, company_branches: companyBranches, reloadSignal, isBranchAdmin } = useAuth()
  const [dashData, setDashData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodKey, setPeriodKey] = useState('today')
  const [branchFilter, setBranchFilter] = useState('active')
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false)

  const accessibleBranches = useMemo(() => (
    (companyBranches?.length ? companyBranches : branch ? [branch] : []).filter((r) => r?.id && r?.is_active !== false)
  ), [branch, companyBranches])

  const period = useMemo(() => buildPeriod(periodKey), [periodKey])
  const dashboardBranches = useMemo(() => {
    if (branchFilter === 'all') return accessibleBranches
    const active = accessibleBranches.find((r) => r.id === branch?.id)
    return active ? [active] : accessibleBranches.slice(0, 1)
  }, [accessibleBranches, branch?.id, branchFilter])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!dashboardBranches.length) { setDashData(null); setLoading(false); return }
      try {
        const data = await posApi.dashboardStats({
          branch_ids: dashboardBranches.map((r) => r.id).join(','),
          date_from: period.date_from,
          date_to: period.date_to,
        })
        if (!cancelled) setDashData(data)
      } catch {
        if (!cancelled) setDashData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    load()
    return () => { cancelled = true }
  }, [dashboardBranches, period.date_from, period.date_to, reloadSignal])

  const branchStatsById = useMemo(() => {
    const map = {}
    for (const s of dashData?.branch_stats || []) map[s.branch_id] = s
    return map
  }, [dashData])

  const branchStats = useMemo(() =>
    dashboardBranches.map((b) => {
      const s = branchStatsById[b.id] || {}
      return { id: b.id, name: b.name, location: b.location || '', salesToday: s.revenue || 0, cashVariance: s.cash_variance || 0, grossProfit: s.gross_profit || 0, txCount: s.transaction_count || 0 }
    }),
  [dashboardBranches, branchStatsById])

  const periodTotalSales = useMemo(() => branchStats.reduce((s, r) => s + r.salesToday, 0), [branchStats])
  const totalGrossProfit = useMemo(() => branchStats.reduce((s, r) => s + r.grossProfit, 0), [branchStats])
  const totalCashVariance = useMemo(() => branchStats.reduce((s, r) => s + r.cashVariance, 0), [branchStats])
  const totalTxCount = useMemo(() => branchStats.reduce((s, r) => s + r.txCount, 0), [branchStats])
  const lowStockCount = useMemo(() => Object.values(branchStatsById).reduce((s, r) => s + (r.low_stock_count || 0), 0), [branchStatsById])
  const totalStockValue = useMemo(() => Object.values(branchStatsById).reduce((s, r) => s + (r.stock_value || 0), 0), [branchStatsById])
  const profitMargin = periodTotalSales > 0 ? (totalGrossProfit / periodTotalSales) * 100 : 0

  const salesTrend = useMemo(() => dashData?.sales_trend || [], [dashData])
  const paymentMix = useMemo(() => dashData?.payment_mix || [], [dashData])
  const recentSales = useMemo(() => dashData?.recent_sales || [], [dashData])

  const alerts = useMemo(() => {
    const stock = (dashData?.low_stock_alerts || []).map((p) => ({
      id: `stock-${p.product_id}`,
      type: 'Low stock',
      message: `${p.name} is below reorder point`,
      severity: p.stock === 0 ? 'Critical' : 'Warning',
    }))
    const variance = branchStats.filter((r) => r.cashVariance !== 0).map((r) => ({
      id: `var-${r.id}`,
      type: 'Cash variance',
      message: `${r.name}: ${money(r.cashVariance)} variance`,
      severity: r.cashVariance < 0 ? 'Critical' : 'Low',
    }))
    return [...stock, ...variance]
  }, [dashData, branchStats])

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-52 shimmer-bar rounded-lg" />
          <div className="flex gap-2">
            <div className="h-9 w-32 shimmer-bar rounded-lg" />
            <div className="h-9 w-28 shimmer-bar rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="shimmer-bar rounded h-4 w-32 mb-5" />
            <div className="shimmer-bar rounded h-52 w-full" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="shimmer-bar rounded h-4 w-28 mb-5" />
            <div className="space-y-4">{[0,1,2,3].map((i) => <div key={i} className="shimmer-bar rounded h-6 w-full" />)}</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="shimmer-bar rounded h-4 w-40 mb-5" />
          <SkeletonTable rows={3} cols={4} />
        </div>
      </div>
    )
  }

  if (!accessibleBranches.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-sm font-semibold text-amber-800">
        No active branch is assigned to this account. Ask an administrator to assign a branch.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {period.label} · {dashboardBranches.length} branch{dashboardBranches.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Period pill buttons — desktop */}
          <div className="hidden sm:flex gap-1 bg-slate-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriodKey(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${periodKey === value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Period filter — collapsed to one button on mobile */}
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setPeriodMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {period.label}
              <FaChevronDown className="text-[10px] text-slate-400" />
            </button>
            {periodMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPeriodMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {PERIOD_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setPeriodKey(value); setPeriodMenuOpen(false) }}
                      className={`block w-full px-3 py-2 text-left text-xs font-semibold ${periodKey === value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {accessibleBranches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              <option value="active">Active branch</option>
              <option value="all">All branches</option>
            </select>
          )}
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 shadow-sm">
            <FaFileExport />Export
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Period Sales"
          value={money(periodTotalSales)}
          sub={totalTxCount > 0 ? `${totalTxCount.toLocaleString()} transactions` : undefined}
          icon={FaCashRegister}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          change={period.label}
          changeTone="good"
        />
        {isBranchAdmin && (
          <StatCard
            title="Gross Profit"
            value={money(totalGrossProfit)}
            sub={profitMargin > 0 ? `${profitMargin.toFixed(1)}% margin` : undefined}
            icon={FaChartLine}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            change="Live"
            changeTone="neutral"
          />
        )}
        <StatCard
          title="Cash Variance"
          value={money(totalCashVariance)}
          sub="Open shifts"
          icon={FaMoneyBillWave}
          gradient={`bg-gradient-to-br ${totalCashVariance === 0 ? 'from-teal-500 to-teal-700' : totalCashVariance < 0 ? 'from-red-500 to-red-700' : 'from-amber-500 to-orange-600'}`}
          change={totalCashVariance === 0 ? 'Balanced' : totalCashVariance < 0 ? 'Short' : 'Over'}
          changeTone={totalCashVariance === 0 ? 'good' : 'bad'}
        />
        <StatCard
          title="Stock Alerts"
          value={String(lowStockCount)}
          sub={money(totalStockValue) + ' stock value'}
          icon={FaBoxes}
          gradient={`bg-gradient-to-br ${lowStockCount === 0 ? 'from-violet-500 to-violet-700' : 'from-rose-500 to-rose-700'}`}
          change={lowStockCount === 0 ? 'All stocked' : `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} low`}
          changeTone={lowStockCount === 0 ? 'good' : 'bad'}
        />
      </div>

      {/* ── Sales trend + Payment mix ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section
          title="Sales Trend"
          icon={FaChartLine}
          right={`${period.date_from} → ${period.date_to}`}
          className="xl:col-span-2"
        >
          <SalesTrendChart rows={salesTrend} />
        </Section>
        <Section title="Payment Mix" icon={FaTags}>
          <PaymentMix rows={paymentMix} />
        </Section>
      </div>

      {/* ── Branch performance ── */}
      {branchStats.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <FaStore className="text-slate-400" />
              <h2 className="font-semibold text-slate-900">Branch Performance</h2>
            </div>
            <span className="text-xs text-slate-500">{period.label}</span>
          </div>
          <div className="p-5">
            <BranchBars rows={branchStats} />
          </div>
          {/* Branch table */}
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Branch', 'Location', 'Sales', ...(isBranchAdmin ? ['Gross Profit', 'Margin'] : []), 'Transactions', 'Cash Variance'].map((col, i) => (
                    <th key={col} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i > 1 ? 'text-right' : 'text-left'}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchStats.map((r) => {
                  const margin = r.salesToday > 0 ? (r.grossProfit / r.salesToday) * 100 : 0
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-5 py-3.5 text-slate-500">{r.location || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-semibold">{money(r.salesToday)}</td>
                      {isBranchAdmin && <td className="px-5 py-3.5 text-right text-blue-700 font-semibold">{money(r.grossProfit)}</td>}
                      {isBranchAdmin && <td className="px-5 py-3.5 text-right text-slate-600">{pct(margin)}</td>}
                      <td className="px-5 py-3.5 text-right text-slate-600">{(r.txCount || 0).toLocaleString()}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${r.cashVariance === 0 ? 'text-emerald-600' : r.cashVariance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {money(r.cashVariance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alerts + Recent Sales ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <FaBell className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">Priority Alerts</h2>
            {alerts.length > 0 && (
              <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{alerts.length}</span>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${alert.severity === 'Critical' ? 'bg-red-100' : alert.severity === 'Warning' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  <FaExclamationTriangle className={`text-xs ${alert.severity === 'Critical' ? 'text-red-600' : alert.severity === 'Warning' ? 'text-amber-600' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">{alert.type}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{alert.message}</p>
                </div>
                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${alert.severity === 'Critical' ? 'bg-red-50 text-red-700' : alert.severity === 'Warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
                  {alert.severity}
                </span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <FaBell className="text-emerald-500" />
                </div>
                <p className="text-sm text-slate-400">No active alerts</p>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <FaShoppingCart className="text-emerald-600" />
              <h2 className="font-semibold text-slate-900">Recent Sales</h2>
            </div>
            <span className="text-xs text-slate-500">{recentSales.length} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Receipt', 'Time', 'Cashier', 'Amount', 'Payment'].map((col, i) => (
                    <th key={col} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i === 3 ? 'text-right' : 'text-left'}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale) => {
                  const pay = (sale.payments || []).find((p) => p.method === 'cash') || (sale.payments || [])[0]
                  const time = sale.created_at ? new Date(sale.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'
                  return (
                    <tr key={sale.id || sale.receipt_no} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">{sale.receipt_no}</td>
                      <td className="px-5 py-3 text-slate-500">{time}</td>
                      <td className="px-5 py-3 text-slate-600">{sale.cashier_name || '—'}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{money(sale.total)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          pay?.method === 'cash' ? 'bg-emerald-50 text-emerald-700' :
                          pay?.method === 'mpesa' ? 'bg-blue-50 text-blue-700' :
                          pay?.method === 'card' ? 'bg-violet-50 text-violet-700' : 'bg-slate-50 text-slate-600'
                        }`}>
                          {pay?.method || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {recentSales.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No sales in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Dashboard
