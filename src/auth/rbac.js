export const ACCESS_LEVELS = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  BRANCH_ADMIN: 'branch_admin',
  BRANCH_STAFF: 'branch_staff',
}

export const ADMIN_SECTIONS = {
  BUSINESS: 'Business Setup',
  BRANCHES: 'Branches',
  USERS: 'Users',
  ROLES_PERMISSIONS: 'Roles & Permissions',
  CREDIT_LOYALTY: 'Credit & Loyalty',
  STOCK_CONTROLS: 'Stock Controls',
  AUDIT_LOGS: 'Audit Logs',
  NOTIFICATIONS: 'Notifications',
  FINANCIAL_CONTROL: 'Financial Control',
  PRICING_CONTROL: 'Pricing Control',
  BACKUP_DATA: 'Backup & Data',
  INTEGRATIONS: 'Integrations',
  SUPER_ADMIN: 'Super Admin',
  REPORTS: 'Reports',
  SCHEDULED_REPORTS: 'Scheduled Reports',
  ALERTS: 'Alerts',
  SETTINGS: 'Settings',
  SYSTEM_HEALTH: 'System Health',
}

export const ADMIN_SECTION_POLICIES = {
  [ADMIN_SECTIONS.BUSINESS]: ['admin.business', 'admin.company', 'company.manage'],
  [ADMIN_SECTIONS.BRANCHES]: ['admin.branches', 'branch.manage'],
  [ADMIN_SECTIONS.USERS]: ['admin.users', 'user.manage'],
  [ADMIN_SECTIONS.ROLES_PERMISSIONS]: ['admin.rbac', 'admin.roles', 'user.manage'],
  [ADMIN_SECTIONS.CREDIT_LOYALTY]: ['admin.settings'],
  [ADMIN_SECTIONS.STOCK_CONTROLS]: ['admin.stock_controls', 'inventory.adjust', 'inventory.view'],
  [ADMIN_SECTIONS.AUDIT_LOGS]: ['admin.audit', 'sales.audit'],
  [ADMIN_SECTIONS.NOTIFICATIONS]: ['admin.notifications', 'alerts.view'],
  [ADMIN_SECTIONS.FINANCIAL_CONTROL]: ['admin.financial', 'cash.manage'],
  [ADMIN_SECTIONS.PRICING_CONTROL]: ['admin.pricing', 'sale.discount'],
  [ADMIN_SECTIONS.BACKUP_DATA]: ['admin.backup', 'admin.data'],
  [ADMIN_SECTIONS.INTEGRATIONS]: ['admin.integrations'],
  [ADMIN_SECTIONS.SUPER_ADMIN]: ['admin.super'],
  [ADMIN_SECTIONS.REPORTS]: ['admin.reports', 'reports.view'],
  [ADMIN_SECTIONS.SCHEDULED_REPORTS]: ['admin.scheduled_reports', 'admin.reports', 'admin.notifications'],
  [ADMIN_SECTIONS.ALERTS]: ['admin.alerts', 'alerts.view'],
  [ADMIN_SECTIONS.SETTINGS]: ['admin.settings', 'settings.view'],
  [ADMIN_SECTIONS.SYSTEM_HEALTH]: ['admin.system', 'admin.super'],
}

