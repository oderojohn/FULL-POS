import React, { useEffect, useMemo, useState } from 'react'
import {
  FaBell, FaBuilding, FaCashRegister, FaCheck, FaCog, FaDatabase, FaExchangeAlt,
  FaEdit, FaFileExcel, FaLock, FaMoneyBillWave, FaPlus, FaSave, FaShieldAlt, FaTags, FaTimes, FaTrash, FaUsers,
  FaWarehouse
} from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'
import { posApi } from '../api/posApi'

const money = (value) => `KES ${value.toLocaleString()}`

const adminSections = {
  'Business Setup': {
    icon: FaBuilding,
    summary: 'Company profile, operating currency, business type, tax identity, receipt branding, and account status.',
  },
  Branches: {
    icon: FaWarehouse,
    summary: 'Multi-branch setup, managers, branch stock separation, sales tracking, and switching rules.',
  },
  Users: {
    icon: FaUsers,
    summary: 'Staff accounts for cashiers, storekeepers, managers, admins, branch assignment, shifts, and password resets.',
  },
  'Roles & Permissions': {
    icon: FaShieldAlt,
    summary: 'Granular permissions for refunds, discounts, price changes, stock edits, reports, and sensitive actions.',
  },
  Security: {
    icon: FaLock,
    summary: 'PIN login, session tracking, device history, two-factor controls, and auto logout settings.',
  },
  'System Settings': {
    icon: FaCog,
    summary: 'Currency, VAT, receipt setup, printer setup, and numbering sequences.',
  },
  'POS Operations': {
    icon: FaCashRegister,
    summary: 'Admin controls for discounts, refunds, credit sales, layby, barcode mode, and approval rules.',
  },
  'Stock Controls': {
    icon: FaWarehouse,
    summary: 'Stock deduction, transfers, low stock alerts, reorder levels, and adjustment approvals.',
  },
  'Audit Logs': {
    icon: FaShieldAlt,
    summary: 'Track sales, refunds, price changes, stock adjustments, login history, and deleted transaction attempts.',
  },
  Notifications: {
    icon: FaBell,
    summary: 'Low stock, daily summaries, refund alerts, suspicious activity, and manager approvals.',
  },
  'Financial Control': {
    icon: FaMoneyBillWave,
    summary: 'Daily cash summaries, cash drawers, Z reports, payment methods, and discrepancy tracking.',
  },
  'Pricing Control': {
    icon: FaTags,
    summary: 'Price editing permissions, approval workflows, retail/wholesale levels, discounts, and activation rules.',
  },
  'Backup & Data': {
    icon: FaDatabase,
    summary: 'Auto backups, manual download, restore, CSV/Excel export, and transaction archiving.',
  },
  Integrations: {
    icon: FaExchangeAlt,
    summary: 'M-Pesa, thermal printers, barcode scanners, accounting integrations, and API key management.',
  },
  'Super Admin': {
    icon: FaShieldAlt,
    summary: 'System-wide business control, company suspension, force logout, analytics, and maintenance mode.',
  },
  Reports: {
    icon: FaFileExcel,
    summary: 'Administration reports, exports, and management summaries.',
  },
  Alerts: {
    icon: FaBell,
    summary: 'Administrative alerts and operational exception queues.',
  },
  Settings: {
    icon: FaCog,
    summary: 'General administration settings shortcut.',
  },
}

