import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FaCashRegister, FaCheck, FaChevronLeft, FaChevronRight, FaDownload, FaEye,
  FaFileExcel, FaFilePdf, FaFilter, FaPrint, FaSearch, FaTimes
} from 'react-icons/fa'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]
const SECTION_PERMISSIONS = {
  Transactions: ['sales.view'],
  Voids: ['sale.void'],
  'Returns & Refunds': ['sale.refund', 'sale.refund.approve'],
  'Cash Management': ['cash.manage'],
  'Cashier Summary': ['shift.view'],
  Payments: ['sales.payments'],
  'Discounts Log': ['sales.discounts', 'sale.discount'],
  'Customer Sales': ['sales.customer'],
  Reports: ['reports.view'],
  'Audit Logs': ['sales.audit', 'admin.audit'],
}
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
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const transactionPeriod = (key) => {
  const today = new Date()
  if (key === 'week') {
    const start = startOfWeek(today)
    return { date_from: isoDate(start), date_to: isoDate(addDays(start, 6)) }
  }
  if (key === 'month') return { date_from: isoDate(startOfMonth(today)), date_to: isoDate(today) }
  if (key === '7days') return { date_from: isoDate(addDays(today, -6)), date_to: isoDate(today) }
  if (key === 'all') return {}
  return { date_from: isoDate(today), date_to: isoDate(today) }
}

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return { results: payload, count: payload.length }
  return {
    results: payload?.results || [],
    count: payload?.count ?? (payload?.results?.length || 0),
    next: payload?.next,
    previous: payload?.previous,
  }
}

const mapCashierRow = (row) => ({
  shiftId: row.shift_id,
  cashier: row.cashier_name || 'Cashier',
  register: row.register_code || `REG-${row.register_id}`,
  branch: row.branch_name || branchNameFromRow(row),
  openedAt: row.opened_at ? new Date(row.opened_at).toLocaleString() : '—',
  closedAt: row.closed_at ? new Date(row.closed_at).toLocaleString() : 'Open',
  opening: Number(row.opening_cash || 0),
  expected: Number(row.expected_cash || 0),
  counted: row.counted_cash == null ? null : Number(row.counted_cash),
  variance: Number(row.cash_variance || 0),
  varianceStatus: row.variance_status || 'balanced',
  cashSales: Number(row.cash_sales_total || 0),
  mpesaSales: Number(row.mpesa_sales_total || 0),
  cardSales: Number(row.card_sales_total || 0),
  salesCount: Number(row.sales_count || 0),
  salesTotal: Number(row.sales_total || 0),
  cashIn: Number(row.manual_cash_in || 0),
  cashOut: Number(row.manual_cash_out || 0),
  status: row.status === 'open' ? 'Open' : 'Closed',
  raw: row,
})

const branchNameFromRow = (row) => `Branch ${row.branch_id || ''}`

