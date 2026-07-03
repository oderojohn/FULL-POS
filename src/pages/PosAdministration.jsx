import React, { useEffect, useMemo, useState } from 'react'
import {
  FaBell, FaBuilding, FaCashRegister, FaCheck, FaCheckCircle, FaCloud, FaCog, FaCopy, FaDatabase, FaDownload,
  FaEnvelope, FaExchangeAlt, FaEdit, FaExclamationTriangle, FaFileExcel, FaHdd, FaKey, FaLink, FaLock, FaMemory,
  FaMoneyBillWave, FaPaperPlane, FaPlus, FaSave, FaServer, FaShieldAlt,
  FaSync, FaTachometerAlt, FaTags, FaTimes, FaTimesCircle, FaTrash, FaUnlink, FaUsers, FaWarehouse, FaWifi
} from 'react-icons/fa'
import { useAuth } from '../auth/AuthContext'
import { posApi } from '../api/posApi'
import { SkeletonTable, SkeletonForm, DotLoader } from '../components/LoadingKit'

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
  'Scheduled Reports': {
    icon: FaEnvelope,
    summary: 'Configure automated daily, weekly, and monthly sales report emails per branch. Set recipients, schedule times, and customize report content.',
  },
  Alerts: {
    icon: FaBell,
    summary: 'Administrative alerts and operational exception queues.',
  },
  Settings: {
    icon: FaCog,
    summary: 'General administration settings shortcut.',
  },
  'System Health': {
    icon: FaServer,
    summary: 'Real-time overview of application status, database, storage, CPU, RAM, POS terminals, and synchronization.',
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
      {section === 'Scheduled Reports' && <ScheduledReports />}
      {section === 'Alerts' && <Notifications />}
      {section === 'Settings' && <SystemSettings />}
      {section === 'System Health' && <SystemHealth />}
    </div>
  )
}