export const ROUTE_POLICIES = {
  '/dashboard': { label: 'Dashboard', permissions: ['dashboard.view'] },
  '/pos': { label: 'POS Terminal', permissions: ['pos.view', 'pos.sell'] },
  '/sales-control/transactions': { label: 'Transactions', permissions: ['sales.view'] },
  '/sales-control/voids': { label: 'Voids', permissions: ['sale.void'] },
  '/sales-control/returns-refunds': { label: 'Returns & Refunds', permissions: ['sale.refund', 'sale.refund.approve'] },
  '/sales-control/cash-management': { label: 'Cash Management', permissions: ['cash.manage'] },
  '/sales-control/cashier-summary': { label: 'Cashier Summary', permissions: ['shift.view'] },
  '/sales-control/payments': { label: 'Payments', permissions: ['sales.payments'] },
  '/sales-control/discounts-log': { label: 'Discounts Log', permissions: ['sales.discounts', 'sale.discount'] },
  '/sales-control/discount-engine': { label: 'Discount Engine', permissions: ['admin.pricing', 'sale.discount'] },
  '/sales-control/price-scheduler': { label: 'Price Scheduler', permissions: ['admin.pricing'] },
  '/sales-control/customer-sales': { label: 'Customer Sales', permissions: ['sales.customer'] },
  '/sales-control/customers': { label: 'Customers', permissions: ['sales.customer'] },
  '/sales-control/reports': { label: 'Reports', permissions: ['reports.view'] },
  '/sales-control/audit-logs': { label: 'Audit Logs', permissions: ['sales.audit', 'admin.audit'] },
  '/inventory/products': { label: 'Products & Items', permissions: ['inventory.products', 'inventory.view'] },
  '/inventory/purchase-orders': { label: 'Purchase Orders', permissions: ['purchase_order.create', 'inventory.view'] },
  '/inventory/goods-receiving': { label: 'Goods Receiving', permissions: ['purchase_order.receive'] },
  '/inventory/stock-management': { label: 'Stock Management', permissions: ['inventory.adjust', 'inventory.view'] },
  '/inventory/stocktake': { label: 'Stocktake', permissions: ['stocktake.manage'] },
  '/inventory/monthly-variance': { label: 'Monthly Variance', permissions: ['inventory.variance'] },
  '/inventory/warehouses': { label: 'Warehouses', permissions: ['inventory.warehouses'] },
  '/inventory/suppliers': { label: 'Suppliers', permissions: ['inventory.suppliers'] },
  '/inventory/reports': { label: 'Inventory Reports', permissions: ['inventory.reports', 'reports.view'] },
  '/settings': { label: 'Settings', permissions: ['settings.view', 'admin.settings'] },
}

export const ADMIN_ROUTE_POLICIES = Object.fromEntries([
  ['/admin/business', ADMIN_SECTIONS.BUSINESS],
  ['/admin/branches', ADMIN_SECTIONS.BRANCHES],
  ['/admin/users', ADMIN_SECTIONS.USERS],
  ['/admin/roles-permissions', ADMIN_SECTIONS.ROLES_PERMISSIONS],
  ['/admin/credit-loyalty', ADMIN_SECTIONS.CREDIT_LOYALTY],
  ['/admin/stock-controls', ADMIN_SECTIONS.STOCK_CONTROLS],
  ['/admin/audit-logs', ADMIN_SECTIONS.AUDIT_LOGS],
  ['/admin/notifications', ADMIN_SECTIONS.NOTIFICATIONS],
  ['/admin/financial-control', ADMIN_SECTIONS.FINANCIAL_CONTROL],
  ['/admin/pricing-control', ADMIN_SECTIONS.PRICING_CONTROL],
  ['/admin/backup-data', ADMIN_SECTIONS.BACKUP_DATA],
  ['/admin/integrations', ADMIN_SECTIONS.INTEGRATIONS],
  ['/admin/mpesa-logs', ADMIN_SECTIONS.INTEGRATIONS],
  ['/admin/super-admin', ADMIN_SECTIONS.SUPER_ADMIN],
  ['/admin/reports', ADMIN_SECTIONS.REPORTS],
  ['/admin/scheduled-reports', ADMIN_SECTIONS.SCHEDULED_REPORTS],
  ['/admin/alerts', ADMIN_SECTIONS.ALERTS],
  ['/admin/settings', ADMIN_SECTIONS.SETTINGS],
  ['/admin/system-health', ADMIN_SECTIONS.SYSTEM_HEALTH],
].map(([path, section]) => [path, { label: section, adminSection: section }]))

export const APP_ROUTE_POLICIES = {
  ...ROUTE_POLICIES,
  ...ADMIN_ROUTE_POLICIES,
}

const ROLE_FALLBACK_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'dashboard.view',
    'pos.view',
    'pos.sell',
    'sales.view',
    'sale.void',
    'sale.refund',
    'sale.discount',
    'cash.manage',
    'shift.view',
    'reports.view',
    'inventory.view',
    'inventory.products',
    'admin.pricing',
  ],
  inventory: [
    'dashboard.view',
    'inventory.view',
    'inventory.products',
    'inventory.adjust',
    'purchase_order.create',
    'purchase_order.receive',
    'stocktake.manage',
    'inventory.reports',
  ],
  cashier: ['dashboard.view', 'pos.view', 'pos.sell', 'shift.view'],
  voiding: ['dashboard.view', 'pos.view', 'sales.view', 'sale.void', 'shift.view'],
  auditor: ['dashboard.view', 'sales.view', 'reports.view', 'sales.audit', 'admin.audit'],
}

const normalizeArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (value instanceof Set) return [...value]
  if (typeof value === 'string') return [value]
  return []
}

const normalizePermissions = (values) => (
  [...new Set(values.flatMap(normalizeArray).map((item) => (
    typeof item === 'string' ? item : item?.code
  )).filter(Boolean))]
)