const Administration = ({ section = 'Business Setup' }) => {
  const { canAccessAdmin, can } = useAuth()
  const allowed = can('*') || canAccessAdmin(section)
  const config = adminSections[section] || adminSections['Business Setup']
  const Icon = config.icon

  if (!allowed) {
    return (
      <div className="p-6 bg-white rounded-lg border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Access denied</h1>
        <p className="text-sm text-slate-500 mt-2">You do not have permission to view {section}.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Icon className="text-emerald-600" />
            Administration / {section}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{config.summary}</p>
        </div>
      </div>

      {section === 'Business Setup' && <BusinessSetup />}
      {section === 'Branches' && <Branches />}
      {section === 'Users' && <Users />}
      {section === 'Roles & Permissions' && <RolesPermissions />}
      {section === 'Security' && <Security />}
      {section === 'System Settings' && <SystemSettings />}
      {section === 'POS Operations' && <Operations />}
      {section === 'Stock Controls' && <StockControls />}
      {section === 'Audit Logs' && <AuditLogs />}
      {section === 'Notifications' && <Notifications />}
      {section === 'Financial Control' && <FinancialControl />}
      {section === 'Pricing Control' && <PricingControl />}
      {section === 'Backup & Data' && <BackupData />}
      {section === 'Integrations' && <Integrations />}
      {section === 'Super Admin' && <SuperAdmin />}
      {section === 'Reports' && <AdminReports />}
      {section === 'Alerts' && <Notifications />}
      {section === 'Settings' && <SystemSettings />}
    </div>
  )
}

const emptyCompanyForm = { name: '', currency: 'KES', vat_rate: '0', is_active: true }
const emptyBranchForm = {
  company: '',
  code: '',
  name: '',
  location: '',
  is_active: true,
  mpesa_stk_enabled: false,
  mpesa_manual_approval_enabled: false,
  mpesa_till_enabled: false,
  mpesa_consumer_key: '',
  mpesa_consumer_secret: '',
  mpesa_business_shortcode: '',
  mpesa_passkey: '',
  mpesa_environment: 'sandbox',
  mpesa_callback_url: '',
  mpesa_till_number: '',
  mpesa_initiator_name: '',
  mpesa_security_credential: '',
  mpesa_direct_result_url: '',
  mpesa_direct_timeout_url: '',
}

const BusinessSetup = () => {
  const { company: authCompany, isSuperAdmin, reloadSignal } = useAuth()
  const [companies, setCompanies] = useState(authCompany ? [authCompany] : [])
  const [form, setForm] = useState({ ...emptyCompanyForm, ...(authCompany || {}) })
  const [editingId, setEditingId] = useState(authCompany?.id || null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const data = await posApi.companies()
      const rows = Array.isArray(data) ? data : data?.results || []
      setCompanies(rows)
      if (!editingId && rows[0]) {
        setEditingId(rows[0].id)
        setForm({ ...emptyCompanyForm, ...rows[0] })
      }
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [reloadSignal])

  const editCompany = (company) => {
    setEditingId(company.id)
    setForm({ ...emptyCompanyForm, ...company })
  }

  const resetCompany = () => {
    setEditingId(null)
    setForm(emptyCompanyForm)
  }

  const submitCompany = async (event) => {
    event.preventDefault()
    setMessage('')
    const payload = {
      name: form.name.trim(),
      currency: form.currency || 'KES',
      vat_rate: form.vat_rate || '0',
      is_active: form.is_active,
    }
    try {
      if (editingId) {
        await posApi.updateCompany(editingId, payload)
        setMessage('Company updated.')
      } else {
        await posApi.createCompany(payload)
        setMessage('Company created.')
      }
      await loadCompanies()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  const deleteCompany = async (company) => {
    if (!window.confirm(`Deactivate ${company.name}?`)) return
    try {
      await posApi.deleteCompany(company.id)
      setMessage('Company deactivated.')
      resetCompany()
      await loadCompanies()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  return (
    <Panel title="Business / Company Setup" icon={FaBuilding}>
      <form onSubmit={submitCompany} className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 border-b border-slate-200">
        <Field label="Business Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
        <Field label="Currency" value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value.toUpperCase() }))} />
        <Field label="VAT / GST Rate" value={form.vat_rate} type="number" onChange={(value) => setForm((current) => ({ ...current, vat_rate: value }))} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
          Active company
        </label>
        <div className="flex items-end gap-2">
          <button disabled={!isSuperAdmin || !form.name} className="inline-flex h-10 items-center px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
            {editingId ? <FaSave className="mr-2" /> : <FaPlus className="mr-2" />}
            {editingId ? 'Save' : 'Create'}
          </button>
          {isSuperAdmin && <button type="button" onClick={resetCompany} className="h-10 px-4 border border-slate-300 rounded-lg text-sm font-semibold">New</button>}
        </div>
        {!isSuperAdmin && <div className="md:col-span-2 xl:col-span-4 text-xs text-slate-500">Only super admins can create or edit companies. Your current company is shown read-only.</div>}
        {message && <div className="md:col-span-2 xl:col-span-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{message}</div>}
      </form>
      {loading ? <div className="p-4 text-sm text-slate-500">Loading companies...</div> : (
        <DenseTable
          columns={['Company', 'Currency', 'VAT', 'Status', 'Actions']}
          rows={companies.map((company) => [
            company.name,
            company.currency,
            `${company.vat_rate}%`,
            <Badge tone={company.is_active ? 'emerald' : 'red'}>{company.is_active ? 'Active' : 'Inactive'}</Badge>,
            <div className="flex gap-1">
              <IconButton label="Edit company" icon={FaEdit} onClick={() => editCompany(company)} />
              {isSuperAdmin && <IconButton label="Deactivate company" icon={FaTrash} tone="danger" onClick={() => deleteCompany(company)} />}
            </div>,
          ])}
          numericColumns={[2]}
        />
      )}
    </Panel>
  )
}

const Branches = () => {
  const { company: authCompany, company_branches: authBranches, isCompanyAdmin, isSuperAdmin, reloadSignal } = useAuth()
  const [branches, setBranches] = useState(authBranches || [])
  const [companies, setCompanies] = useState(authCompany ? [authCompany] : [])
  const [form, setForm] = useState({ ...emptyBranchForm, company: authCompany?.id || '' })
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const canManage = isCompanyAdmin || isSuperAdmin

  const loadBranches = async () => {
    setLoading(true)
    try {
      const [branchData, companyData] = await Promise.all([
        authBranches?.length ? Promise.resolve(authBranches) : posApi.branches(),
        authCompany && !isSuperAdmin ? Promise.resolve([authCompany]) : posApi.companies(),
      ])
      const branchRows = Array.isArray(branchData) ? branchData : branchData?.results || []
      const companyRows = Array.isArray(companyData) ? companyData : companyData?.results || []
      setBranches(branchRows)
      setCompanies(companyRows)
      if (!form.company && companyRows[0]) setForm((current) => ({ ...current, company: companyRows[0].id }))
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [reloadSignal])

  const editBranch = (branch) => {
    setEditingId(branch.id)
    setForm({
      company: branch.company,
      code: branch.code || '',
      name: branch.name || '',
      location: branch.location || '',
      is_active: Boolean(branch.is_active),
      mpesa_stk_enabled: Boolean(branch.mpesa_stk_enabled),
      mpesa_manual_approval_enabled: Boolean(branch.mpesa_manual_approval_enabled),
      mpesa_till_enabled: Boolean(branch.mpesa_till_enabled),
      mpesa_consumer_key: '',
      mpesa_consumer_secret: '',
      mpesa_business_shortcode: '',
      mpesa_passkey: '',
      mpesa_environment: branch.mpesa_environment || 'sandbox',
      mpesa_callback_url: '',
      mpesa_till_number: '',
      mpesa_initiator_name: '',
      mpesa_security_credential: '',
      mpesa_direct_result_url: '',
      mpesa_direct_timeout_url: '',
    })
  }

  const resetBranch = () => {
    setEditingId(null)
    setForm({
      ...emptyBranchForm,
      company: authCompany?.id || companies[0]?.id || '',
      mpesa_stk_enabled: false,
      mpesa_till_enabled: false,
      mpesa_consumer_key: '',
      mpesa_consumer_secret: '',
      mpesa_business_shortcode: '',
      mpesa_passkey: '',
      mpesa_environment: 'sandbox',
      mpesa_callback_url: '',
      mpesa_till_number: '',
      mpesa_initiator_name: '',
      mpesa_security_credential: '',
      mpesa_direct_result_url: '',
      mpesa_direct_timeout_url: '',
    })
  }

  const submitBranch = async (event) => {
    event.preventDefault()
    setMessage('')
    const payload = {
      company: Number(form.company),
      code: form.code.trim(),
      name: form.name.trim(),
      location: form.location.trim(),
      is_active: form.is_active,
      mpesa_stk_enabled: Boolean(form.mpesa_stk_enabled),
      mpesa_manual_approval_enabled: Boolean(form.mpesa_manual_approval_enabled),
      mpesa_till_enabled: Boolean(form.mpesa_till_enabled),
      mpesa_environment: form.mpesa_environment || 'sandbox',
    }
    ;[
      'mpesa_consumer_key',
      'mpesa_consumer_secret',
      'mpesa_business_shortcode',
      'mpesa_passkey',
      'mpesa_callback_url',
      'mpesa_till_number',
      'mpesa_initiator_name',
      'mpesa_security_credential',
      'mpesa_direct_result_url',
      'mpesa_direct_timeout_url',
    ].forEach((field) => {
      const value = form[field]?.trim()
      if (!editingId || value) payload[field] = value || ''
    })
    try {
      if (editingId) {
        await posApi.updateBranch(editingId, payload)
        setMessage('Branch updated.')
      } else {
        await posApi.createBranch(payload)
        setMessage('Branch created.')
      }
      resetBranch()
      await loadBranches()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  const deleteBranch = async (branch) => {
    if (!window.confirm(`Deactivate ${branch.name}?`)) return
    try {
      await posApi.deleteBranch(branch.id)
      setMessage('Branch deactivated.')
      await loadBranches()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  const toggleBranchMpesa = async (branch, field) => {
    const enabled = !Boolean(branch[field])
    const label = field === 'mpesa_stk_enabled'
      ? 'STK'
      : field === 'mpesa_till_enabled'
        ? 'Till fetch'
        : 'manual M-Pesa approval'
    try {
      await posApi.updateBranch(branch.id, { [field]: enabled })
      setMessage(`${label} ${enabled ? 'enabled' : 'disabled'} for ${branch.name}.`)
      await loadBranches()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  return (
    <Panel title="Branch Management" icon={FaWarehouse}>
      <form onSubmit={submitBranch} className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 border-b border-slate-200">
        <Select label="Company" value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} options={companies.map((company) => ({ value: company.id, label: company.name }))} />
        <Field label="Branch Code" value={form.code} onChange={(value) => setForm((current) => ({ ...current, code: value.toUpperCase() }))} />
        <Field label="Branch Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
        <Field label="Location" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
        <Field label="M-Pesa Consumer Key" value={form.mpesa_consumer_key} onChange={(value) => setForm((current) => ({ ...current, mpesa_consumer_key: value }))} />
        <Field label="M-Pesa Consumer Secret" value={form.mpesa_consumer_secret} onChange={(value) => setForm((current) => ({ ...current, mpesa_consumer_secret: value }))} />
        <Field label="M-Pesa Business Shortcode" value={form.mpesa_business_shortcode} onChange={(value) => setForm((current) => ({ ...current, mpesa_business_shortcode: value }))} />
        <Field label="M-Pesa Passkey" value={form.mpesa_passkey} onChange={(value) => setForm((current) => ({ ...current, mpesa_passkey: value }))} />
        <Select label="M-Pesa Environment" value={form.mpesa_environment} onChange={(value) => setForm((current) => ({ ...current, mpesa_environment: value }))} options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'live', label: 'Live' }]} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.mpesa_stk_enabled)} onChange={(event) => setForm((current) => ({ ...current, mpesa_stk_enabled: event.target.checked }))} />
          Enable STK
        </label>
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.mpesa_manual_approval_enabled)} onChange={(event) => setForm((current) => ({ ...current, mpesa_manual_approval_enabled: event.target.checked }))} />
          Enable manual M-Pesa approval
        </label>
        <Field label="M-Pesa Callback URL" value={form.mpesa_callback_url} onChange={(value) => setForm((current) => ({ ...current, mpesa_callback_url: value }))} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.mpesa_till_enabled)} onChange={(event) => setForm((current) => ({ ...current, mpesa_till_enabled: event.target.checked }))} />
          Enable Till Fetch
        </label>
        <Field label="Direct Till Number" value={form.mpesa_till_number} onChange={(value) => setForm((current) => ({ ...current, mpesa_till_number: value }))} />
        <Field label="Direct Till Initiator" value={form.mpesa_initiator_name} onChange={(value) => setForm((current) => ({ ...current, mpesa_initiator_name: value }))} />
        <Field label="Direct Till Security Credential" value={form.mpesa_security_credential} onChange={(value) => setForm((current) => ({ ...current, mpesa_security_credential: value }))} />
        <Field label="Direct Till Result URL" value={form.mpesa_direct_result_url} onChange={(value) => setForm((current) => ({ ...current, mpesa_direct_result_url: value }))} />
        <Field label="Direct Till Timeout URL" value={form.mpesa_direct_timeout_url} onChange={(value) => setForm((current) => ({ ...current, mpesa_direct_timeout_url: value }))} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
          Active branch
        </label>
        <div className="flex items-end gap-2">
          <button disabled={!canManage || !form.company || !form.code || !form.name} className="inline-flex h-10 items-center px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
            {editingId ? <FaSave className="mr-2" /> : <FaPlus className="mr-2" />}
            {editingId ? 'Save' : 'Create'}
          </button>
          {editingId && <button type="button" onClick={resetBranch} className="h-10 px-4 border border-slate-300 rounded-lg text-sm font-semibold">Cancel</button>}
        </div>
        {!canManage && <div className="md:col-span-2 xl:col-span-5 text-xs text-slate-500">Only company admins or super admins can manage branches.</div>}
        {message && <div className="md:col-span-2 xl:col-span-5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{message}</div>}
      </form>
      {loading ? <div className="p-4 text-sm text-slate-500">Loading branches...</div> : (
        <DenseTable
          columns={['Code', 'Branch', 'Company', 'Location', 'M-Pesa', 'Status', 'Actions']}
          rows={branches.map((branch) => {
            const stkEnabled = Boolean(branch.mpesa_stk_enabled)
            const tillEnabled = Boolean(branch.mpesa_till_enabled)
            const mpesaConfigured = Boolean(branch.mpesa_enabled)
            const directConfigured = Boolean(branch.mpesa_direct_enabled)
            const mpesaLabel = [
              stkEnabled ? (mpesaConfigured ? 'STK on' : 'STK incomplete') : 'STK off',
              branch.mpesa_manual_approval_enabled ? 'Manual approval on' : 'Manual approval off',
              tillEnabled ? (directConfigured ? 'Till on' : 'Till incomplete') : 'Till off',
            ].join(' / ')
            const mpesaTone = mpesaConfigured || directConfigured ? 'emerald' : (stkEnabled || tillEnabled ? 'amber' : 'slate')
            return [
              branch.code,
              branch.name,
              branch.company_name || companies.find((company) => company.id === branch.company)?.name || `Company ${branch.company}`,
              branch.location || 'Unassigned',
              <Badge tone={mpesaTone}>{mpesaLabel}</Badge>,
              <Badge tone={branch.is_active ? 'emerald' : 'red'}>{branch.is_active ? 'Active' : 'Inactive'}</Badge>,
              <div className="flex flex-wrap gap-1">
                {canManage && <IconButton label={branch.mpesa_stk_enabled ? 'Disable STK' : 'Enable STK'} icon={branch.mpesa_stk_enabled ? FaTimes : FaCheck} onClick={() => toggleBranchMpesa(branch, 'mpesa_stk_enabled')} />}
                {canManage && <IconButton label={branch.mpesa_manual_approval_enabled ? 'Disable manual approval' : 'Enable manual approval'} icon={branch.mpesa_manual_approval_enabled ? FaTimes : FaCheck} onClick={() => toggleBranchMpesa(branch, 'mpesa_manual_approval_enabled')} />}
                {canManage && <IconButton label={branch.mpesa_till_enabled ? 'Disable Till fetch' : 'Enable Till fetch'} icon={branch.mpesa_till_enabled ? FaTimes : FaCheck} onClick={() => toggleBranchMpesa(branch, 'mpesa_till_enabled')} />}
                <IconButton label="Edit branch" icon={FaEdit} onClick={() => editBranch(branch)} />
                {canManage && <IconButton label="Deactivate branch" icon={FaTrash} tone="danger" onClick={() => deleteBranch(branch)} />}
              </div>,
            ]
          })}
        />
      )}
    </Panel>
  )
}