const emptyCompanyForm = { name: '', code: '', currency: 'KES', vat_rate: '0', is_active: true }
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
  loyalty_enabled: false,
  loyalty_points_rate: '100',
  credit_sale_enabled: false,
  whatsapp_sms_receipt_enabled: false,
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
      code: form.code.trim().toUpperCase(),
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
        <Field label="Company Code (3 letters)" value={form.code} maxLength={3} onChange={(value) => setForm((current) => ({ ...current, code: value.replace(/[^a-zA-Z]/g, '').toUpperCase() }))} />
        <Field label="Currency" value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value.toUpperCase() }))} />
        <Field label="VAT / GST Rate" value={form.vat_rate} type="number" onChange={(value) => setForm((current) => ({ ...current, vat_rate: value }))} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
          Active company
        </label>
        <div className="flex items-end gap-2">
          <button disabled={!isSuperAdmin || !form.name || form.code.trim().length !== 3} className="inline-flex h-10 items-center px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
            {editingId ? <FaSave className="mr-2" /> : <FaPlus className="mr-2" />}
            {editingId ? 'Save' : 'Create'}
          </button>
          {isSuperAdmin && <button type="button" onClick={resetCompany} className="h-10 px-4 border border-slate-300 rounded-lg text-sm font-semibold">New</button>}
        </div>
        {!isSuperAdmin && <div className="md:col-span-2 xl:col-span-4 text-xs text-slate-500">Only super admins can create or edit companies. Your current company is shown read-only.</div>}
        {message && <div className="md:col-span-2 xl:col-span-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{message}</div>}
      </form>
      {loading ? (
        <>
          <SkeletonForm fields={4} />
          <SkeletonTable rows={4} cols={5} />
        </>
      ) : (
        <DenseTable
          columns={['Company', 'Code', 'Currency', 'VAT', 'Status', 'Actions']}
          rows={companies.map((company) => [
            company.name,
            company.code,
            company.currency,
            `${company.vat_rate}%`,
            <Badge tone={company.is_active ? 'emerald' : 'red'}>{company.is_active ? 'Active' : 'Inactive'}</Badge>,
            <div className="flex gap-1">
              <IconButton label="Edit company" icon={FaEdit} onClick={() => editCompany(company)} />
              {isSuperAdmin && <IconButton label="Deactivate company" icon={FaTrash} tone="danger" onClick={() => deleteCompany(company)} />}
            </div>,
          ])}
          numericColumns={[3]}
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
      loyalty_enabled: Boolean(branch.loyalty_enabled),
      loyalty_points_rate: String(branch.loyalty_points_rate ?? '100'),
      credit_sale_enabled: Boolean(branch.credit_sale_enabled),
      whatsapp_sms_receipt_enabled: Boolean(branch.whatsapp_sms_receipt_enabled),
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
      loyalty_enabled: Boolean(form.loyalty_enabled),
      loyalty_points_rate: form.loyalty_points_rate || '100',
      credit_sale_enabled: Boolean(form.credit_sale_enabled),
      whatsapp_sms_receipt_enabled: Boolean(form.whatsapp_sms_receipt_enabled),
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
    <>
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
          <input type="checkbox" checked={Boolean(form.loyalty_enabled)} onChange={(event) => setForm((current) => ({ ...current, loyalty_enabled: event.target.checked }))} />
          Enable Loyalty Points
        </label>
        <Field label="KES per Loyalty Point" value={form.loyalty_points_rate} type="number" onChange={(value) => setForm((current) => ({ ...current, loyalty_points_rate: value }))} />
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.credit_sale_enabled)} onChange={(event) => setForm((current) => ({ ...current, credit_sale_enabled: event.target.checked }))} />
          Enable Credit Sales
        </label>
        <label className="flex items-center gap-2 mt-5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.whatsapp_sms_receipt_enabled)} onChange={(event) => setForm((current) => ({ ...current, whatsapp_sms_receipt_enabled: event.target.checked }))} />
          Enable WhatsApp/SMS Receipt Sharing
        </label>
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
      {loading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : (
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

    {branches.length > 0 && <PosDevices branches={branches} canManage={canManage} />}
    </>
  )
}

const PosDevices = ({ branches, canManage }) => {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '')
  const [devices, setDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedPackage, setGeneratedPackage] = useState(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')

  const loadDevices = async (branchId) => {
    if (!branchId) return
    setLoadingDevices(true)
    setMessage('')
    try {
      const data = await posApi.listDevices({ branch: branchId })
      setDevices(Array.isArray(data) ? data : [])
    } catch (e) {
      setMessage(apiErrorMessage(e))
    } finally {
      setLoadingDevices(false)
    }
  }

  useEffect(() => {
    if (selectedBranchId) loadDevices(selectedBranchId)
  }, [selectedBranchId])

  const generatePackage = async () => {
    if (!selectedBranchId || generating) return
    setGenerating(true)
    setMessage('')
    setGeneratedPackage(null)
    try {
      const data = await posApi.generatePairingToken(selectedBranchId)
      setGeneratedPackage(data)
    } catch (e) {
      setMessage(apiErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  const copyPackage = async () => {
    if (!generatedPackage) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(generatedPackage, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('Clipboard not available. Select and copy the text manually.')
    }
  }

  const downloadPackage = () => {
    if (!generatedPackage) return
    const blob = new Blob([JSON.stringify(generatedPackage, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const branchName = (generatedPackage.branchName || 'branch').replace(/\s+/g, '-').toLowerCase()
    a.download = `nexa-connection-${branchName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel title="POS Devices" icon={FaWifi}>
      {/* Branch selector + Generate button */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Select
            label="Branch"
            value={selectedBranchId}
            onChange={(val) => { setSelectedBranchId(val); setGeneratedPackage(null) }}
            options={branches.filter(b => b.is_active).map(b => ({ value: b.id, label: b.name }))}
          />
        </div>
        {canManage && (
          <button
            type="button"
            onClick={generatePackage}
            disabled={!selectedBranchId || generating}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {generating ? <FaSync className="animate-spin text-xs" /> : <FaKey className="text-xs" />}
            Generate Connection Package
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => loadDevices(selectedBranchId)}
            disabled={loadingDevices}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            <FaSync className={`text-xs ${loadingDevices ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {message && (
        <div className="m-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</div>
      )}

      {/* Generated connection package */}
      {generatedPackage && (
        <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-100 border-b border-emerald-200 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Connection Package — {generatedPackage.branchName}</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Valid for 60 minutes. Single use. Expires: {new Date(generatedPackage.expiresAt).toLocaleString()}
              </p>
            </div>
            <button type="button" onClick={() => setGeneratedPackage(null)} className="text-emerald-600 hover:text-emerald-800 mt-0.5">
              <FaTimes />
            </button>
          </div>
          <div className="p-4">
            <textarea
              readOnly
              value={JSON.stringify(generatedPackage, null, 2)}
              rows={12}
              className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-xs font-mono bg-white resize-none focus:outline-none"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={copyPackage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                <FaCopy className="text-xs" />
                {copied ? 'Copied!' : 'Copy Package'}
              </button>
              <button
                type="button"
                onClick={downloadPackage}
                className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-800 text-sm font-semibold rounded-lg hover:bg-emerald-100"
              >
                <FaDownload className="text-xs" />
                Download .json
              </button>
            </div>
            <p className="mt-3 text-xs text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2">
              On the Electron POS, go to <strong>Administration → Integrations → Connect to Cloud</strong>, paste this package, then click <strong>Test Connection</strong> → <strong>Connect</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Registered devices table */}
      {loadingDevices ? (
        <SkeletonTable rows={3} cols={6} />
      ) : devices.length === 0 ? (
        <div className="py-10 text-center">
          <FaWifi className="text-slate-300 text-3xl mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No POS devices registered yet</p>
          <p className="text-xs text-slate-400 mt-1">Generate a connection package and paste it into the Electron POS to register the first terminal.</p>
        </div>
      ) : (
        <DenseTable
          columns={['Terminal ID', 'Name', 'Machine', 'App Version', 'Last Seen', 'Status']}
          rows={devices.map((device) => [
            <span key={device.device_uuid} className="font-mono font-semibold text-slate-700">{device.terminal_id || '—'}</span>,
            device.name,
            device.machine_name || '—',
            device.app_version || '—',
            formatDateTime(device.last_seen_at),
            <Badge key={`${device.device_uuid}-s`} tone={device.is_active ? 'emerald' : 'red'}>
              {device.is_active ? 'Active' : 'Inactive'}
            </Badge>,
          ])}
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
  permission_groups: [],
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

const SIDEBAR_NAV = [
  {
    section: 'General',
    items: [
      { label: 'Dashboard', codes: ['dashboard.view'] },
      { label: 'POS Terminal', codes: ['pos.view', 'pos.sell', 'pos.hold', 'shift.open', 'shift.close', 'shift.view'] },
    ],
  },
  {
    section: 'Sales Control',
    items: [
      { label: 'Transactions', codes: ['sales.view'] },
      { label: 'Voids', codes: ['sale.void'] },
      { label: 'Returns & Refunds', codes: ['sale.refund', 'sale.refund.approve'] },
      { label: 'Cash Management', codes: ['cash.manage'] },
      { label: 'Cashier Summary', codes: ['shift.view'] },
      { label: 'Payments', codes: ['sales.payments'] },
      { label: 'Discounts Log', codes: ['sales.discounts', 'sale.discount'] },
      { label: 'Discount Engine', codes: ['admin.pricing', 'sale.discount'] },
      { label: 'Price Scheduler', codes: ['admin.pricing'] },
      { label: 'Customer Sales', codes: ['sales.customer'] },
      { label: 'Reports', codes: ['reports.view', 'reports.export'] },
      { label: 'Audit Logs', codes: ['sales.audit', 'admin.audit'] },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Products & Items', codes: ['inventory.products', 'inventory.view'] },
      { label: 'Purchase Orders', codes: ['purchase_order.create', 'inventory.view'] },
      { label: 'Goods Receiving', codes: ['purchase_order.receive'] },
      { label: 'Stock Management', codes: ['inventory.adjust', 'inventory.view'] },
      { label: 'Stocktake', codes: ['stocktake.manage'] },
      { label: 'Monthly Variance', codes: ['inventory.variance'] },
      { label: 'Warehouses', codes: ['inventory.warehouses'] },
      { label: 'Suppliers', codes: ['inventory.suppliers'] },
      { label: 'Inventory Reports', codes: ['inventory.reports', 'reports.view'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Business Setup', codes: ['admin.company', 'admin.company.view'] },
      { label: 'Branches', codes: ['admin.branches'] },
      { label: 'Users', codes: ['admin.users'] },
      { label: 'Roles & Permissions', codes: ['admin.roles'] },
      { label: 'Security', codes: ['admin.security'] },
      { label: 'System & Module Settings', codes: ['admin.settings'] },
      { label: 'Audit Logs', codes: ['admin.audit'] },
      { label: 'Notifications', codes: ['admin.notifications'] },
      { label: 'Financial Control', codes: ['admin.financial'] },
      { label: 'Pricing Control', codes: ['admin.pricing'] },
      { label: 'Backup & Data', codes: ['admin.backup'] },
      { label: 'Integrations & M-Pesa Logs', codes: ['admin.integrations'] },
      { label: 'Super Admin', codes: ['admin.super'] },
      { label: 'Reports', codes: ['admin.reports'] },
      { label: 'Scheduled Reports', codes: ['admin.scheduled_reports'] },
      { label: 'Alerts', codes: ['alerts.view'] },
      { label: 'Settings', codes: ['settings.view'] },
    ],
  },
]

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
const displayRole = (profile) => titleCase(profile?.role)

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
      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 min-w-[7rem]"
    >
      {saving ? <DotLoader color="white" /> : <><FaSave /><span>Save changes</span></>}
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
  const [tab, setTab] = useState('users') // 'users' | 'roles' | 'groups'
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [branches, setBranches] = useState(authBranches || [])
  const [companies, setCompanies] = useState(authCompany ? [authCompany] : [])
  const [roleOptions, setRoleOptions] = useState({ roles: [], access_levels: [] })
  const [form, setForm] = useState({ ...emptyUserForm, branch: authBranch?.id || '', company: authCompany?.id || '' })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [msgTone, setMsgTone] = useState('error') // 'error' | 'success'
  const [roleModal, setRoleModal] = useState(null) // { id, username, role, access_level }
  const [roleModalSaving, setRoleModalSaving] = useState(false)

  const branchMap = useMemo(() => Object.fromEntries(branches.map((branch) => [branch.id, branch])), [branches])
  const companyMap = useMemo(() => Object.fromEntries(companies.map((company) => [company.id, company])), [companies])
  const usernameTaken = useMemo(() => {
    const username = form.username.trim().toLowerCase()
    if (!username) return false
    return users.some((profile) => profile.id !== editingId && String(profile.pos_username || profile.username || '').trim().toLowerCase() === username)
  }, [editingId, form.username, users])
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
  const saveDisabled = saving || !form.username.trim() || usernameTaken || !form.access_level || !form.company || !form.branch || (!editingId && !form.password) || !(form.permission_groups || []).length

  const loadUsers = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [userRows, branchRows, companyRows, options, groupRows] = await Promise.all([
        posApi.users(),
        authBranches?.length ? Promise.resolve(authBranches) : posApi.branches(),
        authCompany ? Promise.resolve([authCompany]) : posApi.companies(),
        Promise.all([posApi.userRoleOptions(), posApi.adminRbacCatalog().catch(() => null)]).then(([roleData, catalogData]) => ({
          ...(roleData || {}),
          permission_catalog: catalogData?.catalog || roleData?.permission_catalog || {},
          admin_sections: catalogData?.admin_sections || roleData?.admin_sections || {},
        })).then(mergeRoleOptions),
        posApi.permissionGroups(authCompany?.id ? { company: authCompany.id } : {}).catch(() => []),
      ])
      setUsers(Array.isArray(userRows) ? userRows : userRows?.results || [])
      setBranches(Array.isArray(branchRows) ? branchRows : branchRows?.results || [])
      setCompanies(Array.isArray(companyRows) ? companyRows : companyRows?.results || [])
      setRoleOptions(options || {})
      setGroups(Array.isArray(groupRows) ? groupRows : groupRows?.results || [])
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
  const resetForm = () => {
    setEditingId(null)
    setForm({ ...emptyUserForm, branch: authBranch?.id || branches[0]?.id || '', company: authCompany?.id || companies[0]?.id || '' })
  }

  const editUser = (profile) => {
    const profileBranchId = entityId(profile.branch)
    const profileCompanyId = entityId(profile.company) || entityId(branchMap[profileBranchId]?.company)
    setEditingId(profile.id)
    setForm({
      username: profile.pos_username || profile.username || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      password: '',
      pin: '',
      role: profile.role || 'cashier',
      access_level: profile.access_level || 'branch_staff',
      branch: profileBranchId || '',
      company: profileCompanyId || '',
      custom_permissions: [],
      use_custom_permissions: false,
      permission_groups: Array.isArray(profile.permission_groups) ? profile.permission_groups : [],
      is_active: Boolean(profile.is_active),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitUser = async (event) => {
    event?.preventDefault?.()
    if (saving) return
    const username = form.username.trim()
    const backendRole = FRONTEND_ROLE_BACKEND_ROLE[form.role] || form.role
    if (!username) {
      setMsgTone('error'); setMessage('Enter a username before saving the user.')
      return
    }
    if (usernameTaken) {
      setMsgTone('error'); setMessage(`Username "${username}" is already in use.`)
      return
    }
    if (!editingId && !form.password) {
      setMsgTone('error'); setMessage('Enter a password before creating the user.')
      return
    }
    if (!form.role || !form.access_level || !form.company || !form.branch) {
      setMsgTone('error'); setMessage('Select a role, access level, company, and branch before saving.')
      return
    }
    setSaving(true)
    setMessage('')
    const payload = {
      username,
      pos_username: username,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      role: backendRole,
      access_level: form.access_level,
      branch: form.branch ? Number(form.branch) : null,
      company: form.company ? Number(form.company) : null,
      custom_permissions: [],
      use_custom_permissions: false,
      permission_groups: form.permission_groups || [],
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
        setMsgTone('success')
        setMessage('User updated successfully.')
      } else {
        await posApi.createUser(payload)
        setMsgTone('success')
        setMessage('User created successfully.')
      }
      resetForm()
      await loadUsers()
      if (editingCurrentUser) {
        await refreshCurrentSession()
      }
    } catch (error) {
      setMsgTone('error')
      setMessage(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleUser = async (profile) => {
    setMessage('')
    try {
      await posApi.updateUser(profile.id, { is_active: !profile.is_active })
      setMsgTone('success')
      setMessage(`${profile.username} ${profile.is_active ? 'suspended' : 'activated'}.`)
      await loadUsers()
    } catch (error) {
      setMsgTone('error')
      setMessage(apiErrorMessage(error))
    }
  }

  const deleteUser = async (profile) => {
    if (!window.confirm(`Delete ${profile.username}? This removes the POS profile and login account.`)) return
    setMessage('')
    try {
      await posApi.deleteUser(profile.id)
      setMsgTone('success')
      setMessage(`${profile.username} deleted.`)
      await loadUsers()
    } catch (error) {
      setMsgTone('error')
      setMessage(apiErrorMessage(error))
    }
  }

  const openRoleModal = (profile) => {
    setRoleModal({ id: profile.id, username: profile.username, access_level: profile.access_level || 'branch_staff' })
  }

  const saveRoleChange = async () => {
    if (!roleModal || roleModalSaving) return
    setRoleModalSaving(true)
    try {
      await posApi.updateUser(roleModal.id, { access_level: roleModal.access_level })
      setMsgTone('success')
      setMessage(`Access level updated for ${roleModal.username}.`)
      setRoleModal(null)
      await loadUsers()
    } catch (error) {
      setMsgTone('error')
      setMessage(apiErrorMessage(error))
      setRoleModal(null)
    } finally {
      setRoleModalSaving(false)
    }
  }

  return (
    <>
    {/* Access Level quick-change modal */}
    {roleModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRoleModal(null)}>
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Change Access Level</p>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">{roleModal.username}</p>
            </div>
            <button type="button" onClick={() => setRoleModal(null)} className="text-slate-400 hover:text-slate-600"><FaTimes /></button>
          </div>
          <div className="space-y-3 px-5 py-4">
            <Select label="Access Level" value={roleModal.access_level} onChange={(v) => setRoleModal((r) => ({ ...r, access_level: v }))} options={normalizedAccessLevels} />
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Access level controls admin privileges. Permissions are always defined by the user's assigned role groups.
            </p>
          </div>
          <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={() => setRoleModal(null)} className="flex-1 h-9 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={saveRoleChange} disabled={roleModalSaving} className="flex-1 h-9 rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700">
              {roleModalSaving ? <DotLoader color="white" /> : <><FaCheck className="text-xs" />Save</>}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button type="button" onClick={() => setTab('users')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Users
        </button>
        <button type="button" onClick={() => setTab('groups')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'groups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Role Groups
        </button>
        <button type="button" onClick={() => setTab('roles')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Roles &amp; Rights
        </button>
      </div>

      {tab === 'users' && (
        <Panel title={editingId ? `Edit User — ${form.username}` : 'Create New User'} icon={FaUsers}>
          <form onSubmit={submitUser}>
            {/* Feedback banner */}
            {message && (
              <div className={`mx-4 mt-3 rounded-lg border px-4 py-3 text-sm font-medium flex items-start gap-2 ${msgTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="flex-1">{message}</span>
                <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100"><FaTimes className="text-xs" /></button>
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Account details */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Account Details</h3>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)} className="h-3.5 w-3.5 rounded" />
                    Active
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Field label="POS Username *" value={form.username} onChange={(v) => setField('username', v)} />
                    {usernameTaken && <p className="mt-1 text-xs font-semibold text-red-600">Username already in use.</p>}
                  </div>
                  <Field label="First Name" value={form.first_name} onChange={(v) => setField('first_name', v)} />
                  <Field label="Last Name" value={form.last_name} onChange={(v) => setField('last_name', v)} />
                  <Field label="Email" value={form.email} onChange={(v) => setField('email', v)} />
                  <Field label={editingId ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={form.password} onChange={(v) => setField('password', v)} />
                  <Field label="Cashier PIN (4–6 digits)" value={form.pin} onChange={(v) => setField('pin', v)} />
                </div>
              </div>

              {/* Scope */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Branch Assignment</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Select label="Access Level *" value={form.access_level} onChange={(v) => setField('access_level', v)} options={[{ value: '', label: 'Select level…' }, ...normalizedAccessLevels]} />
                  <Select label="Company *" value={form.company} onChange={(v) => setField('company', v)} options={companies.map((c) => ({ value: c.id, label: c.name }))} disabled={!isSuperAdmin && companies.length <= 1} />
                  <Select label="Branch *" value={form.branch} onChange={(v) => setField('branch', v)} options={[{ value: '', label: visibleBranchesForForm.length ? 'Select branch…' : 'No branches' }, ...visibleBranchesForForm.map((b) => ({ value: b.id, label: b.name }))]} />
                </div>
              </div>

              {/* Access Rights — Role Groups required */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Role Groups <span className="text-red-500">*</span></h3>
                  <button type="button" onClick={() => setTab('groups')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Manage role groups →</button>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  {groups.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No groups defined. Create groups in the "Rights Groups" tab first, then assign them here.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {groups.map((group) => {
                        const isSelected = (form.permission_groups || []).includes(group.id)
                        return (
                          <label key={group.id} className={`flex items-start gap-2 text-xs font-medium cursor-pointer rounded-lg border p-2.5 transition ${isSelected ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const selected = new Set(form.permission_groups || [])
                                if (selected.has(group.id)) selected.delete(group.id)
                                else selected.add(group.id)
                                setField('permission_groups', [...selected])
                              }}
                              className="mt-0.5 accent-emerald-600"
                            />
                            <span>
                              <span className="block font-semibold">{group.name}</span>
                              {group.description && <span className="block text-[10px] text-slate-400">{group.description}</span>}
                              <span className={`block text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>{(group.permissions || []).length} rights</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {(form.permission_groups || []).length > 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                      {(form.permission_groups || []).length} group{(form.permission_groups || []).length !== 1 ? 's' : ''} assigned — rights come from these groups only.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      At least one role group must be assigned.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky footer actions */}
            <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="text-xs text-slate-500">
                {!form.username.trim() ? 'Enter a username to continue.' :
                 usernameTaken ? 'Username already taken.' :
                 !form.access_level ? 'Select an access level.' :
                 !form.branch ? 'Select a branch.' :
                 (!editingId && !form.password) ? 'Set a password for new accounts.' :
                 !(form.permission_groups || []).length ? 'Assign at least one role group.' :
                 `${form.permission_groups.length} group${form.permission_groups.length !== 1 ? 's' : ''} assigned`}
              </div>
              <div className="flex gap-2">
                {editingId && (
                  <button type="button" onClick={resetForm} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={saveDisabled}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <DotLoader color="white" /> : editingId ? <><FaSave className="text-xs" />Save Changes</> : <><FaPlus className="text-xs" />Create User</>}
                </button>
              </div>
            </div>
          </form>
        </Panel>
      )}

      {tab === 'users' && (
        <Panel title="All Users" icon={FaUsers}>
          {loading ? <SkeletonTable rows={6} cols={5} /> : (
            users.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No users found. Create the first user above.</div>
            ) : (
              <DenseTable
                columns={['User', 'Access Level', 'Role Groups', 'Branch', 'Status', 'Last Login', 'Actions']}
                rows={users.map((profile) => [
                  <div key={profile.id}>
                    <div className="font-semibold text-slate-900">{profile.full_name || profile.username}</div>
                    <div className="text-[10px] text-slate-500">{profile.pos_username || profile.username}</div>
                  </div>,
                  titleCase(profile.access_level),
                  (profile.permission_groups || []).length > 0
                    ? <Badge tone="amber">{profile.permission_groups.length} group{profile.permission_groups.length !== 1 ? 's' : ''}</Badge>
                    : <Badge tone="red">No group</Badge>,
                  branchMap[entityId(profile.branch)]?.name || <span className="text-slate-400">—</span>,
                  <Badge key={`${profile.id}-s`} tone={profile.is_active ? 'emerald' : 'red'}>{profile.is_active ? 'Active' : 'Suspended'}</Badge>,
                  formatDateTime(profile.last_login),
                  <div key={`${profile.id}-a`} className="flex gap-1 items-center">
                    <button onClick={() => openRoleModal(profile)} className="h-7 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Level</button>
                    <IconButton label="Edit" icon={FaEdit} onClick={() => { setTab('users'); editUser(profile) }} />
                    <button onClick={() => toggleUser(profile)} className="h-7 px-2 rounded-md border border-slate-300 text-xs font-semibold hover:bg-slate-50">{profile.is_active ? 'Suspend' : 'Activate'}</button>
                    <IconButton label="Delete" icon={FaTrash} onClick={() => deleteUser(profile)} tone="danger" />
                  </div>,
                ])}
              />
            )
          )}
        </Panel>
      )}

      {tab === 'groups' && (
        <PermissionGroupsManager
          company={authCompany}
          isSuperAdmin={isSuperAdmin}
          onGroupsChanged={loadUsers}
        />
      )}

      {tab === 'roles' && (
        <RolesPermissions />
      )}
    </div>
    </>
  )
}

const PermissionGroupsManager = ({ company, isSuperAdmin, onGroupsChanged }) => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [msgTone, setMsgTone] = useState('error')

  const navTree = isSuperAdmin
    ? SIDEBAR_NAV
    : SIDEBAR_NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.codes.some((c) => ['admin.super', 'admin.company'].includes(c))),
      })).filter((section) => section.items.length > 0)

  const loadGroups = async () => {
    setLoading(true)
    try {
      const data = await posApi.permissionGroups(company?.id ? { company: company.id } : {})
      setGroups(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      setMsgTone('error'); setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGroups() }, [company?.id])

  const openCreate = () => setFormState({ name: '', description: '', permissions: [], company: company?.id })
  const openEdit = (group) => setFormState({ ...group, permissions: [...(group.permissions || [])] })
  const cancelForm = () => { setFormState(null); setMessage('') }
  const setFormField = (key, value) => setFormState((f) => ({ ...f, [key]: value }))

  const isItemChecked = (item) => item.codes.every((c) => (form?.permissions || []).includes(c))
  const isItemIndeterminate = (item) => !isItemChecked(item) && item.codes.some((c) => (form?.permissions || []).includes(c))
  const isSectionChecked = (section) => section.items.length > 0 && section.items.every((i) => isItemChecked(i))
  const isSectionIndeterminate = (section) => !isSectionChecked(section) && section.items.some((i) => isItemChecked(i))
  const selectedCount = form ? navTree.reduce((n, s) => n + s.items.filter((i) => isItemChecked(i)).length, 0) : 0
  const totalCount = navTree.reduce((n, s) => n + s.items.length, 0)

  const toggleSidebarItem = (item) => {
    setFormState((f) => {
      const perms = new Set(f.permissions || [])
      const checked = item.codes.every((c) => perms.has(c))
      if (checked) {
        const otherCodes = new Set()
        navTree.forEach((sec) => sec.items.forEach((i) => {
          if (i !== item && i.codes.every((c) => perms.has(c))) i.codes.forEach((c) => otherCodes.add(c))
        }))
        item.codes.forEach((c) => { if (!otherCodes.has(c)) perms.delete(c) })
      } else {
        item.codes.forEach((c) => perms.add(c))
      }
      return { ...f, permissions: [...perms].sort() }
    })
  }

  const toggleSection = (section, checked) => setFormState((f) => {
    const perms = new Set(f.permissions || [])
    section.items.forEach((item) => item.codes.forEach((c) => checked ? perms.add(c) : perms.delete(c)))
    return { ...f, permissions: [...perms].sort() }
  })

  const saveGroup = async () => {
    if (!form || saving) return
    if (!form.name.trim()) { setMsgTone('error'); setMessage('Group name is required.'); return }
    setSaving(true); setMessage('')
    try {
      const payload = { name: form.name.trim(), description: form.description || '', permissions: form.permissions || [], company: company?.id }
      if (form.id) {
        await posApi.updatePermissionGroup(form.id, payload)
        setMsgTone('success'); setMessage(`Group "${payload.name}" updated.`)
      } else {
        await posApi.createPermissionGroup(payload)
        setMsgTone('success'); setMessage(`Group "${payload.name}" created.`)
      }
      setFormState(null)
      await loadGroups()
      if (onGroupsChanged) onGroupsChanged()
    } catch (error) {
      setMsgTone('error'); setMessage(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const deleteGroup = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"?\n\nUsers assigned to this group will lose these permissions.`)) return
    try {
      await posApi.deletePermissionGroup(group.id)
      setMsgTone('success'); setMessage(`Group "${group.name}" deleted.`)
      await loadGroups()
      if (onGroupsChanged) onGroupsChanged()
    } catch (error) {
      setMsgTone('error'); setMessage(apiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium flex items-start gap-2 ${msgTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="flex-1">{message}</span>
          <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100"><FaTimes className="text-xs" /></button>
        </div>
      )}

      {form && (
        <Panel title={form.id ? `Edit Group — ${form.name || '…'}` : 'Create Role Group'} icon={FaShieldAlt}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-600">Group Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setFormField('name', e.target.value)}
                  placeholder="e.g. Cashiers, Supervisors, Stock Team"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-600">Description</label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={(e) => setFormField('description', e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Sidebar Access — {selectedCount} of {totalCount} areas
                </h4>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setFormState((f) => ({ ...f, permissions: [...new Set(navTree.flatMap((s) => s.items.flatMap((i) => i.codes)))].sort() }))}
                    className="h-6 rounded border border-slate-300 px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Select all
                  </button>
                  <button type="button"
                    onClick={() => setFormState((f) => ({ ...f, permissions: [] }))}
                    className="h-6 rounded border border-slate-300 px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {navTree.map((section) => {
                  const secChecked = isSectionChecked(section)
                  const secIndet = isSectionIndeterminate(section)
                  return (
                    <div key={section.section} className="rounded-lg border border-slate-200 overflow-hidden">
                      <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b font-bold text-[11px] uppercase tracking-wide transition ${secChecked ? 'bg-emerald-600 border-emerald-600 text-white' : secIndet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={secChecked}
                          ref={(el) => { if (el) el.indeterminate = secIndet }}
                          onChange={(e) => toggleSection(section, e.target.checked)}
                          className="accent-emerald-600"
                        />
                        {section.section}
                      </label>
                      <div className="divide-y divide-slate-100">
                        {section.items.map((item) => {
                          const checked = isItemChecked(item)
                          const indet = isItemIndeterminate(item)
                          return (
                            <label key={item.label} className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition select-none ${checked ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                ref={(el) => { if (el) el.indeterminate = indet }}
                                onChange={() => toggleSidebarItem(item)}
                                className="accent-emerald-600 shrink-0"
                              />
                              {item.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <button type="button" onClick={cancelForm} className="flex-1 h-9 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={saveGroup} disabled={saving || !form.name.trim()}
              className="flex-1 h-9 rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700">
              {saving ? <DotLoader color="white" /> : form.id ? <><FaSave className="text-xs" />Save Changes</> : <><FaPlus className="text-xs" />Create Group</>}
            </button>
          </div>
        </Panel>
      )}

      <Panel title="Role Groups" icon={FaShieldAlt}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Each group defines which sidebar areas members can access. Assign groups to users from the Users tab.</p>
          {!form && (
            <button type="button" onClick={openCreate}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
              <FaPlus className="text-[10px]" />New Group
            </button>
          )}
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No role groups yet. Click &ldquo;New Group&rdquo; to create one.</div>
        ) : (
          <DenseTable
            columns={['Group Name', 'Description', 'Access Areas', 'Members', 'Actions']}
            rows={groups.map((group) => {
              const groupPerms = new Set(group.permissions || [])
              const areaCount = SIDEBAR_NAV.reduce((n, s) => n + s.items.filter((i) => i.codes.every((c) => groupPerms.has(c))).length, 0)
              return [
                <span key={group.id} className="font-semibold text-slate-900">{group.name}</span>,
                group.description || <span className="text-slate-400 text-xs">—</span>,
                <Badge key={`${group.id}-p`} tone="blue">{areaCount} area{areaCount !== 1 ? 's' : ''}</Badge>,
                <span key={`${group.id}-m`} className="text-slate-600 text-xs">{group.member_count ?? 0} user{(group.member_count ?? 0) !== 1 ? 's' : ''}</span>,
                <div key={`${group.id}-a`} className="flex gap-1">
                  <IconButton label="Edit group" icon={FaEdit} onClick={() => openEdit(group)} />
                  <IconButton label="Delete group" icon={FaTrash} tone="danger" onClick={() => deleteGroup(group)} />
                </div>,
              ]
            })}
          />
        )}
      </Panel>
    </div>
  )
}

const RolesPermissions = () => {
  const [options, setOptions] = useState({ roles: [], permissions: {}, role_matrix: [] })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([posApi.userRoleOptions(), posApi.adminRbacCatalog().catch(() => null)])
      .then(([roleData, catalogData]) => {
        setOptions(mergeRoleOptions({
          ...roleData,
          permission_catalog: catalogData?.catalog || roleData?.permission_catalog || {},
          admin_sections: catalogData?.admin_sections || roleData?.admin_sections || {},
        }))
      })
      .catch((error) => setMessage(apiErrorMessage(error)))
      .finally(() => setLoading(false))
  }, [])

  const roleMatrix = options.role_matrix?.length
    ? options.role_matrix
    : (options.roles || []).map((role) => ({
        role: role.value,
        role_label: role.label,
        permissions: options.permissions?.[role.value] || [],
        has_all: (options.permissions?.[role.value] || []).includes('*'),
      }))

  return (
    <div className="space-y-4">
      {message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}
      <Panel title="Default Role Access" icon={FaShieldAlt}>
        <p className="px-4 pt-3 pb-1 text-xs text-slate-500">
          Built-in roles and the sidebar areas they can access by default. Assign a <strong>Role Group</strong> to a user to override these with a custom set.
        </p>
        {loading ? (
          <SkeletonTable rows={4} cols={2} />
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {roleMatrix.filter((r) => r.role !== 'voiding').map((row) => {
              const label = row.role_label || titleCase(row.role)
              const hasAll = row.has_all || (row.permissions || []).includes('*')
              const roleCodes = new Set(row.permissions || [])
              return (
                <div key={row.role} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-700">
                    <span className="text-xs font-bold uppercase tracking-wide text-white">{label}</span>
                    {hasAll && <span className="ml-2 text-[10px] font-semibold text-emerald-300">Full Access</span>}
                  </div>
                  {hasAll ? (
                    <div className="px-3 py-4 text-xs text-slate-500 italic">All sidebar areas accessible.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {SIDEBAR_NAV.flatMap((section) =>
                        section.items
                          .filter((item) => item.codes.some((c) => roleCodes.has(c)))
                          .map((item) => (
                            <div key={`${row.role}-${item.label}`} className="px-3 py-1.5 flex items-center gap-2 text-xs text-slate-700">
                              <FaCheck className="text-emerald-500 shrink-0 text-[10px]" />
                              {item.label}
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
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

const SYNC_RESOURCES = ['products', 'categories', 'customers', 'sales']
const RESOURCE_LABELS = { products: 'Products', categories: 'Categories', customers: 'Customers', sales: 'Sales (push)' }

const CloudSyncCard = ({ company }) => {
  const [cloudUrl, setCloudUrl] = useState('')
  const [branchId, setBranchId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connected, setConnected] = useState(false)
  const [connectedCompany, setConnectedCompany] = useState('')
  const [reconnecting, setReconnecting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [message, setMessage] = useState(null)
  const [syncData, setSyncData] = useState(null)   // response from /sync/status/
  const [syncing, setSyncing] = useState(false)
  const pollRef = React.useRef(null)

  useEffect(() => {
    posApi.adminSettings({ company: company?.id })
      .then((data) => {
        const cfg = data?.cloud_config || {}
        setCloudUrl(cfg.cloud_api_url || '')
        setBranchId(cfg.branch_id || '')
        setConnected(!!(cfg.cloud_sync_token && cfg.cloud_sync_token !== ''))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [company?.id])

  // Load sync status once connected; poll while running
  useEffect(() => {
    if (!connected || reconnecting) return
    const load = () => posApi.syncStatus().then(setSyncData).catch(() => {})
    load()
    return () => clearInterval(pollRef.current)
  }, [connected, reconnecting])

  const startPoll = () => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      posApi.syncStatus().then((d) => {
        setSyncData(d)
        if (!d.running) { clearInterval(pollRef.current); setSyncing(false) }
      }).catch(() => {})
    }, 1500)
  }

  const showMsg = (type, text) => setMessage({ type, text })
  const clearMsg = () => setMessage(null)

  const handleConnect = async () => {
    clearMsg()
    setTestResult(null)
    if (!cloudUrl.trim()) { showMsg('err', 'Cloud API URL is required.'); return }
    if (!username.trim() || !password) { showMsg('err', 'Cloud admin username and password are required.'); return }
    setBusy(true)
    try {
      const res = await posApi.cloudConnect({ company: company?.id, cloud_api_url: cloudUrl.trim(), username, password, branch_id: branchId })
      setConnected(true)
      setReconnecting(false)
      setConnectedCompany(res.cloud_company || '')
      setUsername('')
      setPassword('')
      showMsg('ok', `Connected to "${res.cloud_company || cloudUrl}" as ${res.cloud_user} (${res.latency_ms}ms)`)
    } catch (e) {
      showMsg('err', apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    clearMsg()
    setTestResult(null)
    setBusy(true)
    try {
      const res = await posApi.cloudTest(company?.id)
      setTestResult({ ok: res.connected, latency_ms: res.latency_ms, detail: res.detail })
      if (res.connected) showMsg('ok', `Connection OK — ${res.latency_ms}ms`)
      else showMsg('err', res.detail || 'Connection failed.')
    } catch (e) {
      showMsg('err', apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    clearMsg()
    setTestResult(null)
    setBusy(true)
    try {
      await posApi.updateAdminSection({
        company: company?.id,
        section: 'cloud_config',
        values: { cloud_api_url: cloudUrl, cloud_sync_token: '', branch_id: branchId },
      })
      setConnected(false)
      setConnectedCompany('')
      setReconnecting(false)
      showMsg('ok', 'Disconnected from cloud.')
    } catch (e) {
      showMsg('err', apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveBranchId = async () => {
    clearMsg()
    setBusy(true)
    try {
      await posApi.updateAdminSection({
        company: company?.id,
        section: 'cloud_config',
        values: { branch_id: branchId },
      })
      showMsg('ok', 'Branch ID saved.')
    } catch (e) {
      showMsg('err', apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async () => {
    clearMsg()
    setSyncing(true)
    try {
      await posApi.syncTrigger()
      startPoll()
    } catch (e) {
      setSyncing(false)
      showMsg('err', apiErrorMessage(e))
    }
  }

  if (!loaded) return null

  const isConnected = connected && !reconnecting
  const statesByResource = {}
  if (syncData?.states) {
    for (const s of syncData.states) statesByResource[s.resource] = s
  }
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString() : 'Never'

  return (
    <Panel title="Cloud Connection" icon={FaCloud}>
      <div className="p-5 space-y-4">
        {message && (
          <div className={`flex items-start gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {message.type === 'ok' ? <FaCheck className="mt-0.5 shrink-0" /> : <FaExclamationTriangle className="mt-0.5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {isConnected ? (
          <div className="space-y-4">
            {/* Connection badge */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <FaLink />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-900">Connected</span>
                  {connectedCompany && <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{connectedCompany}</span>}
                </div>
                <p className="text-xs text-emerald-600 truncate mt-0.5">{cloudUrl}</p>
              </div>
              {testResult?.ok && (
                <span className="text-xs font-mono text-emerald-700 bg-emerald-100 px-2 py-1 rounded">{testResult.latency_ms}ms</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || busy}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <FaSync className={`text-xs ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={busy || syncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <FaWifi className="text-xs" />
                {busy ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={() => { setReconnecting(true); clearMsg() }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
              >
                Reconnect
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <FaUnlink className="text-xs" />
                Disconnect
              </button>
            </div>

            {/* Sync status table */}
            {syncData && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Sync Status</span>
                  {syncData.running && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <FaSync className="animate-spin" /> Syncing…
                    </span>
                  )}
                  {syncData.finished_at && !syncData.running && (
                    <span className="text-xs text-slate-400">Last run: {fmtTime(syncData.finished_at)}</span>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-3 py-1.5 text-slate-500 font-semibold">Resource</th>
                      <th className="text-left px-3 py-1.5 text-slate-500 font-semibold">Last Synced</th>
                      <th className="text-right px-3 py-1.5 text-slate-500 font-semibold">↓ Downloaded</th>
                      <th className="text-right px-3 py-1.5 text-slate-500 font-semibold">↑ Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYNC_RESOURCES.map((r) => {
                      const s = statesByResource[r]
                      return (
                        <tr key={r} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-1.5 font-medium text-slate-700">{RESOURCE_LABELS[r]}</td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {s ? fmtTime(s.last_synced_at) : '—'}
                            {s?.last_error && <span className="ml-1 text-red-500" title={s.last_error}>⚠</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{s ? s.total_in.toLocaleString() : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{s ? s.total_out.toLocaleString() : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {syncData.last_result?.errors?.length > 0 && (
                  <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                    {syncData.last_result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Branch ID */}
            <div className="pt-1 border-t border-slate-100">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Branch ID <span className="font-normal text-slate-400">(optional — limits sync to this branch)</span></span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    placeholder="Leave blank to sync all branches"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBranchId}
                    disabled={busy}
                    className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {reconnecting && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <FaSync className="text-amber-500" />
                  <span className="font-medium">Re-entering credentials to reconnect</span>
                </div>
                <button type="button" onClick={() => { setReconnecting(false); clearMsg() }} className="text-xs text-amber-600 hover:text-amber-800 underline">
                  Cancel
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Enter your cloud instance URL and admin credentials. The token is fetched automatically — your password is never stored.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Cloud API URL</span>
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://your-cloud-app.vercel.app"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Cloud Admin Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Cloud Admin Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Branch ID <span className="font-normal text-slate-400">(optional)</span></span>
                <input
                  type="text"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  placeholder="Leave blank to sync all branches"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <FaCloud className="text-xs" />
              {busy ? 'Connecting…' : 'Connect to Cloud'}
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}

const Integrations = () => {
  const { draft, setField, loading, saving, save, message, canEdit } = useSettingsSection('integrations')
  const { company: authCompany } = useAuth()
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
    <div className="space-y-6">
      <Panel title="Integrations" icon={FaExchangeAlt}>
        <DenseTable columns={['Integration', 'Status', 'Mode', 'Notes']} rows={tableRows} />
        <SettingsSaveBar onSave={save} saving={saving} canEdit={canEdit} message={message} />
      </Panel>

      {/* Cloud Connection via Connection Package (Electron POS) */}
      <Panel title="Connect to Cloud" icon={FaCloud}>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <FaKey />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Connection Package Method</h3>
              <p className="text-xs text-slate-500 mt-1">
                For Electron POS terminals: generate a connection package from <strong>Administration → Branches → POS Devices</strong>,
                then paste it into the POS Connection screen below. The package is single-use and expires in 60 minutes.
              </p>
              <a
                href="/connect"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                <FaLink className="text-xs" />
                Open POS Connection Screen
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <CloudSyncCard company={authCompany} />
    </div>
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
    {(title || Icon) && (
      <div className="px-4 py-3 border-b border-slate-200 flex items-center">
        {Icon && <Icon className="text-emerald-600 mr-2" />}
        {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
      </div>
    )}
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

// ─── Email Settings Card ─────────────────────────────────────────────────────

const EMPTY_EMAIL_CFG = {
  backend: 'smtp',
  host: '',
  port: 587,
  use_tls: true,
  username: '',
  password: '',
  from_email: '',
  from_name: 'Nexa POS',
}

const EmailSettingsCard = ({ company }) => {
  const [cfg, setCfg] = useState(EMPTY_EMAIL_CFG)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    posApi.adminSettings({ company: company?.id })
      .then((data) => {
        const saved = data?.email_config || {}
        setCfg({ ...EMPTY_EMAIL_CFG, ...saved })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [company?.id])

  const set = (key, value) => setCfg((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await posApi.updateAdminSection({ company: company?.id, section: 'email_config', values: cfg })
      setMessage('Email settings saved.')
    } catch (e) {
      setMessage(apiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testEmail) { setMessage('Enter a recipient email for the test.'); return }
    setTesting(true)
    setMessage('')
    try {
      const res = await posApi.testEmail(testEmail)
      setMessage(res.detail || 'Test sent.')
    } catch (e) {
      setMessage(apiErrorMessage(e))
    } finally {
      setTesting(false)
    }
  }

  if (!loaded) return null

  return (
    <Panel title="Email Settings" icon={FaEnvelope}>
      <div className="p-5 space-y-5">
        {message && (
          <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">SMTP Host</span>
            <input type="text" value={cfg.host} onChange={(e) => set('host', e.target.value)}
              placeholder="smtp.gmail.com"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Port</span>
            <input type="number" value={cfg.port} onChange={(e) => set('port', e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Username / Email</span>
            <input type="email" value={cfg.username} onChange={(e) => set('username', e.target.value)}
              placeholder="you@gmail.com"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Password / App Password</span>
            <input type="password" value={cfg.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={cfg.password === '***' ? '(saved — leave blank to keep)' : ''}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">From Name</span>
            <input type="text" value={cfg.from_name} onChange={(e) => set('from_name', e.target.value)}
              placeholder="Nexa POS"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">From Email Address</span>
            <input type="email" value={cfg.from_email} onChange={(e) => set('from_email', e.target.value)}
              placeholder="Same as username if blank"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!cfg.use_tls} onChange={(e) => set('use_tls', e.target.checked)}
            className="w-4 h-4 accent-emerald-600" />
          <span className="text-sm font-medium text-slate-700">Use TLS (recommended)</span>
        </label>

        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-xs font-semibold text-slate-600">Send test to</span>
            <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </label>
          <button type="button" onClick={sendTest} disabled={testing}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testing ? <DotLoader color="slate" /> : <FaPaperPlane className="text-[10px]" />}
            Test Connection
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <DotLoader color="white" /> : <FaSave className="text-[10px]" />}
            Save Settings
          </button>
        </div>

        <p className="text-xs text-slate-400">
          For Gmail: use an <strong>App Password</strong> (not your account password). Enable 2FA on your Google account, then generate one at Google → Security → App passwords.
          To automate delivery: run <code className="bg-slate-100 px-1 rounded">python manage.py send_scheduled_reports</code> every 15 minutes via cron.
        </p>
      </div>
    </Panel>
  )
}

// ─── Scheduled Reports ────────────────────────────────────────────────────────

const DOW_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SCHEDULE_TYPES = [
  { key: 'daily',   label: 'Daily Report',    description: "Sent daily covering the previous day's sales.",     color: 'emerald', timeFields: true },
  { key: 'weekly',  label: 'Weekly Summary',  description: 'Sent weekly covering the previous 7 days.',         color: 'blue',    dowField: true, timeFields: true },
  { key: 'monthly', label: 'Monthly Report',  description: 'Sent monthly covering the previous calendar month.', color: 'purple',  domField: true, timeFields: true },
]
const COLOR_MAP = {
  emerald: 'from-emerald-500 to-emerald-700',
  blue:    'from-blue-500 to-blue-700',
  purple:  'from-purple-500 to-purple-700',
}

/* Renders the three schedule cards for one branch */
const BranchSchedulePanel = ({ branchId }) => {
  const [schedules, setSchedules] = useState({ daily: null, weekly: null, monthly: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [sending, setSending] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setMessage('')
    posApi.reportSchedules({ branch: branchId })
      .then(setSchedules)
      .catch((e) => setMessage(apiErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [branchId])

  const update = (type, key, value) =>
    setSchedules((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }))

  const saveSchedule = async (type) => {
    const s = schedules[type]
    if (!s) return
    setSaving((prev) => ({ ...prev, [type]: true }))
    setMessage('')
    try {
      const payload = {
        branch: branchId, report_type: type,
        is_enabled: s.is_enabled,
        send_hour: Number(s.send_hour), send_minute: Number(s.send_minute),
        send_day_of_week: s.send_day_of_week != null ? Number(s.send_day_of_week) : null,
        send_day_of_month: s.send_day_of_month != null ? Number(s.send_day_of_month) : null,
        recipients: s.recipients || [],
        include_gross_profit: s.include_gross_profit,
        include_cashier_breakdown: s.include_cashier_breakdown,
        include_payment_methods: s.include_payment_methods,
        include_top_products: s.include_top_products,
        include_returns: s.include_returns,
      }
      const updated = s.id
        ? await posApi.updateReportSchedule(s.id, payload)
        : await posApi.createReportSchedule(payload)
      setSchedules((prev) => ({ ...prev, [type]: updated }))
      setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} report saved.`)
    } catch (e) { setMessage(apiErrorMessage(e)) }
    finally { setSaving((prev) => ({ ...prev, [type]: false })) }
  }

  const sendNow = async (type) => {
    const s = schedules[type]
    if (!s?.id) { setMessage('Save the schedule first.'); return }
    setSending((prev) => ({ ...prev, [type]: true }))
    setMessage('')
    try {
      await posApi.sendReportNow(s.id)
      setMessage(`Test ${type} report sent to ${(s.recipients || []).join(', ')}.`)
    } catch (e) { setMessage(apiErrorMessage(e)) }
    finally { setSending((prev) => ({ ...prev, [type]: false })) }
  }

  if (loading) return <SkeletonForm />

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${message.includes('sent') || message.includes('saved') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message}
        </div>
      )}

      {SCHEDULE_TYPES.map(({ key, label, description, color, timeFields, dowField, domField }) => {
        const s = schedules[key] || {}
        return (
          <Panel key={key}>
            <div className={`flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r ${COLOR_MAP[color]} rounded-t-xl`}>
              <div>
                <h3 className="text-sm font-bold text-white">{label}</h3>
                <p className="text-xs text-white/80 mt-0.5">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={!!s.is_enabled}
                  onChange={(e) => update(key, 'is_enabled', e.target.checked)} />
                <div className="w-10 h-5 bg-white/30 rounded-full peer peer-checked:bg-white peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-checked:after:bg-emerald-600 after:rounded-full after:h-4 after:w-4 after:transition-all border border-white/40" />
              </label>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Timing</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {timeFields && (<>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Hour (0–23)</span>
                      <input type="number" min="0" max="23" value={s.send_hour ?? 23}
                        onChange={(e) => update(key, 'send_hour', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Minute (0–59)</span>
                      <input type="number" min="0" max="59" value={s.send_minute ?? 0}
                        onChange={(e) => update(key, 'send_minute', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </label>
                  </>)}
                  {dowField && (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Day of Week</span>
                      <select value={s.send_day_of_week ?? 0}
                        onChange={(e) => update(key, 'send_day_of_week', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  )}
                  {domField && (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Day of Month (1–31)</span>
                      <input type="number" min="1" max="31" value={s.send_day_of_month ?? 1}
                        onChange={(e) => update(key, 'send_day_of_month', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </label>
                  )}
                </div>
              </div>

              <RecipientsEditor recipients={s.recipients || []} onChange={(r) => update(key, 'recipients', r)} />

              <div>
                <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Report Content</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ['include_gross_profit', 'Gross Profit'],
                    ['include_cashier_breakdown', 'Cashier Breakdown'],
                    ['include_payment_methods', 'Payment Methods'],
                    ['include_top_products', 'Top Products'],
                    ['include_returns', 'Returns & Refunds'],
                  ].map(([field, fieldLabel]) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                      <input type="checkbox" checked={s[field] !== false}
                        onChange={(e) => update(key, field, e.target.checked)}
                        className="w-4 h-4 accent-emerald-600" />
                      <span className="text-xs font-medium text-slate-700">{fieldLabel}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {s.last_sent_at ? `Last sent: ${new Date(s.last_sent_at).toLocaleString()}` : 'Never sent'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => sendNow(key)} disabled={!!sending[key]}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {sending[key] ? <DotLoader color="slate" /> : <FaPaperPlane className="text-[10px]" />}
                    Send Test
                  </button>
                  <button type="button" onClick={() => saveSchedule(key)} disabled={!!saving[key]}
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving[key] ? <DotLoader color="white" /> : <FaSave className="text-[10px]" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

/* Top-level page: branch picker + email settings + schedule cards */
const ScheduledReports = () => {
  const { branch, company: authCompany, company_branches: companyBranches, isCompanyAdmin } = useAuth()

  // Company/super admins see all their branches; branch admins only their own
  const branches = useMemo(() => {
    if (isCompanyAdmin && companyBranches?.length) return companyBranches
    return branch ? [branch] : []
  }, [isCompanyAdmin, companyBranches, branch])

  const [selectedBranchId, setSelectedBranchId] = useState(null)

  // Default to the active branch
  useEffect(() => {
    if (!selectedBranchId && branch?.id) setSelectedBranchId(branch.id)
  }, [branch?.id])

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0]

  return (
    <div className="space-y-5">
      {/* Branch selector — only visible when there's more than one branch */}
      {branches.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide shrink-0">Configure branch:</span>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBranchId(b.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                  b.id === selectedBranch?.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
                }`}
              >
                <FaWarehouse className="text-[9px]" />
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email SMTP settings — company-wide */}
      <EmailSettingsCard company={authCompany} />

      {/* Schedule cards for the selected branch */}
      {selectedBranch
        ? <BranchSchedulePanel key={selectedBranch.id} branchId={selectedBranch.id} />
        : <p className="text-sm text-slate-500">No branch assigned.</p>
      }
    </div>
  )
}

const RecipientsEditor = ({ recipients, onChange }) => {
  const [input, setInput] = useState('')

  const add = () => {
    const email = input.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (recipients.includes(email)) { setInput(''); return }
    onChange([...recipients, email])
    setInput('')
  }

  const remove = (email) => onChange(recipients.filter((r) => r !== email))

  return (
    <div>
      <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Recipients</p>
      <div className="flex gap-2 mb-2">
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="email@example.com"
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white"
        >
          <FaPlus className="text-[9px]" /> Add
        </button>
      </div>
      {recipients.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No recipients — add at least one email address.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((email) => (
            <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
              <FaEnvelope className="text-[9px] text-slate-400" />
              {email}
              <button type="button" onClick={() => remove(email)} className="ml-0.5 text-slate-400 hover:text-red-600">
                <FaTimes className="text-[9px]" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const FormGrid = ({ children }) => <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>

const Field = ({ label, value, onChange, type = 'text', maxLength }) => (
  <label>
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    <input
      type={type}
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      readOnly={!onChange}
      maxLength={maxLength}
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
  const classes = tone === 'red' ? 'bg-red-100 text-red-700'
    : tone === 'amber' ? 'bg-amber-100 text-amber-800'
    : tone === 'slate' ? 'bg-slate-100 text-slate-700'
    : tone === 'blue' ? 'bg-blue-100 text-blue-700'
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

// ── System Health ─────────────────────────────────────────────────────────────

const HealthBadge = ({ status }) => {
  if (status === 'healthy') return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><FaCheckCircle />Healthy</span>
  if (status === 'warning') return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"><FaExclamationTriangle />Warning</span>
  if (status === 'critical') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700"><FaTimesCircle />Critical</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Unknown</span>
}

const DbBadge = ({ status }) => {
  if (status === 'healthy') return <span className="text-xs font-semibold text-emerald-600">Healthy</span>
  if (status === 'error') return <span className="text-xs font-semibold text-red-600">Error</span>
  return <span className="text-xs font-semibold text-slate-500">—</span>
}

const UsageBar = ({ percent, warn = 80, danger = 90 }) => {
  if (percent === null || percent === undefined) return <span className="text-xs text-slate-400">Unavailable</span>
  const color = percent >= danger ? 'bg-red-500' : percent >= warn ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-lg font-black tabular-nums ${percent >= danger ? 'text-red-600' : percent >= warn ? 'text-amber-600' : 'text-slate-900'}`}>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  )
}

const HealthCard = ({ icon: Icon, title, children, accent = 'slate' }) => {
  const accentMap = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    red: 'border-red-200 bg-red-50/40',
  }
  return (
    <div className={`rounded-xl border p-4 ${accentMap[accent] || accentMap.slate}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-sm">
          <Icon />
        </span>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      {children}
    </div>
  )
}

const HealthRow = ({ label, value, mono = false }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className={`text-xs font-semibold text-slate-900 ${mono ? 'tabular-nums' : ''}`}>{value ?? '—'}</span>
  </div>
)

const formatSyncAgo = (mins) => {
  if (mins === null || mins === undefined) return 'Never'
  if (mins < 1) return 'Just now'
  if (mins === 1) return '1 minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const h = Math.floor(mins / 60)
  return h === 1 ? '1 hour ago' : `${h} hours ago`
}

const formatUptime = (days, hours) => {
  if (days === null || days === undefined) return '—'
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours}h`
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

const SystemHealth = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await posApi.systemHealth()
      setData(result)
      setError(null)
      setLastChecked(new Date())
    } catch {
      setError('Could not load system health data. Check your connection or permissions.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(() => fetchHealth(true), 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
      <div className="text-center">
        <FaSync className="mx-auto animate-spin text-2xl text-emerald-500" />
        <p className="mt-3 text-sm font-semibold text-slate-600">Loading system health…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <FaTimesCircle className="mx-auto text-2xl text-red-400" />
      <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      <button onClick={() => fetchHealth()} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">Retry</button>
    </div>
  )

  const { application: app, database: db, storage, pos_terminals: terminals, sync, warnings, critical_issues: criticals } = data
  const overallAccent = data.status === 'healthy' ? 'emerald' : data.status === 'warning' ? 'amber' : 'red'
  const overallBg = data.status === 'healthy'
    ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
    : data.status === 'warning'
      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
      : 'bg-gradient-to-r from-red-600 to-rose-600'

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <div className={`flex items-center justify-between rounded-2xl px-6 py-5 text-white shadow-lg ${overallBg}`}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <FaServer className="text-3xl" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">General System Health</p>
            <p className="text-2xl font-black leading-tight">
              {data.status === 'healthy' ? '✅ Overall Status: Healthy' : data.status === 'warning' ? '⚠ Overall Status: Warning' : '🔴 Overall Status: Critical'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30 disabled:opacity-60"
          >
            <FaSync className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {lastChecked && (
            <p className="text-[10px] text-white/60">
              Last checked {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {/* Application */}
        <HealthCard icon={FaServer} title="Application">
          <HealthRow label="Status" value={<span className="text-emerald-600 font-bold">Running</span>} />
          <HealthRow label="Version" value={app?.version} mono />
          <HealthRow label="Uptime" value={formatUptime(app?.uptime_days, app?.uptime_hours)} />
        </HealthCard>

        {/* Database */}
        <HealthCard icon={FaDatabase} title="Database" accent={db?.status === 'error' ? 'red' : 'slate'}>
          <HealthRow label="Status" value={<DbBadge status={db?.status} />} />
          <HealthRow label="Response time" value={db?.response_ms !== null && db?.response_ms !== undefined ? `${db.response_ms} ms` : null} mono />
          <HealthRow label="Size" value={db?.size_gb !== null && db?.size_gb !== undefined ? `${db.size_gb} GB` : null} mono />
          <HealthRow
            label="Connections"
            value={db?.connections_active !== null && db?.connections_active !== undefined
              ? `${db.connections_active} / ${db.connections_max ?? '?'}`
              : null}
            mono
          />
        </HealthCard>

        {/* Storage */}
        <HealthCard icon={FaHdd} title="Storage">
          <HealthRow
            label="Free space"
            value={storage?.free_gb !== null && storage?.free_gb !== undefined ? `${storage.free_gb} GB` : null}
            mono
          />
          <HealthRow
            label="Total"
            value={storage?.total_gb !== null && storage?.total_gb !== undefined ? `${storage.total_gb} GB` : null}
            mono
          />
          <div className="pt-1">
            <p className="text-xs text-slate-500 mb-1">Used</p>
            <UsageBar percent={storage?.used_percent} warn={75} danger={90} />
          </div>
        </HealthCard>

        {/* CPU */}
        <HealthCard icon={FaTachometerAlt} title="CPU Usage">
          {data.cpu_percent !== null && data.cpu_percent !== undefined ? (
            <UsageBar percent={data.cpu_percent} warn={70} danger={90} />
          ) : (
            <p className="text-xs text-slate-400">Install <code className="bg-slate-100 px-1 rounded">psutil</code> to enable.</p>
          )}
        </HealthCard>

        {/* RAM */}
        <HealthCard icon={FaMemory} title="RAM Usage">
          {data.ram_percent !== null && data.ram_percent !== undefined ? (
            <UsageBar percent={data.ram_percent} warn={75} danger={90} />
          ) : (
            <p className="text-xs text-slate-400">Install <code className="bg-slate-100 px-1 rounded">psutil</code> to enable.</p>
          )}
        </HealthCard>

        {/* POS Terminals */}
        <HealthCard icon={FaWifi} title="POS Terminals" accent={terminals?.offline > 0 ? 'amber' : 'slate'}>
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 py-3 text-center">
              <p className="text-2xl font-black text-emerald-700 tabular-nums">{terminals?.online ?? 0}</p>
              <p className="text-[10px] font-semibold uppercase text-emerald-600 mt-0.5">Online</p>
            </div>
            <div className="flex-1 rounded-lg bg-slate-50 border border-slate-200 py-3 text-center">
              <p className={`text-2xl font-black tabular-nums ${terminals?.offline > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{terminals?.offline ?? 0}</p>
              <p className="text-[10px] font-semibold uppercase text-slate-500 mt-0.5">Offline</p>
            </div>
          </div>
          <HealthRow label="Total terminals" value={terminals?.total ?? 0} mono />
        </HealthCard>

        {/* Synchronization */}
        <HealthCard icon={FaSync} title="Synchronization">
          <HealthRow label="Last sync" value={formatSyncAgo(sync?.last_sync_minutes_ago)} />
          <HealthRow label="Pending uploads" value={sync?.pending_count ?? 0} mono />
          <HealthRow label="Done" value={sync?.status_counts?.done ?? 0} mono />
          <HealthRow label="Failed" value={<span className={sync?.status_counts?.failed > 0 ? 'text-red-600 font-black' : ''}>{sync?.status_counts?.failed ?? 0}</span>} mono />
        </HealthCard>
      </div>

      {/* Sync Reports & Logs */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <FaSync className="text-slate-500 text-sm" />
          <p className="text-sm font-bold text-slate-800">Sync Reports &amp; Logs</p>
        </div>

        {/* Queue status breakdown */}
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Queue Status</p>
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'pending',   label: 'Pending',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
              { key: 'uploading', label: 'Uploading',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
              { key: 'done',      label: 'Done',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
              { key: 'failed',    label: 'Failed',     color: 'bg-red-100 text-red-700 border-red-200' },
            ].map(({ key, label, color }) => (
              <div key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${color}`}>
                <span className="text-xl font-black tabular-nums">{sync?.status_counts?.[key] ?? 0}</span>
                <span className="text-xs font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-device breakdown */}
        {sync?.device_breakdown?.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Device Activity</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left font-semibold text-slate-500">Device</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Branch</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Last Seen</th>
                    <th className="pb-2 text-right font-semibold text-amber-600 pr-3">Pending</th>
                    <th className="pb-2 text-right font-semibold text-sky-600 pr-3">Uploading</th>
                    <th className="pb-2 text-right font-semibold text-emerald-600 pr-3">Done</th>
                    <th className="pb-2 text-right font-semibold text-red-600">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sync.device_breakdown.map((dev) => (
                    <tr key={dev.device_id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-800">{dev.name}</td>
                      <td className="py-2 pr-4 text-slate-500">{dev.branch ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold text-amber-700">{dev.pending}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold text-sky-700">{dev.uploading}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold text-emerald-700">{dev.done}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-red-700">{dev.failed || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent failures */}
        {sync?.recent_failed?.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
              Recent Failures ({sync.recent_failed.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left font-semibold text-slate-500">Model</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Action</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Device</th>
                    <th className="pb-2 text-right font-semibold text-slate-500 pr-4">Attempts</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Last Tried</th>
                    <th className="pb-2 text-left font-semibold text-slate-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sync.recent_failed.map((entry) => (
                    <tr key={entry.id} className="hover:bg-red-50/40">
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-700">{entry.model_name}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          entry.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                          entry.action === 'update' ? 'bg-sky-100 text-sky-700' :
                          'bg-red-100 text-red-700'
                        }`}>{entry.action}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-500 max-w-[100px] truncate">{entry.device_id || '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{entry.attempts}</td>
                      <td className="py-2 pr-3 text-slate-500 tabular-nums whitespace-nowrap">
                        {entry.last_tried_at ? new Date(entry.last_tried_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 text-red-700 max-w-xs truncate" title={entry.error_message}>
                        {entry.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent activity log */}
        {sync?.recent_log?.length > 0 ? (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recent Activity (last {sync.recent_log.length})
            </p>
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Time</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Model</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Action</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sync.recent_log.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-500 tabular-nums whitespace-nowrap">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{entry.model_name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          entry.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                          entry.action === 'update' ? 'bg-sky-100 text-sky-700' :
                          'bg-red-100 text-red-700'
                        }`}>{entry.action}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          entry.status === 'done'      ? 'bg-emerald-100 text-emerald-700' :
                          entry.status === 'failed'    ? 'bg-red-100 text-red-700' :
                          entry.status === 'uploading' ? 'bg-sky-100 text-sky-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{entry.status}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-500 max-w-[120px] truncate">{entry.device_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <FaCheckCircle className="mx-auto text-2xl text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No sync activity yet</p>
            <p className="text-xs text-slate-400 mt-1">Queue entries will appear here once devices connect and sync.</p>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FaExclamationTriangle className="text-amber-500 shrink-0" />
            <p className="text-sm font-bold text-amber-800">Warnings ({warnings.length})</p>
          </div>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                <span className="mt-0.5 shrink-0 text-amber-400">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical Issues */}
      <div className={`rounded-xl border p-4 ${criticals?.length > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50/50'}`}>
        <div className="flex items-center gap-2 mb-3">
          {criticals?.length > 0 ? (
            <FaTimesCircle className="text-red-500 shrink-0" />
          ) : (
            <FaCheckCircle className="text-emerald-500 shrink-0" />
          )}
          <p className={`text-sm font-bold ${criticals?.length > 0 ? 'text-red-800' : 'text-emerald-700'}`}>
            Critical Issues
          </p>
        </div>
        {criticals?.length > 0 ? (
          <ul className="space-y-1.5">
            {criticals.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-800">
                <span className="mt-0.5 shrink-0">🔴</span>
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs font-semibold text-emerald-600">None — all systems operational.</p>
        )}
      </div>
    </div>
  )
}

export default Administration
