import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FaBan, FaCashRegister, FaCheck, FaChevronLeft, FaChevronRight, FaClock,
  FaDownload, FaEdit, FaEye, FaFileExcel, FaFilePdf, FaFilter, FaPlus,
  FaPrint, FaSearch, FaTags, FaTimes, FaTrash
} from 'react-icons/fa'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'
import { SkeletonTable, Spinner } from '../components/LoadingKit'

const money = (v) => `KES ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SECTION_PERMISSIONS = {
  Transactions: ['sales.view'],
  Voids: ['sale.void'],
  'Returns & Refunds': ['sale.refund', 'sale.refund.approve'],
  'Cash Management': ['cash.manage'],
  'Cashier Summary': ['shift.view'],
  Payments: ['sales.payments'],
  'Discounts Log': ['sales.discounts', 'sale.discount'],
  'Discount Engine': ['admin.pricing', 'sale.discount'],
  'Price Scheduler': ['admin.pricing'],
  'Customer Sales': ['sales.customer'],
  Reports: ['reports.view'],
  'Audit Logs': ['sales.audit', 'admin.audit'],
}

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const addDays = (date, days) => { const n = new Date(date); n.setDate(n.getDate() + days); return n }
const startOfWeek = (date) => { const n = new Date(date); const d = n.getDay() || 7; n.setDate(n.getDate() - d + 1); return n }
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const transactionPeriod = (key) => {
  const today = new Date()
  if (key === 'yesterday') return { date_from: isoDate(addDays(today, -1)), date_to: isoDate(addDays(today, -1)) }
  if (key === 'week') { const s = startOfWeek(today); return { date_from: isoDate(s), date_to: isoDate(addDays(s, 6)) } }
  if (key === 'month') return { date_from: isoDate(startOfMonth(today)), date_to: isoDate(today) }
  if (key === '7days') return { date_from: isoDate(addDays(today, -6)), date_to: isoDate(today) }
  if (key === '30days') return { date_from: isoDate(addDays(today, -29)), date_to: isoDate(today) }
  if (key === 'all') return {}
  return { date_from: isoDate(today), date_to: isoDate(today) }
}

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return { results: payload, count: payload.length }
  return { results: payload?.results || [], count: payload?.count ?? (payload?.results?.length || 0), next: payload?.next, previous: payload?.previous }
}

const mapCashierRow = (row) => ({
  shiftId: row.shift_id, cashier: row.cashier_name || 'Cashier',
  register: row.register_code || `REG-${row.register_id}`, branch: row.branch_name || `Branch ${row.branch_id}`,
  openedAt: row.opened_at ? new Date(row.opened_at).toLocaleString() : '—',
  closedAt: row.closed_at ? new Date(row.closed_at).toLocaleString() : 'Open',
  opening: Number(row.opening_cash || 0), expected: Number(row.expected_cash || 0),
  counted: row.counted_cash == null ? null : Number(row.counted_cash),
  variance: Number(row.cash_variance || 0), varianceStatus: row.variance_status || 'balanced',
  cashSales: Number(row.cash_sales_total || 0), mpesaSales: Number(row.mpesa_sales_total || 0),
  cardSales: Number(row.card_sales_total || 0), salesCount: Number(row.sales_count || 0),
  salesTotal: Number(row.sales_total || 0), cashIn: Number(row.manual_cash_in || 0),
  cashOut: Number(row.manual_cash_out || 0), status: row.status === 'open' ? 'Open' : 'Closed', raw: row,
})

const mapSale = (sale, branchName) => ({
  receipt: sale.receipt_no, saleId: sale.id,
  customer: sale.customer_name || 'Walk-in Customer',
  cashier: sale.cashier_name || sale.cashier_username || 'Cashier',
  branch: branchName || sale.branch_name || `Branch ${sale.branch}`,
  payment: sale.payments?.[0]?.method || 'cash',
  product: sale.items?.[0]?.product_name || 'Multiple items',
  amount: Number(sale.total), subtotal: Number(sale.subtotal || sale.total), discount: Number(sale.discount_total || 0), tax: Number(sale.tax_total),
  time: new Date(sale.created_at).toLocaleString(),
  terminal: `POS-${sale.register}`,
  status: sale.status === 'voided' ? 'Voided' : 'Completed',
  items: (sale.items || []).map((i) => `${i.product_name} x${i.quantity}`),
  payments: sale.payments || [], raw: sale,
})

const Status = ({ children }) => {
  const tone = { Pending: 'bg-amber-100 text-amber-800', Approved: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-red-100 text-red-800', Open: 'bg-blue-100 text-blue-800', Closed: 'bg-slate-100 text-slate-700', Completed: 'bg-emerald-100 text-emerald-800', Settled: 'bg-blue-100 text-blue-800', Voided: 'bg-red-100 text-red-700', Active: 'bg-emerald-100 text-emerald-800', Inactive: 'bg-slate-100 text-slate-600', Applied: 'bg-blue-100 text-blue-800', Scheduled: 'bg-amber-100 text-amber-800', Due: 'bg-orange-100 text-orange-800' }[children] || 'bg-slate-100 text-slate-700'
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${tone}`}>{children}</span>
}
const VarianceBadge = ({ amount, status: vs }) => {
  const tone = vs === 'over' ? 'bg-emerald-100 text-emerald-800' : vs === 'short' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${tone}`}>{vs === 'over' ? 'Over' : vs === 'short' ? 'Short' : 'Balanced'} {money(Math.abs(amount))}</span>
}

const SalesControl = ({ initialSection = 'Transactions' }) => {
  const { user, can, branch: authBranch, company_branches: companyBranches, reloadSignal } = useAuth()
  const activeSection = initialSection
  const branchName = authBranch?.name || 'Current branch'

  const [query, setQuery] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [rowDetails, setRowDetails] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [transactionRows, setTransactionRows] = useState([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [transactionFilters, setTransactionFilters] = useState({ period: 'today', paymentMethod: '', branchId: '' })

  const [voidRows, setVoidRows] = useState([])
  const [voidsTotal, setVoidsTotal] = useState(0)
  const [voidsPage, setVoidsPage] = useState(1)

  const [liveReturns, setLiveReturns] = useState([])
  const [returnsTotal, setReturnsTotal] = useState(0)
  const [returnsPage, setReturnsPage] = useState(1)
  const [liveDiscounts, setLiveDiscounts] = useState([])
  const [discountsTotal, setDiscountsTotal] = useState(0)
  const [discountsPage, setDiscountsPage] = useState(1)
  const [livePaymentsApi, setLivePaymentsApi] = useState([])
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [cashierRows, setCashierRows] = useState([])
  const [cashierTotal, setCashierTotal] = useState(0)
  const [cashierPage, setCashierPage] = useState(1)
  const [cashierPeriod, setCashierPeriod] = useState('today')
  const [cashierStatus, setCashierStatus] = useState('')
  const [cashierDateFrom, setCashierDateFrom] = useState(isoDate(new Date()))
  const [cashierDateTo, setCashierDateTo] = useState(isoDate(new Date()))
  const [paymentsPeriod, setPaymentsPeriod] = useState('today')
  const [paymentsDateFrom, setPaymentsDateFrom] = useState(isoDate(new Date()))
  const [paymentsDateTo, setPaymentsDateTo] = useState(isoDate(new Date()))
  const [discountsLogPeriod, setDiscountsLogPeriod] = useState('today')
  const [discountsLogDateFrom, setDiscountsLogDateFrom] = useState(isoDate(new Date()))
  const [discountsLogDateTo, setDiscountsLogDateTo] = useState(isoDate(new Date()))
  const [auditLogsPeriod, setAuditLogsPeriod] = useState('today')
  const [auditLogsDateFrom, setAuditLogsDateFrom] = useState(isoDate(new Date()))
  const [auditLogsDateTo, setAuditLogsDateTo] = useState(isoDate(new Date()))
  const [discountLogsPeriod, setDiscountLogsPeriod] = useState('today')
  const [discountLogsDateFrom, setDiscountLogsDateFrom] = useState(isoDate(new Date()))
  const [discountLogsDateTo, setDiscountLogsDateTo] = useState(isoDate(new Date()))
  const [priceLogsPeriod, setPriceLogsPeriod] = useState('today')
  const [priceLogsDateFrom, setPriceLogsDateFrom] = useState(isoDate(new Date()))
  const [priceLogsDateTo, setPriceLogsDateTo] = useState(isoDate(new Date()))
  const [reportDateFrom, setReportDateFrom] = useState(isoDate(new Date()))
  const [reportDateTo, setReportDateTo] = useState(isoDate(new Date()))
  const [liveCustomerSales, setLiveCustomerSales] = useState([])
  const [customerSalesTotal, setCustomerSalesTotal] = useState(0)
  const [customerSalesPage, setCustomerSalesPage] = useState(1)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogsTotal, setAuditLogsTotal] = useState(0)
  const [auditLogsPage, setAuditLogsPage] = useState(1)

  // Discount Engine state
  const [discountRules, setDiscountRules] = useState([])
  const [discountForm, setDiscountForm] = useState(null)
  const [discountSaving, setDiscountSaving] = useState(false)
  const [discountBranchId, setDiscountBranchId] = useState('')
  const [discountEngineTab, setDiscountEngineTab] = useState('rules')
  const [discountLogs, setDiscountLogs] = useState([])
  const [discountLogsTotal, setDiscountLogsTotal] = useState(0)
  const [discountLogsPage, setDiscountLogsPage] = useState(1)

  // Price Scheduler state
  const [priceSchedules, setPriceSchedules] = useState([])
  const [priceForm, setPriceForm] = useState(null)
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceProducts, setPriceProducts] = useState([])
  const [priceBranchId, setPriceBranchId] = useState('')
  const [priceSchedulerTab, setPriceSchedulerTab] = useState('schedules')
  const [priceLogs, setPriceLogs] = useState([])
  const [priceLogsTotal, setPriceLogsTotal] = useState(0)
  const [priceLogsPage, setPriceLogsPage] = useState(1)

  // Shared product & category lists (loaded for Discount Engine + Price Scheduler)
  const [sharedProducts, setSharedProducts] = useState([])
  const [sharedCategories, setSharedCategories] = useState([])

  // Reports state
  const [reportPeriod, setReportPeriod] = useState('today')
  const [reportLoading, setReportLoading] = useState(false)
  const [cashierPerf, setCashierPerf] = useState([])
  const [productSales, setProductSales] = useState([])
  const [hourlySales, setHourlySales] = useState([])
  const [activeReport, setActiveReport] = useState('cashier')

  const branchId = authBranch?.id
  const transactionBranchId = transactionFilters.branchId || branchId
  const branchOptions = useMemo(() => {
    const rows = (companyBranches?.length ? companyBranches : authBranch ? [authBranch] : []).filter((r) => r?.id && r?.is_active !== false)
    return rows
  }, [authBranch, companyBranches])

  useEffect(() => {
    if (!branchId) return
    // Always sync to the new branch when top-bar company/branch switcher fires
    setTransactionFilters((c) => ({ ...c, branchId: String(branchId) }))
    setDiscountBranchId(String(branchId))
    setPriceBranchId(String(branchId))
    // Clear stale data from the previous company / branch immediately so the
    // user never sees old records while the fresh API calls are in-flight
    setTransactionRows([]); setTransactionsTotal(0); setTransactionsPage(1)
    setVoidRows([]); setVoidsTotal(0); setVoidsPage(1)
    setLiveReturns([]); setReturnsTotal(0); setReturnsPage(1)
    setLiveDiscounts([]); setDiscountsTotal(0); setDiscountsPage(1)
    setLivePaymentsApi([]); setPaymentsTotal(0); setPaymentsPage(1)
    setCashierRows([]); setCashierTotal(0); setCashierPage(1)
    setLiveCustomerSales([]); setCustomerSalesTotal(0); setCustomerSalesPage(1)
    setAuditLogs([]); setAuditLogsTotal(0); setAuditLogsPage(1)
    setCashierPerf([]); setProductSales([]); setHourlySales([])
    // Clear pricing/product caches and open forms
    setSharedProducts([]); setSharedCategories([]); setPriceProducts([])
    setDiscountRules([]); setPriceSchedules([])
    setDiscountForm(null); setPriceForm(null)
  }, [branchId, reloadSignal])

  const loadTransactions = useCallback(async () => {
    if (!transactionBranchId) { setMessage('No active branch.'); setTransactionRows([]); setTransactionsTotal(0); return }
    setLoading(true); setMessage('')
    try {
      const period = transactionPeriod(transactionFilters.period)
      const selectedBranchName = branchOptions.find((r) => String(r.id) === String(transactionBranchId))?.name || branchName
      const response = await posApi.transactions({ branch: transactionBranchId, page: transactionsPage, page_size: pageSize, search: query.trim() || undefined, payment_method: transactionFilters.paymentMethod || undefined, ...period })
      const { results, count } = unwrapList(response)
      const rows = results.map((sale) => mapSale(sale, sale.branch_name || selectedBranchName))
      setTransactionRows(rows); setTransactionsTotal(count)
      setSelectedReceipt((c) => rows.some((r) => r.saleId === c?.saleId) ? c : rows[0] || null)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message || 'Could not load.'); setTransactionRows([]); setTransactionsTotal(0) }
    finally { setLoading(false) }
  }, [branchName, branchOptions, transactionBranchId, transactionFilters, transactionsPage, pageSize, query])

  const loadVoids = useCallback(async () => {
    if (!branchId) return; setLoading(true)
    try {
      const response = await posApi.voids({ branch: branchId, page: voidsPage, page_size: pageSize, search: query.trim() || undefined })
      const { results, count } = unwrapList(response)
      setVoidRows(results.map((sale) => mapSale(sale, branchName))); setVoidsTotal(count)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [branchId, branchName, voidsPage, pageSize, query])

  const loadCashierSummary = useCallback(async () => {
    if (!branchId) return; setLoading(true)
    try {
      const q = query.trim().toLowerCase()
      const dateParams = cashierPeriod === 'custom'
        ? (cashierDateFrom ? { date_from: cashierDateFrom, date_to: cashierDateTo || cashierDateFrom } : {})
        : transactionPeriod(cashierPeriod)
      const statusParam = cashierStatus || (q === 'open' || q === 'closed' ? q : undefined)
      const searchParam = q && q !== 'open' && q !== 'closed' ? query.trim() : undefined
      const response = await posApi.cashierSummary({ branch: branchId, page: cashierPage, page_size: pageSize, status: statusParam, search: searchParam, ...dateParams })
      const { results, count } = unwrapList(response)
      setCashierRows(results.map((r) => mapCashierRow({ ...r, branch_name: r.branch_name || branchName }))); setCashierTotal(count)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message); setCashierRows([]); setCashierTotal(0) }
    finally { setLoading(false) }
  }, [branchId, branchName, cashierPage, pageSize, query, cashierPeriod, cashierStatus, cashierDateFrom, cashierDateTo])

  const loadDiscountRules = useCallback(async () => {
    const effectiveBranch = discountBranchId || branchId
    if (!effectiveBranch) return; setLoading(true)
    try {
      const [rulesRes, prodRes, catRes] = await Promise.all([
        posApi.discountRules({ branch: effectiveBranch, page_size: 200 }),
        posApi.products({ branch: effectiveBranch, page_size: 500 }),
        posApi.categories({ branch: effectiveBranch, page_size: 200 }),
      ])
      setDiscountRules(unwrapList(rulesRes).results)
      const prods = unwrapList(prodRes).results
      const cats = unwrapList(catRes).results
      setSharedProducts(prods)
      setSharedCategories(cats)
      if (!priceProducts.length) setPriceProducts(prods)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [branchId, discountBranchId, priceProducts.length])

  const loadDiscountLogs = useCallback(async () => {
    const effectiveBranch = discountBranchId || branchId
    if (!effectiveBranch) return; setLoading(true)
    try {
      const dateParams = discountLogsPeriod === 'custom'
        ? (discountLogsDateFrom ? { date_from: discountLogsDateFrom, date_to: discountLogsDateTo || discountLogsDateFrom } : {})
        : transactionPeriod(discountLogsPeriod)
      const res = await posApi.discountRuleLogs({ branch: effectiveBranch, page: discountLogsPage, page_size: pageSize, ...dateParams })
      const { results, count } = unwrapList(res)
      setDiscountLogs(results); setDiscountLogsTotal(count)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [branchId, discountBranchId, discountLogsPage, pageSize, discountLogsPeriod, discountLogsDateFrom, discountLogsDateTo])

  const loadPriceSchedules = useCallback(async () => {
    const effectiveBranch = priceBranchId || branchId
    if (!effectiveBranch) return; setLoading(true)
    try {
      const [schedRes, prodRes, catRes] = await Promise.all([
        posApi.priceSchedules({ branch: effectiveBranch, page_size: 200 }),
        posApi.products({ branch: effectiveBranch, page_size: 500 }),
        posApi.categories({ branch: effectiveBranch, page_size: 200 }),
      ])
      setPriceSchedules(unwrapList(schedRes).results)
      const prods = unwrapList(prodRes).results
      const cats = unwrapList(catRes).results
      setPriceProducts(prods)
      setSharedProducts(prods)
      setSharedCategories(cats)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [branchId, priceBranchId])

  const loadPriceLogs = useCallback(async () => {
    const effectiveBranch = priceBranchId || branchId
    if (!effectiveBranch) return; setLoading(true)
    try {
      const dateParams = priceLogsPeriod === 'custom'
        ? (priceLogsDateFrom ? { date_from: priceLogsDateFrom, date_to: priceLogsDateTo || priceLogsDateFrom } : {})
        : transactionPeriod(priceLogsPeriod)
      const res = await posApi.priceScheduleLogs({ branch: effectiveBranch, page: priceLogsPage, page_size: pageSize, ...dateParams })
      const { results, count } = unwrapList(res)
      setPriceLogs(results); setPriceLogsTotal(count)
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [branchId, priceBranchId, priceLogsPage, pageSize, priceLogsPeriod, priceLogsDateFrom, priceLogsDateTo])

  const loadReports = useCallback(async () => {
    if (!branchId) return; setReportLoading(true)
    const dateParams = reportPeriod === 'custom'
      ? (reportDateFrom ? { date_from: reportDateFrom, date_to: reportDateTo || reportDateFrom } : {})
      : transactionPeriod(reportPeriod)
    const params = { branch: branchId, ...dateParams }
    try {
      const [perfRes, prodRes, hourRes] = await Promise.all([
        posApi.cashierPerformance(params),
        posApi.productSalesReport(params),
        posApi.hourlySalesReport(params),
      ])
      setCashierPerf(Array.isArray(perfRes) ? perfRes : perfRes?.results || [])
      setProductSales(Array.isArray(prodRes) ? prodRes : prodRes?.results || [])
      setHourlySales(Array.isArray(hourRes) ? hourRes : hourRes?.results || [])
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setReportLoading(false) }
  }, [branchId, reportPeriod, reportDateFrom, reportDateTo])

  const loadOtherSection = useCallback(async () => {
    if (!branchId) return; setLoading(true)
    const base = { branch: branchId, page_size: pageSize }
    try {
      if (activeSection === 'Returns & Refunds') {
        const r = await posApi.saleReturns({ ...base, page: returnsPage })
        const { results, count } = unwrapList(r); setLiveReturns(results); setReturnsTotal(count)
      } else if (activeSection === 'Payments') {
        const dateParams = paymentsPeriod === 'custom'
          ? (paymentsDateFrom ? { date_from: paymentsDateFrom, date_to: paymentsDateTo || paymentsDateFrom } : {})
          : transactionPeriod(paymentsPeriod)
        const r = await posApi.payments({ ...base, page: paymentsPage, ...dateParams })
        const { results, count } = unwrapList(r)
        setLivePaymentsApi(results.map((p) => ({ reference: p.reference || `${p.receipt_no}-${p.id}`, method: p.method, amount: Number(p.amount), transactionId: p.receipt_no, status: p.sale_status === 'voided' ? 'Voided' : 'Completed' })))
        setPaymentsTotal(count)
      } else if (activeSection === 'Discounts Log') {
        const dateParams = discountsLogPeriod === 'custom'
          ? (discountsLogDateFrom ? { date_from: discountsLogDateFrom, date_to: discountsLogDateTo || discountsLogDateFrom } : {})
          : transactionPeriod(discountsLogPeriod)
        const r = await posApi.discountsLog({ ...base, page: discountsPage, ...dateParams })
        const { results, count } = unwrapList(r); setLiveDiscounts(results); setDiscountsTotal(count)
      } else if (activeSection === 'Customer Sales') {
        const r = await posApi.customerSales({ ...base, page: customerSalesPage })
        const { results, count } = unwrapList(r); setLiveCustomerSales(results); setCustomerSalesTotal(count)
      } else if (activeSection === 'Audit Logs') {
        const dateParams = auditLogsPeriod === 'custom'
          ? (auditLogsDateFrom ? { date_from: auditLogsDateFrom, date_to: auditLogsDateTo || auditLogsDateFrom } : {})
          : transactionPeriod(auditLogsPeriod)
        const r = await posApi.auditLogs({ ...base, page: auditLogsPage, sales_only: true, ...dateParams })
        const { results, count } = unwrapList(r); setAuditLogs(results); setAuditLogsTotal(count)
      }
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setLoading(false) }
  }, [activeSection, branchId, pageSize, returnsPage, paymentsPage, discountsPage, customerSalesPage, auditLogsPage,
    paymentsPeriod, paymentsDateFrom, paymentsDateTo,
    discountsLogPeriod, discountsLogDateFrom, discountsLogDateTo,
    auditLogsPeriod, auditLogsDateFrom, auditLogsDateTo])

  useEffect(() => {
    if (!branchId) return
    const timer = setTimeout(() => {
      if (activeSection === 'Transactions') loadTransactions()
      else if (activeSection === 'Voids') loadVoids()
      else if (activeSection === 'Cashier Summary' || activeSection === 'Cash Management') loadCashierSummary()
      else if (activeSection === 'Discount Engine') {
        if (discountEngineTab === 'rules') loadDiscountRules()
        else loadDiscountLogs()
      }
      else if (activeSection === 'Price Scheduler') {
        if (priceSchedulerTab === 'schedules') loadPriceSchedules()
        else loadPriceLogs()
      }
      else if (activeSection === 'Reports') loadReports()
      else if (!['Reports'].includes(activeSection)) loadOtherSection()
    }, query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [activeSection, branchId, reloadSignal, loadTransactions, loadVoids, loadCashierSummary, loadDiscountRules, loadDiscountLogs, loadPriceSchedules, loadPriceLogs, loadReports, loadOtherSection, query, discountEngineTab, priceSchedulerTab])

  useEffect(() => {
    setTransactionsPage(1); setVoidsPage(1); setCashierPage(1)
    setReturnsPage(1); setPaymentsPage(1); setDiscountsPage(1); setCustomerSalesPage(1); setAuditLogsPage(1)
  }, [query, pageSize, transactionFilters.period, transactionFilters.paymentMethod])

  useEffect(() => { setCashierPage(1) }, [cashierPeriod, cashierStatus, cashierDateFrom, cashierDateTo])
  useEffect(() => { setPaymentsPage(1) }, [paymentsPeriod, paymentsDateFrom, paymentsDateTo])
  useEffect(() => { setDiscountsPage(1) }, [discountsLogPeriod, discountsLogDateFrom, discountsLogDateTo])
  useEffect(() => { setAuditLogsPage(1) }, [auditLogsPeriod, auditLogsDateFrom, auditLogsDateTo])
  useEffect(() => { setDiscountLogsPage(1) }, [discountLogsPeriod, discountLogsDateFrom, discountLogsDateTo])
  useEffect(() => { setPriceLogsPage(1) }, [priceLogsPeriod, priceLogsDateFrom, priceLogsDateTo])

  // Reload when pricing branch selection changes
  useEffect(() => {
    if (!discountBranchId || activeSection !== 'Discount Engine') return
    if (discountEngineTab === 'rules') loadDiscountRules()
    else loadDiscountLogs()
  }, [discountBranchId, discountEngineTab])
  useEffect(() => {
    if (!priceBranchId || activeSection !== 'Price Scheduler') return
    if (priceSchedulerTab === 'schedules') loadPriceSchedules()
    else loadPriceLogs()
  }, [priceBranchId, priceSchedulerTab])

  // Reload logs when page changes
  useEffect(() => { if (activeSection === 'Discount Engine' && discountEngineTab === 'logs') loadDiscountLogs() }, [discountLogsPage])
  useEffect(() => { if (activeSection === 'Price Scheduler' && priceSchedulerTab === 'logs') loadPriceLogs() }, [priceLogsPage])

  const cashierTotals = useMemo(() => cashierRows.reduce((acc, r) => {
    acc.salesTotal += r.salesTotal; acc.cashSales += r.cashSales; acc.mpesaSales += r.mpesaSales; acc.cardSales += r.cardSales
    if (r.status === 'Open') acc.openShifts += 1
    if (r.varianceStatus === 'short') acc.shortVariance += Math.abs(r.variance)
    if (r.varianceStatus === 'over') acc.overVariance += r.variance
    if (r.status === 'Closed') acc.closedVariance += r.variance
    return acc
  }, { salesTotal: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, openShifts: 0, shortVariance: 0, overVariance: 0, closedVariance: 0 }), [cashierRows])

  const customerSalesRows = liveCustomerSales.map((c) => ({ name: c.customer_name, totalSpent: Number(c.total_spent || 0), lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleString() : 'No sales', creditSales: Number(c.credit_sales || 0), loyalty: Number(c.receipt_count || 0) }))
  const discountRows = liveDiscounts.map((e) => ({
    receipt: e.receipt_no, saleId: e.sale_id,
    cashier: e.cashier_name, customer: e.customer_name || 'Walk-in',
    subtotal: Number(e.subtotal || 0), discount: Number(e.discount_total || 0), total: Number(e.total || 0),
    time: e.created_at ? new Date(e.created_at).toLocaleString() : '—',
    status: e.status === 'voided' ? 'Voided' : 'Completed',
    itemsDiscounted: e.items_discounted || [],
  }))
  const returnRows = liveReturns.map((item) => ({ id: item.return_no, returnId: item.id, product: item.items?.[0]?.product_name || 'Multiple', quantity: item.items?.reduce((s, l) => s + l.quantity, 0) || 0, amount: Number(item.total_refund), reason: item.reason, status: item.status === 'pending' ? 'Pending' : item.status === 'rejected' ? 'Rejected' : 'Approved', cashier: item.processed_by_name, raw: item }))

  const openReceipt = (r) => { setSelectedReceipt(r); setDetailsOpen(true) }
  const openRowDetails = (title, data) => setRowDetails({ title, data })

  const handleReturnAction = async (returnRow, action) => {
    if (!returnRow?.returnId || !user?.id) return
    try {
      const payload = { user: user.id }
      if (action === 'approve') { await posApi.approveSaleReturn(returnRow.returnId, payload); await posApi.completeSaleReturn(returnRow.returnId, payload) }
      else await posApi.rejectSaleReturn(returnRow.returnId, { ...payload, reason: 'Rejected from Sales Control' })
      setMessage(`${returnRow.id} ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await loadOtherSection()
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
  }

  const voidReceipt = async (sale) => {
    if (!sale?.saleId || (!can('*') && !can('sale.void'))) return
    const reason = window.prompt(`Void reason for ${sale.receipt}:`)
    if (reason === null) return
    try {
      await posApi.voidSale(sale.saleId, { user: user?.id, reason: reason || 'Voided from Sales Control' })
      setMessage(`${sale.receipt} voided.`)
      await loadTransactions()
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
  }

  // Discount Engine handlers
  const emptyDiscountForm = () => ({ name: '', discount_type: 'percent', value: '', target: 'all', category: '', product: '', start_date: '', end_date: '', days_of_week: [], start_time: '', end_time: '', is_active: true, branch: discountBranchId || branchId, id: null })
  const saveDiscountRule = async () => {
    if (!discountForm?.name || !discountForm?.value) { setMessage('Name and value are required.'); return }
    setDiscountSaving(true)
    try {
      const payload = { ...discountForm, value: discountForm.value, branch: discountBranchId || branchId, category: discountForm.category || null, product: discountForm.product || null, start_date: discountForm.start_date || null, end_date: discountForm.end_date || null, start_time: discountForm.start_time || null, end_time: discountForm.end_time || null }
      if (discountForm.id) await posApi.updateDiscountRule(discountForm.id, payload)
      else await posApi.createDiscountRule(payload)
      setDiscountForm(null); await loadDiscountRules()
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setDiscountSaving(false) }
  }
  const deleteDiscountRule = async (rule) => {
    if (!window.confirm(`Delete discount rule "${rule.name}"?`)) return
    try { await posApi.deleteDiscountRule(rule.id); await loadDiscountRules() }
    catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
  }

  // Price Scheduler handlers
  const emptyPriceForm = () => ({ product: '', new_retail_price: '', new_wholesale_price: '', effective_at: '', note: '', branch: priceBranchId || branchId, id: null })
  const savePriceSchedule = async () => {
    if (!priceForm?.product || !priceForm?.effective_at) { setMessage('Product and effective date/time are required.'); return }
    if (!priceForm.new_retail_price && !priceForm.new_wholesale_price) { setMessage('Provide at least one new price.'); return }
    setPriceSaving(true)
    try {
      const payload = { ...priceForm, branch: priceBranchId || branchId, new_retail_price: priceForm.new_retail_price || null, new_wholesale_price: priceForm.new_wholesale_price || null }
      if (priceForm.id) await posApi.updatePriceSchedule(priceForm.id, payload)
      else await posApi.createPriceSchedule(payload)
      setPriceForm(null); await loadPriceSchedules()
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
    finally { setPriceSaving(false) }
  }
  const applyDueSchedules = async () => {
    try {
      const res = await posApi.applyDuePriceSchedules({ branch: priceBranchId || branchId })
      if (res.applied === 0) {
        setMessage('No schedules are due yet. Use the Apply button on a specific row to force-apply it now.')
      } else {
        setMessage(`Applied ${res.applied} price schedule(s).${res.errors?.length ? ` Errors: ${res.errors.join('; ')}` : ''}`)
      }
      await loadPriceSchedules()
    } catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
  }
  const applySingleSchedule = async (ps) => {
    if (!window.confirm(`Apply price change for "${ps.product_name}" now? This will update the product price immediately.`)) return
    try {
      await posApi.applyPriceSchedule(ps.id)
      setMessage(`Price schedule for "${ps.product_name}" applied successfully.`)
      await loadPriceSchedules()
    } catch (err) { setMessage(err.data?.detail || err.data ? JSON.stringify(err.data) : err.message) }
  }
  const deletePriceSchedule = async (ps) => {
    if (ps.is_applied) { setMessage('Cannot delete an already-applied schedule.'); return }
    if (!window.confirm('Delete this price schedule?')) return
    try { await posApi.deletePriceSchedule(ps.id); await loadPriceSchedules() }
    catch (err) { setMessage(err.data ? JSON.stringify(err.data) : err.message) }
  }

  if (!branchId) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">No active branch. Select a branch from the header.</div>
  }

  const requiredPermissions = SECTION_PERMISSIONS[activeSection] || []
  const allowed = can('*') || requiredPermissions.some((p) => can(p))
  if (!allowed) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">You do not have permission to view {activeSection}.</div>
  }

  return (
    <div className="space-y-4 min-h-[50vh]">
      {message && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}<button className="ml-3 text-amber-600 hover:underline text-xs" onClick={() => setMessage('')}>Dismiss</button></div>}

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sales Control / {activeSection}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Server-paged lists ({transactionsTotal.toLocaleString()} transactions in branch).</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm hover:bg-slate-50"><FaFileExcel className="mr-2 text-emerald-600" />Excel</button>
          <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-slate-900 text-white rounded-lg text-xs sm:text-sm hover:bg-slate-800"><FaFilePdf className="mr-2" />PDF</button>
        </div>
      </div>

      {/* Transactions */}
      {activeSection === 'Transactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <Panel title="Completed Transactions" icon={FaCashRegister} loading={loading}
            right={<div className="hidden sm:flex gap-1"><button className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center hover:bg-slate-200"><FaPrint className="mr-1" />Print</button><button className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center hover:bg-slate-200"><FaFilePdf className="mr-1" />PDF</button></div>}
            footer={!loading && <GridFooter page={transactionsPage} pageSize={pageSize} total={transactionsTotal} shown={transactionRows.length} onPageChange={setTransactionsPage} onPageSizeChange={setPageSize} />}
          >
            <TransactionToolbar query={query} setQuery={setQuery} resultCount={transactionsTotal} branchName={branchName} filters={transactionFilters} setFilters={setTransactionFilters} branchOptions={branchOptions} loading={loading} />
            {loading ? <SkeletonTable rows={9} cols={7} /> : (
              <>
                <DenseTable
                  columns={['Receipt', 'Time', 'Branch', 'Terminal', 'Cashier', 'Customer', 'Payment', 'Product', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Action']}
                  rows={transactionRows.map((sale) => [
                    sale.receipt, sale.time, sale.branch, sale.terminal, sale.cashier, sale.customer,
                    sale.payment, sale.product, money(sale.subtotal || sale.amount), money(sale.discount || 0), money(sale.tax),
                    money(sale.amount),
                    <Status key={`${sale.saleId}-s`}>{sale.status}</Status>,
                    <button key={`${sale.saleId}-v`} type="button" onClick={(e) => { e.stopPropagation(); openReceipt(sale) }} className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded hover:bg-slate-200"><FaEye /></button>,
                  ])}
                  rowData={transactionRows} onRowClick={openReceipt} pinFirst numericColumns={[8, 9, 10, 11]}
                />
                {!transactionRows.length && <EmptyState text="No transactions match your search." />}
              </>
            )}
          </Panel>
          <div className="hidden lg:block">
            {selectedReceipt && <ReceiptDrawer receipt={selectedReceipt} onClose={() => setDetailsOpen(false)} onVoid={voidReceipt} canVoid={can('*') || can('sale.void')} />}
          </div>
        </div>
      )}

      {/* Voids */}
      {activeSection === 'Voids' && (
        <Panel title="Voided Transactions" icon={FaTimes} loading={loading}
          footer={!loading && <GridFooter page={voidsPage} pageSize={pageSize} total={voidsTotal} shown={voidRows.length} onPageChange={setVoidsPage} onPageSizeChange={setPageSize} />}
        >
          <TransactionToolbar query={query} setQuery={setQuery} resultCount={voidsTotal} branchName={branchName} loading={loading} />
          {loading ? <SkeletonTable rows={8} cols={5} /> : (
            <>
              <DenseTable columns={['Receipt', 'Cashier', 'Amount', 'Reason', 'Voided By', 'Timestamp']}
                rows={voidRows.map((v) => [v.receipt, v.cashier, money(v.amount), v.raw?.void_reason || '—', v.raw?.voided_by_name || '—', v.time])}
                rowData={voidRows} onRowClick={(r) => openRowDetails(r.receipt, r)} numericColumns={[2]}
              />
              {!voidRows.length && <EmptyState text="No voided transactions found." />}
            </>
          )}
        </Panel>
      )}

      {/* Returns */}
      {activeSection === 'Returns & Refunds' && (
        <Panel title="Returns & Refunds" icon={FaDownload} loading={loading}
          footer={!loading && <GridFooter page={returnsPage} pageSize={pageSize} total={returnsTotal} shown={returnRows.length} onPageChange={setReturnsPage} onPageSizeChange={setPageSize} />}
        >
          {loading ? <SkeletonTable rows={8} cols={5} /> : (
            <>
              <DenseTable columns={['Request', 'Product', 'Qty', 'Refund', 'Reason', 'Status', 'Actions']}
                rows={returnRows.map((r) => [r.id, r.product, r.quantity, money(r.amount), r.reason, <Status key={r.id}>{r.status}</Status>,
                  r.status === 'Pending' ? (<div key={r.id+'-a'} className="flex gap-1"><button type="button" onClick={(e) => { e.stopPropagation(); handleReturnAction(r, 'approve') }} className="p-1.5 bg-emerald-100 text-emerald-700 rounded"><FaCheck /></button><button type="button" onClick={(e) => { e.stopPropagation(); handleReturnAction(r, 'reject') }} className="p-1.5 bg-red-100 text-red-700 rounded"><FaTimes /></button></div>) : 'Locked',
                ])}
                rowData={returnRows} onRowClick={(r) => openRowDetails(r.id, r)} numericColumns={[2, 3]}
              />
              {!returnRows.length && <EmptyState text="No returns found." />}
            </>
          )}
        </Panel>
      )}

      {/* Cashier Summary */}
      {(activeSection === 'Cashier Summary' || activeSection === 'Cash Management') && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }, (_, i) => (<div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"><div className="shimmer-bar rounded h-2.5 w-20" /><div className="shimmer-bar rounded h-5 w-28" /></div>))}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <SummaryCard label="Shifts (page)" value={String(cashierRows.length)} />
                <SummaryCard label="Open shifts" value={String(cashierTotals.openShifts)} tone="blue" />
                <SummaryCard label="Sales total" value={money(cashierTotals.salesTotal)} />
                <SummaryCard label="Cash sales" value={money(cashierTotals.cashSales)} />
                <SummaryCard label="M-Pesa sales" value={money(cashierTotals.mpesaSales)} />
                <SummaryCard label="Card sales" value={money(cashierTotals.cardSales)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Cash short (page)" value={money(cashierTotals.shortVariance)} tone="red" />
                <SummaryCard label="Cash over (page)" value={money(cashierTotals.overVariance)} tone="emerald" />
                <SummaryCard label="Net variance (closed)" value={money(cashierTotals.closedVariance)} tone={cashierTotals.closedVariance < 0 ? 'red' : cashierTotals.closedVariance > 0 ? 'emerald' : 'slate'} />
              </div>
            </>
          )}
          <Panel title="Cashier Summary & Cash Variances" icon={FaCashRegister} loading={loading}
            footer={!loading && <GridFooter page={cashierPage} pageSize={pageSize} total={cashierTotal} shown={cashierRows.length} onPageChange={setCashierPage} onPageSizeChange={setPageSize} />}
          >
            {/* Date period filter bar */}
            <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap gap-1">
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: '7days', label: 'Last 7 days' },
                  { value: '30days', label: 'Last 30 days' },
                  { value: 'week', label: 'This week' },
                  { value: 'month', label: 'This month' },
                  { value: 'all', label: 'All time' },
                  { value: 'custom', label: 'Custom' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCashierPeriod(value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${cashierPeriod === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {cashierPeriod === 'custom' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    value={cashierDateFrom}
                    max={cashierDateTo || isoDate(new Date())}
                    onChange={(e) => setCashierDateFrom(e.target.value)}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <input
                    type="date"
                    value={cashierDateTo}
                    min={cashierDateFrom}
                    max={isoDate(new Date())}
                    onChange={(e) => setCashierDateTo(e.target.value)}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <FilterSelect
                  label="Status"
                  value={cashierStatus}
                  onChange={setCashierStatus}
                  options={[{ value: '', label: 'All shifts' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]}
                />
              </div>
            </div>
            <TransactionToolbar query={query} setQuery={setQuery} resultCount={cashierTotal} branchName={branchName} loading={loading} />
            {loading ? <SkeletonTable rows={8} cols={6} /> : (
              <>
                <div className="px-2 pb-2 text-[11px] text-slate-500 border-b border-slate-200">Variance = counted − expected. Search cashier name or register code.</div>
                <DenseTable
                  columns={['Cashier', 'Register', 'Opened', 'Closed', 'Sales', 'Cash', 'M-Pesa', 'Card', 'Opening', 'Expected', 'Counted', 'Variance', 'Status']}
                  rows={cashierRows.map((r) => [r.cashier, r.register, r.openedAt, r.closedAt, `${r.salesCount} / ${money(r.salesTotal)}`, money(r.cashSales), money(r.mpesaSales), money(r.cardSales), money(r.opening), money(r.expected), r.counted == null ? '—' : money(r.counted), <VarianceBadge key={`${r.shiftId}-v`} amount={r.variance} status={r.varianceStatus} />, <Status key={`${r.shiftId}-s`}>{r.status}</Status>])}
                  rowData={cashierRows}
                  onRowClick={(r) => openRowDetails(`SHIFT-${r.shiftId} — ${r.cashier}`, { cashier: r.cashier, register: r.register, branch: r.branch, opened: r.openedAt, closed: r.closedAt, opening_cash: money(r.opening), expected_cash: money(r.expected), counted_cash: r.counted == null ? 'Not counted' : money(r.counted), variance: `${r.varianceStatus} ${money(r.variance)}`, cash_sales: money(r.cashSales), mpesa_sales: money(r.mpesaSales), card_sales: money(r.cardSales), sales: `${r.salesCount} receipts, ${money(r.salesTotal)}`, status: r.status })}
                  pinFirst numericColumns={[5, 6, 7, 8, 9, 10]}
                />
                {!cashierRows.length && <EmptyState text="No cashier shifts found." />}
              </>
            )}
          </Panel>
        </div>
      )}

      {/* Payments */}
      {activeSection === 'Payments' && (
        <Panel title="Payment Records" icon={FaCashRegister} loading={loading}
          footer={!loading && <GridFooter page={paymentsPage} pageSize={pageSize} total={paymentsTotal} shown={livePaymentsApi.length} onPageChange={setPaymentsPage} onPageSizeChange={setPageSize} />}
        >
          <DateFilterBar period={paymentsPeriod} setPeriod={setPaymentsPeriod}
            dateFrom={paymentsDateFrom} setDateFrom={setPaymentsDateFrom}
            dateTo={paymentsDateTo} setDateTo={setPaymentsDateTo} />
          {loading ? <SkeletonTable rows={8} cols={4} /> : (
            <>
              <DenseTable columns={['Payment Reference', 'Method', 'Amount', 'Transaction ID', 'Status']}
                rows={livePaymentsApi.map((p) => [p.reference, p.method, money(p.amount), p.transactionId, <Status key={p.reference}>{p.status}</Status>])}
                rowData={livePaymentsApi} onRowClick={(r) => openRowDetails(r.reference, r)} numericColumns={[2]}
              />
              {!livePaymentsApi.length && <EmptyState text="No payments found." />}
            </>
          )}
        </Panel>
      )}

      {/* Discounts Log */}
      {activeSection === 'Discounts Log' && (
        <Panel title="Discounts Log" icon={FaFilter} loading={loading}
          footer={!loading && <GridFooter page={discountsPage} pageSize={pageSize} total={discountsTotal} shown={discountRows.length} onPageChange={setDiscountsPage} onPageSizeChange={setPageSize} />}
        >
          <DateFilterBar period={discountsLogPeriod} setPeriod={setDiscountsLogPeriod}
            dateFrom={discountsLogDateFrom} setDateFrom={setDiscountsLogDateFrom}
            dateTo={discountsLogDateTo} setDateTo={setDiscountsLogDateTo} />
          {loading ? <SkeletonTable rows={8} cols={8} /> : (
            <>
              <DenseTable
                columns={['Receipt', 'Date/Time', 'Cashier', 'Customer', 'Subtotal', 'Discount', 'Net Total', 'Items Discounted', 'Status']}
                rows={discountRows.map((d) => [
                  d.receipt, d.time, d.cashier, d.customer,
                  money(d.subtotal), money(d.discount), money(d.total),
                  d.itemsDiscounted.length ? d.itemsDiscounted.map((i) => `${i.product_name} (−${money(i.discount_amount)})`).join(', ') : '—',
                  <Status key={d.saleId}>{d.status}</Status>,
                ])}
                rowData={discountRows} onRowClick={(r) => openRowDetails(r.receipt, r)} numericColumns={[4, 5, 6]}
              />
              {!discountRows.length && <EmptyState text="No discounted transactions found." />}
            </>
          )}
        </Panel>
      )}

      {/* Discount Engine */}
      {activeSection === 'Discount Engine' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button type="button" onClick={() => { setDiscountEngineTab('rules'); setDiscountForm(null) }} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${discountEngineTab === 'rules' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Rules</button>
              <button type="button" onClick={() => { setDiscountEngineTab('logs'); loadDiscountLogs() }} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${discountEngineTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Activity Logs</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {branchOptions.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Branch:</label>
                  <FilterSelect label="Branch" value={discountBranchId} onChange={(v) => { setDiscountBranchId(v); setDiscountForm(null); setSharedProducts([]); setSharedCategories([]) }} options={branchOptions.map((b) => ({ value: String(b.id), label: b.name }))} />
                </div>
              )}
              {discountEngineTab === 'rules' && (
                <button type="button" onClick={() => setDiscountForm(emptyDiscountForm())} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><FaPlus />New Rule</button>
              )}
            </div>
          </div>

          {/* Rules tab */}
          {discountEngineTab === 'rules' && (
            <>
              {discountForm && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
                  <h3 className="font-semibold text-slate-900">{discountForm.id ? 'Edit' : 'New'} Discount Rule</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FormField label="Rule Name" required><input className="form-input" value={discountForm.name} onChange={(e) => setDiscountForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekend Flash Sale" /></FormField>
                    <FormField label="Discount Type"><select className="form-input" value={discountForm.discount_type} onChange={(e) => setDiscountForm((f) => ({ ...f, discount_type: e.target.value }))}><option value="percent">Percentage (%)</option><option value="fixed">Fixed Amount (KES)</option></select></FormField>
                    <FormField label={discountForm.discount_type === 'percent' ? 'Value (%)' : 'Amount (KES)'} required><input type="number" className="form-input" value={discountForm.value} onChange={(e) => setDiscountForm((f) => ({ ...f, value: e.target.value }))} placeholder="e.g. 10" min="0" /></FormField>
                    <FormField label="Applies To"><select className="form-input" value={discountForm.target} onChange={(e) => setDiscountForm((f) => ({ ...f, target: e.target.value, category: '', product: '' }))}><option value="all">All Products</option><option value="category">Category</option><option value="product">Specific Product</option></select></FormField>
                    {discountForm.target === 'category' && (
                      <FormField label="Category" required>
                        <select className="form-input" value={discountForm.category} onChange={(e) => setDiscountForm((f) => ({ ...f, category: e.target.value }))}>
                          <option value="">Select category…</option>
                          {sharedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </FormField>
                    )}
                    {discountForm.target === 'product' && (
                      <FormField label="Product" required>
                        <select className="form-input" value={discountForm.product} onChange={(e) => setDiscountForm((f) => ({ ...f, product: e.target.value }))}>
                          <option value="">Select product…</option>
                          {sharedProducts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                        </select>
                      </FormField>
                    )}
                    <FormField label="Start Date"><input type="date" className="form-input" value={discountForm.start_date} onChange={(e) => setDiscountForm((f) => ({ ...f, start_date: e.target.value }))} /></FormField>
                    <FormField label="End Date"><input type="date" className="form-input" value={discountForm.end_date} onChange={(e) => setDiscountForm((f) => ({ ...f, end_date: e.target.value }))} /></FormField>
                    <FormField label="Start Time (optional)"><input type="time" className="form-input" value={discountForm.start_time} onChange={(e) => setDiscountForm((f) => ({ ...f, start_time: e.target.value }))} /></FormField>
                    <FormField label="End Time (optional)"><input type="time" className="form-input" value={discountForm.end_time} onChange={(e) => setDiscountForm((f) => ({ ...f, end_time: e.target.value }))} /></FormField>
                    <FormField label="Active"><label className="flex items-center gap-2 mt-2 cursor-pointer"><input type="checkbox" checked={discountForm.is_active} onChange={(e) => setDiscountForm((f) => ({ ...f, is_active: e.target.checked }))} /><span className="text-sm text-slate-700">Enabled</span></label></FormField>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Days of Week (leave empty for every day)</p>
                    <div className="flex gap-2 flex-wrap">
                      {DAY_LABELS.map((day, idx) => (
                        <button key={day} type="button"
                          onClick={() => setDiscountForm((f) => ({ ...f, days_of_week: f.days_of_week.includes(idx) ? f.days_of_week.filter((d) => d !== idx) : [...f.days_of_week, idx] }))}
                          className={`px-3 py-1.5 rounded text-xs font-semibold border ${discountForm.days_of_week.includes(idx) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                        >{day}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveDiscountRule} disabled={discountSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60">{discountSaving ? 'Saving…' : 'Save Rule'}</button>
                    <button type="button" onClick={() => setDiscountForm(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Cancel</button>
                  </div>
                </div>
              )}
              <Panel title="Discount Rules" icon={FaTags} loading={loading}>
                {loading ? <SkeletonTable rows={6} cols={6} /> : (
                  <>
                    <DenseTable
                      columns={['Name', 'Type', 'Value', 'Target', 'Schedule', 'Created By', 'Status', 'Actions']}
                      rows={discountRules.map((r) => [
                        r.name,
                        r.discount_type === 'percent' ? 'Percentage' : 'Fixed',
                        r.discount_type === 'percent' ? `${r.value}%` : money(r.value),
                        r.target === 'all' ? 'All Products' : r.target === 'category' ? `Cat: ${r.category_name || r.category}` : `Prod: ${r.product_name || r.product}`,
                        [r.start_date && `From ${r.start_date}`, r.end_date && `To ${r.end_date}`, r.days_of_week?.length ? r.days_of_week.map((d) => DAY_LABELS[d]).join(',') : 'Every day', r.start_time && `${r.start_time}–${r.end_time || 'end'}`].filter(Boolean).join(' · ') || 'Always',
                        <span key={`${r.id}-cb`} className="text-xs text-slate-600">{r.created_by_name || '—'}<br /><span className="text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span></span>,
                        <Status key={r.id}>{r.is_running ? 'Active' : r.is_active ? 'Scheduled' : 'Inactive'}</Status>,
                        <div key={r.id + '-a'} className="flex gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDiscountForm({ ...r, days_of_week: r.days_of_week || [], start_date: r.start_date || '', end_date: r.end_date || '', start_time: r.start_time || '', end_time: r.end_time || '' }) }} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><FaEdit className="text-xs" /></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); deleteDiscountRule(r) }} className="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100"><FaTrash className="text-xs" /></button>
                        </div>,
                      ])}
                      rowData={discountRules}
                    />
                    {!discountRules.length && <EmptyState text="No discount rules yet. Click 'New Rule' to create one." />}
                  </>
                )}
              </Panel>
            </>
          )}

          {/* Activity Logs tab */}
          {discountEngineTab === 'logs' && (
            <Panel title="Discount Rule Activity Logs" icon={FaClock} loading={loading}
              footer={!loading && <GridFooter page={discountLogsPage} pageSize={pageSize} total={discountLogsTotal} shown={discountLogs.length} onPageChange={setDiscountLogsPage} onPageSizeChange={setPageSize} />}
            >
              <DateFilterBar period={discountLogsPeriod} setPeriod={setDiscountLogsPeriod}
                dateFrom={discountLogsDateFrom} setDateFrom={setDiscountLogsDateFrom}
                dateTo={discountLogsDateTo} setDateTo={setDiscountLogsDateTo} />
              {loading ? <SkeletonTable rows={8} cols={7} /> : (
                <>
                  <DenseTable
                    columns={['Date/Time', 'Action', 'Rule Name', 'Type', 'Value', 'Target', 'Schedule', 'Performed By']}
                    rows={discountLogs.map((log) => {
                      const snap = log.rule_snapshot || {}
                      const actionTone = { created: 'bg-emerald-100 text-emerald-800', updated: 'bg-blue-100 text-blue-800', deleted: 'bg-red-100 text-red-800', activated: 'bg-emerald-100 text-emerald-800', deactivated: 'bg-slate-100 text-slate-700' }[log.action] || 'bg-slate-100 text-slate-700'
                      return [
                        log.performed_at ? new Date(log.performed_at).toLocaleString() : '—',
                        <span key={`${log.id}-a`} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold capitalize ${actionTone}`}>{log.action}</span>,
                        log.rule_name,
                        snap.discount_type === 'percent' ? 'Percentage' : snap.discount_type === 'fixed' ? 'Fixed' : '—',
                        snap.discount_type === 'percent' ? `${snap.value}%` : snap.value ? money(snap.value) : '—',
                        snap.target === 'all' ? 'All Products' : snap.target === 'category' ? `Cat: ${snap.category_name || '—'}` : snap.target === 'product' ? `Prod: ${snap.product_name || '—'}` : '—',
                        [snap.start_date && `From ${snap.start_date}`, snap.end_date && `To ${snap.end_date}`, snap.days_of_week?.length ? snap.days_of_week.map((d) => DAY_LABELS[d]).join(',') : null, snap.start_time && `${snap.start_time}–${snap.end_time || 'end'}`].filter(Boolean).join(' · ') || 'Always',
                        log.performed_by_name || '—',
                      ]
                    })}
                    rowData={discountLogs}
                    onRowClick={(log) => openRowDetails(`Log #${log.id} — ${log.rule_name}`, { action: log.action, rule: log.rule_name, 'performed by': log.performed_by_name || '—', at: log.performed_at ? new Date(log.performed_at).toLocaleString() : '—', ...log.rule_snapshot })}
                  />
                  {!discountLogs.length && <EmptyState text="No activity logged yet. Actions on discount rules will appear here." />}
                </>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Price Scheduler */}
      {activeSection === 'Price Scheduler' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button type="button" onClick={() => { setPriceSchedulerTab('schedules'); setPriceForm(null) }} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${priceSchedulerTab === 'schedules' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Schedules</button>
              <button type="button" onClick={() => { setPriceSchedulerTab('logs'); loadPriceLogs() }} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${priceSchedulerTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Activity Logs</button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {branchOptions.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Branch:</label>
                  <FilterSelect label="Branch" value={priceBranchId} onChange={(v) => { setPriceBranchId(v); setPriceForm(null); setPriceProducts([]); setSharedProducts([]); setSharedCategories([]) }} options={branchOptions.map((b) => ({ value: String(b.id), label: b.name }))} />
                </div>
              )}
              {priceSchedulerTab === 'schedules' && (<>
                <button type="button" onClick={applyDueSchedules} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><FaCheck />Apply Due Now</button>
                <button type="button" onClick={() => setPriceForm(emptyPriceForm())} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><FaPlus />New Schedule</button>
              </>)}
            </div>
          </div>

          {/* Schedules tab */}
          {priceSchedulerTab === 'schedules' && (
            <>
              {priceForm && (() => {
                const allProds = priceProducts.length ? priceProducts : sharedProducts
                const selectedProd = allProds.find((p) => String(p.id) === String(priceForm.product))
                return (
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">{priceForm.id ? 'Edit' : 'New'} Price Schedule</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <FormField label="Product" required>
                        <select className="form-input" value={priceForm.product} onChange={(e) => setPriceForm((f) => ({ ...f, product: e.target.value }))}>
                          <option value="">{allProds.length ? 'Select product…' : 'Loading products…'}</option>
                          {allProds.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                        </select>
                        {selectedProd && (
                          <p className="mt-1 text-xs text-slate-500">
                            Current: Retail <strong>{money(selectedProd.retail_price)}</strong>
                            {selectedProd.wholesale_price ? ` · Wholesale ${money(selectedProd.wholesale_price)}` : ''}
                          </p>
                        )}
                      </FormField>
                      <FormField label="New Retail Price (KES)"><input type="number" className="form-input" value={priceForm.new_retail_price} onChange={(e) => setPriceForm((f) => ({ ...f, new_retail_price: e.target.value }))} placeholder="Leave blank to keep current" min="0" step="0.01" /></FormField>
                      <FormField label="New Wholesale Price (KES)"><input type="number" className="form-input" value={priceForm.new_wholesale_price} onChange={(e) => setPriceForm((f) => ({ ...f, new_wholesale_price: e.target.value }))} placeholder="Leave blank to keep current" min="0" step="0.01" /></FormField>
                      <FormField label="Effective At" required><input type="datetime-local" className="form-input" value={priceForm.effective_at} onChange={(e) => setPriceForm((f) => ({ ...f, effective_at: e.target.value }))} /></FormField>
                      <FormField label="Note"><input className="form-input" value={priceForm.note} onChange={(e) => setPriceForm((f) => ({ ...f, note: e.target.value }))} placeholder="Reason for price change…" /></FormField>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={savePriceSchedule} disabled={priceSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60">{priceSaving ? 'Saving…' : 'Save Schedule'}</button>
                      <button type="button" onClick={() => setPriceForm(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Cancel</button>
                    </div>
                  </div>
                )
              })()}
              <Panel title="Scheduled Price Changes" icon={FaClock} loading={loading}>
                {loading ? <SkeletonTable rows={6} cols={6} /> : (
                  <>
                    <DenseTable
                      columns={['Product', 'SKU', 'Current Retail', 'Current Wholesale', 'New Retail', 'New Wholesale', 'Effective At', 'Created By', 'Status', 'Note', 'Actions']}
                      rows={priceSchedules.map((ps) => [
                        ps.product_name, ps.product_sku,
                        money(ps.current_retail), money(ps.current_wholesale),
                        ps.new_retail_price ? money(ps.new_retail_price) : '—',
                        ps.new_wholesale_price ? money(ps.new_wholesale_price) : '—',
                        new Date(ps.effective_at).toLocaleString(),
                        <span key={`${ps.id}-cb`} className="text-xs text-slate-600">{ps.created_by_name || '—'}<br /><span className="text-slate-400">{ps.created_at ? new Date(ps.created_at).toLocaleDateString() : ''}</span></span>,
                        <Status key={ps.id}>{ps.is_applied ? 'Applied' : new Date(ps.effective_at) <= new Date() ? 'Due' : 'Scheduled'}</Status>,
                        ps.note || '—',
                        <div key={ps.id + '-a'} className="flex gap-1">
                          {!ps.is_applied && <button type="button" title="Apply now" onClick={(e) => { e.stopPropagation(); applySingleSchedule(ps) }} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><FaCheck className="text-xs" /></button>}
                          {!ps.is_applied && <button type="button" title="Edit" onClick={(e) => { e.stopPropagation(); setPriceForm({ ...ps, product: ps.product, new_retail_price: ps.new_retail_price || '', new_wholesale_price: ps.new_wholesale_price || '', effective_at: ps.effective_at ? ps.effective_at.slice(0, 16) : '' }) }} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><FaEdit className="text-xs" /></button>}
                          <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); deletePriceSchedule(ps) }} className="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100"><FaTrash className="text-xs" /></button>
                        </div>,
                      ])}
                      rowData={priceSchedules} numericColumns={[2, 3, 4, 5]}
                    />
                    {!priceSchedules.length && <EmptyState text="No price schedules yet. Click 'New Schedule' to create one." />}
                  </>
                )}
              </Panel>
            </>
          )}

          {/* Activity Logs tab */}
          {priceSchedulerTab === 'logs' && (
            <Panel title="Price Schedule Activity Logs" icon={FaClock} loading={loading}
              footer={!loading && <GridFooter page={priceLogsPage} pageSize={pageSize} total={priceLogsTotal} shown={priceLogs.length} onPageChange={setPriceLogsPage} onPageSizeChange={setPageSize} />}
            >
              <DateFilterBar period={priceLogsPeriod} setPeriod={setPriceLogsPeriod}
                dateFrom={priceLogsDateFrom} setDateFrom={setPriceLogsDateFrom}
                dateTo={priceLogsDateTo} setDateTo={setPriceLogsDateTo} />
              {loading ? <SkeletonTable rows={8} cols={7} /> : (
                <>
                  <DenseTable
                    columns={['Date/Time', 'Action', 'Product', 'New Retail', 'New Wholesale', 'Effective At', 'Note', 'Performed By']}
                    rows={priceLogs.map((log) => {
                      const snap = log.schedule_snapshot || {}
                      const actionTone = { created: 'bg-emerald-100 text-emerald-800', updated: 'bg-blue-100 text-blue-800', deleted: 'bg-red-100 text-red-800', applied: 'bg-purple-100 text-purple-800' }[log.action] || 'bg-slate-100 text-slate-700'
                      return [
                        log.performed_at ? new Date(log.performed_at).toLocaleString() : '—',
                        <span key={`${log.id}-a`} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold capitalize ${actionTone}`}>{log.action}</span>,
                        log.product_name,
                        snap.new_retail_price ? money(snap.new_retail_price) : '—',
                        snap.new_wholesale_price ? money(snap.new_wholesale_price) : '—',
                        snap.effective_at ? new Date(snap.effective_at).toLocaleString() : '—',
                        snap.note || '—',
                        log.performed_by_name || '—',
                      ]
                    })}
                    rowData={priceLogs}
                    onRowClick={(log) => openRowDetails(`Log #${log.id} — ${log.product_name}`, { action: log.action, product: log.product_name, 'performed by': log.performed_by_name || '—', at: log.performed_at ? new Date(log.performed_at).toLocaleString() : '—', ...log.schedule_snapshot })}
                  />
                  {!priceLogs.length && <EmptyState text="No activity logged yet. Actions on price schedules will appear here." />}
                </>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Customer Sales */}
      {activeSection === 'Customer Sales' && (
        <Panel title="Customer Sales" icon={FaSearch} loading={loading}
          footer={!loading && <GridFooter page={customerSalesPage} pageSize={pageSize} total={customerSalesTotal} shown={customerSalesRows.length} onPageChange={setCustomerSalesPage} onPageSizeChange={setPageSize} />}
        >
          {loading ? <SkeletonTable rows={8} cols={4} /> : (
            <>
              <DenseTable columns={['Customer', 'Total Spent', 'Last Purchase', 'Credit Sales', 'Receipts']}
                rows={customerSalesRows.map((c) => [c.name, money(c.totalSpent), c.lastPurchase, money(c.creditSales), c.loyalty.toLocaleString()])}
                rowData={customerSalesRows} onRowClick={(r) => openRowDetails(r.name, r)} numericColumns={[1, 3, 4]}
              />
              {!customerSalesRows.length && <EmptyState text="No customer sales found." />}
            </>
          )}
        </Panel>
      )}

      {/* Reports */}
      {activeSection === 'Reports' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {[{ key: 'cashier', label: 'Cashier Performance' }, { key: 'product', label: 'Product Sales' }, { key: 'hourly', label: 'Hourly Heatmap' }].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setActiveReport(key)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeReport === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
              ))}
            </div>
            <FilterSelect label="Period" value={reportPeriod} onChange={setReportPeriod} options={[{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: '7days', label: 'Last 7 Days' }, { value: '30days', label: 'Last 30 Days' }, { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }, { value: 'all', label: 'All Time' }, { value: 'custom', label: 'Custom' }]} />
            {reportPeriod === 'custom' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input type="date" value={reportDateFrom} max={reportDateTo || isoDate(new Date())}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                <span className="text-xs text-slate-400">—</span>
                <input type="date" value={reportDateTo} min={reportDateFrom} max={isoDate(new Date())}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
            )}
            <button type="button" onClick={loadReports} disabled={reportLoading} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-60">{reportLoading ? <Spinner size="sm" color="white" /> : <FaSearch />}Run Report</button>
          </div>

          {activeReport === 'cashier' && (
            <Panel title="Cashier Performance" icon={FaCashRegister} loading={reportLoading}>
              {reportLoading ? <SkeletonTable rows={8} cols={8} /> : (
                <>
                  <DenseTable
                    columns={['Cashier', 'Username', 'Gross Sales', 'Discounts', 'Net Sales', 'Transactions', 'Avg Sale', 'Items Sold', 'Voids']}
                    rows={cashierPerf.map((r) => [r.cashier_name, r.username, money(r.total_sales), money(r.total_discounts || 0), money((r.total_sales || 0) - (r.total_discounts || 0)), r.sale_count.toLocaleString(), money(r.avg_sale), r.items_sold?.toLocaleString() || '—', r.void_count.toLocaleString()])}
                    rowData={cashierPerf} numericColumns={[2, 3, 4, 5, 6, 7, 8]}
                  />
                  {!cashierPerf.length && <EmptyState text="No cashier performance data for this period." />}
                </>
              )}
            </Panel>
          )}

          {activeReport === 'product' && (
            <Panel title="Product Sales" icon={FaFilter} loading={reportLoading}>
              {reportLoading ? <SkeletonTable rows={8} cols={7} /> : (
                <>
                  <DenseTable
                    columns={['Product', 'SKU', 'Category', 'Qty Sold', 'Gross Revenue', 'Discounts', 'Net Revenue', 'Transactions']}
                    rows={productSales.map((r) => [r.product_name, r.sku, r.category || '—', r.qty_sold?.toLocaleString(), money(r.revenue), money(r.total_discounts || 0), money((r.revenue || 0) - (r.total_discounts || 0)), r.tx_count?.toLocaleString()])}
                    rowData={productSales} numericColumns={[3, 4, 5, 6, 7]}
                  />
                  {!productSales.length && <EmptyState text="No product sales data for this period." />}
                </>
              )}
            </Panel>
          )}

          {activeReport === 'hourly' && (
            <Panel title="Hourly Sales Heatmap" icon={FaClock} loading={reportLoading}>
              {reportLoading ? <div className="h-40 flex items-center justify-center"><Spinner /></div> : hourlySales.length ? (
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-3">Bar height = net revenue after discounts. Numbers = transaction count.</p>
                  <div className="flex items-end gap-1 h-40 overflow-x-auto">
                    {(() => {
                      const maxTotal = Math.max(...hourlySales.map((r) => r.total), 1)
                      return hourlySales.map((r) => (
                        <div key={r.hour} className="flex flex-col items-center gap-1 min-w-[38px]">
                          <span className="text-[9px] text-slate-500">{r.count}</span>
                          <div className="w-8 bg-emerald-500 rounded-t" style={{ height: `${Math.max(4, (r.total / maxTotal) * 120)}px` }} title={`${r.hour}: ${money(r.total)} (${r.count} sales, discount ${money(r.total_discounts || 0)})`} />
                          <span className="text-[9px] text-slate-600 font-medium">{r.hour}</span>
                        </div>
                      ))
                    })()}
                  </div>
                  <DenseTable
                    columns={['Hour', 'Gross Revenue', 'Discounts', 'Net Revenue', 'Transactions']}
                    rows={hourlySales.map((r) => [r.hour, money(r.total), money(r.total_discounts || 0), money((r.total || 0) - (r.total_discounts || 0)), r.count.toLocaleString()])}
                    rowData={hourlySales} numericColumns={[1, 2, 3, 4]}
                  />
                </div>
              ) : <EmptyState text="No hourly data for this period." />}
            </Panel>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {activeSection === 'Audit Logs' && (
        <Panel title="Sales Audit Logs" icon={FaSearch} loading={loading}
          footer={!loading && <GridFooter page={auditLogsPage} pageSize={pageSize} total={auditLogsTotal} shown={auditLogs.length} onPageChange={setAuditLogsPage} onPageSizeChange={setPageSize} />}
        >
          <DateFilterBar period={auditLogsPeriod} setPeriod={setAuditLogsPeriod}
            dateFrom={auditLogsDateFrom} setDateFrom={setAuditLogsDateFrom}
            dateTo={auditLogsDateTo} setDateTo={setAuditLogsDateTo} />
          {loading ? <SkeletonTable rows={8} cols={4} /> : (
            <>
              <DenseTable columns={['User', 'Action', 'Timestamp', 'Entity', 'Notes']}
                rows={auditLogs.map((l) => [l.username || 'System', l.action, new Date(l.created_at).toLocaleString(), `${l.entity} ${l.entity_id}`, l.notes])}
                rowData={auditLogs} onRowClick={(r) => openRowDetails(r.action, r)}
              />
              {!auditLogs.length && <EmptyState text="No audit logs found." />}
            </>
          )}
        </Panel>
      )}

      {detailsOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDetailsOpen(false)} />
          {/* bottom sheet on phones, right slide-over on sm+ tablets */}
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl sm:inset-y-0 sm:inset-x-auto sm:right-0 sm:bottom-auto sm:w-full sm:max-w-sm sm:max-h-none sm:rounded-none sm:rounded-l-2xl">
            <ReceiptDrawer receipt={selectedReceipt} onClose={() => setDetailsOpen(false)} mobile onVoid={voidReceipt} canVoid={can('*') || can('sale.void')} />
          </div>
        </div>
      )}
      {rowDetails && <DetailModal title={rowDetails.title} data={rowDetails.data} onClose={() => setRowDetails(null)} />}
    </div>
  )
}

const _PERIOD_PILLS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]
const DateFilterBar = ({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-2 px-2 pt-2 pb-3 border-b border-slate-200 ${className}`}>
    <div className="flex flex-wrap gap-1">
      {_PERIOD_PILLS.map(({ value, label }) => (
        <button key={value} type="button" onClick={() => setPeriod(value)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${period === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
        >{label}</button>
      ))}
    </div>
    {period === 'custom' && (
      <div className="flex items-center gap-1.5 flex-wrap">
        <input type="date" value={dateFrom} max={dateTo || isoDate(new Date())}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400" />
        <span className="text-xs text-slate-400">—</span>
        <input type="date" value={dateTo} min={dateFrom} max={isoDate(new Date())}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400" />
      </div>
    )}
  </div>
)

const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
)

const TransactionToolbar = ({ query, setQuery, resultCount, branchName, filters, setFilters, branchOptions = [], loading }) => (
  <div className="p-2 border-b border-slate-200 space-y-2">
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
      <div className="relative">
        <FaSearch className="absolute left-2.5 top-2.5 text-slate-400 text-xs" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search receipt, customer, cashier, product (server-side)" className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-xs" />
      </div>
      {filters && setFilters && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <FilterSelect label="Date range" value={filters.period} onChange={(v) => setFilters((c) => ({ ...c, period: v }))} options={[{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: '7days', label: 'Last 7 days' }, { value: '30days', label: 'Last 30 days' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }, { value: 'all', label: 'All dates' }]} />
          <FilterSelect label="Branch" value={String(filters.branchId || '')} onChange={(v) => setFilters((c) => ({ ...c, branchId: v }))} options={(branchOptions.length ? branchOptions : [{ id: filters.branchId, name: branchName }]).map((r) => ({ value: String(r.id), label: r.name }))} />
          <FilterSelect label="Payment" value={filters.paymentMethod} onChange={(v) => setFilters((c) => ({ ...c, paymentMethod: v }))} options={[{ value: '', label: 'All methods' }, { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'credit', label: 'Credit' }]} />
          <button type="button" onClick={() => setFilters((c) => ({ ...c, period: 'today', paymentMethod: '' }))} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear</button>
        </div>
      )}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
      {loading ? <span className="flex items-center gap-1.5"><Spinner size="sm" color="slate" />Fetching records…</span> : <span>{resultCount.toLocaleString()} matching records</span>}
      <span>Load up to 500 rows per page</span>
    </div>
  </div>
)

const Panel = ({ title, icon: Icon, children, right, footer, loading }) => (
  <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
      <div className="flex items-center min-w-0 gap-2"><Icon className="text-emerald-600 shrink-0" /><h2 className="font-semibold text-sm text-slate-900 truncate">{title}</h2>{loading && <Spinner size="sm" color="slate" />}</div>
      {right}
    </div>
    {children}
    {footer}
  </section>
)

const EmptyState = ({ text }) => <div className="px-4 py-6 text-center text-xs font-semibold text-slate-500">{text}</div>

const DenseTable = ({ columns, rows, rowData = [], onRowClick, pinFirst = false, numericColumns = [] }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ overflowX: 'auto', maxHeight: '66vh' }}>
      <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="sticky top-0 z-20 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
          <tr>
            {columns.map((col, i) => (
              <th key={col} style={{ width: numericColumns.includes(i) ? '12%' : 'auto' }} className={`h-7 border-r border-slate-200 px-2 text-left font-bold text-slate-600 uppercase tracking-normal whitespace-nowrap ${numericColumns.includes(i) ? 'text-right' : ''} ${pinFirst && i === 0 ? 'sticky left-0 z-30 bg-slate-100 shadow-[1px_0_0_#cbd5e1]' : ''}`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={rowData[ri]?.saleId || rowData[ri]?.id || rowData[ri]?.receipt || ri} onClick={() => onRowClick?.(rowData[ri] || row)} className={`${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-emerald-50 ${onRowClick ? 'cursor-pointer' : ''}`}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ width: numericColumns.includes(ci) ? '12%' : 'auto' }} className={`h-8 border-r border-b border-slate-200 px-2 text-slate-700 whitespace-nowrap align-middle ${numericColumns.includes(ci) ? 'text-right tabular-nums font-medium' : ''} ${pinFirst && ci === 0 ? 'sticky left-0 z-10 bg-inherit font-bold text-slate-900 shadow-[1px_0_0_#e2e8f0]' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

const GridFooter = ({ page, pageSize, total, shown, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(start + shown - 1, total)
  return (
    <div className="px-3 py-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
      <span>Showing {start.toLocaleString()}-{end.toLocaleString()} of {total.toLocaleString()} (page {page} / {totalPages})</span>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="w-8 h-8 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"><FaChevronLeft /></button>
        <span className="px-2">Page {page}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="w-8 h-8 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"><FaChevronRight /></button>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="ml-2 px-2 py-1.5 border border-slate-300 rounded bg-white" aria-label="Rows per page">
          {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} rows</option>)}
        </select>
      </div>
    </div>
  )
}

const FilterSelect = ({ label, options, value, onChange }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange?.(e.target.value)} className="min-w-0 px-2 py-2 border border-slate-300 rounded-md text-xs bg-white">
    {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
)

const ReceiptDrawer = ({ receipt, onClose, onVoid, canVoid, mobile = false }) => (
  <aside className={`flex flex-col bg-white ${mobile ? '' : 'rounded-lg shadow-sm border border-slate-200'} overflow-hidden h-full`}>
    {/* Header */}
    <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-slate-900 text-sm sm:text-base">Receipt Details</h2>
          {receipt.status && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
              receipt.status === 'Voided' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}>{receipt.status}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{receipt.receipt}</p>
        <p className="text-xs text-slate-400">{receipt.time}</p>
      </div>
      <button type="button" onClick={onClose} className="lg:hidden flex-shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 active:bg-slate-300">
        <FaTimes />
      </button>
    </div>

    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Info label="Customer" value={receipt.customer} />
        <Info label="Cashier" value={receipt.cashier} />
        <Info label="Branch" value={receipt.branch} />
        <Info label="Terminal" value={receipt.terminal} />
        <Info label="Payment" value={receipt.payment} />
        <Info label="Tax" value={money(receipt.tax)} />
        {receipt.discount > 0 && <Info label="Discount" value={`-${money(receipt.discount)}`} />}
      </div>

      {/* Total block */}
      <div className="rounded-xl bg-slate-950 text-white px-4 py-4">
        {receipt.discount > 0 && (
          <p className="text-xs text-slate-400 mb-1">
            Subtotal {money(receipt.subtotal)} · Disc −{money(receipt.discount)}
          </p>
        )}
        <p className="text-xs text-slate-400 uppercase tracking-wide">Receipt Total</p>
        <p className="text-3xl font-bold mt-1 tracking-tight">{money(receipt.amount)}</p>
      </div>

      {/* Items list */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Items ({receipt.items?.length ?? 0})
        </p>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {(receipt.items || []).map((item, idx) => (
            <div key={idx} className="px-3 py-2.5 bg-white text-xs text-slate-800 break-words leading-relaxed">
              {item}
            </div>
          ))}
          {!receipt.items?.length && (
            <div className="px-3 py-3 text-xs text-slate-400 italic">No items recorded</div>
          )}
        </div>
      </div>
    </div>

    {/* Action buttons — pinned at bottom */}
    <div className="flex-shrink-0 border-t border-slate-200 p-3 grid grid-cols-2 gap-2">
      <button type="button" className="inline-flex items-center justify-center px-3 py-2.5 min-h-[44px] bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300">
        <FaPrint className="mr-2 text-slate-600" />Print
      </button>
      <button type="button" className="inline-flex items-center justify-center px-3 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800">
        <FaFilePdf className="mr-2" />PDF
      </button>
      <button
        type="button"
        disabled={!canVoid || receipt.status === 'Voided'}
        onClick={() => onVoid?.(receipt)}
        className="col-span-2 inline-flex items-center justify-center px-3 py-2.5 min-h-[44px] bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 active:bg-red-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        <FaTimes className="mr-2" />Void Receipt
      </button>
    </div>
  </aside>
)

const DetailModal = ({ title, data, onClose }) => {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="absolute inset-x-3 top-6 bottom-6 mx-auto max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl sm:inset-x-6 sm:top-12 sm:bottom-auto">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase text-emerald-600">Record details</p><h2 className="truncate text-lg font-bold text-slate-900">{title}</h2></div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><FaTimes /></button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
        </div>
      </div>
    </div>
  )
}

const Info = ({ label, value }) => (
  <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">{label}</p><p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{value}</p></div>
)

const SummaryCard = ({ label, value, tone = 'slate' }) => {
  const tones = { slate: 'border-slate-200 bg-white text-slate-900', blue: 'border-blue-200 bg-blue-50 text-blue-900', red: 'border-red-200 bg-red-50 text-red-900', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900' }
  return <div className={`rounded-lg border p-3 ${tones[tone] || tones.slate}`}><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>
}

export default SalesControl