const VarianceBadge = ({ amount, status }) => {
  const tone = status === 'over'
    ? 'bg-emerald-100 text-emerald-800'
    : status === 'short'
      ? 'bg-red-100 text-red-800'
      : 'bg-slate-100 text-slate-700'
  const label = status === 'over' ? 'Over' : status === 'short' ? 'Short' : 'Balanced'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${tone}`}>
      {label} {money(Math.abs(amount))}
    </span>
  )
}

const mapSale = (sale, branchName) => ({
  receipt: sale.receipt_no,
  saleId: sale.id,
  customer: sale.customer_name || 'Walk-in Customer',
  cashier: sale.cashier_name || 'Cashier',
  branch: branchName || `Branch ${sale.branch}`,
  payment: sale.payments?.[0]?.method || 'cash',
  product: sale.items?.[0]?.product_name || 'Multiple items',
  amount: Number(sale.total),
  tax: Number(sale.tax_total),
  time: new Date(sale.created_at).toLocaleString(),
  terminal: `POS-${sale.register}`,
  status: sale.status === 'voided' ? 'Voided' : 'Completed',
  items: (sale.items || []).map((item) => `${item.product_name} x${item.quantity}`),
  payments: sale.payments || [],
  raw: sale,
})

const Status = ({ children }) => {
  const tone = {
    Pending: 'bg-amber-100 text-amber-800',
    Approved: 'bg-emerald-100 text-emerald-800',
    Rejected: 'bg-red-100 text-red-800',
    Open: 'bg-blue-100 text-blue-800',
    Closed: 'bg-slate-100 text-slate-700',
    Completed: 'bg-emerald-100 text-emerald-800',
    Settled: 'bg-blue-100 text-blue-800',
    Voided: 'bg-red-100 text-red-700',
  }[children] || 'bg-slate-100 text-slate-700'

  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${tone}`}>{children}</span>
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
  const [transactionFilters, setTransactionFilters] = useState({
    period: 'today',
    paymentMethod: '',
    branchId: '',
  })

  const [voidRows, setVoidRows] = useState([])
  const [voidsTotal, setVoidsTotal] = useState(0)
  const [voidsPage, setVoidsPage] = useState(1)

  const [liveReturns, setLiveReturns] = useState([])
  const [liveDiscounts, setLiveDiscounts] = useState([])
  const [livePaymentsApi, setLivePaymentsApi] = useState([])
  const [cashierRows, setCashierRows] = useState([])
  const [cashierTotal, setCashierTotal] = useState(0)
  const [cashierPage, setCashierPage] = useState(1)
  const [liveCustomerSales, setLiveCustomerSales] = useState([])
  const [auditLogs, setAuditLogs] = useState([])

  const branchId = authBranch?.id
  const transactionBranchId = transactionFilters.branchId || branchId
  const branchOptions = useMemo(() => {
    const rows = (companyBranches?.length ? companyBranches : authBranch ? [authBranch] : [])
      .filter((row) => row?.id && row?.is_active !== false)
    return rows
  }, [authBranch, companyBranches])

  useEffect(() => {
    if (!branchId) return
    setTransactionFilters((current) => ({
      ...current,
      branchId: current.branchId || String(branchId),
    }))
  }, [branchId])

  const loadTransactions = useCallback(async () => {
    if (!transactionBranchId) {
      setMessage('No active branch is assigned to this user.')
      setTransactionRows([])
      setTransactionsTotal(0)
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const period = transactionPeriod(transactionFilters.period)
      const selectedBranchName = branchOptions.find((row) => String(row.id) === String(transactionBranchId))?.name || branchName
      const response = await posApi.transactions({
        branch: transactionBranchId,
        page: transactionsPage,
        page_size: pageSize,
        search: query.trim() || undefined,
        payment_method: transactionFilters.paymentMethod || undefined,
        ...period,
      })
      const { results, count } = unwrapList(response)
      const rows = results.map((sale) => mapSale(sale, sale.branch_name || selectedBranchName))
      setTransactionRows(rows)
      setTransactionsTotal(count)
      setSelectedReceipt((current) => rows.some((row) => row.saleId === current?.saleId) ? current : rows[0] || null)
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message || 'Could not load transactions.')
      setTransactionRows([])
      setTransactionsTotal(0)
    } finally {
      setLoading(false)
    }
  }, [branchName, branchOptions, transactionBranchId, transactionFilters, transactionsPage, pageSize, query])

  const loadVoids = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const response = await posApi.voids({
        branch: branchId,
        page: voidsPage,
        page_size: pageSize,
        search: query.trim() || undefined,
      })
      const { results, count } = unwrapList(response)
      setVoidRows(results.map((sale) => mapSale(sale, branchName)))
      setVoidsTotal(count)
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message)
    } finally {
      setLoading(false)
    }
  }, [branchId, branchName, voidsPage, pageSize, query])

  const loadCashierSummary = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const q = query.trim().toLowerCase()
      const response = await posApi.cashierSummary({
        branch: branchId,
        page: cashierPage,
        page_size: pageSize,
        status: q === 'open' || q === 'closed' ? q : undefined,
        search: q && q !== 'open' && q !== 'closed' ? query.trim() : undefined,
      })
      const { results, count } = unwrapList(response)
      setCashierRows(results.map((row) => mapCashierRow({ ...row, branch_name: row.branch_name || branchName })))
      setCashierTotal(count)
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message)
      setCashierRows([])
      setCashierTotal(0)
    } finally {
      setLoading(false)
    }
  }, [branchId, branchName, cashierPage, pageSize, query])

  const loadOtherSection = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const params = { branch: branchId, page_size: 100 }
    try {
      if (activeSection === 'Returns & Refunds') {
        const returnsResponse = await posApi.saleReturns(params)
        setLiveReturns(unwrapList(returnsResponse).results)
      } else if (activeSection === 'Payments') {
        const paymentsResponse = await posApi.payments({ ...params, page_size: pageSize, page: transactionsPage })
        const { results } = unwrapList(paymentsResponse)
        setLivePaymentsApi(results.map((payment) => ({
          reference: payment.reference || `${payment.receipt_no}-${payment.id}`,
          method: payment.method,
          amount: Number(payment.amount),
          transactionId: payment.receipt_no,
          status: payment.sale_status === 'voided' ? 'Voided' : 'Completed',
        })))
      } else if (activeSection === 'Discounts Log') {
        const discountsResponse = await posApi.discountsLog(params)
        setLiveDiscounts(unwrapList(discountsResponse).results)
      } else if (activeSection === 'Customer Sales') {
        const customerSalesResponse = await posApi.customerSales(params)
        setLiveCustomerSales(unwrapList(customerSalesResponse).results)
      } else if (activeSection === 'Audit Logs') {
        const auditResponse = await posApi.auditLogs({ ...params, sales_only: true })
        setAuditLogs(unwrapList(auditResponse).results)
      }
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message)
    } finally {
      setLoading(false)
    }
  }, [activeSection, branchId, pageSize, transactionsPage])

  useEffect(() => {
    if (!branchId) return undefined
    const timer = setTimeout(() => {
      if (activeSection === 'Transactions') loadTransactions()
      else if (activeSection === 'Voids') loadVoids()
      else if (activeSection === 'Cashier Summary' || activeSection === 'Cash Management') loadCashierSummary()
      else if (!['Reports'].includes(activeSection)) loadOtherSection()
    }, query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [activeSection, branchId, reloadSignal, loadTransactions, loadVoids, loadCashierSummary, loadOtherSection, query])

  useEffect(() => {
    setTransactionsPage(1)
    setVoidsPage(1)
    setCashierPage(1)
  }, [query, pageSize, branchId, transactionFilters])

  const livePayments = livePaymentsApi

  const cashierTotals = useMemo(() => cashierRows.reduce((acc, row) => {
    acc.salesTotal += row.salesTotal
    acc.cashSales += row.cashSales
    acc.mpesaSales += row.mpesaSales
    acc.cardSales += row.cardSales
    if (row.status === 'Open') acc.openShifts += 1
    if (row.varianceStatus === 'short') acc.shortVariance += Math.abs(row.variance)
    if (row.varianceStatus === 'over') acc.overVariance += row.variance
    if (row.status === 'Closed') acc.closedVariance += row.variance
    return acc
  }, {
    salesTotal: 0,
    cashSales: 0,
    mpesaSales: 0,
    cardSales: 0,
    openShifts: 0,
    shortVariance: 0,
    overVariance: 0,
    closedVariance: 0,
  }), [cashierRows])
  const customerSalesRows = liveCustomerSales.map((customer) => ({
    name: customer.customer_name,
    totalSpent: Number(customer.total_spent || 0),
    lastPurchase: customer.last_purchase ? new Date(customer.last_purchase).toLocaleString() : 'No sales',
    creditSales: Number(customer.credit_sales || 0),
    loyalty: Number(customer.receipt_count || 0),
  }))
  const discountRows = liveDiscounts.map((entry) => ({
    target: entry.receipt_no || entry.product_name,
    value: money(Number(entry.discount_amount)),
    type: 'Fixed',
    approvedBy: 'System',
    cashier: entry.cashier_name,
    time: new Date(entry.created_at).toLocaleString(),
  }))
  const returnRows = liveReturns.map((item) => ({
    id: item.return_no,
    returnId: item.id,
    product: item.items?.[0]?.product_name || 'Multiple items',
    quantity: item.items?.reduce((sum, line) => sum + line.quantity, 0) || 0,
    amount: Number(item.total_refund),
    reason: item.reason,
    status: item.status === 'pending' ? 'Pending' : item.status === 'rejected' ? 'Rejected' : 'Approved',
    cashier: item.processed_by_name,
    raw: item,
  }))

  const openReceipt = (receipt) => {
    setSelectedReceipt(receipt)
    setDetailsOpen(true)
  }

  const openRowDetails = (title, data) => {
    setRowDetails({ title, data })
  }

  const handleReturnAction = async (returnRow, action) => {
    if (!returnRow?.returnId || !user?.id) return
    try {
      const payload = { user: user.id }
      if (action === 'approve') {
        await posApi.approveSaleReturn(returnRow.returnId, payload)
        await posApi.completeSaleReturn(returnRow.returnId, payload)
      } else {
        await posApi.rejectSaleReturn(returnRow.returnId, { ...payload, reason: 'Rejected from Sales Control' })
      }
      setMessage(`${returnRow.id} ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await loadOtherSection()
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message)
    }
  }

  const voidReceipt = async (sale) => {
    if (!sale?.saleId || (!can('*') && !can('sale.void'))) return
    try {
      await posApi.voidSale(sale.saleId, { user: user?.id, reason: 'Voided from Sales Control' })
      setMessage(`${sale.receipt} voided.`)
      await loadTransactions()
    } catch (error) {
      setMessage(error.data ? JSON.stringify(error.data) : error.message)
    }
  }

  if (!branchId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">
        No active branch is assigned. Select a branch from the header to view Sales Control.
      </div>
    )
  }

  const requiredPermissions = SECTION_PERMISSIONS[activeSection] || []
  const allowed = can('*') || requiredPermissions.some((permission) => can(permission))
  if (!allowed) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">
        You do not have permission to view {activeSection}.
      </div>
    )
  }

  return (
    <div className="space-y-4 min-h-[50vh]">
      {message && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</div>}
      {loading && (
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          Loading {activeSection.toLowerCase()}…
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sales Control / {activeSection}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Server-paged lists for high volume ({transactionsTotal.toLocaleString()} transactions in branch).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm hover:bg-slate-50">
            <FaFileExcel className="mr-2 text-emerald-600" />
            Excel
          </button>
          <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-slate-900 text-white rounded-lg text-xs sm:text-sm hover:bg-slate-800">
            <FaFilePdf className="mr-2" />
            PDF
          </button>
        </div>
      </div>

      {activeSection === 'Transactions' && (
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <Panel
            title="Completed Transactions"
            icon={FaCashRegister}
            right={<ReceiptActions />}
            footer={(
              <GridFooter
                page={transactionsPage}
                pageSize={pageSize}
                total={transactionsTotal}
                shown={transactionRows.length}
                onPageChange={setTransactionsPage}
                onPageSizeChange={setPageSize}
              />
            )}
          >
            <TransactionToolbar
              query={query}
              setQuery={setQuery}
              resultCount={transactionsTotal}
              branchName={branchName}
              filters={transactionFilters}
              setFilters={setTransactionFilters}
              branchOptions={branchOptions}
            />
            <DenseTable
              columns={['Receipt', 'Time', 'Branch', 'Terminal', 'Cashier', 'Customer', 'Payment', 'Product', 'Amount', 'Tax', 'Status', 'Action']}
              rows={transactionRows.map((sale) => [
                sale.receipt,
                sale.time,
                sale.branch,
                sale.terminal,
                sale.cashier,
                sale.customer,
                sale.payment,
                sale.product,
                money(sale.amount),
                money(sale.tax),
                <Status key={`${sale.saleId}-status`}>{sale.status}</Status>,
                <button key={`${sale.saleId}-view`} type="button" onClick={(event) => { event.stopPropagation(); openReceipt(sale) }} className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded hover:bg-slate-200" aria-label={`View ${sale.receipt}`}>
                  <FaEye />
                </button>,
              ])}
              rowData={transactionRows}
              onRowClick={openReceipt}
              pinFirst
              numericColumns={[8, 9]}
            />
            {!loading && !transactionRows.length && <EmptyState text="No transactions match your search." />}
          </Panel>
          <div className="hidden 2xl:block">
            {selectedReceipt && (
              <ReceiptDrawer
                receipt={selectedReceipt}
                onClose={() => setDetailsOpen(false)}
                onVoid={voidReceipt}
                canVoid={can('*') || can('sale.void')}
              />
            )}
          </div>
        </div>
      )}

      {activeSection === 'Voids' && (
        <Panel
          title="Voided Transactions"
          icon={FaTimes}
          footer={(
            <GridFooter
              page={voidsPage}
              pageSize={pageSize}
              total={voidsTotal}
              shown={voidRows.length}
              onPageChange={setVoidsPage}
              onPageSizeChange={setPageSize}
            />
          )}
        >
          <TransactionToolbar query={query} setQuery={setQuery} resultCount={voidsTotal} branchName={branchName} />
          <DenseTable
            columns={['Receipt', 'Cashier', 'Amount', 'Reason', 'Approved By', 'Timestamp']}
            rows={voidRows.map((voided) => [
              voided.receipt,
              voided.cashier,
              money(voided.amount),
              voided.raw?.void_reason || 'Recorded on receipt',
              voided.raw?.voided_by_name || 'Manager',
              voided.time,
            ])}
            rowData={voidRows}
            onRowClick={(row) => openRowDetails(row.receipt, row)}
            numericColumns={[2]}
          />
          {!loading && !voidRows.length && <EmptyState text="No voided transactions found." />}
        </Panel>
      )}

      {activeSection === 'Returns & Refunds' && (
        <Panel title="Returns & Refunds" icon={FaDownload}>
          <DenseTable columns={['Request', 'Product Returned', 'Qty', 'Refund Amount', 'Reason', 'Status', 'Actions']} rows={returnRows.map((refund) => [
            refund.id,
            refund.product,
            refund.quantity,
            money(refund.amount),
            refund.reason,
            <Status key={`${refund.id}-s`}>{refund.status}</Status>,
            refund.status === 'Pending' ? (
              <div key={`${refund.id}-a`} className="flex gap-1">
                <button type="button" onClick={(event) => { event.stopPropagation(); handleReturnAction(refund, 'approve') }} className="p-1.5 bg-emerald-100 text-emerald-700 rounded"><FaCheck /></button>
                <button type="button" onClick={(event) => { event.stopPropagation(); handleReturnAction(refund, 'reject') }} className="p-1.5 bg-red-100 text-red-700 rounded"><FaTimes /></button>
              </div>
            ) : 'Locked',
          ])} rowData={returnRows} onRowClick={(row) => openRowDetails(row.id, row)} numericColumns={[2, 3]} />
          {!returnRows.length && <EmptyState text="No returns found." />}
        </Panel>
      )}

      {(activeSection === 'Cashier Summary' || activeSection === 'Cash Management') && (
        <div className="space-y-4">
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

          <Panel
            title="Cashier Summary & Cash Variances"
            icon={FaCashRegister}
            footer={(
              <GridFooter
                page={cashierPage}
                pageSize={pageSize}
                total={cashierTotal}
                shown={cashierRows.length}
                onPageChange={setCashierPage}
                onPageSizeChange={setPageSize}
              />
            )}
          >
            <TransactionToolbar
              query={query}
              setQuery={setQuery}
              resultCount={cashierTotal}
              branchName={branchName}
            />
            <div className="px-2 pb-2 text-[11px] text-slate-500 border-b border-slate-200">
              Variance = counted cash − expected cash. Search cashier or register; type <strong>open</strong> / <strong>closed</strong> to filter status.
            </div>
            <DenseTable
              columns={[
                'Cashier', 'Register', 'Opened', 'Closed', 'Sales', 'Cash', 'M-Pesa', 'Card',
                'Opening', 'Expected', 'Counted', 'Variance', 'Status',
              ]}
              rows={cashierRows.map((row) => [
                row.cashier,
                row.register,
                row.openedAt,
                row.closedAt,
                `${row.salesCount} / ${money(row.salesTotal)}`,
                money(row.cashSales),
                money(row.mpesaSales),
                money(row.cardSales),
                money(row.opening),
                money(row.expected),
                row.counted == null ? '—' : money(row.counted),
                <VarianceBadge key={`${row.shiftId}-v`} amount={row.variance} status={row.varianceStatus} />,
                <Status key={`${row.shiftId}-s`}>{row.status}</Status>,
              ])}
              rowData={cashierRows}
              onRowClick={(row) => openRowDetails(`SHIFT-${row.shiftId} — ${row.cashier}`, {
                cashier: row.cashier,
                register: row.register,
                branch: row.branch,
                opened: row.openedAt,
                closed: row.closedAt,
                opening_cash: money(row.opening),
                expected_cash: money(row.expected),
                counted_cash: row.counted == null ? 'Not counted' : money(row.counted),
                variance: `${row.varianceStatus} ${money(row.variance)}`,
                cash_sales: money(row.cashSales),
                mpesa_sales: money(row.mpesaSales),
                card_sales: money(row.cardSales),
                manual_cash_in: money(row.cashIn),
                manual_cash_out: money(row.cashOut),
                sales: `${row.salesCount} receipts, ${money(row.salesTotal)}`,
                status: row.status,
              })}
              pinFirst
              numericColumns={[5, 6, 7, 8, 9, 10]}
            />
            {!loading && !cashierRows.length && <EmptyState text="No cashier shifts found for this branch." />}
          </Panel>
        </div>
      )}

      {activeSection === 'Payments' && (
        <Panel title="Payment Records" icon={FaCashRegister}>
          <DenseTable columns={['Payment Reference', 'Method', 'Amount', 'Transaction ID', 'Status']} rows={livePayments.map((payment) => [payment.reference, payment.method, money(payment.amount), payment.transactionId, <Status key={payment.reference}>{payment.status}</Status>])} rowData={livePayments} onRowClick={(row) => openRowDetails(row.reference, row)} numericColumns={[2]} />
          {!livePayments.length && <EmptyState text="No payments found." />}
        </Panel>
      )}

      {activeSection === 'Discounts Log' && (
        <Panel title="Discounts Log" icon={FaFilter}>
          <DenseTable columns={['Product / Receipt', 'Discount Value', 'Type', 'Approved By', 'Cashier', 'Date/Time']} rows={discountRows.map((discount) => [discount.target, discount.value, discount.type, discount.approvedBy, discount.cashier, discount.time])} rowData={discountRows} onRowClick={(row) => openRowDetails(row.target, row)} />
          {!discountRows.length && <EmptyState text="No discounts found." />}
        </Panel>
      )}

      {activeSection === 'Customer Sales' && (
        <Panel title="Customer Sales" icon={FaSearch}>
          <DenseTable columns={['Customer', 'Total Spent', 'Last Purchase', 'Credit Sales', 'Receipts']} rows={customerSalesRows.map((customer) => [customer.name, money(customer.totalSpent), customer.lastPurchase, money(customer.creditSales), customer.loyalty.toLocaleString()])} rowData={customerSalesRows} onRowClick={(row) => openRowDetails(row.name, row)} numericColumns={[1, 3, 4]} />
          {!customerSalesRows.length && <EmptyState text="No customer sales found." />}
        </Panel>
      )}

      {activeSection === 'Reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {['Daily sales summary', 'Sales per cashier', 'Sales per branch', 'Payment breakdown', 'Refund & void summary'].map((report) => (
            <div key={report} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h2 className="font-semibold text-sm text-slate-900">{report}</h2>
              <p className="text-xs text-slate-500 mt-2">Use date and branch filters; large exports run server-side.</p>
              <div className="flex gap-2 mt-4">
                <button type="button" className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center"><FaFilePdf className="mr-1" />PDF</button>
                <button type="button" className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center"><FaFileExcel className="mr-1" />Excel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'Audit Logs' && (
        <Panel title="Sales Audit Logs" icon={FaSearch}>
          <DenseTable columns={['User', 'Action Performed', 'Timestamp', 'Entity', 'Notes']} rows={auditLogs.map((log) => [log.username || 'System', log.action, new Date(log.created_at).toLocaleString(), `${log.entity} ${log.entity_id}`, log.notes])} rowData={auditLogs} onRowClick={(row) => openRowDetails(row.action, row)} />
          {!auditLogs.length && <EmptyState text="No audit logs found." />}
        </Panel>
      )}

      {detailsOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 2xl:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDetailsOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto bg-white rounded-t-xl shadow-2xl">
            <ReceiptDrawer receipt={selectedReceipt} onClose={() => setDetailsOpen(false)} mobile onVoid={voidReceipt} canVoid={can('*') || can('sale.void')} />
          </div>
        </div>
      )}

      {rowDetails && (
        <DetailModal title={rowDetails.title} data={rowDetails.data} onClose={() => setRowDetails(null)} />
      )}
    </div>
  )
}

const TransactionToolbar = ({ query, setQuery, resultCount, branchName, filters, setFilters, branchOptions = [] }) => (
  <div className="p-2 border-b border-slate-200 space-y-2">
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
      <div className="relative">
        <FaSearch className="absolute left-2.5 top-2.5 text-slate-400 text-xs" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search receipt, customer, cashier, product (server-side)"
          className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-xs"
        />
      </div>
      {filters && setFilters && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <FilterSelect
            label="Date range"
            value={filters.period}
            onChange={(value) => setFilters((current) => ({ ...current, period: value }))}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: '7days', label: 'Last 7 days' },
              { value: 'month', label: 'This month' },
              { value: 'all', label: 'All dates' },
            ]}
          />
          <FilterSelect
            label="Branch"
            value={String(filters.branchId || '')}
            onChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}
            options={(branchOptions.length ? branchOptions : [{ id: filters.branchId, name: branchName }]).map((row) => ({
              value: String(row.id),
              label: row.name,
            }))}
          />
          <FilterSelect
            label="Payment"
            value={filters.paymentMethod}
            onChange={(value) => setFilters((current) => ({ ...current, paymentMethod: value }))}
            options={[
              { value: '', label: 'All methods' },
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'mpesa', label: 'M-Pesa' },
              { value: 'credit', label: 'Credit' },
            ]}
          />
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, period: 'today', paymentMethod: '' }))}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
      <span>{resultCount.toLocaleString()} matching records (indexed server search)</span>
      <span>Load up to 500 rows per page</span>
    </div>
  </div>
)

const Panel = ({ title, icon: Icon, children, right, footer }) => (
  <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
      <div className="flex items-center min-w-0">
        <Icon className="text-emerald-600 mr-2 shrink-0" />
        <h2 className="font-semibold text-sm text-slate-900 truncate">{title}</h2>
      </div>
      {right}
    </div>
    {children}
    {footer}
  </section>
)

const EmptyState = ({ text }) => (
  <div className="px-4 py-6 text-center text-xs font-semibold text-slate-500">{text}</div>
)

const DenseTable = ({ columns, rows, rowData = [], onRowClick, pinFirst = false, numericColumns = [] }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ overflowX: 'auto', maxHeight: '66vh' }}>
      <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="sticky top-0 z-20 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                style={{ width: numericColumns.includes(index) ? '12%' : 'auto' }}
                className={`h-7 border-r border-slate-200 px-2 text-left font-bold text-slate-600 uppercase tracking-normal whitespace-nowrap ${numericColumns.includes(index) ? 'text-right' : ''} ${pinFirst && index === 0 ? 'sticky left-0 z-30 bg-slate-100 shadow-[1px_0_0_#cbd5e1]' : ''}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowData[rowIndex]?.saleId || rowData[rowIndex]?.receipt || rowIndex}
              onClick={() => onRowClick?.(rowData[rowIndex] || row)}
              className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-emerald-50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{ width: numericColumns.includes(cellIndex) ? '12%' : 'auto' }}
                  className={`h-8 border-r border-b border-slate-200 px-2 text-slate-700 whitespace-nowrap align-middle ${numericColumns.includes(cellIndex) ? 'text-right tabular-nums font-medium' : ''} ${pinFirst && cellIndex === 0 ? 'sticky left-0 z-10 bg-inherit font-bold text-slate-900 shadow-[1px_0_0_#e2e8f0]' : ''}`}
                >
                  {cell}
                </td>
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
      <span>
        Showing {start.toLocaleString()}-{end.toLocaleString()} of {total.toLocaleString()} (page {page} / {totalPages})
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-8 h-8 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
        >
          <FaChevronLeft />
        </button>
        <span className="px-2">Page {page}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-8 h-8 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
        >
          <FaChevronRight />
        </button>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="ml-2 px-2 py-1.5 border border-slate-300 rounded bg-white"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size} rows</option>
          ))}
        </select>
      </div>
    </div>
  )
}

