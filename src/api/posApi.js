const API_BASE = import.meta.env.VITE_POS_API_URL || '/api/pos'
const INVENTORY_API_BASE = import.meta.env.VITE_INVENTORY_API_URL || '/api/inventory'
const SESSION_KEY = 'nexa-pos-session'

const authHeaders = () => {
  try {
    const token = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

const requestFrom = async (base, path, options = {}) => {
  const { skipAuth = false, headers = {}, ...fetchOptions } = options
  const response = await fetch(`${base}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(skipAuth ? {} : authHeaders()),
      ...headers,
    },
    credentials: 'include',
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const error = new Error('POS API request failed')
    error.status = response.status
    error.data = data
    const detail = String(data?.detail || '').toLowerCase()
    if (!skipAuth && (response.status === 401 || detail.includes('inactive') || detail.includes('session'))) {
      window.dispatchEvent(new CustomEvent('pos-auth-expired', { detail: data }))
    }
    throw error
  }

  return data
}

const request = (path, options = {}) => requestFrom(API_BASE, path, options)
const inventoryRequest = (path, options = {}) => requestFrom(INVENTORY_API_BASE, path, options)
const _rawFetch = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.skipAuth ? {} : authHeaders()),
      ...(options.headers || {}),
    },
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response
}
const cleanParams = (params = {}) => new URLSearchParams(
  Object.entries(params).filter(([, value]) => (
    value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null'
  ))
)

export const posApi = {
   login: (payload) => request('/auth/login/', { method: 'POST', body: JSON.stringify(payload), skipAuth: true }),
   me: () => request('/auth/me/'),
   switchBranch: (payload) => request('/auth/switch-branch/', { method: 'POST', body: JSON.stringify(payload) }),
   switchCompany: (payload) => request('/auth/switch-company/', { method: 'POST', body: JSON.stringify(payload) }),
   companies: (params = {}) => request(`/companies/?${cleanParams(params)}`),
   createCompany: (payload) => request('/companies/', { method: 'POST', body: JSON.stringify(payload) }),
   updateCompany: (id, payload) => request(`/companies/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
   deleteCompany: (id) => request(`/companies/${id}/`, { method: 'DELETE' }),
   branches: (params = {}) => request(`/branches/?${cleanParams(params)}`),
   createBranch: (payload) => request('/branches/', { method: 'POST', body: JSON.stringify(payload) }),
   updateBranch: (id, payload) => request(`/branches/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
   deleteBranch: (id) => request(`/branches/${id}/`, { method: 'DELETE' }),
  users: (params = {}) => request(`/users/?${cleanParams(params)}`),
  userRoleOptions: () => request('/users/role-options/'),
  adminSettings: (params = {}) => request(`/admin-settings/by-company/?${cleanParams(params)}`),
  updateAdminSection: (payload) => {
    const { company, section, values } = payload
    return request(`/admin-settings/update-section/?${cleanParams({ company })}`, {
      method: 'PATCH',
      body: JSON.stringify({ section, values }),
    })
  },
  adminRbacCatalog: () => request('/admin-rbac/catalog/'),
  adminMyAccess: () => request('/admin-rbac/my-access/'),
  createUser: (payload) => request('/users/', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id, payload) => request(`/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/users/${id}/`, { method: 'DELETE' }),
  registers: (params = {}) => request(`/registers/?${cleanParams(params)}`),
  ensureRegister: (payload) => request('/registers/ensure-default/', { method: 'POST', body: JSON.stringify(payload) }),
  shifts: (params = {}) => request(`/shifts/?${cleanParams(params)}`),
  categories: (params = {}) => request(`/categories/?${cleanParams(params)}`),
  createCategory: (payload) => request('/categories/', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id, payload) => request(`/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCategory: (id) => request(`/categories/${id}/`, { method: 'DELETE' }),
  products: ({ branch, search, category, barcode, page = 1, page_size = 100 } = {}) => {
    const params = new URLSearchParams()
    if (branch) params.set('branch', branch)
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (barcode) params.set('barcode', barcode)
    if (page) params.set('page', page)
    if (page_size) params.set('page_size', page_size)
    return request(`/products/?${params}`)
  },
  createProduct: (payload) => request('/products/', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/products/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}/`, { method: 'DELETE' }),
  customers: (params = {}) => {
    const nextParams = typeof params === 'string' ? { search: params } : params
    return request(`/customers/?${cleanParams(nextParams)}`)
  },
  createCustomer: (payload) => request('/customers/', { method: 'POST', body: JSON.stringify(payload) }),
  openShift: (payload) => request('/shifts/open/', { method: 'POST', body: JSON.stringify(payload) }),
  closeShift: (shiftId, payload) => request(`/shifts/${shiftId}/close/`, { method: 'POST', body: JSON.stringify(payload) }),
  heldOrders: (params = {}) => request(`/held-orders/?${cleanParams(params)}`),
  holdOrder: (payload) => request('/held-orders/hold/', { method: 'POST', body: JSON.stringify(payload) }),
  resumeHeldOrder: (id) => request(`/held-orders/${id}/resume/`, { method: 'POST' }),
  updateHeldOrder: (id, payload) => request(`/held-orders/${id}/update-hold/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  cancelHeldOrder: (id) => request(`/held-orders/${id}/cancel/`, { method: 'POST' }),
   checkout: (payload) => request('/sales/checkout/', { method: 'POST', body: JSON.stringify(payload) }),
   mpesaStkPush: (payload) => request('/sales/mpesa/stk-push/', { method: 'POST', body: JSON.stringify(payload) }),
   mpesaStkQuery: (payload) => request('/sales/mpesa/stk-query/', { method: 'POST', body: JSON.stringify(payload) }),
   mpesaDirectLookup: (payload) => request('/sales/mpesa/direct-lookup/', { method: 'POST', body: JSON.stringify(payload) }),
   sales: (params = {}) => request(`/sales/?${cleanParams(params)}`),
   todaySales: (params = {}) => request(`/sales/?${cleanParams({ ...params, status: 'paid' })}`),
   todayShifts: (params = {}) => request(`/shifts/?${cleanParams(params)}`),
   sale: (id) => request(`/sales/${id}/`),
   voidSale: (id, payload) => request(`/sales/${id}/void/`, { method: 'POST', body: JSON.stringify(payload) }),
   reprintReceipt: (id, payload) => request(`/sales/${id}/reprint/`, { method: 'POST', body: JSON.stringify(payload) }),
   summary: (params = {}) => request(`/sales/summary/?${cleanParams(params)}`),
   salesControl: (params = {}) => request(`/sales/control/?${cleanParams(params)}`),
   transactions: (params = {}) => request(`/sales/transactions/?${cleanParams(params)}`),
   voids: (params = {}) => request(`/sales/voids/?${cleanParams(params)}`),
   discountsLog: (params = {}) => request(`/sales/discounts/?${cleanParams(params)}`),
   customerSales: (params = {}) => request(`/sales/customer-sales/?${cleanParams(params)}`),
   salesReports: (params = {}) => request(`/sales/reports/?${cleanParams(params)}`),
   saleReturns: (params = {}) => request(`/sale-returns/?${cleanParams(params)}`),
   createSaleReturn: (payload) => request('/sale-returns/create_return/', { method: 'POST', body: JSON.stringify(payload) }),
   approveSaleReturn: (id, payload) => request(`/sale-returns/${id}/approve/`, { method: 'POST', body: JSON.stringify(payload) }),
   rejectSaleReturn: (id, payload) => request(`/sale-returns/${id}/reject/`, { method: 'POST', body: JSON.stringify(payload) }),
   completeSaleReturn: (id, payload) => request(`/sale-returns/${id}/complete/`, { method: 'POST', body: JSON.stringify(payload) }),
   payments: (params = {}) => request(`/payments/?${cleanParams(params)}`),
  mpesaStkLogs: (params = {}) => request(`/mpesa-stk-logs/?${cleanParams(params)}`),
  mpesaDirectLogs: (params = {}) => request(`/mpesa-direct-logs/?${cleanParams(params)}`),
   cashTransactions: (params = {}) => request(`/cash-transactions/?${cleanParams(params)}`),
   createCashTransaction: (payload) => request('/cash-transactions/', { method: 'POST', body: JSON.stringify(payload) }),
   cashManagement: (params = {}) => request(`/shifts/cash-management/?${cleanParams(params)}`),
   cashierSummary: (params = {}) => request(`/shifts/cashier-summary/?${cleanParams(params)}`),
   shiftPerformance: (params = {}) => request(`/shifts/performance/?${cleanParams(params)}`),
   shiftCashSummary: (id) => request(`/shifts/${id}/cash-summary/`),
  stock: (params = {}) => request(`/stock/?${cleanParams(params)}`),
  lowStock: (params = {}) => request(`/stock/low-stock/?${cleanParams(params)}`),
  adjustStock: (payload) => request('/stock/adjust/', { method: 'POST', body: JSON.stringify(payload) }),
  stockMovements: (params = {}) => request(`/stock-movements/?${cleanParams(params)}`),
   purchaseOrders: (params = {}) => request(`/purchase-orders/?${cleanParams(params)}`),
   createPurchaseOrder: (payload) => request('/purchase-orders/create_order/', { method: 'POST', body: JSON.stringify(payload) }),
   receivePurchaseOrder: (id, payload) => request(`/purchase-orders/${id}/receive/`, { method: 'POST', body: JSON.stringify(payload) }),
   cancelPurchaseOrder: (id) => request(`/purchase-orders/${id}/cancel/`, { method: 'POST' }),
   updatePurchaseOrder: (id, payload) => request(`/purchase-orders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
   deletePurchaseOrder: (id) => request(`/purchase-orders/${id}/`, { method: 'DELETE' }),
  stocktakes: (params = {}) => request(`/stocktakes/?${cleanParams(params)}`),
  startStocktake: (payload) => request('/stocktakes/start/', { method: 'POST', body: JSON.stringify(payload) }),
  countStocktake: (id, payload) => request(`/stocktakes/${id}/count/`, { method: 'POST', body: JSON.stringify(payload) }),
  approveStocktake: (id, payload) => request(`/stocktakes/${id}/approve/`, { method: 'POST', body: JSON.stringify(payload) }),
  auditLogs: (params = {}) => request(`/audit-logs/?${cleanParams(params)}`),
  stockValuation: (params = {}) => request(`/stock/stock-valuation/?${cleanParams(params)}`),
  fastSlowMoving: (params = {}) => request(`/stock/fast-slow-moving/?${cleanParams(params)}`),
  monthlyVariance: (params = {}) => request(`/stock/monthly-variance/?${cleanParams(params)}`),
  rawFetch: _rawFetch,
inventory: {
     categories: ({ branch, page = 1, page_size = 100, search } = {}) => {
       const params = new URLSearchParams()
       if (branch) params.set('branch', branch)
       if (page) params.set('page', page)
       if (page_size) params.set('page_size', page_size)
       if (search) params.set('search', search)
       return inventoryRequest(`/categories/?${params}`)
     },
     createCategory: (payload) => inventoryRequest('/categories/', { method: 'POST', body: JSON.stringify(payload) }),
     updateCategory: (id, payload) => inventoryRequest(`/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
     deleteCategory: (id) => inventoryRequest(`/categories/${id}/`, { method: 'DELETE' }),
     suppliers: ({ branch, page = 1, page_size = 100, search } = {}) => {
       const params = new URLSearchParams()
       if (branch) params.set('branch', branch)
       if (page) params.set('page', page)
       if (page_size) params.set('page_size', page_size)
       if (search) params.set('search', search)
       return inventoryRequest(`/suppliers/?${params}`)
     },
     createSupplier: (payload) => inventoryRequest('/suppliers/', { method: 'POST', body: JSON.stringify(payload) }),
     updateSupplier: (id, payload) => inventoryRequest(`/suppliers/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
     deleteSupplier: (id) => inventoryRequest(`/suppliers/${id}/`, { method: 'DELETE' }),
     products: ({ branch, search, category, barcode, page = 1, page_size = 100 } = {}) => {
       const params = new URLSearchParams()
       if (branch) params.set('branch', branch)
       if (search) params.set('search', search)
       if (category) params.set('category', category)
       if (barcode) params.set('barcode', barcode)
       if (page) params.set('page', page)
       if (page_size) params.set('page_size', page_size)
       return inventoryRequest(`/products/?${params}`)
     },
     createProduct: (payload) => inventoryRequest('/products/', { method: 'POST', body: JSON.stringify(payload) }),
     updateProduct: (id, payload) => inventoryRequest(`/products/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
     deleteProduct: (id) => inventoryRequest(`/products/${id}/`, { method: 'DELETE' }),
     stock: (params = {}) => inventoryRequest(`/stock/?${cleanParams(params)}`),
     lowStock: (params = {}) => inventoryRequest(`/stock/low-stock/?${cleanParams(params)}`),
     adjustStock: (payload) => inventoryRequest('/stock/adjust/', { method: 'POST', body: JSON.stringify(payload) }),
     stockMovements: (params = {}) => inventoryRequest(`/stock-movements/?${cleanParams(params)}`),
      purchaseOrders: (params = {}) => inventoryRequest(`/purchase-orders/?${cleanParams(params)}`),
      createPurchaseOrder: (payload) => inventoryRequest('/purchase-orders/create_order/', { method: 'POST', body: JSON.stringify(payload) }),
      receivePurchaseOrder: (id, payload) => inventoryRequest(`/purchase-orders/${id}/receive/`, { method: 'POST', body: JSON.stringify(payload) }),
      cancelPurchaseOrder: (id) => inventoryRequest(`/purchase-orders/${id}/cancel/`, { method: 'POST' }),
      updatePurchaseOrder: (id, payload) => inventoryRequest(`/purchase-orders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
      deletePurchaseOrder: (id) => inventoryRequest(`/purchase-orders/${id}/`, { method: 'DELETE' }),
     stocktakes: (params = {}) => inventoryRequest(`/stocktakes/?${cleanParams(params)}`),
     startStocktake: (payload) => inventoryRequest('/stocktakes/start/', { method: 'POST', body: JSON.stringify(payload) }),
     countStocktake: (id, payload) => inventoryRequest(`/stocktakes/${id}/count/`, { method: 'POST', body: JSON.stringify(payload) }),
     approveStocktake: (id, payload) => inventoryRequest(`/stocktakes/${id}/approve/`, { method: 'POST', body: JSON.stringify(payload) }),
     monthlyVariance: (params = {}) => request(`/stock/monthly-variance/?${cleanParams(params)}`),
   },
 }
