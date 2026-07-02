import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaBan, FaBars, FaBell, FaCalendarAlt, FaCashRegister, FaChartLine, FaCheck, FaChevronLeft,
  FaChevronRight, FaCreditCard, FaExclamationCircle, FaExclamationTriangle,
  FaList, FaLock, FaMinus, FaEdit, FaMobileAlt, FaMoneyBillWave, FaPause, FaPlus, FaPrint,
  FaReceipt, FaSearch, FaShoppingBag, FaSignOutAlt, FaStore, FaTag, FaTimes, FaTrash, FaUser
} from 'react-icons/fa'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'
import { useOfflineStatus } from '../hooks/useOfflineStatus'
import { getDeviceId, getDeviceShortCode } from '../offline/deviceId'
import { savePendingSale } from '../offline/db'
import { getLocalProducts, getLocalCategories, getLocalCustomersFiltered, saveApiDataToCache } from '../offline/catalogSync'
import { SkeletonProductGrid, DotLoader, Spinner } from '../components/LoadingKit'

const currency = 'Ksh'
const money = (value) => `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const receiptMoney = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TOAST_AUTO_DISMISS_MS = 4500
const MPESA_POLL_INTERVAL_MS = 3000
const MPESA_POLL_ATTEMPTS = 30
const MPESA_RECOVERY_QUERY_INTERVAL_MS = 20000
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]))

const categoryColors = [
  'bg-indigo-500', 'bg-slate-700', 'bg-red-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-green-600', 'bg-amber-500', 'bg-violet-500', 'bg-teal-500', 'bg-sky-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-rose-500', 'bg-zinc-600', 'bg-fuchsia-500',
  'bg-lime-600', 'bg-yellow-500', 'bg-blue-600', 'bg-stone-500', 'bg-pink-500',
  'bg-blue-500', 'bg-emerald-700', 'bg-red-600', 'bg-slate-500',
]

const fallbackCustomers = ['Walk-in Customer']

const workspaceTabs = [
  { key: 'cart', label: 'Cart', icon: FaShoppingBag },
  { key: 'receipts', label: 'Receipts', icon: FaReceipt },
  { key: 'held', label: 'Held', icon: FaPause },
  { key: 'summary', label: 'Summary', icon: FaChartLine },
  { key: 'shift', label: 'Shift', icon: FaLock },
]

const productSizeOptions = [
  { key: 'compact', label: 'S' },
  { key: 'small', label: 'M' },
  { key: 'comfortable', label: 'L' },
  { key: 'large', label: 'XL' },
]

const productCardSizes = {
  compact: {
    grid: 'grid-cols-2 gap-1.5 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8',
    tile: 'min-h-[68px] p-1.5',
    badge: 'h-4 w-4 text-[8px]',
    name: 'mt-1 min-h-[24px] text-[10px]',
    price: 'mt-1 text-[10px]',
  },
  small: {
    grid: 'grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
    tile: 'min-h-[78px] p-2',
    badge: 'h-5 w-5 text-[9px]',
    name: 'mt-1.5 min-h-[28px] text-[10px]',
    price: 'mt-1.5 text-[11px]',
  },
  comfortable: {
    grid: 'grid-cols-2 gap-2 min-[380px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    tile: 'min-h-[88px] p-2',
    badge: 'h-5 w-5 text-[10px]',
    name: 'mt-2 min-h-[30px] text-[11px]',
    price: 'mt-2 text-xs',
  },
  large: {
    grid: 'grid-cols-2 gap-2 min-[420px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5',
    tile: 'min-h-[108px] p-3',
    badge: 'h-6 w-6 text-[11px]',
    name: 'mt-2 min-h-[36px] text-xs',
    price: 'mt-2 text-sm',
  },
}

const PosTerminal = () => {
  const navigate = useNavigate()
  const { user, can, logout, branch: authBranch, company: authCompany, reloadSignal } = useAuth()
  const { effectivelyOnline, refreshPendingCount, syncCatalog } = useOfflineStatus(authBranch?.id)
  const [usingCachedData, setUsingCachedData] = useState(false)
  const [apiProducts, setApiProducts] = useState([])
  const [apiCategories, setApiCategories] = useState([])
  const [apiCustomers, setApiCustomers] = useState([])
  const [apiSales, setApiSales] = useState([])
  const [activeDiscountRules, setActiveDiscountRules] = useState([])
  const [branch, setBranch] = useState(null)
  const [registers, setRegisters] = useState([])
  const [register, setRegister] = useState(null)
  const [shift, setShift] = useState(null)
  const [heldApiOrders, setHeldApiOrders] = useState([])
  const [lowStockRows, setLowStockRows] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [openingCash, setOpeningCash] = useState('0.00')
  const [countedCash, setCountedCash] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [cashTendered, setCashTendered] = useState('')
  const [mpesaAmount, setMpesaAmount] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaReference, setMpesaReference] = useState('')
  const [mpesaDirectTransactionId, setMpesaDirectTransactionId] = useState('')
  const [lastCheckout, setLastCheckout] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All Products')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('Wholesale')
  const [customer, setCustomer] = useState(fallbackCustomers[0])
  const [cart, setCart] = useState([])
  const [workspace, setWorkspace] = useState('cart')

  useEffect(() => {
    if (workspace === 'pay') setWorkspace('cart')
  }, [workspace])
  const [productSize, setProductSize] = useState('small')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobilePanel, setMobilePanel] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [receiptModal, setReceiptModal] = useState(null)
  const [editingHeldOrderId, setEditingHeldOrderId] = useState(null)
  const [heldOrderBaseline, setHeldOrderBaseline] = useState({})

  const loadShiftSales = async (branchId, shiftId) => {
    if (!branchId || !shiftId) {
      setApiSales([])
      return
    }
    const base = { branch: branchId, shift: shiftId, page_size: 200 }
    const [paidResponse, voidedResponse] = await Promise.all([
      posApi.sales({ ...base, status: 'paid' }),
      posApi.sales({ ...base, status: 'voided' }),
    ])
    const paid = paidResponse.results || paidResponse
    const voided = voidedResponse.results || voidedResponse
    const merged = [...paid, ...voided].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    setApiSales(merged)
  }

  const refreshApiData = async (branchOverride = branch || authBranch, shiftOverride = shift) => {
    const branchId = branchOverride?.id
    if (!branchId) return
    const [productResponse, categoryResponse, customerResponse, heldResponse, lowStockResponse, discountRulesResponse] = await Promise.all([
      posApi.products({ branch: branchId, page_size: 500 }),
      posApi.categories({ branch: branchId }),
      posApi.customers({ branch: branchId }),
      posApi.heldOrders({ branch: branchId, status: 'open' }),
      posApi.lowStock({ branch: branchId }),
      posApi.activeDiscountRules({ branch: branchId }).catch(() => []),
    ])
    const products = productResponse.results || productResponse
    const categories = categoryResponse.results || categoryResponse
    const customers = customerResponse.results || customerResponse
    setApiProducts(products)
    setApiCategories(categories)
    setApiCustomers(customers)
    setHeldApiOrders(heldResponse.results || heldResponse)
    setLowStockRows(lowStockResponse.results || lowStockResponse)
    setActiveDiscountRules(Array.isArray(discountRulesResponse) ? discountRulesResponse : (discountRulesResponse?.results || []))
    setUsingCachedData(false)
    saveApiDataToCache(branchId, { products, categories, customers }).catch(() => {})
    await loadShiftSales(branchId, shiftOverride?.id)
  }

  useEffect(() => {
    let active = true

    const loadApiData = async () => {
      try {
        const selectedBranch = authBranch
        if (!selectedBranch?.id) {
          setStatusMessage('No active branch is assigned to this POS user.')
          return
        }
        setBranch(selectedBranch)
        setCart([])
        setActiveCategory('All Products')
        const registerResponse = await posApi.registers({ branch: selectedBranch.id })
        if (!active) return
        let registerRows = registerResponse.results || registerResponse
        if (!registerRows.length) {
          const ensured = await posApi.ensureRegister({ branch: selectedBranch.id })
          registerRows = [ensured]
        }
        setRegisters(registerRows)
        const selectedRegister = registerRows[0] || null
        setRegister(selectedRegister)
        const shiftResponse = await posApi.shifts({
          branch: selectedBranch.id,
          register: selectedRegister.id,
          status: 'open',
        })
        const openShifts = shiftResponse.results || shiftResponse
        const selectedShift = openShifts[0] || null
        if (!active) return
        setShift(selectedShift)
        await refreshApiData(selectedBranch, selectedShift)
      } catch (error) {
        if (!active) return
        const branchId = authBranch?.id
        if (branchId) {
          try {
            const [cachedProducts, cachedCategories, cachedCustomers] = await Promise.all([
              getLocalProducts(branchId),
              getLocalCategories(branchId),
              getLocalCustomersFiltered(branchId),
            ])
            if (cachedProducts.length || cachedCategories.length) {
              setApiProducts(cachedProducts)
              setApiCategories(cachedCategories)
              setApiCustomers(cachedCustomers)
              setUsingCachedData(true)
              setStatusMessage('Offline — using cached catalog. Sales will sync when connected.')
              return
            }
          } catch {
            // IndexedDB read failed — fall through to empty state
          }
        }
        setStatusMessage(error.data?.detail || 'Offline: no cached data yet. Connect to load products.')
        setApiProducts([])
        setApiCustomers([])
        setApiSales([])
      } finally {
        if (active) setInitialLoading(false)
      }
    }

    loadApiData()
    return () => {
      active = false
    }
  }, [user?.id, authBranch?.id, reloadSignal])

  const categoryNames = useMemo(
    () => ['All Products', ...apiCategories.map((category) => category.name)],
    [apiCategories],
  )

  const customerOptions = useMemo(() => apiCustomers.map((item) => item.name), [apiCustomers])

  const saleProducts = useMemo(() => {
    return apiProducts.map((product, index) => {
      const categoryName = product.category_name || product.category || 'Products'
      const color = categoryColors[(index + 1) % categoryColors.length]
      return {
        id: String(product.id),
        productId: product.id,
        name: product.name,
        category: categoryName,
        sku: product.sku,
        price: Number(mode === 'Wholesale' ? product.wholesale_price : product.retail_price),
        stock: Number(product.stock || 0),
        letter: categoryName[0] || 'P',
        color,
      }
    })
  }, [apiProducts, mode])

  useEffect(() => {
    if (!cart.length || !apiProducts.length) return
    const priceByProduct = new Map(apiProducts.map((product) => [
      String(product.id),
      Number(mode === 'Wholesale' ? product.wholesale_price : product.retail_price),
    ]))
    setCart((current) => current.map((item) => {
      const nextPrice = priceByProduct.get(String(item.productId || item.id))
      if (!Number.isFinite(nextPrice) || nextPrice === item.price) return item
      return { ...item, price: nextPrice }
    }))
  }, [apiProducts, mode, cart.length])

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase()
    return saleProducts.filter((product) => {
      const categoryMatch = activeCategory === 'All Products' || product.category === activeCategory
      const searchMatch = !search || [product.name, product.category, product.sku].some((value) => value.toLowerCase().includes(search))
      return categoryMatch && searchMatch
    })
  }, [activeCategory, query, saleProducts])

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart])

  const cartWithDiscounts = useMemo(() => {
    if (!activeDiscountRules.length) return cart.map((item) => ({ ...item, discountAmount: 0 }))
    return cart.map((item) => {
      const gross = item.price * item.qty
      const productId = String(item.productId || item.id)
      const categoryName = item.category
      let rule = activeDiscountRules.find((r) => r.target === 'product' && String(r.product) === productId)
      if (!rule) rule = activeDiscountRules.find((r) => r.target === 'category' && r.category_name === categoryName)
      if (!rule) rule = activeDiscountRules.find((r) => r.target === 'all')
      if (!rule) return { ...item, discountAmount: 0 }
      let disc = rule.discount_type === 'percent'
        ? (gross * Number(rule.value)) / 100
        : Math.min(Number(rule.value), gross)
      disc = Math.round(disc * 100) / 100
      return { ...item, discountAmount: disc, appliedRule: rule.name }
    })
  }, [cart, activeDiscountRules])

  const discountTotal = useMemo(() => cartWithDiscounts.reduce((s, i) => s + i.discountAmount, 0), [cartWithDiscounts])
  const total = Math.max(0, subtotal - discountTotal)
  const lowStockCount = lowStockRows.length

  // Poll active discount rules every 30 s so expiries apply without a manual refresh.
  // Depends only on branch?.id — not on activeDiscountRules — so the interval is stable.
  useEffect(() => {
    if (!branch?.id) return
    const interval = setInterval(async () => {
      try {
        const fresh = await posApi.activeDiscountRules({ branch: branch.id })
        setActiveDiscountRules(Array.isArray(fresh) ? fresh : (fresh?.results || []))
      } catch { /* silent — never interrupt the cashier */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [branch?.id])

  // Refresh product prices every 5 min to pick up price-schedule changes.
  useEffect(() => {
    if (!branch?.id) return
    const interval = setInterval(async () => {
      try {
        const res = await posApi.products({ branch: branch.id, page_size: 500 })
        setApiProducts(res.results || res)
      } catch { /* silent */ }
    }, 5 * 60_000)
    return () => clearInterval(interval)
  }, [branch?.id])

  // Notification bell state
  const [notifications, setNotifications] = useState([])
  const [seenNotifIds, setSeenNotifIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nexa-pos-seen-notifs') || '[]')) } catch { return new Set() }
  })

  useEffect(() => {
    if (!branch?.id) return
    const fetchNotifs = async () => {
      try {
        const res = await posApi.posNotifications({ branch: branch.id })
        setNotifications(res.notifications || [])
      } catch { /* silent */ }
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [branch?.id])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenNotifIds.has(n.id)).length,
    [notifications, seenNotifIds],
  )

  const handleNotifOpen = useCallback(() => {
    const next = new Set([...seenNotifIds, ...notifications.map((n) => n.id)])
    setSeenNotifIds(next)
    try { localStorage.setItem('nexa-pos-seen-notifs', JSON.stringify([...next])) } catch { /* ok */ }
  }, [notifications, seenNotifIds])

  const selectedCustomer = useMemo(() => apiCustomers.find((item) => item.name === customer), [apiCustomers, customer])

  const addProduct = useCallback((product) => {
    if (product.stock === 0) {
      setStatusMessage(`${product.name} is out of stock.`)
      return
    }
    const lowStock = product.stock <= 5
    if (lowStock) {
      setStatusMessage(`Low stock: ${product.name} has ${product.stock} left.`)
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) {
          setStatusMessage(`Only ${product.stock} units available for ${product.name}.`)
          return current
        }
        return current.map((item) => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock || 99) } : item)
      }
      return [...current, { ...product, qty: 1 }]
    })
    setWorkspace('cart')
  }, [])

  useEffect(() => {
    if (!selectedCustomer?.phone) return
    if (paymentMode === 'mpesa' || paymentMode === 'split') {
      setMpesaPhone((current) => current || selectedCustomer.phone)
    }
  }, [selectedCustomer?.id, paymentMode])

  const changeQty = useCallback((id, delta) => {
    if (editingHeldOrderId) {
      setStatusMessage('Items from a held order cannot be edited. Clear the cart to start fresh.')
      return
    }
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, qty: Math.max(1, Math.min(item.qty + delta, item.stock || 99)) } : item)
    )
  }, [editingHeldOrderId])

  const setItemPrice = useCallback((id, newPrice) => {
    if (editingHeldOrderId) return
    const price = parseFloat(newPrice)
    if (isNaN(price) || price < 0) return
    setCart((current) => current.map((item) => item.id === id ? { ...item, price } : item))
  }, [editingHeldOrderId])

  const clearCart = () => {
    setCart([])
    setEditingHeldOrderId(null)
    setHeldOrderBaseline({})
  }

  const mapHeldItemsToCart = (heldItems = []) => heldItems.map((item, index) => {
    const productId = item.product
    const matched = saleProducts.find((product) => product.productId === productId)
    return {
      id: String(productId),
      productId,
      name: item.product_name || matched?.name || 'Product',
      category: matched?.category || 'Products',
      sku: matched?.sku || '',
      price: Number(item.unit_price),
      stock: matched?.stock ?? 999,
      letter: (item.product_name || matched?.name || 'P')[0],
      color: matched?.color || categoryColors[index % categoryColors.length],
      qty: item.quantity,
    }
  })
  const withBusy = async (action, success) => {
    setBusy(true)
    setStatusMessage('')
    try {
      const result = await action()
      setStatusMessage(success)
      return result
    } catch (error) {
      setStatusMessage(error.data ? JSON.stringify(error.data) : error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const resetPaymentInputs = () => {
    setCashTendered('')
    setMpesaAmount('')
    setMpesaPhone('')
    setMpesaReference('')
    setMpesaDirectTransactionId('')
    setPaymentMode('cash')
  }

  const openPaymentModal = () => {
    if (!cart.length) return
    if (!shift) {
      setWorkspace('shift')
      setStatusMessage('Open a shift with opening cash before selling.')
      return
    }
    setPaymentModalOpen(true)
  }

  const sendMpesaStk = async () => {
    const built = buildCheckoutPayments({
      total,
      paymentMode,
      cashTendered,
      mpesaAmount,
      mpesaPhone,
      mpesaReference,
      mpesaDirectTransactionId,
    })
    if (built.error) {
      throw new Error(built.error)
    }
    const mpesaPayment = built.payments.find((payment) => payment.method === 'mpesa')
    if (!mpesaPayment) {
      throw new Error('Select an M-Pesa payment before sending STK.')
    }

    // If the branch is not configured for M-Pesa, skip STK push and allow checkout to proceed
    const branchHasMpesa = Boolean(branch?.mpesa_enabled)
    if (!branchHasMpesa) {
      setStatusMessage('Branch M-Pesa not configured — completing sale without STK.')
      return { success: true, skipped: true }
    }

    setStatusMessage('Sending M-Pesa STK push...')
    const result = await posApi.mpesaStkPush({
      phone: normalizePhone(mpesaPhone),
      amount: mpesaPayment.amount,
      reference: mpesaPayment.reference || mpesaPhone,
      branch: branch?.id,
      branch_name: branch?.name,
      description: 'POS Payment',
    })
    setStatusMessage(result.customer_message || 'STK sent. Ask the customer to enter their M-Pesa PIN.')
    return result
  }

  const checkoutCart = async (opts = {}) => {
    if (!shift) {
      setWorkspace('shift')
      setPaymentModalOpen(false)
      setStatusMessage('Open a shift with opening cash before selling.')
      return
    }
    if (!cart.length || !branch || !register || !user) return

    const built = buildCheckoutPayments({
      total,
      paymentMode,
      cashTendered,
      mpesaAmount,
      mpesaPhone,
      mpesaReference,
      mpesaDirectTransactionId,
    })
    if (built.error) {
      setStatusMessage(built.error)
      return
    }

    const deviceId = getDeviceId()
    const checkoutPayload = {
      branch: branch.id,
      register: register.id,
      shift: shift.id,
      cashier: user.id,
      customer: selectedCustomer?.id || null,
      mode: mode.toLowerCase(),
      items: cartWithDiscounts.map((item) => ({ product: item.productId || item.id, quantity: item.qty, discount_amount: item.discountAmount.toFixed(2) })),
      payments: built.payments,
      mpesa_checkout_request_id: opts.mpesa_checkout_request_id || '',
      mpesa_direct_transaction_id: opts.mpesa_direct_transaction_id || '',
      mpesa_manual_approval: opts.mpesa_manual_approval || false,
      device_id: deviceId,
    }

    // Save offline when server is unreachable (cash sales, or manually-confirmed M-Pesa)
    const isCashOnly = built.payments.every((p) => p.method === 'cash')
    const hasMpesa = built.payments.some((p) => p.method === 'mpesa')
    const isOfflineMpesa = !effectivelyOnline && hasMpesa && opts.offline_mpesa

    if (!effectivelyOnline && (isCashOnly || isOfflineMpesa)) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const seq = String(Date.now()).slice(-4)
      const offlineReceiptNo = `${branch.code}-${getDeviceShortCode()}-${today}-${seq}`
      const offlineSale = { ...checkoutPayload, receipt_no: offlineReceiptNo, created_at: new Date().toISOString() }
      await savePendingSale(offlineSale)
      await refreshPendingCount()
      const payLabel = isOfflineMpesa ? 'M-Pesa (offline)' : 'cash'
      setStatusMessage(`Saved offline [${payLabel}]: ${offlineReceiptNo}. Will sync when connected.`)
      const primaryPayment = built.payments[0]
      const receipt = {
        id: offlineReceiptNo, saleId: null, customer: selectedCustomer?.name || 'Walk-in',
        cashier: user.username, branch: branch?.name || '', register: register?.code || register?.name || '',
        mode: mode.toLowerCase(), method: primaryPayment?.method || 'cash', amount: total, subtotal,
        tax: 0, discount: discountTotal, paid: Number(primaryPayment?.amount || total),
        change: isCashOnly ? Math.max(0, Number(primaryPayment?.amount || total) - total) : 0,
        payments: built.payments,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Offline', items: cartWithDiscounts.map((item) => ({ productId: item.id, name: item.name, qty: item.qty, price: item.price, discountAmount: item.discountAmount || 0, appliedRule: item.appliedRule || '' })),
      }
      setLastCheckout(receipt)
      // Open cash drawer for cash payments when running in Electron
      if (isCashOnly && window.electronAPI?.openCashDrawer) {
        try {
          const deviceCfg = JSON.parse(localStorage.getItem('nexa-device-settings') || '{}')
          window.electronAPI.openCashDrawer({ port: deviceCfg.cashDrawerPort || '' })
        } catch (_) {}
      }
      // Remove the held order immediately from local state (we're offline, can't call API)
      const heldIdToRemove = editingHeldOrderId
      clearCart()
      if (heldIdToRemove) {
        setHeldApiOrders((prev) => prev.filter((o) => o.id !== heldIdToRemove))
        posApi.cancelHeldOrder(heldIdToRemove).catch(() => {})
      }
      resetPaymentInputs()
      setPaymentModalOpen(false)
      setWorkspace('receipts')
      setReceiptModal(receipt)
      return
    }

    if (!effectivelyOnline && hasMpesa) {
      setStatusMessage('You are offline. Use "Confirm M-Pesa received" in the payment screen to record a manual M-Pesa payment.')
      return
    }

    if (!effectivelyOnline) {
      setStatusMessage('You are offline. Only cash and manually-confirmed M-Pesa payments are available.')
      return
    }

    const sale = await withBusy(() => posApi.checkout(checkoutPayload), `Sale ${built.payments[0]?.method === 'cash' ? 'completed' : 'recorded'} successfully.`)
    if (sale) {
      const discountByProduct = Object.fromEntries(
        cartWithDiscounts.filter((i) => i.discountAmount > 0).map((i) => [String(i.productId || i.id), { discountAmount: i.discountAmount, appliedRule: i.appliedRule || '' }])
      )
      setLastCheckout({
        saleId: sale.id,
        receipt: sale.receipt_no,
        customer: sale.customer_name || customer,
        cashier: sale.cashier_name || user.username,
        branch: sale.branch_name || branch?.name || '',
        register: sale.register_code || register?.code || register?.name || '',
        mode: sale.mode || mode.toLowerCase(),
        method: sale.payments?.[0]?.method || built.payments[0]?.method || 'cash',
        total: Number(sale.total),
        subtotal: Number(sale.subtotal || sale.total || 0),
        tax: Number(sale.tax_total || 0),
        discount: Number(sale.discount_total || 0),
        paid: Number(sale.paid_total || 0),
        change: Number(sale.change_due || 0),
        payments: sale.payments || built.payments,
        time: new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: sale.status === 'voided' ? 'Voided' : 'Paid',
        items: (sale.items || []).map((item) => ({
          productId: item.product,
          name: item.product_name,
          qty: item.quantity,
          price: Number(item.unit_price),
          discountAmount: Number(item.discount_amount || 0) || (discountByProduct[String(item.product)]?.discountAmount ?? 0),
          appliedRule: discountByProduct[String(item.product)]?.appliedRule || '',
        })),
      })
      // Capture before clearCart() resets the state
      const heldIdToCancel = editingHeldOrderId
      clearCart()
      resetPaymentInputs()
      setPaymentModalOpen(false)
      setWorkspace('receipts')
      setReceiptModal({
        id: sale.receipt_no,
        saleId: sale.id,
        customer: sale.customer_name || customer,
        cashier: sale.cashier_name || user.username,
        branch: sale.branch_name || branch?.name || '',
        register: sale.register_code || register?.code || register?.name || '',
        mode: sale.mode || mode.toLowerCase(),
        method: sale.payments?.[0]?.method || built.payments[0]?.method || 'cash',
        amount: Number(sale.total),
        subtotal: Number(sale.subtotal || sale.total || 0),
        tax: Number(sale.tax_total || 0),
        discount: Number(sale.discount_total || 0),
        paid: Number(sale.paid_total || 0),
        change: Number(sale.change_due || 0),
        payments: sale.payments || built.payments,
        time: new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Paid',
        items: (sale.items || []).map((item) => ({
          productId: item.product,
          name: item.product_name,
          qty: item.quantity,
          price: Number(item.unit_price),
          discountAmount: Number(item.discount_amount || 0) || (discountByProduct[String(item.product)]?.discountAmount ?? 0),
          appliedRule: discountByProduct[String(item.product)]?.appliedRule || '',
        })),
      })
      // Cancel the held order BEFORE refreshing so the fetch returns the clean list
      if (heldIdToCancel) {
        await posApi.cancelHeldOrder(heldIdToCancel).catch(() => {})
      }
      await refreshApiData(branch, shift)
      // Open cash drawer for cash payments when running in Electron
      const hasCash = (sale.payments || built.payments).some((p) => p.method === 'cash')
      if (hasCash && window.electronAPI?.openCashDrawer) {
        try {
          const deviceCfg = JSON.parse(localStorage.getItem('nexa-device-settings') || '{}')
          window.electronAPI.openCashDrawer({ port: deviceCfg.cashDrawerPort || '' })
        } catch (_) {}
      }
      const change = Number(sale.change_due || 0)
      if (change > 0) {
        setStatusMessage(`Sale ${sale.receipt_no} complete. Change due: ${money(change)}`)
      }
    }
  }

  const buildHoldPayload = () => ({
    customer: selectedCustomer?.id || null,
    note: editingHeldOrderId ? 'Updated from POS terminal' : 'Held from POS terminal',
    items: cart.map((item) => ({
      product: item.productId || item.id,
      quantity: item.qty,
      unit_price: item.price.toFixed(2),
    })),
  })

  const validateHeldOrderUpdate = () => {
    if (!editingHeldOrderId) return true
    const currentQtyByProduct = new Map(cart.map((item) => [String(item.productId || item.id), Number(item.qty || 0)]))
    const reducedItem = Object.entries(heldOrderBaseline).find(([productId, originalQty]) => (
      (currentQtyByProduct.get(String(productId)) || 0) < Number(originalQty || 0)
    ))
    if (!reducedItem) return true
    setStatusMessage('Cannot remove or reduce items from a loaded held order. Add items or increase quantities only.')
    return false
  }

  const holdCart = async () => {
    if (!shift) {
      setWorkspace('shift')
      setStatusMessage('Open a shift before holding orders.')
      return
    }
    if (!cart.length || !branch || !register || !user) return

    if (editingHeldOrderId) {
      if (!validateHeldOrderUpdate()) return
      const updated = await withBusy(
        () => posApi.updateHeldOrder(editingHeldOrderId, buildHoldPayload()),
        'Held order updated.',
      )
      if (updated) {
        clearCart()
        setWorkspace('held')
        await refreshApiData(branch, shift)
      }
      return
    }

    const held = await withBusy(() => posApi.holdOrder({
      branch: branch.id,
      register: register.id,
      cashier: user.id,
      ...buildHoldPayload(),
    }), 'Order held.')
    if (held) {
      clearCart()
      setWorkspace('held')
      await refreshApiData(branch, shift)
    }
  }

  const loadHeldOrderForEdit = (heldOrder) => {
    const raw = heldOrder?.raw
    if (!raw?.id || raw.status !== 'open') return
    if (cart.length && editingHeldOrderId !== raw.id && !window.confirm('Replace the current cart with this held order?')) return
    const heldCartItems = mapHeldItemsToCart(raw.items || [])
    setCart(heldCartItems)
    setHeldOrderBaseline(Object.fromEntries(
      heldCartItems.map((item) => [String(item.productId || item.id), Number(item.qty || 0)]),
    ))
    setEditingHeldOrderId(raw.id)
    if (raw.customer_name) setCustomer(raw.customer_name)
    setWorkspace('cart')
    setStatusMessage(`Held order HLD-${raw.id} loaded. Add items or increase quantities only, then tap Update hold or Pay.`)
  }

  const cancelHeldOrder = async (heldOrder) => {
    const orderId = heldOrder?.raw?.id
    if (!orderId) return
    if (!window.confirm(`Cancel held order HLD-${orderId}?`)) return
    const cancelled = await withBusy(() => posApi.cancelHeldOrder(orderId), 'Held order cancelled.')
    if (!cancelled) return
    if (editingHeldOrderId === orderId) clearCart()
    await refreshApiData(branch, shift)
  }

  const changeRegister = async (registerId) => {
    const nextRegister = registers.find((row) => String(row.id) === String(registerId))
    if (!nextRegister || !branch) return
    setRegister(nextRegister)
    setShift(null)
    setApiSales([])
    try {
      const shiftResponse = await posApi.shifts({
        branch: branch.id,
        register: nextRegister.id,
        status: 'open',
      })
      const openShifts = shiftResponse.results || shiftResponse
      const nextShift = openShifts[0] || null
      setShift(nextShift)
      await refreshApiData(branch, nextShift)
    } catch (error) {
      setStatusMessage(error.data ? JSON.stringify(error.data) : error.message)
    }
  }

  const shiftSalesSummary = useMemo(() => {
    if (!shift?.id) return { total: 0, count: 0, cash: 0, mpesa: 0, card: 0 }
    const shiftSales = apiSales.filter((sale) => sale.status !== 'voided')
    const payments = shiftSales.flatMap((sale) => sale.payments || [])
    return {
      total: shiftSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      count: shiftSales.length,
      cash: payments.filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      mpesa: payments.filter((payment) => payment.method === 'mpesa').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      card: payments.filter((payment) => payment.method === 'card').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    }
  }, [apiSales, shift?.id])

  const voidReceipt = async (receipt) => {
    if (!receipt?.saleId || !user || (!can('*') && !can('sale.void'))) return
    if (!window.confirm(`Void entire transaction ${receipt.id}? Stock will be restored.`)) return
    const reason = window.prompt('Reason for voiding this transaction:', 'Voided from POS terminal')
    if (reason === null || !reason.trim()) {
      if (reason !== null) setStatusMessage('A void reason is required.')
      return
    }
    const sale = await withBusy(
      () => posApi.voidSale(receipt.saleId, { user: user.id, reason: reason.trim() }),
      'Transaction voided and stock restored.',
    )
    if (sale) {
      setReceiptModal(null)
      await refreshApiData(branch, shift)
    }
  }

  const voidLineItem = async (receipt, item) => {
    if (!receipt?.saleId || !item?.productId || !user) return
    if (!can('*') && !can('sale.refund') && !can('sale.void')) {
      setStatusMessage('You do not have permission to void line items.')
      return
    }
    if (!window.confirm(`Void ${item.qty}× ${item.name} from ${receipt.id}?`)) return
    const reason = window.prompt('Reason for voiding this line:', 'Wrong item')
    if (reason === null || !reason.trim()) {
      if (reason !== null) setStatusMessage('A reason is required.')
      return
    }
    const result = await withBusy(async () => {
      const created = await posApi.createSaleReturn({
        sale: receipt.saleId,
        processed_by: user.id,
        reason: reason.trim(),
        refund_method: receipt.method || 'cash',
        shift: shift?.id || undefined,
        items: [{ product: item.productId, quantity: item.qty }],
      })
      return posApi.completeSaleReturn(created.id, { user: user.id })
    }, `Voided line: ${item.name}`)
    if (result) {
      await refreshApiData(branch, shift)
      setReceiptModal(null)
    }
  }

  const reprintReceipt = async (receipt) => {
    if (!receipt?.saleId) return
    await withBusy(() => posApi.reprintReceipt(receipt.saleId, { user: user?.id || null }), 'Receipt copy recorded.')
  }
  const openShift = async () => {
    if (!branch || !register || !user) return
    const nextShift = await withBusy(() => posApi.openShift({ branch: branch.id, register: register.id, cashier: user.id, opening_cash: openingCash || '0.00' }), 'Shift opened. Sales are enabled.')
    if (nextShift) {
      setShift(nextShift)
      await refreshApiData(branch, nextShift)
    }
  }
  const closeCurrentShift = async () => {
    if (!shift) return
    const closed = await withBusy(() => posApi.closeShift(shift.id, { counted_cash: countedCash || shift.expected_cash || '0.00' }), 'Shift closed.')
    if (closed) {
      setShift(null)
      setCountedCash('')
      setApiSales([])
    }
  }
  const openMobileWorkspace = (panel = workspace) => {
    setWorkspace(panel)
    setMobilePanel('workspace')
  }

  return (
    <div className="pos-terminal min-h-[100dvh] bg-[#eef2f6] text-slate-900 [--pos-header:3.5rem] sm:[--pos-header:4rem] lg:overflow-hidden">
      <TopBar
        mode={mode}
        setMode={setMode}
        company={authCompany}
        branch={branch}
        register={register}
        registers={registers}
        onRegisterChange={changeRegister}
        shift={shift}
        lowStockCount={lowStockCount}
        heldCount={heldApiOrders.length}
        itemCount={itemCount}
        onPay={openPaymentModal}
        onExit={() => navigate('/dashboard')}
        onLogout={logout}
        user={user}
        notifications={notifications}
        unreadCount={unreadCount}
        onNotifOpen={handleNotifOpen}
      />
      <StatusToast message={statusMessage} onDismiss={() => setStatusMessage('')} />

      {usingCachedData && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800 border-b border-amber-200">
          <FaExclamationTriangle className="shrink-0" />
          <span>Offline mode — showing cached catalog. Prices may be outdated. Sales will sync when connected.</span>
        </div>
      )}

      <div className={`pos-shell-grid grid h-[calc(100dvh-var(--pos-header))] grid-cols-1 overflow-hidden ${sidebarCollapsed ? 'lg:grid-cols-[56px_minmax(0,1fr)_minmax(360px,440px)] xl:grid-cols-[56px_minmax(0,1fr)_minmax(380px,460px)]' : 'lg:grid-cols-[172px_minmax(0,1fr)_minmax(360px,440px)] xl:grid-cols-[192px_minmax(0,1fr)_minmax(380px,460px)]'}`}>
        <CategoryRail
          categories={categoryNames}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />

        <main className="flex min-h-0 flex-col border-r border-slate-200/80 bg-white">
          <CatalogHeader
            activeCategory={activeCategory}
            query={query}
            setQuery={setQuery}
            shown={visibleProducts.length}
            total={saleProducts.length}
            productSize={productSize}
            setProductSize={setProductSize}
            onOpenCategories={() => setMobilePanel('categories')}
          />
          {initialLoading
            ? <SkeletonProductGrid count={20} />
            : <ProductGrid products={visibleProducts} addProduct={addProduct} productSize={productSize} />
          }
        </main>

        <WorkspacePanel
          mode={mode}
          cart={cartWithDiscounts}
          subtotal={subtotal}
          discount={discountTotal}
          total={total}
          itemCount={itemCount}
          changeQty={changeQty}
          setItemPrice={setItemPrice}
          clearCart={clearCart}
          salesHistory={apiSales}
          shiftSummary={shiftSalesSummary}
          workspace={workspace}
          setWorkspace={setWorkspace}
          heldOrders={heldApiOrders}
          onHold={holdCart}
          editingHeldOrderId={editingHeldOrderId}
          onEditHeld={loadHeldOrderForEdit}
          onCancelHeld={cancelHeldOrder}
          onOpenPayment={openPaymentModal}
          onSelectReceipt={setReceiptModal}
          busy={busy}
          shift={shift}
          openingCash={openingCash}
          setOpeningCash={setOpeningCash}
          countedCash={countedCash}
          setCountedCash={setCountedCash}
          onOpenShift={openShift}
          onCloseShift={closeCurrentShift}
          lastCheckout={lastCheckout}
          heldCount={heldApiOrders.length}
          onOpenTransactions={() => navigate('/sales-control/transactions')}
        />
      </div>

      {paymentModalOpen && (
        <PaymentModal
          total={total}
          itemCount={itemCount}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          cashTendered={cashTendered}
          setCashTendered={setCashTendered}
          mpesaAmount={mpesaAmount}
          setMpesaAmount={setMpesaAmount}
          mpesaPhone={mpesaPhone}
          setMpesaPhone={setMpesaPhone}
          mpesaReference={mpesaReference}
          setMpesaReference={setMpesaReference}
          mpesaDirectTransactionId={mpesaDirectTransactionId}
          setMpesaDirectTransactionId={setMpesaDirectTransactionId}
          onSendStk={sendMpesaStk}
          onCheckout={checkoutCart}
          onClose={() => setPaymentModalOpen(false)}
          busy={busy}
          shift={shift}
          cartEmpty={!cart.length}
          branch={branch}
          effectivelyOnline={effectivelyOnline}
        />
      )}

      {receiptModal && (
        <EnhancedReceiptModal
          receipt={receiptModal}
          onClose={() => setReceiptModal(null)}
          onVoid={voidReceipt}
          onVoidLine={voidLineItem}
          onReprint={reprintReceipt}
          canVoid={can('*') || can('sale.void')}
          canVoidLine={can('*') || can('sale.refund') || can('sale.void')}
          busy={busy}
        />
      )}

      <MobileDock
        itemCount={itemCount}
        total={total}
        shift={shift}
        onCart={() => openMobileWorkspace('cart')}
        onPay={openPaymentModal}
        onWorkspace={() => openMobileWorkspace()}
      />

      {mobilePanel === 'categories' && (
        <MobileSheet title="Categories" onClose={() => setMobilePanel(null)}>
          <div className="grid grid-cols-2 gap-2 p-3">
            {categoryNames.map((category, index) => (
              <CategoryButton
                key={category}
                category={category}
                index={index}
                active={activeCategory === category}
                onClick={() => {
                  setActiveCategory(category)
                  setMobilePanel(null)
                }}
              />
            ))}
          </div>
        </MobileSheet>
      )}

      {mobilePanel === 'workspace' && (
        <MobileSheet title="POS Controls" onClose={() => setMobilePanel(null)} nativeScroll={false}>
          <WorkspacePanel
            mode={mode}
            cart={cart}
            subtotal={subtotal}
            discount={discountTotal}
            total={total}
            itemCount={itemCount}
            changeQty={changeQty}
            setItemPrice={setItemPrice}
            clearCart={clearCart}
            salesHistory={apiSales}
            shiftSummary={shiftSalesSummary}
            workspace={workspace}
            setWorkspace={setWorkspace}
            mobile
            heldOrders={heldApiOrders}
            onHold={holdCart}
            editingHeldOrderId={editingHeldOrderId}
            onEditHeld={loadHeldOrderForEdit}
            onCancelHeld={cancelHeldOrder}
            onOpenPayment={openPaymentModal}
            onSelectReceipt={setReceiptModal}
            busy={busy}
            shift={shift}
            openingCash={openingCash}
            setOpeningCash={setOpeningCash}
            countedCash={countedCash}
            setCountedCash={setCountedCash}
            onOpenShift={openShift}
            onCloseShift={closeCurrentShift}
            lastCheckout={lastCheckout}
            heldCount={heldApiOrders.length}
            onOpenTransactions={() => navigate('/sales-control/transactions')}
          />
        </MobileSheet>
      )}
    </div>
  )
}

const normalizePhone = (value = '') => value.replace(/\D/g, '')
const wholeMoneyAmount = (value) => Math.ceil(Number(value || 0))
const isWholeMoneyAmount = (value) => {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && Number.isInteger(amount)
}

const buildCheckoutPayments = ({ total, paymentMode, cashTendered, mpesaAmount, mpesaPhone, mpesaReference, mpesaDirectTransactionId }) => {
  const payments = []
  const format = (amount) => Number(amount).toFixed(2)
  const formatWhole = (amount) => format(wholeMoneyAmount(amount))
  const totalCents = Math.round(total * 100)

  if (paymentMode === 'cash') {
    const tendered = Number(cashTendered || 0)
    if (Math.round(tendered * 100) < totalCents) {
      return { error: 'Cash received must be at least the sale total.' }
    }
    payments.push({ method: 'cash', amount: format(tendered), reference: 'POS cash' })
  } else if (paymentMode === 'mpesa') {
    const phone = normalizePhone(mpesaPhone)
    if (phone.length < 9) return { error: 'Enter the customer M-Pesa phone number (e.g. 254712345678).' }
    const ref = mpesaReference.trim() ? `${mpesaPhone.trim()} | ${mpesaReference.trim()}` : mpesaPhone.trim()
    payments.push({ method: 'mpesa', amount: formatWhole(total), reference: ref })
  } else if (paymentMode === 'mpesa_till') {
    const code = mpesaDirectTransactionId.trim().toUpperCase()
    payments.push({ method: 'mpesa', amount: formatWhole(total), reference: code || 'Direct till payment' })
  } else if (paymentMode === 'card') {
    payments.push({ method: 'card', amount: format(total), reference: mpesaReference.trim() || 'Card terminal' })
  } else if (paymentMode === 'split') {
    const cashValue = Number(cashTendered || 0)
    const mpesaValue = Number(mpesaAmount || 0)
    if (mpesaValue > 0 && !isWholeMoneyAmount(mpesaValue)) {
      return { error: 'M-Pesa STK amount must be a whole number.' }
    }
    if (Math.round((cashValue + mpesaValue) * 100) < totalCents) {
      return { error: 'Cash + M-Pesa must cover the full sale total.' }
    }
    if (cashValue > 0) {
      payments.push({ method: 'cash', amount: format(cashValue), reference: 'POS split cash' })
    }
    if (mpesaValue > 0) {
      const phone = normalizePhone(mpesaPhone)
      if (phone.length < 9) return { error: 'Enter M-Pesa phone number for the M-Pesa portion.' }
      const ref = mpesaReference.trim() ? `${mpesaPhone.trim()} | ${mpesaReference.trim()}` : mpesaPhone.trim()
      payments.push({ method: 'mpesa', amount: format(mpesaValue), reference: ref })
    }
  }

  if (!payments.length) return { error: 'Select a payment method and enter payment details.' }
  return { payments }
}

const StatusToast = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => onDismiss?.(), TOAST_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  const isError = /error|failed|must|required|cannot|unavailable|short by|permission|invalid/i.test(message)
    || message.trim().startsWith('{')
    || message.trim().startsWith('[')
  const isSuccess = /success|completed|opened|closed|recorded|held|loaded|voided|reprint/i.test(message)

  const toneClass = isError
    ? 'border-red-500/80 bg-red-600 text-white shadow-lg shadow-red-900/25 ring-red-500/30'
    : isSuccess
      ? 'border-emerald-400/80 bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-emerald-400/30'
      : 'border-amber-300/80 bg-amber-50 text-amber-950 shadow-lg shadow-amber-900/10 ring-amber-200/80'

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--pos-header)+0.625rem)] z-[70] flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end"
    >
      <div className={`pos-toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-sm ${toneClass}`}>
        {isError ? (
          <FaExclamationCircle className="mt-0.5 shrink-0 text-base text-red-100" aria-hidden />
        ) : isSuccess ? (
          <FaCheck className="mt-0.5 shrink-0 text-base text-emerald-100" aria-hidden />
        ) : null}
        <p className="min-w-0 flex-1 font-medium leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className={`pos-press shrink-0 rounded-lg p-1.5 ${isError || isSuccess ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-amber-800/70 hover:bg-amber-100'}`}
          aria-label="Dismiss notification"
        >
          <FaTimes className="text-xs" />
        </button>
      </div>
    </div>
  )
}