const FilterSelect = ({ label, options, value, onChange }) => (
  <select
    aria-label={label}
    value={value}
    onChange={(event) => onChange?.(event.target.value)}
    className="min-w-0 px-2 py-2 border border-slate-300 rounded-md text-xs bg-white"
  >
    {options.map((option) => (
      <option key={option.value ?? option} value={option.value ?? option}>
        {option.label ?? option}
      </option>
    ))}
  </select>
)

const ReceiptActions = () => (
  <div className="hidden sm:flex gap-1">
    <button type="button" className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center hover:bg-slate-200"><FaPrint className="mr-1" />Print</button>
    <button type="button" className="px-2.5 py-1.5 bg-slate-100 rounded text-xs flex items-center hover:bg-slate-200"><FaFilePdf className="mr-1" />PDF</button>
  </div>
)

const ReceiptDrawer = ({ receipt, onClose, onVoid, canVoid, mobile = false }) => (
  <aside className={`bg-white ${mobile ? '' : 'rounded-lg shadow-sm border border-slate-200'} overflow-hidden`}>
    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-900">Receipt Details</h2>
        <p className="text-xs text-slate-500 mt-0.5">{receipt.receipt} / {receipt.time}</p>
      </div>
      <button type="button" onClick={onClose} className="2xl:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-100">
        <FaTimes />
      </button>
    </div>
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Info label="Customer" value={receipt.customer} />
        <Info label="Cashier" value={receipt.cashier} />
        <Info label="Branch" value={receipt.branch} />
        <Info label="Terminal" value={receipt.terminal} />
        <Info label="Payment" value={receipt.payment} />
        <Info label="Tax" value={money(receipt.tax)} />
      </div>
      <div className="rounded-lg bg-slate-950 text-white p-4">
        <p className="text-xs text-slate-300">Receipt total</p>
        <p className="text-2xl font-bold mt-1">{money(receipt.amount)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Items</p>
        <div className="mt-2 divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {receipt.items.map((item) => <div key={item} className="px-3 py-2 bg-white text-xs">{item}</div>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"><FaPrint className="mr-2" />Print</button>
        <button type="button" className="inline-flex items-center justify-center px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><FaFilePdf className="mr-2" />Export PDF</button>
        <button type="button" disabled={!canVoid || receipt.status === 'Voided'} onClick={() => onVoid?.(receipt)} className="col-span-2 inline-flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:bg-red-200 disabled:cursor-not-allowed"><FaTimes className="mr-2" />Void Receipt</button>
      </div>
    </div>
  </aside>
)

const DetailModal = ({ title, data, onClose }) => {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="absolute inset-x-3 top-6 bottom-6 mx-auto max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl sm:inset-x-6 sm:top-12 sm:bottom-auto">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-emerald-600">Record details</p>
            <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label="Close details">
            <FaTimes />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{formatLabel(key)}</p>
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

const formatLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())

const Info = ({ label, value }) => (
  <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
  </div>
)

const SummaryCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}

export default SalesControl