const emptyUserForm = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  pin: '',
  role: 'cashier',
  access_level: 'branch_staff',
  branch: '',
  company: '',
  custom_permissions: [],
  use_custom_permissions: false,
  is_active: true,
}

const titleCase = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
const formatDateTime = (value) => value ? new Date(value).toLocaleString() : 'Never'
const apiErrorMessage = (error) => {
  const data = error?.data
  if (!data) return error?.message || 'Request failed'
  if (data.detail) return data.detail
  return Object.entries(data).map(([key, value]) => `${titleCase(key)}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' ')
}

const catalogToEntries = (catalog = {}) => {
  if (Array.isArray(catalog)) return catalog
  return Object.entries(catalog).map(([code, meta]) => ({ code, ...(typeof meta === 'object' ? meta : { label: meta }) }))
}

const fallbackCatalogFromRoleOptions = (options = {}) => {
  const codes = new Set()
  Object.values(options.permissions || {}).forEach((permissions) => {
    if (Array.isArray(permissions)) permissions.forEach((code) => code !== '*' && codes.add(code))
  })
  ;(options.role_matrix || []).forEach((row) => {
    ;(row.permissions || []).forEach((code) => code !== '*' && codes.add(code))
  })
  return [...codes].sort().map((code) => ({
    code,
    label: titleCase(code.split('.').pop()),
    module: code.split('.')[0] || 'general',
  }))
}

const FRONTEND_ROLE_DEFAULTS = {
  voiding: ['dashboard.view', 'pos.view', 'sales.view', 'sale.void', 'shift.view'],
}

const FRONTEND_ROLE_OPTIONS = [
  { value: 'voiding', label: 'Voiding' },
]

const FRONTEND_ROLE_BACKEND_ROLE = {
  voiding: 'cashier',
}

const mergeRoleOptions = (options = {}) => {
  const rolesByValue = new Map()
  normalizeOptions(options.roles || []).forEach((role) => rolesByValue.set(role.value, role))
  FRONTEND_ROLE_OPTIONS.forEach((role) => rolesByValue.set(role.value, role))
  return {
    ...options,
    roles: [...rolesByValue.values()],
    permissions: {
      ...FRONTEND_ROLE_DEFAULTS,
      ...(options.permissions || {}),
    },
  }
}

const normalizeOptions = (items = []) => items.map((item) => (
  typeof item === 'string' ? { value: item, label: titleCase(item) } : item
)).filter((item) => item?.value !== undefined && item?.value !== null)

const entityId = (value) => (value && typeof value === 'object' ? value.id : value)
const samePermissions = (left = [], right = []) => {
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.length === rightSorted.length && leftSorted.every((code, index) => code === rightSorted[index])
}

const displayRole = (profile) => {
  if (profile?.role === FRONTEND_ROLE_BACKEND_ROLE.voiding && profile?.use_custom_permissions && samePermissions(profile.custom_permissions, FRONTEND_ROLE_DEFAULTS.voiding)) {
    return 'Voiding'
  }
  return titleCase(profile?.role)
}

const formatBool = (value) => (value ? 'Enabled' : 'Disabled')
const formatLabel = (value = '') => String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const useSettingsSection = (apiKey) => {
  const { company, reloadSignal, can } = useAuth()
  const canEdit = can('admin.settings') || can('*')
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!company?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await posApi.adminSettings({ company: company.id })
      setDraft(response?.[apiKey] || {})
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [company?.id, reloadSignal, apiKey])

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

  const save = async (event) => {
    event?.preventDefault?.()
    if (!canEdit || !company?.id) return
    setSaving(true)
    setMessage('')
    try {
      await posApi.updateAdminSection({ company: company.id, section: apiKey, values: draft })
      setMessage('Settings saved.')
      await load()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return { draft, setField, loading, saving, save, message, canEdit }
}

const SettingsSaveBar = ({ onSave, saving, canEdit, message }) => (
  <div className="p-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
    {message && <p className="text-sm text-slate-700 flex-1 min-w-[12rem]">{message}</p>}
    {!canEdit && <p className="text-xs text-slate-500">Read-only — requires admin.settings permission.</p>}
    <button
      type="button"
      disabled={!canEdit || saving}
      onClick={onSave}
      className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
    >
      <FaSave className="mr-2" />
      {saving ? 'Saving...' : 'Save changes'}
    </button>
  </div>
)

const Toggle = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-center gap-2 text-sm font-semibold text-slate-700 ${disabled ? 'opacity-60' : ''}`}>
    <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    {label}
  </label>
)