const PosCompanyLogo = ({ company, branch, register }) => {
  const name = company?.name || 'POS'
  const initial = (name.trim()[0] || 'N').toUpperCase()
  const logoUrl = company?.logo_url || company?.logo

  return (
  <div className="flex min-w-0 max-w-[8.5rem] items-center gap-2 sm:max-w-xs sm:gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
        className="h-8 w-8 shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-200/80 sm:h-10 sm:w-10"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-sm font-bold text-white shadow-md shadow-emerald-600/20 sm:h-10 sm:w-10 sm:text-base">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-bold leading-tight text-slate-950 sm:text-base">{name}</p>
        <p className="truncate text-[10px] text-slate-500 sm:text-xs">
          {branch?.name || 'Branch'}
          {register?.code || register?.name ? ` · ${register.code || register.name}` : ''}
        </p>
      </div>
    </div>
  )
}

// ── Notification Bell ─────────────────────────────────────────────────────────

const _NOTIF_STYLES = {
  success: { bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  info:    { bg: 'bg-sky-50',     iconColor: 'text-sky-600'     },
  warning: { bg: 'bg-amber-50',   iconColor: 'text-amber-600'   },
  error:   { bg: 'bg-red-50',     iconColor: 'text-red-600'     },
}

const _notifIcon = (type) => {
  if (type === 'discount_active') return FaTag
  if (type === 'price_scheduled') return FaCalendarAlt
  if (type === 'low_stock' || type === 'out_of_stock') return FaExclamationTriangle
  return FaBell
}

const NotifItem = ({ notif }) => {
  const s = _NOTIF_STYLES[notif.severity] || _NOTIF_STYLES.info
  const Icon = _notifIcon(notif.type)
  return (
    <div className={`flex gap-2.5 border-b border-slate-100 px-3 py-2.5 ${s.bg}`}>
      <div className={`mt-0.5 shrink-0 ${s.iconColor}`}><Icon className="text-[11px]" /></div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-800 leading-snug">{notif.title}</p>
        <p className="text-[10px] text-slate-500 leading-snug">{notif.body}</p>
      </div>
    </div>
  )
}

const _SECTIONS = [
  { key: 'discounts', label: 'Active Discounts',   labelCls: 'text-emerald-700 bg-emerald-50', types: ['discount_active'] },
  { key: 'prices',    label: 'Scheduled Prices',   labelCls: 'text-sky-700 bg-sky-50',         types: ['price_scheduled'] },
  { key: 'stock',     label: 'Stock Alerts',        labelCls: 'text-amber-700 bg-amber-50',    types: ['low_stock', 'out_of_stock'] },
]

const NotificationBell = ({ notifications, unreadCount, onOpen }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = () => {
    if (!open) onOpen?.()
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className={`relative pos-press inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 ring-1 hover:bg-white ${open ? 'bg-white ring-slate-300' : 'ring-slate-200/80'}`}
      >
        <FaBell className="text-sm" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-72 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" style={{ maxHeight: '30rem' }}>
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <FaBell className="text-[11px] text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Notifications</span>
              {notifications.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{notifications.length}</span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="pos-press rounded p-1 text-slate-400 hover:bg-slate-100">
              <FaTimes className="text-[10px]" />
            </button>
          </div>

          <div className="overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                <FaBell className="text-2xl" />
                <p className="text-xs">All clear</p>
              </div>
            ) : (
              _SECTIONS.map(({ key, label, labelCls, types }) => {
                const items = notifications.filter((n) => types.includes(n.type))
                if (!items.length) return null
                return (
                  <div key={key}>
                    <p className={`sticky top-0 border-b border-slate-100 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${labelCls}`}>
                      {label}
                    </p>
                    {items.map((n) => <NotifItem key={n.id} notif={n} />)}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const TopBar = ({
  mode, setMode, company, branch, register, registers = [],
  onRegisterChange, shift, lowStockCount, heldCount, itemCount, onPay, onExit, onLogout, user,
  notifications = [], unreadCount = 0, onNotifOpen,
}) => (
  <header className="sticky top-0 z-40 h-[var(--pos-header)] border-b border-slate-200/80 pos-glass shadow-sm">
    <div className="flex h-full min-w-0 items-center gap-1.5 px-2.5 sm:gap-3 sm:px-4">
      <PosCompanyLogo company={company} branch={branch} register={register} />

      <div className="inline-flex h-8 shrink-0 items-center rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80 sm:h-9 sm:p-1">
        <ModeButton active={mode === 'Retail'} onClick={() => setMode('Retail')} icon={FaShoppingBag} short>Retail</ModeButton>
        <ModeButton active={mode === 'Wholesale'} onClick={() => setMode('Wholesale')} icon={FaStore} short>Wholesale</ModeButton>
      </div>

      {registers.length > 1 && (
        <select
          value={register?.id || ''}
          onChange={(event) => onRegisterChange?.(event.target.value)}
          className="hidden h-9 max-w-[8.5rem] shrink-0 truncate rounded-xl border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 lg:block xl:max-w-[10rem]"
        >
          {registers.map((row) => <option key={row.id} value={row.id}>{row.name || row.code}</option>)}
        </select>
      )}

      <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1 min-[390px]:flex sm:justify-center lg:justify-center">
        <HeaderChip tone={shift ? 'emerald' : 'red'}>{shift ? 'Open' : 'Closed'}</HeaderChip>
        {heldCount > 0 && <HeaderChip tone="amber" className="hidden sm:inline-flex">Held {heldCount}</HeaderChip>}
        {lowStockCount > 0 && <HeaderChip tone="red" className="hidden md:inline-flex">Low {lowStockCount}</HeaderChip>}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {itemCount > 0 && (
          <button
            type="button"
            onClick={onPay}
            className="pos-press hidden h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 lg:inline-flex"
          >
            <FaCreditCard />
            Checkout
          </button>
        )}

        <span className="hidden items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80 xl:inline-flex">
          <FaUser className="text-slate-400" />
          <span className="max-w-[8rem] truncate">{user?.username || user?.first_name || 'Cashier'}</span>
        </span>

        <NotificationBell notifications={notifications} unreadCount={unreadCount} onOpen={onNotifOpen} />

        <button type="button" onClick={onExit} className="pos-press inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 hover:bg-white sm:w-auto sm:px-3">
          <FaSignOutAlt />
          <span className="hidden sm:inline">Exit</span>
        </button>
        <button type="button" onClick={onLogout} className="pos-press hidden h-9 items-center rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 sm:inline-flex">
          Logout
        </button>
      </div>
    </div>
  </header>
)

const HeaderChip = ({ children, tone = 'slate', className = '' }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
    blue: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    red: 'bg-red-50 text-red-800 ring-red-200/80',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200/80',
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:px-2.5 sm:py-1 sm:text-[11px] ${tones[tone] || tones.slate} ${className}`}>
      {children}
    </span>
  )
}

const ModeButton = ({ active, onClick, icon: Icon, children, short = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={typeof children === 'string' ? children : undefined}
    className={`pos-press inline-flex h-8 items-center gap-1 rounded-lg text-xs font-semibold transition ${short ? 'px-2 sm:gap-1.5 sm:px-3.5' : 'gap-1.5 px-3.5'} ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
  >
    <Icon className="text-[10px] opacity-80" />
    <span className={short ? 'hidden sm:inline' : ''}>{children}</span>
  </button>
)

const CategoryRail = ({ categories = [], activeCategory, setActiveCategory, collapsed, onToggle }) => (
  <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-200/80 bg-white lg:block">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-2 py-2.5 backdrop-blur-sm">
      {!collapsed && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Menu</span>}
      <button type="button" onClick={onToggle} className="pos-press ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200/80 hover:bg-slate-50">
        {collapsed ? <FaChevronRight className="text-xs" /> : <FaChevronLeft className="text-xs" />}
      </button>
    </div>
    <div className="space-y-0.5 p-2">
      {categories.map((category, index) => (
        <CategoryButton
          key={category}
          category={category}
          index={index}
          active={activeCategory === category}
          onClick={() => setActiveCategory(category)}
          collapsed={collapsed}
        />
      ))}
    </div>
  </aside>
)

const CategoryButton = ({ category, index, active, onClick, collapsed = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={category}
    className={`pos-press flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xs font-semibold ${collapsed ? 'justify-center px-1.5' : ''} ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
  >
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${active ? 'bg-white/20' : categoryColors[index % categoryColors.length]}`}>
      {category === 'All Products' ? <FaBars className="text-[9px]" /> : category[0]}
    </span>
    {!collapsed && <span className="min-w-0 truncate">{category}</span>}
  </button>
)

const CatalogHeader = ({ activeCategory, query, setQuery, shown, total, productSize, setProductSize, onOpenCategories }) => (
  <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenCategories}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 lg:hidden"
          aria-label="Categories"
        >
          <FaBars />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900">{activeCategory}</h2>
          <p className="text-xs text-slate-500">{shown} of {total} products</p>
        </div>
      </div>

      <label className="relative min-w-0 flex-1 sm:max-w-md">
        <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SKU, category…"
          className="h-10 w-full rounded-xl border-0 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/35"
        />
      </label>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200">
          {productSizeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setProductSize(option.key)}
              className={`h-8 min-w-[2rem] rounded-md px-2 text-xs font-semibold transition ${productSize === option.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const ProductGrid = React.memo(({ products: visibleProducts, addProduct, productSize }) => {
  const size = productCardSizes[productSize]

  return (
  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-28 lg:pb-2">
    <div className={`grid ${size.grid}`}>
      {visibleProducts.map((product) => (
        <ProductTile key={product.id} product={product} onAdd={addProduct} size={size} />
      ))}
    </div>
  </div>
  )
})

const ProductTile = React.memo(({ product, onAdd, size }) => {
  const out = product.stock === 0

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={out}
      className={`pos-press group relative flex flex-col rounded-xl border border-slate-200/80 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:border-emerald-300 hover:shadow-md hover:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 sm:rounded-2xl ${size.tile}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className={`flex shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-sm ${product.color} ${size.badge}`}>{product.letter}</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${out ? 'bg-red-50 text-red-600' : product.stock <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {out ? 'Out' : product.stock}
        </span>
      </div>
      <p className={`flex-1 font-semibold leading-snug text-slate-900 group-hover:text-emerald-900 ${size.name}`}>{product.name}</p>
      <p className={`font-bold tabular-nums text-emerald-700 ${size.price}`}>
        {money(product.price)}
      </p>
    </button>
  )
})

const WorkspacePanel = ({
  mode,
  cart,
  subtotal,
  discount,
  total,
  itemCount,
  changeQty,
  setItemPrice,
  clearCart,
  customer,
  salesHistory,
  workspace,
  setWorkspace,
  heldOrders,
  onHold,
  editingHeldOrderId,
  onEditHeld,
  onCancelHeld,
  onOpenPayment,
  onSelectReceipt,
  busy,
  shift,
  openingCash,
  setOpeningCash,
  countedCash,
  setCountedCash,
  onOpenShift,
  onCloseShift,
  lastCheckout,
  shiftSummary,
  heldCount = 0,
  onOpenTransactions,
  mobile = false,
}) => (
  <section className={`${mobile ? 'flex-1 min-h-0 border-0 shadow-none' : 'hidden border-l shadow-2xl lg:flex lg:shadow-none'} flex flex-col border-slate-200/80 bg-white`}>
    <WorkspaceTabBar workspace={workspace} setWorkspace={setWorkspace} itemCount={itemCount} heldCount={heldCount} />

    <div className={`shrink-0 border-b px-3 py-2 ${itemCount === 0 ? 'border-red-100 bg-red-50/70' : 'border-slate-100 bg-gradient-to-br from-slate-50 to-white'}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-semibold uppercase ${itemCount === 0 ? 'text-red-600' : 'text-slate-500'}`}>Amount due</p>
          <p className={`font-bold tabular-nums tracking-tight ${itemCount === 0 ? 'text-lg text-red-700' : 'text-2xl text-slate-950'}`}>{money(total)}</p>
          <p className={`mt-0.5 truncate text-[11px] ${itemCount === 0 ? 'text-red-600' : 'text-slate-500'}`}>
            {itemCount} {itemCount === 1 ? 'line' : 'lines'}
            {customer ? ` · ${customer}` : ''}
          </p>
        </div>
        {!shift && (
          <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
            Shift closed
          </span>
        )}
      </div>
    </div>

    {workspace === 'cart' && (
      <CartView
        mode={mode}
        cart={cart}
        subtotal={subtotal}
        discount={discount}
        total={total}
        itemCount={itemCount}
        changeQty={changeQty}
        setItemPrice={setItemPrice}
        clearCart={clearCart}
        setWorkspace={setWorkspace}
        onHold={onHold}
        onOpenPayment={onOpenPayment}
        editingHeldOrderId={editingHeldOrderId}
        busy={busy}
        shift={shift}
      />
    )}
    {workspace === 'receipts' && (
      <ReceiptsView
        salesHistory={salesHistory}
        shift={shift}
        lastCheckout={lastCheckout}
        onSelectReceipt={onSelectReceipt}
        onOpenTransactions={onOpenTransactions}
      />
    )}
    {workspace === 'held' && (
      <HeldOrdersView
        heldOrders={heldOrders}
        editingHeldOrderId={editingHeldOrderId}
        onEditHeld={onEditHeld}
        onCancelHeld={onCancelHeld}
        busy={busy}
      />
    )}
    {workspace === 'summary' && <SalesSummaryView shiftSummary={shiftSummary} itemCount={itemCount} total={total} />}
    {workspace === 'shift' && <EndShiftView shift={shift} openingCash={openingCash} setOpeningCash={setOpeningCash} countedCash={countedCash} setCountedCash={setCountedCash} onOpenShift={onOpenShift} onCloseShift={onCloseShift} busy={busy} />}
  </section>
)

const WorkspaceTabBar = ({ workspace, setWorkspace, itemCount, heldCount = 0 }) => (
  <nav className="shrink-0 border-b border-slate-100 bg-white px-2 pt-2" aria-label="POS sections">
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/90 p-1 scrollbar-thin">
      {workspaceTabs.map((tab) => {
        const Icon = tab.icon
        const active = workspace === tab.key
        const badge = tab.key === 'cart' ? itemCount : tab.key === 'held' ? heldCount : 0
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setWorkspace(tab.key)}
            className={`pos-press relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-semibold transition sm:px-2.5 sm:text-xs ${active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Icon className={`shrink-0 text-sm ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="truncate">{tab.label}</span>
            {badge > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  </nav>
)

const CartView = ({
  mode, cart, subtotal, discount, total, itemCount, changeQty, setItemPrice, clearCart, setWorkspace, onHold, onOpenPayment, editingHeldOrderId,
}) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="inline-flex max-w-[70%] flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <span className="text-slate-400">{mode}</span>
            <span className="h-3 w-px bg-slate-300" />
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          {editingHeldOrderId && (
            <span className="text-[10px] font-semibold text-amber-700">Editing hold HLD-{editingHeldOrderId}</span>
          )}
        </span>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            disabled={Boolean(editingHeldOrderId)}
            className={`pos-press inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ${editingHeldOrderId ? 'cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200' : 'text-red-600 ring-1 ring-red-200/80 hover:bg-red-50'}`}
          >
            <FaTrash className="text-[10px]" />
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-1 sm:px-3">
        {cart.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
            <FaShoppingBag className="text-2xl text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No items yet</p>
            <p className="mt-1 text-xs text-slate-500">Tap products to add them.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/80 bg-white">
            {cart.map((item) => (
              <CartLineItem key={item.id} item={item} changeQty={changeQty} setItemPrice={setItemPrice} isHeld={Boolean(editingHeldOrderId)} />
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className="shrink-0 border-t border-slate-200/80 bg-white px-3 pt-3 pb-3 shadow-[0_-8px_32px_rgba(15,23,42,0.10)]">
          {discount > 0 && (
            <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-emerald-600">
              <span>Discount</span>
              <span className="tabular-nums">−{money(discount)}</span>
            </div>
          )}
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500">Total due</span>
            <span className="text-2xl font-black tabular-nums text-slate-950">{money(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onHold}
              className="pos-press flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
            >
              <FaPause className="text-slate-400" />
              {editingHeldOrderId ? 'Update hold' : 'Hold'}
            </button>
            <button
              type="button"
              onClick={onOpenPayment}
              className="pos-press flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:bg-emerald-800"
            >
              <FaCreditCard />
              Pay now
            </button>
          </div>
        </div>
      )}
    </div>
)

const CartLineItem = ({ item, changeQty, setItemPrice, isHeld }) => {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')

  const startEdit = () => {
    if (isHeld) return
    setPriceInput(String(item.price))
    setEditingPrice(true)
  }
  const commitEdit = () => {
    setItemPrice(item.id, priceInput)
    setEditingPrice(false)
  }

  return (
    <li className={`group flex items-start gap-2.5 px-3 py-3 transition ${isHeld ? 'bg-amber-50/60' : 'hover:bg-slate-50/80'}`}>
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-sm ${item.color}`}>
        {item.letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <p className="flex-1 text-xs font-semibold leading-snug text-slate-900 break-words">{item.name}</p>
          {isHeld && <FaLock className="mt-0.5 shrink-0 text-[8px] text-amber-500" title="Held order — locked" />}
        </div>

        {editingPrice ? (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              value={priceInput}
              min="0"
              step="0.01"
              onChange={(e) => setPriceInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingPrice(false) }}
              autoFocus
              className="w-24 rounded-lg border border-emerald-400 px-2 py-1 text-xs font-semibold tabular-nums outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
            <button type="button" onClick={commitEdit} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">OK</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={isHeld}
            className={`mt-0.5 flex items-center gap-1 text-[10px] tabular-nums ${isHeld ? 'cursor-default text-slate-400' : 'group/price text-slate-500 hover:text-emerald-700'}`}
          >
            {money(item.price)} each
            {!isHeld && <FaEdit className="text-[8px] opacity-0 group-hover/price:opacity-60 transition-opacity" />}
          </button>
        )}

        {item.discountAmount > 0 && (
          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">−{money(item.discountAmount)} ({item.appliedRule})</p>
        )}

        {/* Qty controls + total in one row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`inline-flex h-9 items-center overflow-hidden rounded-xl border shadow-sm ${isHeld ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
              <QtyButton onClick={() => changeQty(item.id, -1)} disabled={isHeld} aria-label="Decrease">
                <FaMinus className="text-[9px]" />
              </QtyButton>
              <span className="min-w-[2rem] border-x border-slate-200 bg-slate-50 px-1 text-center text-xs font-bold tabular-nums text-slate-900">
                {item.qty}
              </span>
              <QtyButton onClick={() => changeQty(item.id, 1)} disabled={isHeld} aria-label="Increase">
                <FaPlus className="text-[9px]" />
              </QtyButton>
            </div>
            <button
              type="button"
              onClick={() => changeQty(item.id, -item.qty)}
              disabled={isHeld}
              className={`pos-press inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent ${isHeld ? 'cursor-not-allowed text-slate-300' : 'text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600'}`}
              aria-label="Remove item"
            >
              <FaTrash className="text-[10px]" />
            </button>
          </div>

          <div className="flex flex-col items-end">
            {item.discountAmount > 0 ? (
              <>
                <p className="text-[10px] tabular-nums text-slate-400 line-through">{money(item.price * item.qty)}</p>
                <p className="text-sm font-bold tabular-nums text-emerald-700">{money(item.price * item.qty - item.discountAmount)}</p>
              </>
            ) : (
              <p className="text-sm font-bold tabular-nums text-slate-900">{money(item.price * item.qty)}</p>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

const QtyButton = ({ children, onClick, ...props }) => (
  <button
    type="button"
    onClick={onClick}
    className="pos-press flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"
    {...props}
  >
    {children}
  </button>
)

const PosModal = ({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
    <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
    <div
      className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} className="pos-press flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-label="Close">
          <FaTimes />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  </div>
)

const PaymentModal = ({
  total,
  itemCount,
  paymentMode,
  setPaymentMode,
  cashTendered,
  setCashTendered,
  mpesaAmount,
  setMpesaAmount,
  mpesaPhone,
  setMpesaPhone,
  mpesaReference,
  setMpesaReference,
  mpesaDirectTransactionId,
  setMpesaDirectTransactionId,
  onSendStk,
  onCheckout,
  onClose,
  busy,
  shift,
  cartEmpty,
  branch,
  effectivelyOnline = true,
}) => (
  <PosModal title="Payment" onClose={onClose} wide>
    <div className="p-3 sm:p-4">
      <div className={`mb-4 rounded-xl border p-3 ${cartEmpty ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
        <p className={`text-[11px] font-semibold uppercase ${cartEmpty ? 'text-red-600' : 'text-emerald-700'}`}>
          Amount due · {itemCount} {itemCount === 1 ? 'line' : 'lines'}
        </p>
        <p className={`mt-0.5 font-bold tabular-nums tracking-tight ${cartEmpty ? 'text-xl text-red-700' : 'text-2xl text-emerald-800'}`}>{money(total)}</p>
      </div>
      <PaymentCheckout
        total={total}
        paymentMode={paymentMode}
        setPaymentMode={setPaymentMode}
        cashTendered={cashTendered}
        setCashTendered={setCashTendered}
        mpesaAmount={mpesaAmount}
        setMpesaAmount={setMpesaAmount}
        mpesaPhone={mpesaPhone}
        setMpesaPhone={setMpesaPhone}
        mpesaReference={mpesaReference}
        setMpesaReference={setMpesaReference}
        mpesaDirectTransactionId={mpesaDirectTransactionId}
        setMpesaDirectTransactionId={setMpesaDirectTransactionId}
        onSendStk={onSendStk}
        onCheckout={onCheckout}
        busy={busy}
        shift={shift}
        cartEmpty={cartEmpty}
        branch={branch}
        effectivelyOnline={effectivelyOnline}
      />
    </div>
  </PosModal>
)

const PaymentCheckout = ({
  total,
  paymentMode,
  setPaymentMode,
  cashTendered,
  setCashTendered,
  mpesaAmount,
  setMpesaAmount,
  mpesaPhone,
  setMpesaPhone,
  mpesaReference,
  setMpesaReference,
  mpesaDirectTransactionId,
  setMpesaDirectTransactionId,
  onSendStk,
  onCheckout,
  busy,
  shift,
  cartEmpty,
  branch,
  compact = false,
  effectivelyOnline = true,
}) => {
  const [stkState, setStkState] = useState({ status: 'idle', checkoutRequestId: '', message: '' })
  const [stkCountdown, setStkCountdown] = useState(null)
  const [stkRetrying, setStkRetrying] = useState(false)
  const [autoCompletingSale, setAutoCompletingSale] = useState(false)
  const stkAbortRef = useRef(false)
  useEffect(() => () => { stkAbortRef.current = true }, [])
  const tendered = Number(cashTendered || 0)
  const changeDue = paymentMode === 'cash' ? Math.max(0, tendered - total) : 0
  const splitCash = Number(cashTendered || 0)
  const splitMpesa = Number(mpesaAmount || 0)
  const splitRemaining = Math.max(0, total - splitCash)
  const mpesaRequired = paymentMode === 'mpesa' || (paymentMode === 'split' && splitMpesa > 0)
  const mpesaEnabled = Boolean(branch?.id && branch?.mpesa_enabled)
  const mpesaManualApprovalEnabled = Boolean(branch?.id && branch?.mpesa_manual_approval_enabled)
  const mpesaDirectRequired = paymentMode === 'mpesa_till'
  const mpesaDirectEnabled = Boolean(branch?.id && branch?.mpesa_direct_enabled)
  const mpesaRequiresStk = mpesaRequired && mpesaEnabled
  const [directState, setDirectState] = useState({ status: 'idle', transactionId: '', conversationId: '', message: '' })
  const [directPolling, setDirectPolling] = useState(false)
  const stkIsBusy = ['sending', 'sent', 'querying'].includes(stkState.status)
  const stkIsPaid = stkState.status === 'paid'
  const directIsBusy = ['fetching', 'pending'].includes(directState.status)
  const directIsPaid = directState.status === 'paid'
  const setExactCash = () => setCashTendered(total.toFixed(2))
  const fillSplitMpesa = () => setMpesaAmount(String(wholeMoneyAmount(splitRemaining)))
  const inputClass = 'mt-1.5 h-12 w-full rounded-xl border-0 bg-slate-50 px-4 text-lg font-semibold tabular-nums text-slate-900 ring-1 ring-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/40'
  const labelClass = 'text-xs font-semibold text-slate-600'
  const paymentMethods = [
    { key: 'cash', label: 'Cash', icon: FaMoneyBillWave },
    { key: 'mpesa', label: 'M-Pesa', icon: FaMobileAlt },
    { key: 'mpesa_till', label: 'Till', icon: FaMobileAlt },
    { key: 'card', label: 'Card', icon: FaCreditCard },
    { key: 'split', label: 'Split', icon: FaList },
  ]

  useEffect(() => {
    setStkState({ status: 'idle', checkoutRequestId: '', message: '' })
    setStkCountdown(null)
    setStkRetrying(false)
    setAutoCompletingSale(false)
    setDirectState({ status: 'idle', transactionId: '', conversationId: '', message: '' })
    setDirectPolling(false)
  }, [paymentMode, mpesaPhone, mpesaAmount, mpesaReference, mpesaDirectTransactionId, total])

  const completeConfirmedMpesaSale = async (checkoutRequestId, message) => {
    setStkCountdown(null)
    setStkRetrying(false)
    setAutoCompletingSale(true)
    setStkState({
      status: 'paid',
      checkoutRequestId,
      message: `${message || 'M-Pesa payment confirmed.'} Creating sale...`,
    })
    try {
      await onCheckout({ mpesa_checkout_request_id: checkoutRequestId })
    } finally {
      setAutoCompletingSale(false)
    }
  }

  const sendAndWatchStk = async () => {
    stkAbortRef.current = false
    setStkState({ status: 'sending', checkoutRequestId: '', message: 'Sending STK to the customer phone...' })
    setStkCountdown(40)
    setStkRetrying(false)

    const evaluateLog = (log) => {
      if (!log) return null
      const resultCode = log.result_code === null || log.result_code === undefined ? null : Number(log.result_code)
      if (resultCode === 0 && log.success) {
        return {
          status: 'paid',
          message: log.result_desc || 'Payment confirmed. You can now complete the sale.',
        }
      }
      if (resultCode !== null && resultCode !== 0) {
        return {
          status: 'failed',
          message: log.result_desc || log.message || 'M-Pesa payment was not completed.',
        }
      }
      return null
    }

    try {
      const result = await onSendStk()
      // If sendMpesaStk decided to skip STK because branch isn't configured,
      // complete the sale immediately and return.
      if (result && result.skipped) {
        setStkState({ status: 'skipped', checkoutRequestId: '', message: result.message || 'Branch M-Pesa not configured — completing sale without STK.' })
        setStkCountdown(null)
        await onCheckout({ mpesa_checkout_request_id: '' })
        return
      }

      const checkoutRequestId = result?.checkout_request_id
      if (!checkoutRequestId) {
        setStkState({ status: 'failed', checkoutRequestId: '', message: result?.message || 'Safaricom did not return a checkout request ID.' })
        setStkCountdown(null)
        return
      }

      setStkState({
        status: 'sent',
        checkoutRequestId,
        message: result?.customer_message || 'STK sent. Waiting for customer PIN and Safaricom callback...',
      })

      let elapsed = 0
      while (elapsed < 40) {
          if (elapsed % 3 === 0) {
          const log = await posApi.mpesaStkLogs({ checkout_request_id: checkoutRequestId, branch: branch?.id })
          const rows = log.results || log
          const parsed = evaluateLog(rows?.[0])
          if (parsed) {
            if (parsed.status === 'paid') {
              await completeConfirmedMpesaSale(checkoutRequestId, parsed.message)
            } else {
              setStkCountdown(null)
              setStkState({ status: parsed.status, checkoutRequestId, message: parsed.message })
            }
            return
          }
        }

        await wait(1000)
        if (stkAbortRef.current) return
        elapsed += 1
        setStkCountdown(40 - elapsed)
      }

      setStkState({
        status: 'querying',
        checkoutRequestId,
        message: 'No callback after 40 seconds. Querying Safaricom for transaction status...',
      })
      setStkRetrying(true)
      setStkCountdown(0)

      const queryResult = await posApi.mpesaStkQuery({ checkout_request_id: checkoutRequestId, branch: branch?.id })
      const statusMessage = queryResult?.customer_message || queryResult?.ResultDesc || queryResult?.ResponseDescription || queryResult?.message || 'Query sent. Waiting for payment confirmation.'
      const queryResultCode = queryResult?.ResultCode === null || queryResult?.ResultCode === undefined ? null : Number(queryResult.ResultCode)

      if (queryResultCode === 0) {
        await completeConfirmedMpesaSale(checkoutRequestId, statusMessage || 'Payment confirmed by Safaricom query.')
        return
      }
      if (queryResultCode !== null && queryResultCode !== 0) {
        setStkCountdown(null)
        setStkRetrying(false)
        setStkState({ status: 'failed', checkoutRequestId, message: statusMessage || 'M-Pesa payment was not completed.' })
        return
      }
      setStkState({ status: 'sent', checkoutRequestId, message: `${statusMessage} Re-checking for callback...` })

      let lastRecoveryQueryAt = Date.now()
      const retryAttempts = 18
      for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
        let waitSeconds = MPESA_POLL_INTERVAL_MS / 1000
        while (waitSeconds > 0) {
          setStkCountdown(waitSeconds)
          await wait(1000)
          if (stkAbortRef.current) return
          waitSeconds -= 1
        }

        const logResponse = await posApi.mpesaStkLogs({ checkout_request_id: checkoutRequestId, branch: branch?.id })
        const logRows = logResponse.results || logResponse
        const parsed = evaluateLog(logRows?.[0])
        if (parsed) {
          if (parsed.status === 'paid') {
            await completeConfirmedMpesaSale(checkoutRequestId, parsed.message)
          } else {
            setStkCountdown(null)
            setStkRetrying(false)
            setStkState({ status: parsed.status, checkoutRequestId, message: parsed.message })
          }
          return
        }

        if (Date.now() - lastRecoveryQueryAt >= MPESA_RECOVERY_QUERY_INTERVAL_MS) {
          lastRecoveryQueryAt = Date.now()
          const recoveryResult = await posApi.mpesaStkQuery({ checkout_request_id: checkoutRequestId, branch: branch?.id })
          const recoveryMessage = recoveryResult?.customer_message || recoveryResult?.ResultDesc || recoveryResult?.ResponseDescription || recoveryResult?.message || 'Still waiting for M-Pesa confirmation.'
          const recoveryCode = recoveryResult?.ResultCode === null || recoveryResult?.ResultCode === undefined ? null : Number(recoveryResult.ResultCode)
          if (recoveryCode === 0) {
            await completeConfirmedMpesaSale(checkoutRequestId, recoveryMessage || 'Payment confirmed by Safaricom query.')
            return
          }
          if (recoveryCode !== null && recoveryCode !== 0) {
            setStkCountdown(null)
            setStkRetrying(false)
            setStkState({ status: 'failed', checkoutRequestId, message: recoveryMessage || 'M-Pesa payment was not completed.' })
            return
          }
          setStkState({ status: 'sent', checkoutRequestId, message: recoveryResult?.rate_limited ? 'Safaricom is rate limiting status checks. Waiting before retrying...' : recoveryMessage })
        }
      }

      setStkCountdown(null)
      setStkRetrying(false)
      setStkState({
        status: 'timeout',
        checkoutRequestId,
        message: 'STK has not confirmed yet. Keep this modal open and try again, or resend STK if needed.',
      })
    } catch (error) {
      setStkCountdown(null)
      setStkRetrying(false)
      setStkState({
        status: 'failed',
        checkoutRequestId: '',
        message: error.data ? JSON.stringify(error.data) : error.message,
      })
    }
  }

  const fetchDirectTillPayment = async () => {
    const transactionId = mpesaDirectTransactionId.trim().toUpperCase()
    setDirectState({ status: 'fetching', transactionId, conversationId: '', message: 'Fetching payment from M-Pesa...' })
    setDirectPolling(true)
    try {
      if (!transactionId) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const logResponse = await posApi.mpesaDirectLogs({ branch: branch?.id, success: 'true', page_size: 25 })
          const rows = logResponse.results || logResponse
          const matchingLog = rows.find((log) => (
            !log.sale
            && log.transaction_id
            && Number(log.amount || 0) === wholeMoneyAmount(total)
          ))
          if (matchingLog) {
            const matchedTransactionId = matchingLog.transaction_id.trim().toUpperCase()
            setMpesaDirectTransactionId(matchedTransactionId)
            setDirectState({
              status: 'paid',
              transactionId: matchedTransactionId,
              conversationId: matchingLog.conversation_id || matchingLog.originator_conversation_id || '',
              message: matchingLog.result_desc || 'Direct till payment verified. Creating sale...',
            })
            await onCheckout({ mpesa_direct_transaction_id: matchedTransactionId })
            return
          }
          await wait(2000)
        }
        setDirectState({
          status: 'timeout',
          transactionId: '',
          conversationId: '',
          message: 'No verified unused till payment matched this amount yet. Try fetch again after the customer pays.',
        })
        return
      }

      const result = await posApi.mpesaDirectLookup({ branch: branch?.id, transaction_id: transactionId, amount: wholeMoneyAmount(total).toFixed(2) })
      const conversationId = result?.conversation_id || result?.originator_conversation_id || ''
      setDirectState({
        status: 'pending',
        transactionId,
        conversationId,
        message: result?.message || 'Lookup submitted. Waiting for M-Pesa verification...',
      })

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await wait(2000)
        const logResponse = await posApi.mpesaDirectLogs({ branch: branch?.id, transaction_id: transactionId })
        const rows = logResponse.results || logResponse
        const log = rows?.[0]
        if (!log) continue
        const code = log.result_code === null || log.result_code === undefined ? null : Number(log.result_code)
        if (code === 0 && log.success) {
          setDirectState({
            status: 'paid',
            transactionId,
            conversationId: log.conversation_id || conversationId,
            message: log.result_desc || 'Direct till payment verified. Creating sale...',
          })
          await onCheckout({ mpesa_direct_transaction_id: transactionId })
          return
        }
        if (code !== null && code !== 0) {
          setDirectState({
            status: 'failed',
            transactionId,
            conversationId: log.conversation_id || conversationId,
            message: log.result_desc || log.message || 'M-Pesa could not verify this transaction.',
          })
          return
        }
      }
      setDirectState({
        status: 'timeout',
        transactionId,
        conversationId,
        message: 'M-Pesa has not confirmed this transaction yet. Try fetch again in a moment.',
      })
    } catch (error) {
      setDirectState({
        status: 'failed',
        transactionId,
        conversationId: '',
        message: error.data ? JSON.stringify(error.data) : error.message,
      })
    } finally {
      setDirectPolling(false)
    }
  }

  const canCompleteSale = !cartEmpty && !busy && !autoCompletingSale && !stkIsBusy && !directIsBusy && Boolean(shift) && (!mpesaRequiresStk || stkIsPaid) && (!mpesaDirectRequired || !mpesaDirectEnabled || directIsPaid)
  const completeLabel = busy
    ? 'Processing...'
    : autoCompletingSale
      ? 'Creating sale...'
    : mpesaRequiresStk && !stkIsPaid
      ? 'Waiting for M-Pesa confirmation'
      : mpesaDirectRequired && mpesaDirectEnabled && !directIsPaid
        ? 'Fetch till payment first'
      : 'Complete sale'

  return (
    <div className={`${compact ? 'p-0' : ''}`}>
      <p className="mb-2.5 text-xs font-semibold text-slate-500">Payment method</p>
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-5">
        {paymentMethods.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPaymentMode(key)}
            className={`pos-press flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition ${paymentMode === key ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Icon className={`text-lg ${paymentMode === key ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-[11px] font-semibold sm:text-xs">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
        {paymentMode === 'cash' && (
          <div className="space-y-3">
            <label className="block">
              <span className={labelClass}>Cash received</span>
              <input type="number" min="0" step="0.01" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} placeholder={total.toFixed(2)} className={inputClass} />
            </label>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <button type="button" onClick={setExactCash} className="pos-press h-10 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800">Exact</button>
              <button type="button" onClick={() => setCashTendered(String(Math.ceil(total / 100) * 100))} className="pos-press h-10 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200">Round up</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[500, 1000, 2000].map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => setCashTendered(String((Number(cashTendered || 0) + note).toFixed(2)))}
                  className="pos-press h-10 rounded-xl bg-slate-100 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-200"
                >
                  +{note}
                </button>
              ))}
            </div>
            {tendered > 0 && (
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${changeDue > 0 ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60' : tendered >= total ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/60' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/60'}`}>
                {tendered < total ? `Short by ${money(total - tendered)}` : changeDue > 0 ? `Change due: ${money(changeDue)}` : 'Exact payment'}
              </div>
            )}
          </div>
        )}

        {paymentMode === 'mpesa' && (
          <div className="space-y-3">
            <label className="block">
              <span className={labelClass}>M-Pesa phone</span>
              <input type="tel" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="254712345678" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Transaction code (optional)</span>
              <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} placeholder="QHK7X2ABCD" className={inputClass} />
            </label>
            <p className="text-xs text-slate-500">Charge <span className="font-bold text-slate-800">{money(total)}</span></p>
          </div>
        )}

        {paymentMode === 'mpesa_till' && (
          <div className="space-y-3">
            <label className="block">
              <span className={labelClass}>M-Pesa transaction code (optional)</span>
              <input value={mpesaDirectTransactionId} onChange={(e) => setMpesaDirectTransactionId(e.target.value.toUpperCase())} placeholder="QHK7X2ABCD" className={inputClass} />
            </label>
            <p className="text-xs text-slate-500">Customer pays directly to the branch till, then fetch. A code can still be entered to check a specific payment.</p>
            <button
              type="button"
              onClick={fetchDirectTillPayment}
              disabled={cartEmpty || busy || directPolling || !shift || !mpesaDirectEnabled}
              className="pos-press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {directPolling ? <DotLoader color="white" /> : <><FaMobileAlt /><span>Fetch payment</span></>}
            </button>
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${directState.status === 'paid' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : directState.status === 'failed' || directState.status === 'timeout' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
              {directState.message || (mpesaDirectEnabled ? 'Ready to verify direct till payment.' : 'Direct till verification is not configured for this branch.')}
            </div>
          </div>
        )}

        {paymentMode === 'card' && (
          <div className="space-y-3">
            <label className="block">
              <span className={labelClass}>Reference (optional)</span>
              <input value={mpesaReference} onChange={(e) => setMpesaReference(e.target.value)} placeholder="Auth / last 4 digits" className={inputClass} />
            </label>
            <p className="text-xs text-slate-500">Charge <span className="font-bold text-slate-800">{money(total)}</span></p>
          </div>
        )}

        {paymentMode === 'split' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Cash</span>
                <input type="number" min="0" step="0.01" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>M-Pesa</span>
                <input type="number" min="0" step="1" value={mpesaAmount} onChange={(e) => setMpesaAmount(e.target.value)} placeholder={String(wholeMoneyAmount(splitRemaining))} className={inputClass} />
              </label>
            </div>
            <button type="button" onClick={fillSplitMpesa} className="h-9 w-full rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
              Fill M-Pesa {money(wholeMoneyAmount(splitRemaining))}
            </button>
            <label className="block">
              <span className={labelClass}>M-Pesa phone</span>
              <input type="tel" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="254712345678" className={inputClass} />
            </label>
            <p className={`text-sm font-semibold ${splitCash + splitMpesa >= total ? 'text-emerald-700' : 'text-amber-700'}`}>
              Paid {money(splitCash + splitMpesa)} of {money(total)}
            </p>
          </div>
        )}
      </div>

      {!shift && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 ring-1 ring-red-100">
          Open a shift before completing this sale.
        </p>
      )}

      <div className="mt-4">
        {mpesaRequired && (
          <div className={`mb-3 rounded-2xl border p-3 ${stkIsPaid ? 'border-emerald-200 bg-emerald-50' : stkState.status === 'failed' || stkState.status === 'timeout' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-xs font-black uppercase ${stkIsPaid ? 'text-emerald-700' : stkState.status === 'failed' || stkState.status === 'timeout' ? 'text-amber-700' : 'text-sky-700'}`}>
                  {stkIsPaid ? 'M-Pesa confirmed' : stkIsBusy ? 'STK sent' : (mpesaEnabled ? 'M-Pesa confirmation required' : 'M-Pesa not configured for this branch')}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {stkState.message || (mpesaEnabled ? 'Send STK and wait for the callback before completing this sale.' : 'Branch M-Pesa not configured — complete sale to record payment without STK.')}
                </p>
                {stkState.checkoutRequestId && (
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">Checkout ID: {stkState.checkoutRequestId}</p>
                )}
                {stkCountdown !== null && (
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {stkRetrying ? `Retrying status check in ${stkCountdown}s...` : `Waiting for callback: ${stkCountdown}s remaining...`}
                  </p>
                )}
              </div>
              {mpesaEnabled && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={sendAndWatchStk}
                    disabled={cartEmpty || busy || autoCompletingSale || !shift || stkIsBusy || stkIsPaid}
                    className={`pos-press flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${stkIsPaid ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                  >
                    {(stkState.status === 'sending' || stkState.status === 'querying' || stkIsBusy) && !stkIsPaid
                      ? <DotLoader color="white" />
                      : <>
                          <FaMobileAlt />
                          {stkIsPaid
                            ? 'Confirmed'
                            : stkState.status === 'failed' || stkState.status === 'timeout'
                              ? 'Send again'
                              : 'Send STK'}
                        </>
                    }
                  </button>
                  {mpesaManualApprovalEnabled && !stkIsPaid && (
                    <button
                      type="button"
                      onClick={() => onCheckout({ mpesa_manual_approval: true })}
                      disabled={cartEmpty || busy || autoCompletingSale || !shift || stkIsBusy}
                      className="pos-press flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {(busy || autoCompletingSale) ? <DotLoader color="white" /> : <><FaCheck /><span>Approve without Safaricom</span></>}
                    </button>
                  )}
                  {!effectivelyOnline && !stkIsPaid && (
                    <button
                      type="button"
                      onClick={() => onCheckout({ offline_mpesa: true })}
                      disabled={cartEmpty || busy || !shift}
                      title="You are offline. Confirm you physically received this M-Pesa payment."
                      className="pos-press flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {busy ? <DotLoader color="white" /> : <><FaCheck /><span>Confirm M-Pesa offline</span></>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onCheckout({ mpesa_checkout_request_id: stkState.checkoutRequestId, mpesa_direct_transaction_id: mpesaDirectTransactionId.trim().toUpperCase() })}
          disabled={!canCompleteSale}
          className="pos-press mt-1 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {(busy || autoCompletingSale) ? <DotLoader color="white" /> : <><FaCheck className="text-lg" />{completeLabel}</>}
        </button>
      </div>
    </div>
    
  )
}

const CustomerView = ({ customer, setCustomer, customers, setWorkspace }) => (
  <PanelBody title="Customer Selection" subtitle="Attach a buyer before receipt confirmation.">
    <div className="space-y-2">
      {customers.map((item) => (
        <button
          key={item}
          onClick={() => setCustomer(item)}
          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left ${customer === item ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          <span className="text-sm font-black">{item}</span>
          {customer === item && <FaCheck />}
        </button>
      ))}
      <button className="mt-2 flex h-10 w-full items-center justify-center rounded bg-slate-900 text-xs font-black uppercase text-white">
        <FaPlus className="mr-2" />
        New Customer
      </button>
      <button onClick={() => setWorkspace('cart')} className="flex h-10 w-full items-center justify-center rounded border border-slate-200 text-xs font-black uppercase text-slate-700">
        Back to cart
      </button>
    </div>
  </PanelBody>
)

const mapSaleToReceipt = (sale) => ({
  id: sale.receipt_no,
  saleId: sale.id,
  customer: sale.customer_name || 'Walk-in Customer',
  cashier: sale.cashier_name || 'Cashier',
  branch: sale.branch_name || '',
  register: sale.register_code || '',
  mode: sale.mode || 'retail',
  method: sale.payments?.[0]?.method || 'cash',
  payments: sale.payments || [],
  amount: Number(sale.total),
  subtotal: Number(sale.subtotal || sale.total || 0),
  tax: Number(sale.tax_total || 0),
  discount: Number(sale.discount_total || 0),
  paid: Number(sale.paid_total || sale.total || 0),
  change: Number(sale.change_due || 0),
  time: new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  status: sale.status === 'voided' ? 'Voided' : 'Paid',
  items: (sale.items || []).map((item) => ({
    productId: item.product,
    name: item.product_name,
    qty: item.quantity,
    price: Number(item.unit_price),
  })),
})

const ReceiptsView = ({ salesHistory, shift, lastCheckout, onSelectReceipt, onOpenTransactions }) => {
  const transactions = useMemo(() => {
    if (!shift?.id || !salesHistory?.length) return []
    return salesHistory
      .filter((sale) => sale.shift === shift.id || sale.shift_id === shift.id)
      .map(mapSaleToReceipt)
  }, [salesHistory, shift?.id])

  const lastCheckoutReceipt = lastCheckout ? {
    id: lastCheckout.receipt,
    saleId: lastCheckout.saleId,
    customer: lastCheckout.customer || 'Walk-in Customer',
    cashier: lastCheckout.cashier || 'Cashier',
    branch: lastCheckout.branch || '',
    register: lastCheckout.register || '',
    mode: lastCheckout.mode || 'retail',
    method: lastCheckout.method || lastCheckout.payments?.[0]?.method || 'cash',
    payments: lastCheckout.payments || [],
    amount: Number(lastCheckout.total),
    subtotal: Number(lastCheckout.subtotal || lastCheckout.total || 0),
    tax: Number(lastCheckout.tax || 0),
    discount: Number(lastCheckout.discount || 0),
    paid: Number(lastCheckout.paid || lastCheckout.total || 0),
    change: Number(lastCheckout.change || 0),
    time: lastCheckout.time || 'Now',
    status: lastCheckout.status || 'Paid',
    items: lastCheckout.items || [],
  } : null

  return (
    <PanelBody title="Receipts" subtitle={shift ? 'Tap a receipt to view, print, or void.' : 'Open a shift to see transactions.'}>
      {lastCheckoutReceipt && (
        <button
          type="button"
          onClick={() => onSelectReceipt?.(lastCheckoutReceipt)}
          className="pos-press mb-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left"
        >
          <p className="text-xs font-semibold text-emerald-800">Latest sale</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-900">{lastCheckoutReceipt.id} · {money(lastCheckoutReceipt.amount)}</p>
        </button>
      )}

      <div className="space-y-1.5">
        {!shift && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">Open a shift to see transactions.</div>}
        {shift && !transactions.length && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">No transactions on this shift yet.</div>}
        {transactions.map((receipt) => {
          const voided = receipt.status === 'Voided'
          return (
            <button
              key={receipt.id}
              type="button"
              onClick={() => onSelectReceipt?.(receipt)}
              className="pos-press w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left hover:border-sky-300 hover:bg-sky-50/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{receipt.id}</p>
                  <p className="truncate text-[11px] text-slate-500">{receipt.customer} · {receipt.time} · {receipt.method}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-slate-900">{money(receipt.amount)}</p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${voided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {voided ? 'Voided' : receipt.status}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{receipt.items.length} line{receipt.items.length === 1 ? '' : 's'}</p>
            </button>
          )
        })}
      </div>

      <button type="button" onClick={onOpenTransactions} className="pos-press mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
        All receipts (back office)
      </button>
    </PanelBody>
  )
}

const ReceiptModal = ({ receipt, onClose, onVoid, onVoidLine, onReprint, canVoid, canVoidLine, busy }) => {
  const voided = receipt.status === 'Voided'
  const printReceipt = () => {
    const rows = receipt.items.map((item) => `
      <tr><td>${item.qty}× ${item.name}</td><td style="text-align:right">${money(item.qty * item.price)}</td></tr>
    `).join('')
    const html = `<!DOCTYPE html><html><head><title>${receipt.id}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:320px;margin:0 auto}
      table{width:100%;border-collapse:collapse;font-size:13px}td{padding:4px 0}
      h1{font-size:18px;margin:0 0 8px} .muted{color:#64748b;font-size:12px}</style></head><body>
      <h1>${receipt.id}</h1>
      <p class="muted">${receipt.customer} · ${receipt.cashier} · ${receipt.time}</p>
      <p class="muted">Payment: ${receipt.method}</p>
      <table>${rows}</table>
      <p style="margin-top:12px;font-size:16px;font-weight:bold;text-align:right">Total: ${money(receipt.amount)}</p>
      </body></html>`
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <PosModal title={receipt.id} onClose={onClose} wide>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm text-slate-600">
            <p><span className="font-medium text-slate-800">Customer:</span> {receipt.customer}</p>
            <p><span className="font-medium text-slate-800">Cashier:</span> {receipt.cashier}</p>
            <p><span className="font-medium text-slate-800">Time:</span> {receipt.time}</p>
            <p><span className="font-medium text-slate-800">Payment:</span> {receipt.method}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${voided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {voided ? 'Voided' : receipt.status}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50">
          <p className="border-b border-slate-200/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</p>
          <ul className="divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <li key={`${receipt.id}-${item.productId || item.name}`} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.qty}× {item.name}</p>
                  <p className="text-[11px] text-slate-500">{money(item.price)} each</p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">{money(item.qty * item.price)}</p>
                {!voided && canVoidLine && item.productId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onVoidLine?.(receipt, item)}
                    className="pos-press shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                  >
                    Void line
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200/80 px-3 py-2.5">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-lg font-bold tabular-nums">{money(receipt.amount)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={printReceipt} className="pos-press col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700">
            <FaPrint />
            Print receipt
          </button>
          <button type="button" onClick={() => onReprint?.(receipt)} disabled={busy} className="pos-press flex h-10 items-center justify-center gap-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            <FaReceipt />
            Reprint log
          </button>
          {!voided && canVoid && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onVoid?.(receipt)}
              className="pos-press flex h-10 items-center justify-center gap-1 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <FaBan />
              Void all
            </button>
          )}
        </div>
      </div>
    </PosModal>
  )
}

const EnhancedReceiptModal = ({ receipt, onClose, onVoid, onVoidLine, onReprint, canVoid, canVoidLine, busy }) => {
  const voided = receipt.status === 'Voided'
  const payments = receipt.payments?.length ? receipt.payments : [{ method: receipt.method, amount: receipt.paid || receipt.amount }]
  const printReceipt = () => {
    const rows = receipt.items.map((item) => {
      const gross = item.qty * item.price
      const disc = item.discountAmount || 0
      const net = gross - disc
      const discLabel = disc > 0 ? `<span style="color:#16a34a;font-size:10px">Discount${item.appliedRule ? ` (${escapeHtml(item.appliedRule)})` : ''}: -${receiptMoney(disc)}</span>` : ''
      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong><span>${item.qty} x ${receiptMoney(item.price)}</span>${discLabel}</td>
          <td>${receiptMoney(net)}</td>
        </tr>
      `
    }).join('')
    const paymentRows = payments.map((payment) => `
      <div class="row"><span>${escapeHtml(payment.method || 'Payment')}</span><strong>${receiptMoney(payment.amount)}</strong></div>
    `).join('')
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(receipt.id)}</title>
      <style>
        @page{size:80mm auto;margin:4mm}*{box-sizing:border-box}
        body{margin:0;background:#fff;color:#111827;font-family:Inter,Arial,sans-serif}
        .receipt{width:72mm;margin:0 auto;padding:6mm 2mm}.center{text-align:center}
        .brand{font-size:18px;font-weight:900;letter-spacing:.04em}.muted{color:#64748b;font-size:11px;line-height:1.35}
        .meta{margin-top:10px;border-top:1px dashed #94a3b8;border-bottom:1px dashed #94a3b8;padding:8px 0}
        .row{display:flex;justify-content:space-between;gap:10px;font-size:12px;margin:3px 0}
        table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:6px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:12px}
        td:last-child{text-align:right;font-weight:800;white-space:nowrap}td span{display:block;color:#64748b;font-size:10px;margin-top:2px}
        .totals{margin-top:8px}.grand{font-size:16px;border-top:2px solid #111827;padding-top:7px;margin-top:7px}
        .thanks{margin-top:14px;border-top:1px dashed #94a3b8;padding-top:10px;font-size:11px}.voided{margin:8px auto 0;display:inline-block;border:1px solid #dc2626;color:#dc2626;padding:3px 8px;font-weight:900;font-size:11px}
      </style></head><body><main class="receipt">
        <section class="center"><div class="brand">${escapeHtml(receipt.branch || 'Nexa POS')}</div><div class="muted">${escapeHtml(receipt.register ? `Register ${receipt.register}` : 'Point of Sale')}</div>${voided ? '<div class="voided">VOIDED</div>' : ''}</section>
        <section class="meta">
          <div class="row"><span>Receipt</span><strong>${escapeHtml(receipt.id)}</strong></div>
          <div class="row"><span>Time</span><strong>${escapeHtml(receipt.time)}</strong></div>
          <div class="row"><span>Cashier</span><strong>${escapeHtml(receipt.cashier)}</strong></div>
          <div class="row"><span>Customer</span><strong>${escapeHtml(receipt.customer)}</strong></div>
          <div class="row"><span>Mode</span><strong>${escapeHtml(receipt.mode || 'retail')}</strong></div>
        </section>
        <table>${rows}</table>
        <section class="totals">
          <div class="row"><span>Subtotal</span><strong>${receiptMoney(receipt.subtotal || receipt.amount)}</strong></div>
          <div class="row"><span>Discount</span><strong>${receiptMoney(receipt.discount || 0)}</strong></div>
          <div class="row"><span>Tax</span><strong>${receiptMoney(receipt.tax || 0)}</strong></div>
          <div class="row grand"><span>Total KSh</span><strong>${receiptMoney(receipt.amount)}</strong></div>
          ${paymentRows}
          <div class="row"><span>Change</span><strong>${receiptMoney(receipt.change || 0)}</strong></div>
        </section>
        <p class="center thanks">Thank you for shopping with us.<br>Goods sold are subject to store return policy.</p>
      </main><script>window.onload=function(){window.print()}</script></body></html>`
    const win = window.open('', '_blank', 'width=420,height=720')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  return (
    <PosModal title={receipt.id} onClose={onClose} wide>
      <div className="bg-slate-100 p-3 sm:p-4">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-4 text-slate-900 shadow-sm ring-1 ring-slate-200">
          <div className="text-center">
            <p className="text-lg font-black tracking-wide">{receipt.branch || 'Nexa POS'}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{receipt.register ? `Register ${receipt.register}` : 'Point of Sale'}</p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase ${voided ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'}`}>
              {voided ? 'Voided' : receipt.status}
            </span>
          </div>
          <div className="mt-4 space-y-1.5 border-y border-dashed border-slate-300 py-3 text-xs">
            <SummaryRow label="Receipt" value={receipt.id} />
            <SummaryRow label="Time" value={receipt.time} />
            <SummaryRow label="Cashier" value={receipt.cashier} />
            <SummaryRow label="Customer" value={receipt.customer} />
            <SummaryRow label="Mode" value={String(receipt.mode || 'retail').toUpperCase()} />
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <li key={`${receipt.id}-${item.productId || item.name}`} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-slate-950">{item.name}</p>
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500">{item.qty} x {money(item.price)}</p>
                  {(item.discountAmount > 0) && (
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">
                      -{money(item.discountAmount)}{item.appliedRule ? ` · ${item.appliedRule}` : ''}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {item.discountAmount > 0
                    ? (<><p className="text-[11px] tabular-nums text-slate-400 line-through">{money(item.qty * item.price)}</p><p className="text-sm font-black tabular-nums text-emerald-700">{money(item.qty * item.price - item.discountAmount)}</p></>)
                    : <p className="text-sm font-black tabular-nums">{money(item.qty * item.price)}</p>}
                  {!voided && canVoidLine && item.productId && (
                    <button type="button" disabled={busy} onClick={() => onVoidLine?.(receipt, item)} className="pos-press mt-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                      Void line
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <SummaryRow label="Subtotal" value={money(receipt.subtotal || receipt.amount)} />
            <SummaryRow label="Discount" value={money(receipt.discount || 0)} />
            <SummaryRow label="Tax" value={money(receipt.tax || 0)} />
            <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2">
              <span className="text-base font-black text-slate-950">Total</span>
              <span className="text-xl font-black tabular-nums text-slate-950">{money(receipt.amount)}</span>
            </div>
            {payments.map((payment, index) => (
              <SummaryRow key={`${payment.method}-${index}`} label={payment.method || 'Payment'} value={money(payment.amount)} />
            ))}
            <SummaryRow label="Change" value={money(receipt.change || 0)} />
          </div>
          <p className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center text-[11px] font-medium text-slate-500">
            Thank you for shopping with us.
          </p>
        </div>
        <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2">
          <button type="button" onClick={printReceipt} className="pos-press col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700">
            <FaPrint />
            Print receipt
          </button>
          <button type="button" onClick={() => onReprint?.(receipt)} disabled={busy} className="pos-press flex h-10 items-center justify-center gap-1 rounded-xl bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            <FaReceipt />
            Reprint log
          </button>
          {!voided && canVoid && (
            <button type="button" disabled={busy} onClick={() => onVoid?.(receipt)} className="pos-press flex h-10 items-center justify-center gap-1 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              <FaBan />
              Void all
            </button>
          )}
        </div>
      </div>
    </PosModal>
  )
}

const HeldOrdersView = ({ heldOrders: apiHeldOrders = [], editingHeldOrderId, onEditHeld, onCancelHeld, busy }) => {
  const rows = apiHeldOrders
    .filter((order) => order.status === 'open')
    .map((order) => ({
      id: `HLD-${order.id}`,
      customer: order.customer_name || 'Walk-in Customer',
      items: order.items?.length || 0,
      amount: (order.items || []).reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0),
      time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      raw: order,
    }))

  return (
  <PanelBody title="Held Orders" subtitle="Load a hold into the cart. Then pay, clear it, or edit items and tap Update hold.">
    {editingHeldOrderId && (
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
        Loaded <span className="font-bold">HLD-{editingHeldOrderId}</span> in the cart. Save changes with Update hold or complete with Pay.
      </div>
    )}
    <div className="space-y-2">
      {!rows.length && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
          No open held orders. Use Hold on the cart to save one for later.
        </div>
      )}
      {rows.map((order) => {
        const isEditing = editingHeldOrderId === order.raw.id
        return (
          <div
            key={order.id}
            className={`rounded-xl border bg-white p-3 ${isEditing ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/80'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{order.customer} · {order.items} items · {order.time}</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{money(order.amount)}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onEditHeld?.(order)}
                disabled={busy}
                className={`pos-press flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${isEditing ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'} disabled:opacity-50`}
              >
                <FaEdit className="text-[10px]" />
                {isEditing ? 'Loaded' : 'Load'}
              </button>
              <button
                type="button"
                onClick={() => onCancelHeld?.(order)}
                disabled={busy}
                className="pos-press flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <FaTrash className="text-[10px]" />
                Cancel
              </button>
            </div>
          </div>
        )
      })}
    </div>
  </PanelBody>
  )
}

const SalesSummaryView = ({ shiftSummary, total, itemCount }) => {
  const paymentTotal = shiftSummary.cash + shiftSummary.mpesa + shiftSummary.card
  const cashPct = paymentTotal ? Math.round((shiftSummary.cash / paymentTotal) * 100) : 0
  const mpesaPct = paymentTotal ? Math.round((shiftSummary.mpesa / paymentTotal) * 100) : 0

  return (
  <PanelBody title="Sales Summary" subtitle="Totals for your open shift only (not branch history).">
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Shift Sales" value={money(shiftSummary.total)} />
      <Metric label="Cart Items" value={itemCount} />
      <Metric label="Cash" value={money(shiftSummary.cash)} />
      <Metric label="M-Pesa" value={money(shiftSummary.mpesa)} />
      <Metric label="Card" value={money(shiftSummary.card)} />
      <Metric label="Receipts" value={String(shiftSummary.count)} />
    </div>
    <div className="mt-3 rounded border border-slate-200 bg-white p-3">
      <p className="text-xs font-black uppercase text-slate-500">Payment mix</p>
      <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${cashPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-500">
        <span>Cash {cashPct}%</span>
        <span>M-Pesa {mpesaPct}%</span>
        <span>Card {100 - cashPct - mpesaPct}%</span>
      </div>
    </div>
    <p className="mt-3 text-[10px] font-semibold text-slate-500">Current cart total: {money(total)}</p>
  </PanelBody>
  )
}

const EndShiftView = ({ shift, openingCash, setOpeningCash, countedCash, setCountedCash, onOpenShift, onCloseShift, busy }) => (
  <PanelBody title={shift ? 'End Of Shift' : 'Open Shift'} subtitle={shift ? 'Close drawer, confirm counted cash, and lock the register.' : 'Enter opening cash before the cashier can sell.'}>
    {shift ? (
      <>
        <div className="space-y-2 rounded border border-slate-200 bg-white p-3 text-xs">
          <SummaryRow label="Opening cash" value={money(shift.opening_cash)} />
          <SummaryRow label="Expected cash" value={money(shift.expected_cash)} />
          <label className="block pt-2">
            <span className="text-[10px] font-black uppercase text-slate-500">Counted closing cash</span>
            <input value={countedCash} onChange={(event) => setCountedCash(event.target.value)} type="number" className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
          </label>
        </div>
        <button onClick={onCloseShift} disabled={busy} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded bg-red-600 text-xs font-black uppercase text-white disabled:bg-red-200">
          {busy ? <DotLoader color="white" /> : <><FaLock /><span>Close Shift</span></>}
        </button>
      </>
    ) : (
      <>
        <div className="rounded border border-slate-200 bg-white p-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-500">Opening cash</span>
            <input value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} type="number" className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold" />
          </label>
        </div>
        <button onClick={onOpenShift} disabled={busy} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-xs font-black uppercase text-white disabled:bg-emerald-200">
          {busy ? <DotLoader color="white" /> : <><FaLock /><span>Open Shift</span></>}
        </button>
      </>
    )}
  </PanelBody>
)

const PanelBody = ({ title, subtitle, children }) => (
  <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-4">
    <div className="mb-4">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </div>
)

const CompactRecord = ({ title, meta, amount, icon: Icon }) => (
  <button className="flex w-full items-center gap-3 rounded border border-slate-200 bg-white p-2 text-left hover:border-sky-200 hover:bg-sky-50">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600">
      <Icon />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-black text-slate-900">{title}</span>
      <span className="block truncate text-[10px] font-semibold text-slate-500">{meta}</span>
    </span>
    <span className="text-xs font-black text-slate-900">{money(amount)}</span>
  </button>
)

const Metric = ({ label, value }) => (
  <div className="rounded border border-slate-200 bg-white p-3">
    <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
    <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
  </div>
)

const MobileDock = ({ itemCount, total, shift, onCart, onPay, onWorkspace }) => (
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/60 pos-glass px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_40px_rgba(15,23,42,0.14)] lg:hidden">
    <div className={`grid gap-2.5 ${itemCount > 0 ? 'grid-cols-[1fr_1.5fr_1fr]' : 'grid-cols-2'}`}>
      {/* Cart button with count badge */}
      <button
        type="button"
        onClick={onCart}
        className="pos-press relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-slate-100 px-2 text-slate-800 ring-1 ring-slate-200/80 active:bg-slate-200"
      >
        <FaShoppingBag className="text-lg" />
        <span className="text-[10px] font-semibold">Cart</span>
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-black text-white shadow">
            {itemCount}
          </span>
        )}
      </button>

      {/* Pay — only when items in cart */}
      {itemCount > 0 && (
        <button
          type="button"
          onClick={onPay}
          className="pos-press flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-emerald-600 px-2 text-white shadow-lg shadow-emerald-600/30 active:bg-emerald-700"
        >
          <FaCreditCard className="text-lg" />
          <span className="max-w-full truncate text-[10px] font-black tabular-nums">{money(total)}</span>
        </button>
      )}

      {/* Workspace / menu */}
      <button
        type="button"
        onClick={onWorkspace}
        className="pos-press flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-slate-900 px-2 text-white active:bg-slate-800"
      >
        <FaBars className="text-lg" />
        <span className="text-[10px] font-semibold">Menu</span>
        {!shift && <span className="text-[8px] font-semibold text-amber-400">No shift</span>}
      </button>
    </div>
  </div>
)

const MobileSheet = ({ title, children, onClose, nativeScroll = true }) => (
  <div className="fixed inset-0 z-50 lg:hidden">
    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
    <div className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl">
      <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-300" />
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} className="pos-press flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-label="Close">
          <FaTimes />
        </button>
      </div>
      {/* nativeScroll=false lets the child manage its own internal scroll (e.g. WorkspacePanel) */}
      <div className={`min-h-0 flex-1 pb-[env(safe-area-inset-bottom)] ${nativeScroll ? 'overflow-y-auto' : 'flex flex-col overflow-hidden'}`}>{children}</div>
    </div>
  </div>
)

const SummaryRow = ({ label, value, bold }) => (
  <div className="flex items-center justify-between py-0.5">
    <span className={`text-slate-500 ${bold ? 'font-semibold text-slate-700' : ''}`}>{label}</span>
    <span className={`text-slate-900 ${bold ? 'text-lg font-bold' : 'font-semibold'}`}>{value}</span>
  </div>
)

export default PosTerminal