const hasExplicitPermissions = (session) => (
  Array.isArray(session?.permissions)
  || Array.isArray(session?.profile?.permissions)
  || Array.isArray(session?.profile?.effective_permissions)
  || Array.isArray(session?.profile?.custom_permissions)
)

export const getAccessLevel = (session) => (
  session?.profile?.access_level
  || session?.access_level
  || ACCESS_LEVELS.BRANCH_STAFF
)

export const getRole = (session) => session?.profile?.role || session?.role || 'cashier'

export const getSessionPermissions = (session) => {
  if (!session) return []
  const role = getRole(session)
  const profile = session.profile || {}

  // Group-based permissions from the backend always take priority
  const explicitPermissions = normalizePermissions([
    session.permissions,
    profile.effective_permissions,
    profile.permissions,
  ])

  if (explicitPermissions.length) {
    return explicitPermissions
  }

  // Custom permissions override (legacy, no groups assigned)
  if (profile.use_custom_permissions && Array.isArray(profile.custom_permissions)) {
    return normalizePermissions([profile.custom_permissions])
  }

  // Role-based fallback — only reached when the backend sends no permissions at all
  if (ROLE_FALLBACK_PERMISSIONS[role]) {
    return ROLE_FALLBACK_PERMISSIONS[role]
  }

  return []
}

const slugPermission = (prefix, value) => (
  `${prefix}.${String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
)

const readAdminSectionGrant = (adminSections, sectionName, hasAnyPermission) => {
  if (!adminSections || !sectionName) return undefined

  if (Array.isArray(adminSections)) return adminSections.includes(sectionName)

  const directValue = adminSections[sectionName]
  const slugValue = adminSections[slugPermission('admin', sectionName)]
  const value = directValue ?? slugValue

  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return hasAnyPermission(value)
  if (typeof value === 'string') return hasAnyPermission([value])
  if (value && typeof value === 'object') {
    if ('allowed' in value) return Boolean(value.allowed)
    if ('permissions' in value) return hasAnyPermission(value.permissions)
  }

  return undefined
}

export const createAccessController = (session) => {
  const permissions = getSessionPermissions(session)
  const permissionSet = new Set(permissions)
  const accessLevel = getAccessLevel(session)
  const role = getRole(session)

  const isAccessLevelSuperAdmin = accessLevel === ACCESS_LEVELS.SUPER_ADMIN
  const hasWildcard = permissionSet.has('*') || isAccessLevelSuperAdmin
  const hasPermission = (permission) => {
    if (!permission) return true
    if (Array.isArray(permission)) return hasAnyPermission(permission)
    return hasWildcard || permissionSet.has(permission)
  }
  const hasAnyPermission = (codes = []) => {
    const normalizedCodes = normalizePermissions([codes])
    if (!normalizedCodes.length) return true
    return hasWildcard || normalizedCodes.some((code) => permissionSet.has(code))
  }
  const hasAllPermissions = (codes = []) => {
    const normalizedCodes = normalizePermissions([codes])
    if (!normalizedCodes.length) return true
    return hasWildcard || normalizedCodes.every((code) => permissionSet.has(code))
  }

  const isSuperAdmin = hasWildcard
  const isCompanyAdmin = isSuperAdmin || accessLevel === ACCESS_LEVELS.COMPANY_ADMIN
  const isBranchAdmin = isCompanyAdmin || accessLevel === ACCESS_LEVELS.BRANCH_ADMIN

  const canAccessAdmin = (sectionName) => {
    if (isSuperAdmin) return true

    const backendGrant = readAdminSectionGrant(session?.admin_sections, sectionName, hasAnyPermission)
    if (backendGrant === true) return true

    const policyPermissions = [
      ...(ADMIN_SECTION_POLICIES[sectionName] || []),
      slugPermission('admin', sectionName),
    ]
    return hasAnyPermission(policyPermissions)
  }

  const canAccessPolicy = (policy) => {
    if (!policy) return false
    if (policy.adminSection) return canAccessAdmin(policy.adminSection)
    return hasAnyPermission(policy.permissions)
  }

  const canAccessRoute = (path) => canAccessPolicy(APP_ROUTE_POLICIES[path])

  return {
    permissions,
    permissionSet,
    accessLevel,
    role,
    hasWildcard,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessAdmin,
    canAccessPolicy,
    canAccessRoute,
    isSuperAdmin,
    isCompanyAdmin,
    isBranchAdmin,
    canSwitchBranch: isCompanyAdmin,
    canSwitchCompany: isSuperAdmin,
  }
}