const Users = () => {
  const { user: authUser, branch: authBranch, company: authCompany, company_branches: authBranches, reloadSignal, isSuperAdmin, refreshSession } = useAuth()
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState(authBranches || [])
  const [companies, setCompanies] = useState(authCompany ? [authCompany] : [])
  const [roleOptions, setRoleOptions] = useState({ roles: [], access_levels: [] })
  const [form, setForm] = useState({ ...emptyUserForm, branch: authBranch?.id || '', company: authCompany?.id || '' })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const branchMap = useMemo(() => Object.fromEntries(branches.map((branch) => [branch.id, branch])), [branches])
  const companyMap = useMemo(() => Object.fromEntries(companies.map((company) => [company.id, company])), [companies])
  const permissionEntries = useMemo(() => {
    const catalogRows = catalogToEntries(roleOptions.permission_catalog)
    const rows = catalogRows.length ? catalogRows : fallbackCatalogFromRoleOptions(roleOptions)
    const grantableRows = isSuperAdmin ? rows : rows.filter((entry) => !['admin.super', 'admin.company'].includes(entry.code))
    return grantableRows.sort((a, b) => String(a.module || '').localeCompare(String(b.module || '')) || String(a.label || a.code).localeCompare(String(b.label || b.code)))
  }, [isSuperAdmin, roleOptions])
  const permissionGroups = useMemo(() => permissionEntries.reduce((groups, entry) => {
    const key = titleCase(entry.module || 'general')
    groups[key] = [...(groups[key] || []), entry]
    return groups
  }, {}), [permissionEntries])
  const selectedPermissionCount = form.custom_permissions?.length || 0
  const usernameTaken = useMemo(() => {
    const username = form.username.trim().toLowerCase()
    if (!username) return false
    return users.some((profile) => profile.id !== editingId && String(profile.username || '').trim().toLowerCase() === username)
  }, [editingId, form.username, users])
  const allPermissionCodes = useMemo(() => permissionEntries.map((entry) => entry.code), [permissionEntries])
  const visibleBranchesForForm = useMemo(() => {
    if (!form.company) return branches
    return branches.filter((branch) => Number(entityId(branch.company)) === Number(form.company))
  }, [branches, form.company])
  const roles = roleOptions.roles?.length ? roleOptions.roles : [
    { value: 'cashier', label: 'Cashier' },
    { value: 'voiding', label: 'Voiding' },
    { value: 'manager', label: 'Manager' },
    { value: 'inventory', label: 'Inventory Officer' },
    { value: 'admin', label: 'Administrator' },
  ]
  const normalizedRoles = useMemo(() => normalizeOptions(roles), [roles])
  const accessLevels = roleOptions.access_levels?.length ? roleOptions.access_levels : [
    { value: 'branch_staff', label: 'Branch Staff' },
    { value: 'branch_admin', label: 'Branch Admin' },
    { value: 'company_admin', label: 'Company Admin' },
    { value: 'super_admin', label: 'Super Admin' },
  ]
  const normalizedAccessLevels = useMemo(() => normalizeOptions(accessLevels), [accessLevels])
  const saveDisabled = saving || !form.username.trim() || usernameTaken || !form.role || !form.access_level || !form.company || !form.branch || (!editingId && !form.password)

  const loadUsers = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [userRows, branchRows, companyRows, options] = await Promise.all([
        posApi.users(),
        authBranches?.length ? Promise.resolve(authBranches) : posApi.branches(),
        authCompany ? Promise.resolve([authCompany]) : posApi.companies(),
        Promise.all([posApi.userRoleOptions(), posApi.adminRbacCatalog().catch(() => null)]).then(([roleData, catalogData]) => ({
          ...(roleData || {}),
          permission_catalog: catalogData?.catalog || roleData?.permission_catalog || {},
          admin_sections: catalogData?.admin_sections || roleData?.admin_sections || {},
        })).then(mergeRoleOptions),
      ])
      setUsers(Array.isArray(userRows) ? userRows : userRows?.results || [])
      setBranches(Array.isArray(branchRows) ? branchRows : branchRows?.results || [])
      setCompanies(Array.isArray(companyRows) ? companyRows : companyRows?.results || [])
      setRoleOptions(options || {})
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }
  const refreshCurrentSession = async () => {
    try {
      await refreshSession({ force: true })
      window.dispatchEvent(new CustomEvent('pos-rights-updated'))
    } catch {
      // Login verification will handle inactive/expired sessions.
    }
  }

  useEffect(() => {
    loadUsers()
  }, [authBranch?.id, reloadSignal])

  useEffect(() => {
    if (editingId || (!companies.length && !branches.length)) return
    setForm((current) => {
      const nextCompany = current.company || authCompany?.id || companies[0]?.id || ''
      const nextBranch = current.branch
        || authBranch?.id
        || branches.find((branch) => Number(entityId(branch.company)) === Number(nextCompany))?.id
        || branches[0]?.id
        || ''
      if (current.company === nextCompany && current.branch === nextBranch) return current
      return { ...current, company: nextCompany, branch: nextBranch }
    })
  }, [authBranch?.id, authCompany?.id, branches, companies, editingId])

  const setField = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value }
    if (field === 'role' && value !== current.role) {
      if (FRONTEND_ROLE_DEFAULTS[value]) {
        next.custom_permissions = FRONTEND_ROLE_DEFAULTS[value]
        next.use_custom_permissions = true
      } else {
        next.custom_permissions = []
        next.use_custom_permissions = false
      }
    }
    if (field === 'branch') {
      const selectedBranch = branchMap[Number(value)]
      if (selectedBranch) next.company = entityId(selectedBranch.company)
    }
    if (field === 'company') {
      const currentBranch = branchMap[Number(current.branch)]
      if (currentBranch && Number(entityId(currentBranch.company)) !== Number(value)) {
        const firstBranch = branches.find((branch) => Number(entityId(branch.company)) === Number(value))
        next.branch = firstBranch?.id || ''
      }
    }
    return next
  })
  const togglePermission = (code) => setForm((current) => {
    const selected = new Set(current.custom_permissions || [])
    if (selected.has(code)) selected.delete(code)
    else selected.add(code)
    return { ...current, custom_permissions: [...selected].sort(), use_custom_permissions: true }
  })
  const togglePermissionGroup = (entries, checked) => setForm((current) => {
    const selected = new Set(current.custom_permissions || [])
    entries.forEach((entry) => {
      if (checked) selected.add(entry.code)
      else selected.delete(entry.code)
    })
    return { ...current, custom_permissions: [...selected].sort(), use_custom_permissions: true }
  })
  const applyRoleDefaults = () => {
    const defaults = roleOptions.permissions?.[form.role] || []
    const allowedCodes = new Set(allPermissionCodes)
    const nextPermissions = defaults.includes('*')
      ? allPermissionCodes
      : defaults.filter((code) => allowedCodes.has(code))
    setForm((current) => ({ ...current, custom_permissions: nextPermissions, use_custom_permissions: true }))
  }
  const applyAllPermissions = () => {
    setForm((current) => ({ ...current, custom_permissions: allPermissionCodes, use_custom_permissions: true }))
  }
  const followRoleDefaults = () => {
    setForm((current) => ({ ...current, custom_permissions: [], use_custom_permissions: false }))
  }
  const removeAllPermissions = () => {
    setForm((current) => ({ ...current, custom_permissions: [], use_custom_permissions: true }))
  }

  const resetForm = () => {
    setEditingId(null)
    setForm({ ...emptyUserForm, branch: authBranch?.id || branches[0]?.id || '', company: authCompany?.id || companies[0]?.id || '' })
  }

  const editUser = (profile) => {
    const allowedCodes = new Set(allPermissionCodes)
    const profileBranchId = entityId(profile.branch)
    const profileCompanyId = entityId(profile.company) || entityId(branchMap[profileBranchId]?.company)
    const manualPermissions = profile.custom_permissions || []
    const frontendRole = Object.entries(FRONTEND_ROLE_BACKEND_ROLE).find(([, backendRole]) => (
      profile.role === backendRole && profile.use_custom_permissions && samePermissions(manualPermissions, FRONTEND_ROLE_DEFAULTS.voiding)
    ))?.[0]
    setEditingId(profile.id)
    setForm({
      username: profile.username || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      password: '',
      pin: '',
      role: frontendRole || profile.role || 'cashier',
      access_level: profile.access_level || 'branch_staff',
      branch: profileBranchId || '',
      company: profileCompanyId || '',
      custom_permissions: Boolean(profile.use_custom_permissions) ? manualPermissions.filter((code) => allowedCodes.has(code)) : [],
      use_custom_permissions: Boolean(profile.use_custom_permissions),
      is_active: Boolean(profile.is_active),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitUser = async (event) => {
    event?.preventDefault?.()
    if (saving) return
    const username = form.username.trim()
    const frontendRolePermissions = FRONTEND_ROLE_DEFAULTS[form.role]
    const backendRole = FRONTEND_ROLE_BACKEND_ROLE[form.role] || form.role
    const manualOverride = Boolean(form.use_custom_permissions || frontendRolePermissions)
    const customPermissions = frontendRolePermissions || form.custom_permissions || []
    if (!username) {
      setMessage('Enter a username before saving the user.')
      return
    }
    if (usernameTaken) {
      setMessage(`Username "${username}" is already used by another user.`)
      return
    }
    if (!editingId && !form.password) {
      setMessage('Enter a password before creating the user.')
      return
    }
    if (!form.role || !form.access_level || !form.company || !form.branch) {
      setMessage('Select role, access level, company, and branch before saving the user.')
      return
    }
    setSaving(true)
    setMessage('')
    const payload = {
      username,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      role: backendRole,
      access_level: form.access_level,
      branch: form.branch ? Number(form.branch) : null,
      company: form.company ? Number(form.company) : null,
      custom_permissions: manualOverride ? customPermissions : [],
      use_custom_permissions: manualOverride,
      is_active: form.is_active,
    }
    if (form.password) payload.password = form.password
    if (form.pin) payload.pin = form.pin

    try {
      const editingCurrentUser = Boolean(authUser?.id && users.find((profile) => (
        profile.id === editingId && (profile.user === authUser.id || profile.id === authUser.id)
      )))
      if (editingId) {
        await posApi.updateUser(editingId, payload)
        setMessage(manualOverride ? 'User rights updated.' : 'User updated.')
      } else {
        await posApi.createUser(payload)
        setMessage('User created.')
      }
      resetForm()
      await loadUsers()
      if (editingCurrentUser) {
        await refreshCurrentSession()
      }
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleUser = async (profile) => {
    setMessage('')
    try {
      await posApi.updateUser(profile.id, { is_active: !profile.is_active })
      await loadUsers()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  const deleteUser = async (profile) => {
    if (!window.confirm(`Delete ${profile.username}? This removes the POS profile and login account.`)) return
    setMessage('')
    try {
      await posApi.deleteUser(profile.id)
      await loadUsers()
    } catch (error) {
      setMessage(apiErrorMessage(error))
    }
  }

  return (
    <Panel title="User Management" icon={FaUsers}>
      <form onSubmit={submitUser} className="border-b border-slate-200">
        <div className="sticky top-16 z-20 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{editingId ? `Editing ${form.username}` : 'Create user'}</p>
            <p className="text-xs text-slate-500">{form.use_custom_permissions ? `${selectedPermissionCount} custom rights selected` : 'This user will follow the selected role defaults'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editingId && <button type="button" onClick={resetForm} className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-semibold">Cancel</button>}
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {editingId ? <FaSave className="mr-2" /> : <FaPlus className="mr-2" />}
              {saving ? 'Saving...' : editingId ? 'Save user' : 'Create user'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">Account</h3>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} />
                  Active
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Username" value={form.username} onChange={(value) => setField('username', value)} />
                {usernameTaken && <p className="self-end text-xs font-semibold text-red-600 md:col-span-2 xl:col-span-3">This username already exists. Choose a different username or edit the existing user below.</p>}
                <Field label="First Name" value={form.first_name} onChange={(value) => setField('first_name', value)} />
                <Field label="Last Name" value={form.last_name} onChange={(value) => setField('last_name', value)} />
                <Field label="Email" value={form.email} onChange={(value) => setField('email', value)} />
                <Field label={editingId ? 'New Password' : 'Password'} type="password" value={form.password} onChange={(value) => setField('password', value)} />
                <Field label="Cashier PIN" value={form.pin} onChange={(value) => setField('pin', value)} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Role and Scope</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select label="Role" value={form.role} onChange={(value) => setField('role', value)} options={[{ value: '', label: 'Select role' }, ...normalizedRoles]} />
                <Select label="Access Level" value={form.access_level} onChange={(value) => setField('access_level', value)} options={[{ value: '', label: 'Select access level' }, ...normalizedAccessLevels]} />
                <Select label="Company" value={form.company} onChange={(value) => setField('company', value)} options={companies.map((company) => ({ value: company.id, label: company.name }))} disabled={!isSuperAdmin && companies.length <= 1} />
                <Select label="Branch" value={form.branch} onChange={(value) => setField('branch', value)} options={visibleBranchesForForm.map((branch) => ({ value: branch.id, label: branch.name }))} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Access Rights</h3>
                  <p className="text-xs text-slate-500">{form.use_custom_permissions ? 'Custom rights override the selected role.' : 'Role defaults are applied by the backend.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={followRoleDefaults} className={`h-8 rounded border px-3 text-xs font-semibold ${!form.use_custom_permissions ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white'}`}>Follow role</button>
                  <button type="button" disabled={!form.role} onClick={applyRoleDefaults} className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-semibold disabled:opacity-50">Customize from role</button>
                  <button type="button" onClick={applyAllPermissions} className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-semibold">Mark all</button>
                  <button type="button" onClick={removeAllPermissions} className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-semibold">Clear custom</button>
                </div>
              </div>
              {!isSuperAdmin && (
                <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Super Admin and platform company-management rights can only be granted by a super admin.
                </div>
              )}
              {permissionEntries.length === 0 ? (
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No permission catalog was returned by the server.</div>
              ) : (
                <div className={`grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3 ${!form.use_custom_permissions ? 'opacity-60' : ''}`}>
                  {Object.entries(permissionGroups).map(([group, entries]) => {
                    const selectedInGroup = entries.filter((entry) => (form.custom_permissions || []).includes(entry.code)).length
                    const groupChecked = entries.length > 0 && selectedInGroup === entries.length
                    return (
                      <div key={group} className="rounded border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                            <input
                              type="checkbox"
                              checked={groupChecked}
                              disabled={!form.use_custom_permissions}
                              ref={(input) => {
                                if (input) input.indeterminate = selectedInGroup > 0 && !groupChecked
                              }}
                              onChange={(event) => togglePermissionGroup(entries, event.target.checked)}
                            />
                            {group}
                          </label>
                          <span className="text-[10px] font-semibold text-slate-400">{selectedInGroup}/{entries.length}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {entries.map((entry) => (
                            <label key={entry.code} className="flex items-start gap-2 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={(form.custom_permissions || []).includes(entry.code)}
                                disabled={!form.use_custom_permissions}
                                onChange={() => togglePermission(entry.code)}
                                className="mt-0.5"
                              />
                              <span>
                                <span className="block">{entry.label || entry.code}</span>
                                <span className="text-[10px] text-slate-400">{entry.code}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">Save Summary</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p><span className="font-semibold text-slate-800">Role:</span> {titleCase(form.role || 'Not selected')}</p>
              <p><span className="font-semibold text-slate-800">Access:</span> {titleCase(form.access_level || 'Not selected')}</p>
              <p><span className="font-semibold text-slate-800">Company:</span> {companies.find((company) => Number(company.id) === Number(form.company))?.name || 'Not selected'}</p>
              <p><span className="font-semibold text-slate-800">Branch:</span> {visibleBranchesForForm.find((branch) => Number(branch.id) === Number(form.branch))?.name || 'Not selected'}</p>
              <p><span className="font-semibold text-slate-800">Rights:</span> {form.use_custom_permissions ? `${selectedPermissionCount} custom` : 'Role defaults'}</p>
            </div>
            {message && <div className="mt-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>}
          </aside>
        </div>
      </form>
      {loading ? (
        <div className="p-4 text-sm text-slate-500">Loading users...</div>
      ) : (
        <DenseTable
          columns={['User', 'Role', 'Access', 'Rights', 'Branch', 'Company', 'Status', 'Last Login', 'Actions']}
          rows={users.map((profile) => [
            <div><div className="font-semibold text-slate-900">{profile.full_name || profile.username}</div><div className="text-[10px] text-slate-500">{profile.username}</div></div>,
            displayRole(profile),
            titleCase(profile.access_level),
            profile.use_custom_permissions ? `${profile.custom_permissions?.length || 0} manual` : 'Role defaults',
            branchMap[profile.branch]?.name || 'Unassigned',
            companyMap[profile.company]?.name || branchMap[profile.branch]?.company_name || 'Unassigned',
            <Badge tone={profile.is_active ? 'emerald' : 'red'}>{profile.is_active ? 'Active' : 'Suspended'}</Badge>,
            formatDateTime(profile.last_login),
            <div className="flex gap-1">
              <IconButton label="Edit user" icon={FaEdit} onClick={() => editUser(profile)} />
              <button onClick={() => toggleUser(profile)} className="px-2 h-8 rounded border border-slate-300 text-xs font-semibold">{profile.is_active ? 'Suspend' : 'Activate'}</button>
              <IconButton label="Delete user" icon={FaTrash} onClick={() => deleteUser(profile)} tone="danger" />
            </div>,
          ])}
        />
      )}
    </Panel>
  )
}

const RolesPermissions = () => {
  const [options, setOptions] = useState({ roles: [], permissions: {}, role_matrix: [], permission_catalog: {} })
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([posApi.userRoleOptions(), posApi.adminRbacCatalog().catch(() => null)])
      .then(([roleData, catalogData]) => {
        setOptions(mergeRoleOptions({
          ...roleData,
          permission_catalog: catalogData?.catalog || roleData?.permission_catalog || {},
          admin_sections: catalogData?.admin_sections,
        }))
      })
      .catch((error) => setMessage(apiErrorMessage(error)))
  }, [])

  const catalogEntries = useMemo(() => {
    const catalogRows = catalogToEntries(options.permission_catalog)
    return catalogRows.length ? catalogRows : fallbackCatalogFromRoleOptions(options)
  }, [options])

  const roleRows = (options.role_matrix?.length ? options.role_matrix : (options.roles || []).map((role) => ({
    role: role.value,
    role_label: role.label,
    permissions: options.permissions?.[role.value] || [],
    has_all: (options.permissions?.[role.value] || []).includes('*'),
  }))).map((row) => {
    const label = row.role_label || titleCase(row.role)
    const count = row.permission_count ?? (row.permissions?.length || 0)
    return [
      label,
      row.has_all ? <Badge>Full access (*)</Badge> : `${count} permissions`,
      row.has_all ? 'All modules' : (row.permissions || []).slice(0, 8).join(', ') + ((row.permissions?.length || 0) > 8 ? '…' : ''),
    ]
  })

  const catalogRows = catalogEntries.map((entry) => [
    entry.code,
    entry.label || entry.code,
    titleCase(entry.module || 'general'),
  ])

  const sectionRows = Object.entries(options.admin_sections || {}).map(([name, perms]) => [
    name,
    Array.isArray(perms) ? perms.join(', ') : String(perms),
  ])

  return (
    <div className="space-y-4">
      <Panel title="Role Permission Matrix (Backend)" icon={FaShieldAlt}>
        {message && <div className="m-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{message}</div>}
        <p className="px-4 pt-3 text-xs text-slate-500">Admin role grants wildcard (*) — full access to every module and administration section.</p>
        <DenseTable columns={['Role', 'Access', 'Permission codes']} rows={roleRows} />
      </Panel>
      {catalogRows.length > 0 && (
        <Panel title="Permission Catalog" icon={FaShieldAlt}>
          <DenseTable columns={['Code', 'Label', 'Module']} rows={catalogRows} />
        </Panel>
      )}
      {sectionRows.length > 0 && (
        <Panel title="Administration Section Gates" icon={FaShieldAlt}>
          <DenseTable columns={['Section', 'Required permission (any)']} rows={sectionRows} />
        </Panel>
      )}
    </div>
  )
}

const Security = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('security')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading security settings...</div>
  return (
    <Panel title="Security" icon={FaLock}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="PIN login for cashiers" checked={draft.pin_login_enabled} disabled={!canEdit} onChange={(v) => setField('pin_login_enabled', v)} />
        <Toggle label="Two-factor authentication (optional)" checked={draft.two_factor_optional} disabled={!canEdit} onChange={(v) => setField('two_factor_optional', v)} />
        <Toggle label="Device login history" checked={draft.device_history} disabled={!canEdit} onChange={(v) => setField('device_history', v)} />
        <Toggle label="Force logout — admin only" checked={draft.force_logout_admin_only} disabled={!canEdit} onChange={(v) => setField('force_logout_admin_only', v)} />
        <Field label="Auto logout (minutes)" type="number" value={draft.auto_logout_minutes ?? 15} onChange={canEdit ? (v) => setField('auto_logout_minutes', Number(v)) : undefined} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const SystemSettings = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('system')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading system settings...</div>
  return (
    <Panel title="Global System Settings" icon={FaCog}>
      <form onSubmit={save}>
        <FormGrid>
          <Select label="Tax Mode" value={draft.tax_mode || 'inclusive'} onChange={canEdit ? (v) => setField('tax_mode', v) : undefined} options={[{ value: 'inclusive', label: 'Inclusive tax' }, { value: 'exclusive', label: 'Exclusive tax' }]} />
          <Field label="Receipt prefix" value={draft.receipt_prefix || ''} onChange={canEdit ? (v) => setField('receipt_prefix', v) : undefined} />
          <Field label="Invoice prefix" value={draft.invoice_prefix || ''} onChange={canEdit ? (v) => setField('invoice_prefix', v) : undefined} />
          <Field label="Return prefix" value={draft.return_prefix || ''} onChange={canEdit ? (v) => setField('return_prefix', v) : undefined} />
          <Select label="Printer type" value={draft.printer_type || 'thermal_80mm'} onChange={canEdit ? (v) => setField('printer_type', v) : undefined} options={[{ value: 'thermal_80mm', label: 'Thermal 80mm' }, { value: 'thermal_58mm', label: 'Thermal 58mm' }, { value: 'a4', label: 'A4 printer' }]} />
        </FormGrid>
        <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
      </form>
    </Panel>
  )
}

const Operations = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('pos_operations')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading POS operations...</div>
  return (
    <Panel title="POS Operations" icon={FaCashRegister}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Discounts enabled" checked={draft.discounts_enabled} disabled={!canEdit} onChange={(v) => setField('discounts_enabled', v)} />
        <Toggle label="Refunds require manager approval" checked={draft.refunds_manager_approval} disabled={!canEdit} onChange={(v) => setField('refunds_manager_approval', v)} />
        <Toggle label="Credit sales" checked={draft.credit_sales_enabled} disabled={!canEdit} onChange={(v) => setField('credit_sales_enabled', v)} />
        <Toggle label="Layby / installments" checked={draft.layby_enabled} disabled={!canEdit} onChange={(v) => setField('layby_enabled', v)} />
        <Toggle label="Barcode scanning mode" checked={draft.barcode_mode} disabled={!canEdit} onChange={(v) => setField('barcode_mode', v)} />
        <Field label="Max cashier discount %" type="number" value={draft.max_cashier_discount_pct ?? 5} onChange={canEdit ? (v) => setField('max_cashier_discount_pct', Number(v)) : undefined} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const StockControls = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('stock_controls')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading stock controls...</div>
  return (
    <Panel title="Stock Controls" icon={FaWarehouse}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Auto deduct stock on sale" checked={draft.auto_deduct_on_sale} disabled={!canEdit} onChange={(v) => setField('auto_deduct_on_sale', v)} />
        <Toggle label="Branch stock separation" checked={draft.branch_stock_separation} disabled={!canEdit} onChange={(v) => setField('branch_stock_separation', v)} />
        <Toggle label="Transfer approval required" checked={draft.transfer_approval_required} disabled={!canEdit} onChange={(v) => setField('transfer_approval_required', v)} />
        <Toggle label="Low stock alerts" checked={draft.low_stock_alerts} disabled={!canEdit} onChange={(v) => setField('low_stock_alerts', v)} />
        <Toggle label="Stock adjustment approval" checked={draft.stock_adjustment_approval} disabled={!canEdit} onChange={(v) => setField('stock_adjustment_approval', v)} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const AuditLogs = () => {
  const { reloadSignal, company_branches } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const branchMap = useMemo(() => Object.fromEntries((company_branches || []).map((b) => [b.id, b.name])), [company_branches])

  useEffect(() => {
    setLoading(true)
    posApi.auditLogs({ page_size: 100 })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results || []
        setRows(list)
      })
      .catch((error) => setMessage(apiErrorMessage(error)))
      .finally(() => setLoading(false))
  }, [reloadSignal])

  return (
    <Panel title="Critical POS Audit Trail" icon={FaShieldAlt}>
      {message && <div className="m-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</div>}
      {loading ? <div className="p-4 text-sm text-slate-500">Loading audit logs...</div> : (
        <DenseTable
          columns={['User', 'Action', 'Entity', 'Branch', 'Timestamp', 'Notes']}
          rows={rows.map((log) => [
            log.username || 'System',
            log.action,
            log.entity ? `${log.entity}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—',
            branchMap[log.branch] || (log.branch ? `Branch ${log.branch}` : '—'),
            formatDateTime(log.created_at),
            log.notes || '—',
          ])}
        />
      )}
    </Panel>
  )
}

const NOTIFICATION_LABELS = {
  low_stock: 'Low stock alerts',
  daily_sales: 'Daily sales summary',
  refund_alerts: 'Refund alerts',
  suspicious_activity: 'Suspicious activity',
}

const Notifications = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('notifications')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading notifications...</div>

  const updateAlert = (key, field, value) => {
    const current = draft[key] || {}
    setField(key, { ...current, [field]: value })
  }

  const tableRows = Object.entries(NOTIFICATION_LABELS).map(([key, label]) => {
    const alert = draft[key] || {}
    return [
      label,
      <Bool value={alert.sms} />,
      <Bool value={alert.email} />,
      <Bool value={alert.whatsapp} />,
      canEdit ? (
        <input
          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
          value={alert.recipients || ''}
          onChange={(e) => updateAlert(key, 'recipients', e.target.value)}
        />
      ) : (alert.recipients || '—'),
      canEdit ? (
        <div className="flex gap-2 text-[10px]">
          <label><input type="checkbox" checked={Boolean(alert.sms)} onChange={(e) => updateAlert(key, 'sms', e.target.checked)} /> SMS</label>
          <label><input type="checkbox" checked={Boolean(alert.email)} onChange={(e) => updateAlert(key, 'email', e.target.checked)} /> Email</label>
          <label><input type="checkbox" checked={Boolean(alert.whatsapp)} onChange={(e) => updateAlert(key, 'whatsapp', e.target.checked)} /> WhatsApp</label>
        </div>
      ) : null,
    ]
  })

  return (
    <Panel title="Notifications & Alerts" icon={FaBell}>
      <DenseTable columns={['Alert', 'SMS', 'Email', 'WhatsApp', 'Recipients', 'Edit channels']} rows={tableRows} />
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const FinancialControl = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('financial')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading financial controls...</div>
  return (
    <Panel title="Financial Control" icon={FaMoneyBillWave}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Daily cash summaries" checked={draft.daily_cash_summaries} disabled={!canEdit} onChange={(v) => setField('daily_cash_summaries', v)} />
        <Toggle label="Cash drawer tracking" checked={draft.cash_drawer_tracking} disabled={!canEdit} onChange={(v) => setField('cash_drawer_tracking', v)} />
        <Toggle label="End-of-day Z report required" checked={draft.z_report_required} disabled={!canEdit} onChange={(v) => setField('z_report_required', v)} />
        <Toggle label="Cash discrepancy tracking" checked={draft.cash_discrepancy_tracking} disabled={!canEdit} onChange={(v) => setField('cash_discrepancy_tracking', v)} />
        <Field label="Payment methods (comma-separated)" value={draft.payment_methods || ''} onChange={canEdit ? (v) => setField('payment_methods', v) : undefined} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const PricingControl = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('pricing')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading pricing controls...</div>
  return (
    <Panel title="Product & Pricing Control" icon={FaTags}>
      <form onSubmit={save}>
        <FormGrid>
          <Field label="Retail price edits" value={draft.retail_price_edits || ''} onChange={canEdit ? (v) => setField('retail_price_edits', v) : undefined} />
          <Field label="Wholesale price edits" value={draft.wholesale_price_edits || ''} onChange={canEdit ? (v) => setField('wholesale_price_edits', v) : undefined} />
          <Field label="Max cashier discount %" type="number" value={draft.max_cashier_discount_pct ?? 5} onChange={canEdit ? (v) => setField('max_cashier_discount_pct', Number(v)) : undefined} />
          <Field label="Product deactivation" value={draft.product_deactivation || ''} onChange={canEdit ? (v) => setField('product_deactivation', v) : undefined} />
          <Toggle label="Price change workflow" checked={draft.price_change_workflow} disabled={!canEdit} onChange={(v) => setField('price_change_workflow', v)} />
        </FormGrid>
        <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
      </form>
    </Panel>
  )
}

const BackupData = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('backup')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading backup settings...</div>
  return (
    <Panel title="Backup & Data" icon={FaDatabase}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Auto backups enabled" checked={draft.auto_backup_enabled} disabled={!canEdit} onChange={(v) => setField('auto_backup_enabled', v)} />
        <Field label="Auto backup time (HH:MM)" value={draft.auto_backup_time || ''} onChange={canEdit ? (v) => setField('auto_backup_time', v) : undefined} />
        <Toggle label="Manual backup download" checked={draft.manual_download} disabled={!canEdit} onChange={(v) => setField('manual_download', v)} />
        <Toggle label="Restore — admin only" checked={draft.restore_admin_only} disabled={!canEdit} onChange={(v) => setField('restore_admin_only', v)} />
        <Toggle label="CSV / Excel export" checked={draft.csv_export} disabled={!canEdit} onChange={(v) => setField('csv_export', v)} />
        <Field label="Archive transactions after (months)" type="number" value={draft.archive_months ?? 24} onChange={canEdit ? (v) => setField('archive_months', Number(v)) : undefined} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const INTEGRATION_LABELS = {
  mpesa: 'M-Pesa Paybill / Till',
  thermal_printers: 'Thermal printers',
  barcode_scanners: 'Barcode scanners',
  accounting: 'Accounting system',
  api_keys: 'API keys',
}

const Integrations = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('integrations')
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading integrations...</div>

  const setIntegration = (key, field, value) => {
    const current = draft[key] || {}
    setField(key, { ...current, [field]: value })
  }

  const tableRows = Object.entries(INTEGRATION_LABELS).map(([key, label]) => {
    const row = draft[key] || {}
    return [
      label,
      canEdit ? <input className="w-full px-2 py-1 border rounded text-xs" value={row.status || ''} onChange={(e) => setIntegration(key, 'status', e.target.value)} /> : formatLabel(row.status),
      canEdit ? <input className="w-full px-2 py-1 border rounded text-xs" value={row.mode || ''} onChange={(e) => setIntegration(key, 'mode', e.target.value)} /> : formatLabel(row.mode),
      canEdit ? <input className="w-full px-2 py-1 border rounded text-xs" value={row.notes || ''} onChange={(e) => setIntegration(key, 'notes', e.target.value)} /> : (row.notes || '—'),
    ]
  })

  return (
    <Panel title="Integrations" icon={FaExchangeAlt}>
      <DenseTable columns={['Integration', 'Status', 'Mode', 'Notes']} rows={tableRows} />
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const SuperAdmin = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('super_admin')
  const { isSuperAdmin } = useAuth()
  if (loading) return <div className="p-4 text-sm text-slate-500">Loading super admin settings...</div>
  if (!isSuperAdmin) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        Super Admin settings are only available to platform super admins.
      </div>
    )
  }
  return (
    <Panel title="Super Admin Control" icon={FaShieldAlt}>
      <form onSubmit={save} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Manage all businesses" checked={draft.manage_all_businesses} disabled={!canEdit} onChange={(v) => setField('manage_all_businesses', v)} />
        <Toggle label="Suspend / activate companies" checked={draft.suspend_companies} disabled={!canEdit} onChange={(v) => setField('suspend_companies', v)} />
        <Toggle label="View all transactions (read-only)" checked={draft.view_all_transactions} disabled={!canEdit} onChange={(v) => setField('view_all_transactions', v)} />
        <Toggle label="Force logout users" checked={draft.force_logout_users} disabled={!canEdit} onChange={(v) => setField('force_logout_users', v)} />
        <Toggle label="Maintenance mode" checked={draft.maintenance_mode} disabled={!canEdit} onChange={(v) => setField('maintenance_mode', v)} />
      </form>
      <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
    </Panel>
  )
}

const AdminReports = () => (
  <Panel title="Administration Reports" icon={FaFileExcel}>
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
      {['User access report', 'Branch activity report', 'Settings change report'].map((report) => (
        <div key={report} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-900">{report}</p>
          <p className="mt-1 text-xs text-slate-500">Available to users with administration reports access.</p>
        </div>
      ))}
    </div>
  </Panel>
)

const Panel = ({ title, icon: Icon, children }) => (
  <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 flex items-center">
      <Icon className="text-emerald-600 mr-2" />
      <h2 className="font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
)

const DenseTable = ({ columns, rows, numericColumns = [] }) => {
  const base = columns.length > 0 ? 80 / columns.length : 9
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ overflowX: 'auto', maxHeight: '68vh' }}>
        <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'auto', width: '100%' }}>
          <thead className="sticky top-0 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
            <tr>{columns.map((column, index) => <th key={column} style={{ width: numericColumns.includes(index) ? '12%' : 'auto' }} className={`h-8 px-2 border-r border-slate-200 text-left uppercase text-slate-600 ${numericColumns.includes(index) ? 'text-right' : ''}`}>{column}</th>)}</tr>
          </thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className={`${rowIndex % 2 ? 'bg-slate-50' : 'bg-white'} hover:bg-emerald-50`}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ width: numericColumns.includes(cellIndex) ? '12%' : 'auto' }} className={`h-9 px-2 border-r border-b border-slate-200 whitespace-nowrap ${numericColumns.includes(cellIndex) ? 'text-right font-semibold tabular-nums' : ''}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

const FormGrid = ({ children }) => <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>

const Field = ({ label, value, onChange, type = 'text' }) => (
  <label>
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    <input
      type={type}
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      readOnly={!onChange}
      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
    />
  </label>
)

const Select = ({ label, options, value, onChange, disabled = false }) => {
  const normalized = options.map((option) => typeof option === 'string' ? { value: option, label: option } : option)
  return (
    <label>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        disabled={disabled}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-500"
      >
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

const Badge = ({ children, tone = 'emerald' }) => {
  const classes = tone === 'red'
    ? 'bg-red-100 text-red-700'
    : tone === 'amber'
      ? 'bg-amber-100 text-amber-800'
      : tone === 'slate'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-emerald-100 text-emerald-700'
  return <span className={`px-2 py-1 ${classes} rounded text-xs font-semibold`}>{children}</span>
}

const IconButton = ({ label, icon: Icon, onClick, tone = 'default' }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`inline-flex items-center justify-center w-8 h-8 rounded border text-xs ${tone === 'danger' ? 'border-red-200 text-red-700 bg-red-50' : 'border-slate-300 text-slate-700 bg-white'}`}
  >
    <Icon />
  </button>
)

const Bool = ({ value = false }) => <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{value ? <FaCheck /> : <FaTimes />}</span>

const CardGrid = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    {items.map(([title, value]) => <div key={title} className="bg-white rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">{title}</p><p className="mt-2 text-lg font-bold text-slate-900">{value}</p></div>)}
  </div>
)

export default Administration
