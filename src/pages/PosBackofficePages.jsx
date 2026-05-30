import React from 'react'
import posData from '../data/posData.json'
import { FaBell, FaBoxes, FaBuilding, FaCheckCircle, FaDownload, FaEdit, FaExchangeAlt, FaFileInvoiceDollar, FaPlus, FaPrint, FaShieldAlt, FaTags, FaTruck, FaUserShield } from 'react-icons/fa'

const money = (value) => `KES ${value.toLocaleString()}`

const PageHeader = ({ title, subtitle, action = 'Add New' }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
    <button className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
      <FaPlus className="mr-2" />
      {action}
    </button>
  </div>
)

const Status = ({ children, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-800',
  }
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
}

const TableShell = ({ title, icon: Icon, children, right }) => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
      <div className="flex items-center">
        {Icon && <Icon className="text-emerald-600 mr-2" />}
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {right}
    </div>
    <div style={{ minWidth: 0, overflowX: 'auto' }}>{children}</div>
  </div>
)

export const Products = () => (
  <div className="space-y-6">
    <PageHeader title="Products" subtitle="Manage SKUs, barcodes, pricing, variants, tax categories, and product status." action="Add Product" />
    <TableShell title="Product Catalogue" icon={FaBoxes}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50">
          <tr>
            {['Product', 'SKU', 'Barcode', 'Category', 'Cost', 'Price', 'Stock', 'Status', ''].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {posData.products.map((product) => (
            <tr key={product.id} className="hover:bg-slate-50">
              <td className="px-5 py-4"><p className="font-medium text-slate-900">{product.name}</p><p className="text-xs text-slate-500">{product.brand} / {product.tax}</p></td>
              <td className="px-5 py-4 text-sm text-slate-600">{product.sku}</td>
              <td className="px-5 py-4 text-sm text-slate-600">{product.barcode}</td>
              <td className="px-5 py-4 text-sm text-slate-600">{product.category}</td>
              <td className="px-5 py-4 text-sm">{money(product.cost)}</td>
              <td className="px-5 py-4 text-sm font-semibold">{money(product.price)}</td>
              <td className="px-5 py-4 text-sm">{product.stock}</td>
              <td className="px-5 py-4"><Status tone={product.stock === 0 ? 'red' : product.stock <= product.reorderPoint ? 'amber' : 'emerald'}>{product.status}</Status></td>
              <td className="px-5 py-4 text-right"><button className="text-slate-500 hover:text-slate-900"><FaEdit /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Inventory = () => (
  <div className="space-y-6">
    <PageHeader title="Stock Levels" subtitle="Track real-time stock by branch, reorder points, valuation, and approval-controlled adjustments." action="Stock Adjustment" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Metric title="Total Stock Value" value={money(posData.products.reduce((sum, product) => sum + product.cost * product.stock, 0))} />
      <Metric title="Low Stock Items" value={posData.products.filter((product) => product.stock <= product.reorderPoint && product.stock > 0).length} />
      <Metric title="Out of Stock" value={posData.products.filter((product) => product.stock === 0).length} />
    </div>
    <TableShell title="Branch Stock Position" icon={FaBoxes}>
      <SimpleProductStockTable />
    </TableShell>
  </div>
)

const SimpleProductStockTable = () => (
  <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
    <thead className="bg-slate-50"><tr>{['Product', 'Branch', 'On Hand', 'Reorder Point', 'Valuation', 'Action'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-200">
      {posData.products.map((product) => (
        <tr key={product.id}>
          <td className="px-5 py-4 font-medium">{product.name}</td>
          <td className="px-5 py-4 text-sm text-slate-600">{product.branch}</td>
          <td className="px-5 py-4 text-sm">{product.stock}</td>
          <td className="px-5 py-4 text-sm">{product.reorderPoint}</td>
          <td className="px-5 py-4 text-sm font-semibold">{money(product.stock * product.cost)}</td>
          <td className="px-5 py-4"><button className="px-3 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200">Adjust</button></td>
        </tr>
      ))}
    </tbody>
  </table>
)

const Metric = ({ title, value }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
    <p className="text-sm text-slate-500">{title}</p>
    <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
  </div>
)

export const Purchases = () => (
  <div className="space-y-6">
    <PageHeader title="Purchase Orders" subtitle="Create POs, approve purchases, receive goods, and track supplier payments." action="Create PO" />
    <TableShell title="Purchase Workflow" icon={FaFileInvoiceDollar}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['PO', 'Supplier', 'Branch', 'Items', 'Amount', 'Status', 'Created'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.purchaseOrders.map((po) => (
            <tr key={po.id}>
              <td className="px-5 py-4 font-medium">{po.id}</td>
              <td className="px-5 py-4 text-sm">{po.supplier}</td>
              <td className="px-5 py-4 text-sm">{po.branch}</td>
              <td className="px-5 py-4 text-sm">{po.items}</td>
              <td className="px-5 py-4 text-sm font-semibold">{money(po.amount)}</td>
              <td className="px-5 py-4"><Status tone={po.status === 'Pending Approval' ? 'amber' : po.status === 'Approved' ? 'blue' : 'emerald'}>{po.status}</Status></td>
              <td className="px-5 py-4 text-sm text-slate-600">{po.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Suppliers = () => (
  <div className="space-y-6">
    <PageHeader title="Suppliers" subtitle="Manage supplier profiles, payment terms, outstanding balances, and purchase history." action="Add Supplier" />
    <TableShell title="Supplier Directory" icon={FaTruck}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['Supplier', 'Contact', 'Terms', 'Outstanding', 'Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td className="px-5 py-4 font-medium">{supplier.name}</td>
              <td className="px-5 py-4 text-sm">{supplier.contact}</td>
              <td className="px-5 py-4 text-sm">{supplier.terms}</td>
              <td className="px-5 py-4 text-sm font-semibold">{money(supplier.balance)}</td>
              <td className="px-5 py-4"><Status>{supplier.status}</Status></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Finance = () => {
  const { finance } = posData
  return (
    <div className="space-y-6">
      <PageHeader title="Cash & Finance" subtitle="Reconcile drawers, monitor expenses, track tax, credit sales, and refund approvals." action="Add Expense" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Sales Today" value={money(finance.salesToday)} />
        <Metric title="Expenses Today" value={money(finance.expensesToday)} />
        <Metric title="Tax Due" value={money(finance.taxDue)} />
        <Metric title="Pending Refunds" value={finance.refundsPending} />
      </div>
      <TableShell title="Drawer Reconciliation" icon={FaFileInvoiceDollar}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
          <tbody>
            <FinanceRow label="Expected Cash" value={money(finance.cashExpected)} />
            <FinanceRow label="Counted Cash" value={money(finance.cashCounted)} />
            <FinanceRow label="Variance" value={money(finance.cashCounted - finance.cashExpected)} strong />
            <FinanceRow label="Credit Sales" value={money(finance.creditSales)} />
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}

const FinanceRow = ({ label, value, strong }) => (
  <tr className="border-b border-slate-200 last:border-0">
    <td className="px-5 py-4 text-sm text-slate-600">{label}</td>
    <td className={`px-5 py-4 text-right ${strong ? 'font-bold text-slate-900' : 'font-semibold'}`}>{value}</td>
  </tr>
)

export const Users = () => (
  <div className="space-y-6">
    <PageHeader title="Users & Roles" subtitle="Create users, assign roles, reset passwords, and control granular permissions." action="Create User" />
    <TableShell title="Access Control" icon={FaUserShield}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['User', 'Role', 'Branch Access', 'Status', 'Last Login'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.users.map((user) => (
            <tr key={user.id}>
              <td className="px-5 py-4 font-medium">{user.name}</td>
              <td className="px-5 py-4 text-sm">{user.role}</td>
              <td className="px-5 py-4 text-sm">{user.branch}</td>
              <td className="px-5 py-4"><Status tone={user.status === 'Read-only' ? 'slate' : 'emerald'}>{user.status}</Status></td>
              <td className="px-5 py-4 text-sm text-slate-600">{user.lastLogin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Alerts = () => (
  <div className="space-y-6">
    <PageHeader title="Alerts & Notifications" subtitle="Low stock, expiry, approvals, cash variance, sales targets, and system notifications." action="Notification Rule" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {posData.alerts.map((alert) => (
        <div key={alert.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <FaBell className={alert.severity === 'Critical' ? 'text-red-500 mt-1' : 'text-amber-500 mt-1'} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{alert.type}</h2>
                <Status tone={alert.severity === 'Critical' ? 'red' : alert.severity === 'High' ? 'amber' : 'slate'}>{alert.severity}</Status>
              </div>
              <p className="text-sm text-slate-600 mt-2">{alert.message}</p>
              <p className="text-xs text-slate-400 mt-3">{alert.time}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export const AuditLogs = () => (
  <div className="space-y-6">
    <PageHeader title="Audit Logs" subtitle="Read-only action trail for sales edits, stock changes, price changes, refunds, and logins." action="Export Logs" />
    <TableShell title="Activity Trail" icon={FaShieldAlt}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['User', 'Action', 'Target', 'Branch', 'Device', 'Time'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.auditLogs.map((log) => (
            <tr key={log.id}>
              <td className="px-5 py-4 font-medium">{log.user}</td>
              <td className="px-5 py-4 text-sm">{log.action}</td>
              <td className="px-5 py-4 text-sm">{log.target}</td>
              <td className="px-5 py-4 text-sm">{log.branch}</td>
              <td className="px-5 py-4 text-sm text-slate-600">{log.device}</td>
              <td className="px-5 py-4 text-sm text-slate-600">{log.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Reports = () => (
  <div className="space-y-6">
    <PageHeader title="Reports" subtitle="Sales, financial, operational, stock movement, tax, staff activity, and exportable reports." action="Build Report" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {['Daily Sales', 'Profit & Loss', 'Stock Movement', 'Low Stock', 'Tax Summary', 'Cashier Performance'].map((report) => (
        <div key={report} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900">{report}</h2>
          <p className="text-sm text-slate-500 mt-2">Filter by branch, date range, category, and user.</p>
          <div className="flex gap-2 mt-4">
            <button className="px-3 py-1.5 bg-slate-100 rounded text-xs flex items-center"><FaDownload className="mr-1" />CSV</button>
            <button className="px-3 py-1.5 bg-slate-100 rounded text-xs flex items-center"><FaPrint className="mr-1" />PDF</button>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export const Branches = () => (
  <div className="space-y-6">
    <PageHeader title="Company & Branches" subtitle="Configure company profile, tax rules, branch stock, pricing rules, and receipt identity." action="Add Branch" />
    <TableShell title={posData.company.name} icon={FaBuilding}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['Branch', 'Location', 'Sales Today', 'Cash Variance', 'Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.company.branches.map((branch) => (
            <tr key={branch.id}>
              <td className="px-5 py-4 font-medium">{branch.name}</td>
              <td className="px-5 py-4 text-sm">{branch.location}</td>
              <td className="px-5 py-4 text-sm font-semibold">{money(branch.salesToday)}</td>
              <td className="px-5 py-4 text-sm">{money(branch.cashVariance)}</td>
              <td className="px-5 py-4"><Status>Active</Status></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Categories = () => (
  <div className="space-y-6">
    <PageHeader title="Categories" subtitle="Organize products into nested reporting groups with category-level rules." action="Add Category" />
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {['Food Staples', 'Beverages', 'Dairy', 'Household'].map((category) => (
        <div key={category} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <FaTags className="text-emerald-600 text-xl mb-3" />
          <h2 className="font-semibold">{category}</h2>
          <p className="text-sm text-slate-500 mt-2">{posData.products.filter((product) => product.category === category).length} active products</p>
        </div>
      ))}
    </div>
  </div>
)

export const Sales = () => (
  <div className="space-y-6">
    <PageHeader title="Sales Monitor" subtitle="Review receipts, cashier activity, discounts, refunds, and payment breakdowns." action="New Sale" />
    <TableShell title="Live Sales Feed" icon={FaCheckCircle}>
      <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
        <thead className="bg-slate-50"><tr>{['Receipt', 'Cashier', 'Branch', 'Amount', 'Profit', 'Payment', 'Time'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">
          {posData.sales.map((sale) => (
            <tr key={sale.id}>
              <td className="px-5 py-4 font-medium">{sale.id}</td>
              <td className="px-5 py-4 text-sm">{sale.cashier}</td>
              <td className="px-5 py-4 text-sm">{sale.branch}</td>
              <td className="px-5 py-4 text-sm font-semibold">{money(sale.amount)}</td>
              <td className="px-5 py-4 text-sm text-emerald-600 font-semibold">{money(sale.profit)}</td>
              <td className="px-5 py-4 text-sm">{sale.payment}</td>
              <td className="px-5 py-4 text-sm text-slate-600">{sale.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  </div>
)

export const Transfers = () => (
  <div className="space-y-6">
    <PageHeader title="Stock Transfers" subtitle="Move stock between branches with approval, in-transit tracking, and sent-vs-received controls." action="Create Transfer" />
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <FaExchangeAlt className="text-emerald-600 text-2xl mb-3" />
      <h2 className="font-semibold text-slate-900">Transfer Workflow</h2>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 text-sm">
        {['Draft', 'Pending Approval', 'In Transit', 'Received', 'Reconciled'].map((step) => (
          <div key={step} className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 text-center font-medium">{step}</div>
        ))}
      </div>
    </div>
  </div>
)
