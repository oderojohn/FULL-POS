import React, { useEffect, useState } from 'react'
import {
  FaBarcode, FaBoxes, FaChartLine, FaCheck, FaClipboardCheck, FaClipboardList, FaDownload,
  FaExchangeAlt, FaFileExcel, FaFileInvoiceDollar, FaFilePdf, FaPlus, FaSearch,
  FaTags, FaTimes, FaTruck, FaWarehouse
} from 'react-icons/fa'
import { posApi } from '../api/posApi'
import { useAuth } from '../auth/AuthContext'

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`
const TABLE_PAGE_SIZE = 100
const TABLE_RENDER_LIMIT = 250
const CATEGORY_PAGE_SIZE = 100
const PO_PICKER_PAGE_SIZE = 8
const RECEIVING_PAGE_SIZE = 10
const STOCK_PAGE_SIZE = 50

const flattenApiError = (value, prefix = '') => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenApiError(item, prefix ? `${prefix}[${index}]` : `${index}`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) => flattenApiError(nested, prefix ? `${prefix}.${key}` : key))
  }
  return [`${prefix}: ${value}`]
}

const formatApiError = (error) => {
  const data = error?.data
  if (!data) return error?.message || 'Request failed.'
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  const parts = flattenApiError(data)
  return parts.join(' | ') || 'Request failed.'
}

const InventoryModule = ({ section = 'Products' }) => {
  const { user, branch: authBranch, company: authCompany, company_branches: authBranches, reloadSignal } = useAuth()
  const [modal, setModal] = useState(null)
  const [modalDraft, setModalDraft] = useState({})
  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryMeta, setCategoryMeta] = useState({ count: 0, pageSize: CATEGORY_PAGE_SIZE })
  const [suppliers, setSuppliers] = useState([])
  const [supplierMeta, setSupplierMeta] = useState({ count: 0, pageSize: CATEGORY_PAGE_SIZE })
  const [liveProducts, setLiveProducts] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [stocktakes, setStocktakes] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [lowStockRows, setLowStockRows] = useState([])
  const [productMeta, setProductMeta] = useState({ count: 0, pageSize: TABLE_PAGE_SIZE })
  const [productPage, setProductPage] = useState(1)
  const [stockProductPage, setStockProductPage] = useState(1)
  const [stockMovementPage, setStockMovementPage] = useState(1)
  const [adjustmentLogs, setAdjustmentLogs] = useState([])
  const [adjustmentLogCount, setAdjustmentLogCount] = useState(0)
  const [auditLogPage, setAuditLogPage] = useState(1)
  const [message, setMessage] = useState('')
  const [companies, setCompanies] = useState([])
  const activeBranchId = authBranch?.id || branches[0]?.id

  const loadLiveData = async () => {
    try {
      const companyData = authCompany ? [authCompany] : []
      const finalBranches = authBranches?.length ? authBranches : authBranch ? [authBranch] : []
      const branchId = authBranch?.id || finalBranches[0]?.id
      if (!branchId) throw new Error('No active branch is assigned to this user.')
      const [categoryResponse, supplierResponse, productResponse, poResponse, stocktakeResponse, movementResponse, lowStockResponse] = await Promise.all([
        posApi.inventory.categories({ branch: branchId, page_size: CATEGORY_PAGE_SIZE }),
        posApi.inventory.suppliers({ branch: branchId, page_size: CATEGORY_PAGE_SIZE }),
        posApi.inventory.products({ branch: branchId, page: productPage, page_size: TABLE_PAGE_SIZE }),
        posApi.inventory.purchaseOrders({ branch: branchId, page_size: TABLE_PAGE_SIZE }),
        posApi.inventory.stocktakes({ branch: branchId, page_size: TABLE_PAGE_SIZE }),
        posApi.inventory.stockMovements({ branch: branchId, page_size: TABLE_PAGE_SIZE }),
        posApi.inventory.lowStock({ branch: branchId }),
      ])
      const categoryRows = Array.isArray(categoryResponse.results) ? categoryResponse.results : Array.isArray(categoryResponse) ? categoryResponse : []
      const supplierRows = Array.isArray(supplierResponse.results) ? supplierResponse.results : Array.isArray(supplierResponse) ? supplierResponse : []
      const productRows = Array.isArray(productResponse.results) ? productResponse.results : Array.isArray(productResponse) ? productResponse : []
      const poRows = Array.isArray(poResponse.results) ? poResponse.results : Array.isArray(poResponse) ? poResponse : []
      const stocktakeRows = Array.isArray(stocktakeResponse.results) ? stocktakeResponse.results : Array.isArray(stocktakeResponse) ? stocktakeResponse : []
      const movementRows = Array.isArray(movementResponse.results) ? movementResponse.results : Array.isArray(movementResponse) ? movementResponse : []
      const lowStockData = Array.isArray(lowStockResponse.results) ? lowStockResponse.results : Array.isArray(lowStockResponse) ? lowStockResponse : []
      setCompanies(companyData)
      setBranches(finalBranches)
      setCategories(categoryRows)
      setCategoryMeta({ count: categoryResponse.count || categoryRows.length, pageSize: CATEGORY_PAGE_SIZE })
      setSuppliers(supplierRows)
      setSupplierMeta({ count: supplierResponse.count || supplierRows.length, pageSize: CATEGORY_PAGE_SIZE })
      setProductMeta({ count: productResponse.count || productRows.length, pageSize: TABLE_PAGE_SIZE })
      setLiveProducts(productRows.map((product) => ({
        ...product,
        price: Number(product.retail_price),
        wholesale: Number(product.wholesale_price),
        cost: Number(product.cost_price),
        reorderPoint: Number(product.reorder_point),
        category_id: product.category,
        category_name: product.category_name || 'Products',
        category: product.category_name || 'Products',
        supplier: 'Backend',
        unit: 'Piece',
        imageTone: 'bg-emerald-100 text-emerald-700',
      })))
      setPurchaseOrders(poRows)
      setStocktakes(stocktakeRows)
      setStockMovements(movementRows)
      setLowStockRows(lowStockData)
    } catch (error) {
      setMessage(formatApiError(error) || 'Backend unavailable. Inventory data could not be loaded.')
    }
  }

  useEffect(() => {
    loadLiveData()
    loadAdjustmentLogs()
  }, [authBranch?.id, reloadSignal, productPage])

  useEffect(() => {
    if (!authBranch?.id) return
    setProductPage(1)
  }, [authBranch?.id])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(timer)
  }, [message])

  const openModal = (nextModal, draft = {}) => {
    const mergedDraft = (nextModal.type === 'po' && nextModal.data && !draft.items)
      ? { ...draft, items: (nextModal.data.items || []).filter((item) => item.is_active !== false) }
      : draft
    setModal(nextModal)
    setModalDraft(mergedDraft)
  }

  const confirmModal = async () => {
    const firstProduct = liveProducts.find((product) => product.id === Number(modalDraft.product)) || liveProducts[0]
    try {
      if (!activeBranchId) {
        setMessage('No active branch is assigned to this user.')
        return
      }
      if (modal.type === 'product') {
        const rawCategory = modalDraft.category_id ?? modalDraft.category
        const categoryId = Number.isFinite(Number(rawCategory)) && String(rawCategory).match(/^\d+$/)
          ? Number(rawCategory)
          : categories.find((row) => row.name === rawCategory)?.id || categories[0]?.id
        if (!categoryId) {
          setMessage('Create a category before adding products.')
          return
        }
        const payload = {
          category: categoryId,
          name: modalDraft.name || 'New Product',
          sku: modalDraft.sku || `SKU-${Date.now()}`,
          barcode: modalDraft.barcode || '',
          retail_price: modalDraft.retail_price || modalDraft.price || '0.00',
          wholesale_price: modalDraft.wholesale_price || modalDraft.wholesale || '0.00',
          cost_price: modalDraft.cost_price || modalDraft.cost || '0.00',
          tax_rate: modalDraft.tax_rate || '0.00',
          reorder_point: Number(modalDraft.reorder_point || modalDraft.reorderPoint || 0),
          is_active: modalDraft.is_active ?? true,
        }
        if (!modal.data?.id) {
          payload.branch = activeBranchId
          payload.user = user?.id || null
          payload.initial_stock = Number(modalDraft.initial_stock || 0)
        }
        if (modal.data?.id) await posApi.inventory.updateProduct(modal.data.id, payload)
        else await posApi.inventory.createProduct(payload)
setMessage(modal.data?.id ? 'Product updated.' : 'Product created.')
      } else if (modal.type === 'category') {
          const payload = {
            name: modalDraft.name || 'New Category',
            color: modalDraft.color || '',
            is_active: modalDraft.is_active ?? true,
            branch: activeBranchId,
          }
          if (modal.data?.id) await posApi.inventory.updateCategory(modal.data.id, payload)
          else await posApi.inventory.createCategory(payload)
        setMessage(modal.data?.id ? 'Category updated.' : 'Category created.')
      } else if (modal.type === 'supplier') {
        const payload = {
          name: modalDraft.name || 'New Supplier',
          contact_person: modalDraft.contact_person || '',
          phone: modalDraft.phone || '',
          email: modalDraft.email || '',
          address: modalDraft.address || '',
          is_active: modalDraft.is_active ?? true,
          branch: activeBranchId,
        }
        if (modal.data?.id) await posApi.inventory.updateSupplier(modal.data.id, payload)
        else await posApi.inventory.createSupplier(payload)
        setMessage(modal.data?.id ? 'Supplier updated.' : 'Supplier created.')
      } else if (modal.type === 'po' && firstProduct) {
        const inactiveItems = (modalDraft.items || []).filter((item) => item.is_active === false)
        if (inactiveItems.length) {
          setMessage('Remove inactive products before placing the purchase order.')
          return
        }
        const orderItems = (modalDraft.items?.length ? modalDraft.items : [{
          product: firstProduct.id,
          ordered_quantity: Number(modalDraft.ordered_quantity || 5),
          unit_cost: modalDraft.unit_cost || firstProduct.cost_price || '1.00',
        }]).map((item) => ({
          product: Number(item.product),
          ordered_quantity: Number(item.ordered_quantity || 1),
          unit_cost: item.unit_cost || '0.00',
        })).filter((item) => item.product && item.ordered_quantity > 0)
        if (!orderItems.length) {
          setMessage('Add at least one product to the purchase order.')
          return
        }
        if (modal.data?.id) {
          await posApi.inventory.updatePurchaseOrder(modal.data.id, {
            supplier: modalDraft.supplier || modal.data.supplier || '',
            expected_at: modalDraft.expected_at || null,
            items: orderItems,
          })
          setMessage('Purchase order updated.')
        } else {
          await posApi.inventory.createPurchaseOrder({
            branch: activeBranchId,
            supplier: modalDraft.supplier || suppliers[0]?.name || 'Default Supplier',
            created_by: user?.id || null,
            expected_at: modalDraft.expected_at || null,
            items: orderItems,
          })
          setMessage('Purchase order placed.')
        }
      } else if (modal.type === 'poCancel' && modal.data?.id) {
        await posApi.inventory.cancelPurchaseOrder(modal.data.id)
        setMessage('Purchase order cancelled.')
      } else if (modal.type === 'poDelete' && modal.data?.id) {
        await posApi.inventory.deletePurchaseOrder(modal.data.id)
        setMessage('Purchase order deleted.')
      } else if (modal.type === 'receive') {
        const poList = Array.isArray(purchaseOrders) ? purchaseOrders : []
        const po = poList.find((item) => item.id === Number(modalDraft.purchase_order)) || poList.find((item) => item.status !== 'received' && item.items?.length)
        if (po) {
          const receiveItems = po.items.map((item) => {
            const remaining = Math.max(0, Number(item.ordered_quantity) - Number(item.received_quantity))
            return {
              item: item.id,
              received_quantity: Math.max(0, Math.min(remaining, Number(modalDraft[`receive_${item.id}`] ?? remaining))),
            }
          })
          await posApi.inventory.receivePurchaseOrder(po.id, { user: user?.id || null, items: receiveItems })
        }
        setMessage(po ? 'Goods received and stock updated.' : 'No open purchase order to receive.')
      } else if (modal.type === 'adjust' && modal.data?.id) {
        await posApi.inventory.adjustStock({ branch: activeBranchId, product: modal.data.id, quantity_delta: Number(modalDraft.quantity_delta || 1), reason: modalDraft.reason || 'Backoffice adjustment', user: user?.id || null })
        setMessage('Stock adjusted.')
        const freshCount = await loadAdjustmentLogs()
        setAuditLogPage(Math.max(1, Math.ceil(freshCount / STOCK_PAGE_SIZE)))
      } else if (modal.type === 'stocktake') {
        await posApi.inventory.startStocktake({ branch: activeBranchId, created_by: user?.id || null, note: modalDraft.note || 'Backoffice stocktake' })
        setMessage('Stocktake session created.')
      } else if (modal.type === 'countStocktake') {
        const session = modal.data
        if (!session || session.status === 'approved' || session.status === 'cancelled') {
          setMessage('This session is locked and cannot be edited.')
          return
        }
        await posApi.inventory.countStocktake(session.id, { items: (session.items || []).map((item) => ({ item: item.id, counted_quantity: Number(modalDraft[`count_${item.id}`] ?? item.counted_quantity) })) })
        setMessage('Stocktake counts saved.')
      } else if (modal.type === 'approveVariance') {
        const session = (modal.data && stocktakes.find((item) => item.id === Number(modal.data.id))) || stocktakes.find((item) => item.status !== 'approved')
        if (session) await posApi.inventory.approveStocktake(session.id, { user: user?.id || null })
        setMessage(session ? 'Stocktake approved and variances posted to inventory.' : 'No stocktake session available to approve.')
      }
      setModal(null)
      setModalDraft({})
      await loadLiveData()
    } catch (error) {
      setMessage(formatApiError(error))
    }
  }

  const deleteModalItem = async () => {
    try {
      if (modal.type === 'product' && modal.data?.id) {
        await posApi.inventory.updateProduct(modal.data.id, { is_active: false })
        setMessage('Product deleted from active catalogue.')
      } else if (modal.type === 'category' && modal.data?.id) {
        await posApi.inventory.updateCategory(modal.data.id, { is_active: false })
        setMessage('Category deleted from active catalogue.')
      } else if (modal.type === 'supplier' && modal.data?.id) {
        await posApi.inventory.updateSupplier(modal.data.id, { is_active: false })
        setMessage('Supplier deleted from active directory.')
      } else if (modal.type === 'poDelete' && modal.data?.id) {
        await posApi.inventory.deletePurchaseOrder(modal.data.id)
        setMessage('Purchase order deleted.')
      }
      setModal(null)
      setModalDraft({})
      await loadLiveData()
    } catch (error) {
      setMessage(formatApiError(error))
    }
   }

  const loadAdjustmentLogs = () => {
    return posApi.auditLogs({
      module: 'inventory',
      action: 'adjust_stock',
      page: auditLogPage,
      page_size: STOCK_PAGE_SIZE,
    }).then((data) => {
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
      const count = data?.count || rows.length
      setAdjustmentLogs(rows)
      setAdjustmentLogCount(count)
      return count
    }).catch(() => {
      // back-end audit-log filter not available yet — keep empty list
      return 0
    })
  }

return (
    <div className="space-y-4">
      <Header section={section} onAction={() => openModal(defaultModalFor(section))} />
      {message && <Toast message={message} onClose={() => setMessage('')} />}

      {section === 'Products' && <ProductsView items={liveProducts} categories={categories} categoryMeta={categoryMeta} meta={productMeta} page={productPage} onPageChange={setProductPage} onCreate={() => openModal({ type: 'product', title: 'Create Product' })} onCreateCategory={() => openModal({ type: 'category', title: 'Create Category' })} onEdit={(product) => openModal({ type: 'product', title: product.name, data: product }, product)} onEditCategory={(category) => openModal({ type: 'category', title: category.name, data: category }, category)} />}
      {section === 'Purchase Orders' && <PurchaseOrdersView purchaseOrders={purchaseOrders} onCreate={() => openModal({ type: 'po', title: 'Create Purchase Order' })} onDetail={(po) => openModal({ type: 'poDetail', title: po.po_no || 'PO Detail', data: po })} onCancel={(po) => openModal({ type: 'poCancel', title: 'Cancel Purchase Order', data: po }) } onUpdate={(po) => openModal({ type: 'po', title: 'Edit ' + (po.po_no || 'PO'), data: po }, { supplier: po.supplier, expected_at: po.expected_at, items: (po.items || []).filter((item) => item.is_active !== false) })} onDelete={(po) => openModal({ type: 'poDelete', title: 'Delete Purchase Order', data: po })} />}
      {section === 'Goods Receiving' && <GoodsReceivingView purchaseOrders={purchaseOrders} onReceive={(po) => openModal({ type: 'receive', title: 'Confirm Goods Receiving' }, { purchase_order: po?.id })} />}
      {section === 'Stock Management' && <StockManagementView items={liveProducts} lowStockRows={lowStockRows} movements={stockMovements} onAdjust={(product) => openModal({ type: 'adjust', title: `Adjust ${product.name}`, data: product }, { quantity_delta: 1, reason: 'Manual correction' })} stockProductPage={stockProductPage} onStockProductPageChange={setStockProductPage} stockMovementPage={stockMovementPage} onStockMovementPageChange={setStockMovementPage} adjustmentLogs={adjustmentLogs} adjustmentLogCount={adjustmentLogCount} auditLogPage={auditLogPage} onAuditLogPageChange={setAuditLogPage} />}
      {section === 'Stocktake' && <StocktakeView sessions={stocktakes} onCreate={() => openModal({ type: 'stocktake', title: 'Create Stocktake Session' })} onCount={(session) => openModal({ type: 'countStocktake', title: session.session_no, data: session }, Object.fromEntries((session.items || []).map((item) => [`count_${item.id}`, item.counted_quantity])))} onApprove={(session) => openModal({ type: 'approveVariance', title: 'Approve ' + (session.session_no || 'Stocktake'), data: session }, { stocktake: session?.id })} />}
      {section === 'Monthly Variance' && <MonthlyVarianceView sessions={stocktakes} onApprove={(session) => openModal({ type: 'approveVariance', title: 'Approve Final Reconciliation' }, { stocktake: session?.id })} />}
      {section === 'Warehouses' && <WarehouseView products={liveProducts} branches={branches} onTransfer={() => openModal({ type: 'transfer', title: 'Transfer Stock' })} />}
      {section === 'Suppliers' && <SuppliersView suppliers={suppliers} meta={supplierMeta} onCreate={() => openModal({ type: 'supplier', title: 'Create Supplier' })} onEdit={(supplier) => openModal({ type: 'supplier', title: supplier.name, data: supplier }, supplier)} />}
      {section === 'Inventory Reports' && <ReportsView categories={categories} />}

      {modal && <InventoryModal modal={modal} draft={modalDraft} setDraft={setModalDraft} products={liveProducts} categories={categories} suppliers={suppliers} purchaseOrders={purchaseOrders} stocktakes={stocktakes} onClose={() => setModal(null)} onConfirm={confirmModal} onDelete={deleteModalItem} />}
    </div>
  )
}

const defaultModalFor = (section) => {
  if (section === 'Products') return { type: 'product', title: 'Create Product' }
  if (section === 'Purchase Orders') return { type: 'po', title: 'Create Purchase Order' }
  if (section === 'Goods Receiving') return { type: 'receive', title: 'Confirm Goods Receiving' }
  if (section === 'Stock Management') return { type: 'adjust', title: 'Stock Adjustment' }
  if (section === 'Stocktake') return { type: 'stocktake', title: 'Create Stocktake Session' }
  if (section === 'Monthly Variance') return { type: 'approveVariance', title: 'Approve Final Reconciliation' }
  if (section === 'Warehouses') return { type: 'transfer', title: 'Transfer Stock' }
  return { type: 'export', title: 'Export Inventory Report' }
}

const Header = ({ section, onAction }) => (
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Inventory / {section}</h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-1">Control products, purchases, receiving, stock levels, stocktake, variance, warehouses, suppliers, and inventory reports.</p>
    </div>
    <button onClick={onAction} className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800">
      <FaPlus className="mr-2" />
      New Action
    </button>
  </div>
)

const Toast = ({ message, onClose }) => (
  <div className="fixed right-4 top-4 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-emerald-200 bg-white px-4 py-3 shadow-xl">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <FaCheck className="text-xs" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{message}</p>
      </div>
      <button onClick={onClose} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200">
        <FaTimes className="text-xs" />
      </button>
    </div>
  </div>
)

const ProductsView = ({ items = [], categories = [], categoryMeta = {}, meta = {}, page = 1, onPageChange = () => {}, onCreate, onCreateCategory, onEdit, onEditCategory }) => {
  const [priceView, setPriceView] = useState('full')
  const showMargins = priceView === 'full'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Catalogue SKUs" value={items.length.toLocaleString()} />
        <Metric label="Active Products" value={items.filter((item) => item.is_active).length.toLocaleString()} />
        <Metric label="Low Stock" value={items.filter((item) => item.stock <= item.reorderPoint).length.toLocaleString()} />
        <Metric label="Stock Value" value={money(items.reduce((sum, item) => sum + item.cost * item.stock, 0))} />
      </div>
      <CategoriesView categories={categories} products={items} meta={categoryMeta} onCreate={onCreateCategory} onEdit={onEditCategory} />
      <Panel
        title="Product & Item Catalogue"
        icon={FaBoxes}
        action={
          <div className="hidden sm:flex gap-2">
            <button className="px-3 py-1.5 bg-slate-100 rounded text-xs">Import CSV</button>
            <button className="px-3 py-1.5 bg-slate-100 rounded text-xs">Bulk Price Edit</button>
            <button onClick={onCreateCategory} className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs">Add Category</button>
            <button onClick={onCreate} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Add Product</button>
          </div>
        }
      >
      <FilterBar filters={['Category', 'Stock level', 'Supplier', 'Price mode']} />
      <div className="px-3 py-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-500">
        <span>Showing {items.length.toLocaleString()} of {(meta.count || items.length).toLocaleString()} SKUs. Tables request {meta.pageSize || TABLE_PAGE_SIZE} rows per page for large catalogues.</span>
        <div className="flex items-center gap-2">
          <span>Price view</span>
          <select value={priceView} onChange={(event) => setPriceView(event.target.value)} className="px-2 py-1 border border-slate-300 rounded bg-white">
            <option value="full">Retail + Wholesale</option>
            <option value="retail">Retail only</option>
            <option value="wholesale">Wholesale only</option>
          </select>
        </div>
      </div>
      <DenseTable
        columns={
          showMargins
            ? ['Item', 'SKU', 'Barcode', 'Category', 'Supplier', 'Unit', 'Stock Level', 'Cost', 'Retail Price', 'Retail Margin', 'Wholesale Price', 'Wholesale Margin', 'Status']
            : ['Item', 'SKU', 'Category', 'Supplier', 'Unit', 'Stock Level', 'Cost', priceView === 'retail' ? 'Retail Price' : 'Wholesale Price', 'Status']
        }
        rows={items.map((product) => [
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${product.imageTone}`}>{product.name.slice(0, 2).toUpperCase()}</div>
            <div><p className="font-semibold text-slate-900">{product.name}</p><p className="text-[11px] text-slate-500">{product.barcode}</p></div>
          </div>,
          product.sku,
          ...(showMargins ? [product.barcode, product.category, product.supplier, product.unit] : [product.category, product.supplier, product.unit]),
          <StockBar value={product.stock} reorder={product.reorderPoint} />,
          money(product.cost),
          ...(showMargins ? [money(product.price), `${Math.round(((product.price - product.cost) / product.price) * 100)}%`, money(product.wholesale), `${Math.round(((product.wholesale - product.cost) / product.wholesale) * 100)}%`] : [money(priceView === 'retail' ? product.price : product.wholesale)]),
          <Status product={product} />,
        ])}
        rowData={items}
        onRowClick={onEdit}
        numericColumns={showMargins ? [7, 8, 9, 10, 11] : [6, 7]}
        pinFirst
      />
      {meta.count > (meta.pageSize || TABLE_PAGE_SIZE) && (
        <div className="px-3 py-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <span>Page {page} of {Math.max(1, Math.ceil(meta.count / (meta.pageSize || TABLE_PAGE_SIZE)))}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 text-xs font-semibold">Previous</button>
            <button type="button" disabled={page >= Math.max(1, Math.ceil(meta.count / (meta.pageSize || TABLE_PAGE_SIZE)))} onClick={() => onPageChange(page + 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 text-xs font-semibold">Next</button>
          </div>
        </div>
      )}
    </Panel>
    </div>
  )
}

const CategoriesView = ({ categories = [], products = [], meta = {}, onCreate, onEdit }) => {
  const colorClass = (color) => ({
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
  }[color] || 'bg-slate-400')
  const rows = categories.map((category) => {
    const productCount = products.filter((product) => product.category === category.name || product.category_id === category.id || product.category === category.id).length
    return [
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${colorClass(category.color)}`} />
        <span className="font-semibold text-slate-900">{category.name}</span>
      </div>,
      category.color || 'Default',
      productCount,
      category.is_active ? <Badge>Active</Badge> : <Badge>Inactive</Badge>,
    ]
  })

  return (
    <Panel title="Categories" icon={FaTags} action={<button onClick={onCreate} className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs">Add Category</button>}>
      {categories.length ? (
        <>
          <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
            Showing {categories.length.toLocaleString()} of {(meta.count || categories.length).toLocaleString()} categories. Category lists are paged for large catalogs.
          </div>
          <DenseTable
            columns={['Category', 'Color', 'Products on current page', 'Status']}
            rows={rows}
            rowData={categories}
            onRowClick={onEdit}
            numericColumns={[2]}
          />
        </>
      ) : (
        <div className="p-4 text-sm text-slate-600">
          No categories yet. Create a category before adding products.
        </div>
      )}
    </Panel>
  )
}

const getStatusBadge = (status) => {
  const statusStyles = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'pending approval': 'bg-amber-100 text-amber-700 border-amber-200',
    'approved': 'bg-blue-100 text-blue-700 border-blue-200',
    'partial': 'bg-violet-100 text-violet-700 border-violet-200',
    'received': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'open': 'bg-amber-100 text-amber-700 border-amber-200',
    'completed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  const normalizedStatus = (status || 'draft').toLowerCase()
  const style = statusStyles[normalizedStatus] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={`px-2 py-1 rounded text-xs font-semibold border ${style}`}>{status || 'draft'}</span>
}

const getSupplierColor = (supplier) => {
  const colors = ['bg-emerald-50 border-emerald-200', 'bg-blue-50 border-blue-200', 'bg-amber-50 border-amber-200', 'bg-violet-50 border-violet-200', 'bg-rose-50 border-rose-200']
  let hash = 0
  for (let i = 0; i < (supplier || '').length; i++) {
    hash = ((hash << 5) - hash) + supplier.charCodeAt(i)
    hash = hash & hash
  }
  return colors[Math.abs(hash) % colors.length]
}

const PurchaseOrdersView = ({ purchaseOrders = [], onCreate, onDetail, onCancel, onUpdate, onDelete }) => {
  const rows = Array.isArray(purchaseOrders) && purchaseOrders.length ? purchaseOrders : []

  const canEdit = (po) => !['cancelled', 'received', 'partial'].includes(po.status)

  return (
    <div className="space-y-4">
      <Panel title="Purchase Orders" icon={FaFileInvoiceDollar} action={<button onClick={onCreate} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Create PO</button>}>
        <DenseTable
          columns={['Status', 'PO Number', 'Supplier', 'Branch', 'Items', 'Total Amount', 'Action']}
          rows={rows.map((po) => [
            getStatusBadge(po.status || 'draft'),
            po.po_no || 'PO-' + po.id,
            po.supplier || 'Supplier',
            po.branch_display || po.branch_name || po.branch_name_display || 'Main Branch',
            Array.isArray(po.items) ? po.items.length : Number(po.items || 0),
            money(po.amount || po.total || 0),
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <button onClick={(event) => { event.stopPropagation(); onDetail && onDetail(po) }} className="px-2 py-1 bg-slate-100 rounded text-xs font-semibold">View</button>
              {canEdit(po) && (
                <button onClick={(event) => { event.stopPropagation(); onCancel && onCancel(po) }} className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-semibold">Cancel</button>
              )}
              {canEdit(po) && (
                <button onClick={(event) => { event.stopPropagation(); onUpdate && onUpdate(po) }} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">Edit</button>
              )}
              {canEdit(po) && (
                <button onClick={(event) => { event.stopPropagation(); onDelete && onDelete(po) }} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-semibold">Delete</button>
              )}
            </div>,
          ])}
          rowData={rows}
          onRowClick={onDetail}
          numericColumns={[4, 5]}
        />
      </Panel>
    </div>
  )
}

const GoodsReceivingView = ({ purchaseOrders = [], onReceive }) => {
  const openOrders = Array.isArray(purchaseOrders) ? purchaseOrders.filter((po) => po.status !== 'received' && po.status !== 'cancelled') : []

  return (
    <Panel title="Goods Receiving Note" icon={FaClipboardCheck}>
      <div className="p-3 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded text-xs font-semibold">Partial delivery support enabled</div>
        <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded text-xs font-semibold">Stock update preview before confirmation</div>
      </div>
      <DenseTable
        columns={['PO Number', 'Supplier', 'Items', 'Total Ordered', 'Received', 'Remaining', 'Status', 'Action']}
        rows={openOrders.map((po) => {
          const itemCount = po.items?.length || 0
          const totalOrdered = (po.items || []).reduce((s, i) => s + Number(i.ordered_quantity || 0), 0)
          const totalReceived = (po.items || []).reduce((s, i) => s + Number(i.received_quantity || 0), 0)
          const remaining = Math.max(0, totalOrdered - totalReceived)
          const status = remaining === 0 ? 'Completed' : totalReceived > 0 ? 'Partial' : 'Open'
          return [
            po.po_no,
            po.supplier,
            itemCount,
            totalOrdered,
            totalReceived,
            remaining,
            <Badge>{status}</Badge>,
            <button onClick={(event) => { event.stopPropagation(); onReceive(po) }} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs whitespace-nowrap font-semibold">Receive</button>,
          ]
        })}
        rowData={openOrders}
        onRowClick={onReceive}
        numericColumns={[3, 4, 5]}
      />
    </Panel>
  )
}

const AdjustmentAuditTable = ({ logs = [], count = 0, page, onPageChange, pageSize = STOCK_PAGE_SIZE }) => {
  const currentCount = typeof count === 'number' && count > 0 ? count : logs.length
  const totalPages = Math.max(1, Math.ceil(currentCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const visible = logs.slice((safePage - 1) * pageSize, safePage * pageSize)
  if (!logs.length && !count) return null
  return (
    <Panel title="Stock Adjustment Log" icon={FaExchangeAlt} action={
      <div className="flex items-center gap-1">
        <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 text-xs font-semibold">Previous</button>
        <span className="px-2 text-xs font-semibold text-slate-500">Page {safePage} of {totalPages}</span>
        <button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 text-xs font-semibold">Next</button>
      </div>
    }>
      {logs.length ? (
        <div className="divide-y divide-slate-200">
          {visible.map((entry, index) => {
            const avatar = String(entry?.user || entry?.username || 'A').charAt(0).toUpperCase()
            return (
              <div key={entry.id || entry.timestamp || index} className="flex items-center justify-between px-4 py-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{avatar}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{String(entry.user || entry.username || 'System')}</p>
                    <p className="text-slate-500 truncate">product: {entry.product_name || entry.product || entry.product_name || '—'} <span className="mx-1 text-slate-300">|</span> {entry.reason || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${Number(entry.quantity_delta) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {'+'}{Number(entry.quantity_delta)}
                  </span>
                  <span className="text-slate-500 whitespace-nowrap">{new Date(entry.timestamp || entry.created_at).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-4 text-xs text-slate-500">No adjustment history yet. Changes will be recorded here after each stock adjustment.</div>
      )}
    </Panel>
  )
}

const StockManagementView = ({ items, lowStockRows, movements: liveMovements, onAdjust, stockProductPage, onStockProductPageChange, stockMovementPage, onStockMovementPageChange, adjustmentLogs, adjustmentLogCount, auditLogPage, onAuditLogPageChange }) => {
  const totalStock = items ? items.length : 0
  const lowStock = lowStockRows ? lowStockRows.length : 0
  const totalMovements = liveMovements ? liveMovements.length : 0
  const totalAdjustments = typeof adjustmentLogCount === 'number' && adjustmentLogCount > 0 ? adjustmentLogCount : 0

  const stockProductPageCount = Math.max(1, Math.ceil(totalStock / STOCK_PAGE_SIZE))
  const safeStockProductPage = Math.min(stockProductPage || 1, stockProductPageCount)
  const visibleStock = Array.isArray(items) ? items.slice((safeStockProductPage - 1) * STOCK_PAGE_SIZE, safeStockProductPage * STOCK_PAGE_SIZE) : []

  const movementPageCount = Math.max(1, Math.ceil(totalMovements / STOCK_PAGE_SIZE))
  const safeMovementPage = Math.min(stockMovementPage || 1, movementPageCount)
  const visibleMovements = Array.isArray(liveMovements) ? liveMovements.slice((safeMovementPage - 1) * STOCK_PAGE_SIZE, safeMovementPage * STOCK_PAGE_SIZE) : []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric label="Current SKUs" value={totalStock.toLocaleString()} />
        <Metric label="Low Stock Alerts" value={lowStock.toLocaleString()} />
        <Metric label="Stock Movements" value={totalMovements.toLocaleString()} />
      </div>
      <Panel title="Stock Overview" icon={FaWarehouse}>
        {totalStock === 0 ? (
          <div className="p-4 text-sm text-slate-600">No stock data available.</div>
        ) : (
          <DenseTable
            columns={['Product', 'Current Stock', 'Warehouse / Location', 'Reorder Alert', 'Action']}
            rows={visibleStock.map((product) => [product.name, product.stock, product.branch || 'Main Branch', product.stock <= product.reorderPoint ? <span className="text-red-600 font-bold">Reorder now</span> : 'Healthy', <button onClick={(event) => { event.stopPropagation(); onAdjust(product) }} className="px-2 py-1 bg-slate-100 rounded">Adjust</button>])}
            rowData={visibleStock}
            onRowClick={onAdjust}
            numericColumns={[1]}
          />
        )}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-[11px] text-slate-500">
          <span>Showing {(safeStockProductPage - 1) * STOCK_PAGE_SIZE + 1} – {Math.min(safeStockProductPage * STOCK_PAGE_SIZE, totalStock)} of {totalStock} SKUs</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safeStockProductPage <= 1} onClick={() => onStockProductPageChange(safeStockProductPage - 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 font-semibold">Previous</button>
            <span>Page {safeStockProductPage} of {stockProductPageCount}</span>
            <button type="button" disabled={safeStockProductPage >= stockProductPageCount} onClick={() => onStockProductPageChange(safeStockProductPage + 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 font-semibold">Next</button>
          </div>
        </div>
      </Panel>
      <Panel title="Stock Movement History" icon={FaExchangeAlt}>
        {!totalMovements ? (
          <div className="p-4 text-sm text-slate-600">No stock movements recorded yet. Adjustments and purchases will appear here.</div>
        ) : (
          <>
            <DenseTable
              columns={['Product', 'Type', 'Qty', 'User', 'Timestamp', 'Location']}
              rows={visibleMovements.map((row) => [row.product || row.product_name, row.type || row.reason, row.qty || row.quantity_delta, row.user || 'System', row.time || new Date(row.created_at).toLocaleString(), row.location || 'Main Branch'])}
              numericColumns={[2]}
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-[11px] text-slate-500">
              <span>Showing {(safeMovementPage - 1) * STOCK_PAGE_SIZE + 1} – {Math.min(safeMovementPage * STOCK_PAGE_SIZE, totalMovements)} of {totalMovements} events</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={safeMovementPage <= 1} onClick={() => onStockMovementPageChange(safeMovementPage - 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 font-semibold">Previous</button>
                <span>Page {safeMovementPage} of {movementPageCount}</span>
                <button type="button" disabled={safeMovementPage >= movementPageCount} onClick={() => onStockMovementPageChange(safeMovementPage + 1)} className="px-2 py-1 rounded bg-white disabled:opacity-40 font-semibold">Next</button>
              </div>
            </div>
          </>
        )}
      </Panel>
      <AdjustmentAuditTable logs={adjustmentLogs} count={adjustmentLogCount} page={auditLogPage} onPageChange={onAuditLogPageChange} />
    </div>
  )
}

const StocktakeView = ({ sessions = [], onCreate, onCount, onApprove }) => {
  const statusStyle = (s) => {
    const t = (s || '').toLowerCase()
    return t === 'approved'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : t === 'counted'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : t === 'cancelled'
          ? 'bg-red-100 text-red-700 border-red-200'
          : 'bg-amber-100 text-amber-700 border-amber-200'
  }
  const isEditable = (row) => row.status !== 'approved' && row.status !== 'cancelled'
  const totalVariance = (items = []) =>
    items.reduce((sum, item) => sum + (Number(item.counted_quantity || 0) - Number(item.system_quantity || 0)), 0)
  const approvedCount = sessions.filter((s) => s.status === 'approved').length
  const openSessions = sessions.filter((s) => s.status !== 'approved')

  return (
    <div className="space-y-4">
      <Panel title="Stocktake Sessions" icon={FaClipboardCheck} action={<button onClick={onCreate} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Create Session</button>}>
        {!sessions.length ? (
          <div className="p-4 text-sm text-slate-500 text-center">No stocktake sessions yet. Click <strong>Create Session</strong> to start one.</div>
        ) : (
          <DenseTable
            columns={['Session', 'Branch', 'Status', 'Items', 'Variance Qty', 'Created', 'Action']}
            rows={sessions.map((row) => {
              const items = row.items || []
              const v = totalVariance(items)
              const editable = isEditable(row)
              return [
                row.session_no,
                row.branch_name || row.branch?.name || row.branch_display || `#${row.branch || '—'}`,
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusStyle(row.status)}`}>{row.status || 'open'}</span>,
                items.length,
                <span className={`font-semibold ${v < 0 ? 'text-red-600' : v > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>{v > 0 ? '+' : ''}{v}</span>,
                row.created_at ? new Date(row.created_at).toLocaleDateString() : '—',
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => { e.stopPropagation(); onCount(row) }} disabled={!editable} title={editable ? '' : 'Session is locked — cannot be edited'} className={`px-2 py-1 rounded text-xs font-semibold ${editable ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}>Count</button>
                  {editable && (
                    <button onClick={(e) => { e.stopPropagation(); onApprove && onApprove(row) }} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">Approve</button>
                  )}
                </div>,
              ]
            })}
            rowData={sessions}
            onRowClick={(row) => isEditable(row) && onCount(row)}
            numericColumns={[3, 4]}
          />
        )}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-[11px] text-slate-500">
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''} · {approvedCount} approved · {openSessions.length} pending</span>
        </div>
      </Panel>

      {openSessions.length > 0 && (
        <Panel title="Mobile Stock Counting" icon={FaBarcode}>
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <FaBarcode className="absolute left-3 top-3 text-slate-400" />
              <input placeholder="Scan barcode or type SKU" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <DenseTable
            columns={['Product', 'SKU', 'System Qty', 'Physical Count', 'Variance']}
            rows={openSessions[0]?.items?.map((row) => {
              const diff = Number(row.counted_quantity || 0) - Number(row.system_quantity || 0)
              return [row.product_name, row.sku, row.system_quantity, row.counted_quantity, <span className={diff < 0 ? 'text-red-700 font-bold' : diff > 0 ? 'text-emerald-700 font-bold' : 'text-slate-600'}>{diff > 0 ? '+' : ''}{diff}</span>]
            }) || []}
            numericColumns={[2, 3, 4]}
          />
        </Panel>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold">Stocktake Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Metric label="Total Sessions" value={sessions.length} />
          <Metric label="Approved" value={approvedCount} />
          <Metric label="Pending Review" value={openSessions.length} />
          <Metric label="Net Variance Qty" value={sessions.reduce((sum, s) => sum + totalVariance(s.items || []), 0)} />
        </div>
        {openSessions.length > 0 && (
          <div className="mt-4 flex items-center justify-end gap-2">
            {openSessions.filter((s) => s.status !== 'cancelled').map((session) => (
              <button key={session.id} onClick={() => onApprove && onApprove(session)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                Approve {session.session_no}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const MonthlyVarianceView = ({ sessions = [], onApprove }) => {
  const rows = sessions.flatMap((session) => (session.items || []).filter((item) => Number(item.variance) !== 0).map((item) => ({ ...item, session })))
  const netImpact = rows.reduce((sum, row) => sum + Number(row.variance), 0)
  return (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Metric label="Variance Loss" value={rows.filter((row) => Number(row.variance) < 0).length} />
      <Metric label="Variance Gain" value={rows.filter((row) => Number(row.variance) > 0).length} />
      <Metric label="Net Units" value={netImpact} />
      <Metric label="Sessions" value={sessions.length} />
    </div>
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold">Monthly Variance Trend</h2>
      <div className="flex items-end gap-2 h-32 mt-4">
        {[45, 62, 38, 70, 54, 80].map((height, index) => <div key={index} className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${height}%` }} />)}
      </div>
    </div>
    <Panel title="Variance Report" icon={FaChartLine} action={<button onClick={() => onApprove(sessions.find((session) => session.status !== 'approved'))} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Approve Reconciliation</button>}>
      <DenseTable columns={['Session', 'Product', 'Expected Stock', 'Actual Stock', 'Difference']} rows={rows.map((row) => [row.session.session_no, row.product_name, row.system_quantity, row.counted_quantity, <span className={Number(row.variance) < 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>{row.variance}</span>])} numericColumns={[2, 3, 4]} />
    </Panel>
  </div>
  )
}

const WarehouseView = ({ products: liveProducts = [], branches = [], onTransfer }) => {
  const warehouses = branches.length ? branches.map((branch) => ({
    name: branch.name,
    location: branch.location,
    value: liveProducts.reduce((sum, product) => sum + product.cost * product.stock, 0),
    items: liveProducts.length,
  })) : []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {warehouses.map((warehouse) => (
          <div key={warehouse.name} className="bg-white rounded-lg border border-slate-200 p-4">
            <FaWarehouse className="text-emerald-600 text-xl mb-3" />
            <h2 className="font-semibold">{warehouse.name}</h2>
            <p className="text-xs text-slate-500 mt-1">{warehouse.location}</p>
            <p className="mt-3 text-lg font-bold">{money(warehouse.value)}</p>
            <p className="text-xs text-slate-500">{warehouse.items} items</p>
          </div>
        ))}
        {warehouses.length === 0 && (
          <div className="md:col-span-4 p-4 text-sm text-slate-400 text-center">No warehouse data available.</div>
        )}
      </div>
      <Panel title="Stock Per Warehouse" icon={FaWarehouse} action={<button onClick={onTransfer} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Transfer Stock</button>}>
        <DenseTable columns={['Warehouse', 'Product', 'Qty', 'Stock Value']} rows={(branches || []).flatMap((warehouse) => (liveProducts || []).map((product) => [warehouse.name, product.name, product.stock, money(product.stock * product.cost)]))} numericColumns={[2, 3]} />
      </Panel>
    </div>
  )
}

const SuppliersView = ({ suppliers = [], meta = {}, onCreate, onEdit }) => (
  <Panel title="Supplier Directory" icon={FaTruck} action={<button onClick={onCreate} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">Add Supplier</button>}>
    <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
      Showing {suppliers.length.toLocaleString()} of {(meta.count || suppliers.length).toLocaleString()} suppliers.
    </div>
    {suppliers.length ? (
      <DenseTable columns={['Supplier', 'Contact Person', 'Phone', 'Email', 'Status']} rows={suppliers.map((supplier) => [supplier.name, supplier.contact_person || '—', supplier.phone || '—', supplier.email || '—', supplier.is_active ? <Badge>Active</Badge> : <Badge>Inactive</Badge>])} rowData={suppliers} onRowClick={onEdit} numericColumns={[]} />
    ) : (
      <div className="p-4 text-sm text-slate-600">No suppliers yet. Add a supplier to get started.</div>
    )}
  </Panel>
)

const ReportsView = ({ categories = [] }) => {
  const { branch: authBranch, company_branches: authBranches } = useAuth()
  const [branchId, setBranchId] = useState(authBranch?.id || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [loadingVal, setLoadingVal] = useState(false)
  const [loadingFsm, setLoadingFsm] = useState(false)
  const [loadingVar, setLoadingVar] = useState(false)
  const [message, setMessage] = useState('')

  // ── report data ──────────────────────────────────────────────────────
  const [valuationRows, setValuationRows] = useState([])
  const [valuationSummary, setValuationSummary] = useState(null)
  const [fsmFast, setFsmFast] = useState([])
  const [fsmSlow, setFsmSlow] = useState([])
  const [fsmAvg, setFsmAvg] = useState(0)
  const [fsmPeriodDays, setFsmPeriodDays] = useState(30)
  const [varMonths, setVarMonths] = useState([])  // ["2026-01", …]
  const [varRows, setVarRows] = useState([])
  const [varYear, setVarYear] = useState(String(new Date().getFullYear()))

  const activeBranch = authBranches?.find(b => b.id === Number(branchId)) || authBranch
  const _extra = (params = {}) => ({
    branch: branchId || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    category: categoryId || undefined,
    ...params,
  })

  // ── fetch helpers ────────────────────────────────────────────────────
  useEffect(() => {
    if ((branchId || startDate || endDate || categoryId) && loadingVal) {
      (async () => {
        try {
          const data = await posApi.stockValuation(_extra())
          setValuationRows(Array.isArray(data?.rows) ? data.rows : [])
          setValuationSummary(data?.summary || null)
        } catch { setValuationRows([]); setValuationSummary(null) } finally { setLoadingVal(false) }
      })()
    }
  }, [loadingVal, branchId, startDate, endDate, categoryId])

  const triggerValuation = () => { setValuationRows([]); setValuationSummary(null); setLoadingVal(true) }

  useEffect(() => {
    if ((branchId || startDate || endDate || categoryId) && loadingFsm) {
      (async () => {
        try {
          const data = await posApi.fastSlowMoving(_extra({ days: fsmPeriodDays || 30 }))
          setFsmFast(Array.isArray(data?.fast_moving) ? data.fast_moving : [])
          setFsmSlow(Array.isArray(data?.slow_moving) ? data.slow_moving : [])
          setFsmAvg(data?.average_movement_per_product || 0)
          setFsmPeriodDays(data?.period_days || fsmPeriodDays)
        } catch { setFsmFast([]); setFsmSlow([]); setFsmAvg(0) } finally { setLoadingFsm(false) }
      })()
    }
  }, [loadingFsm, branchId, startDate, endDate, categoryId])

  const triggerFsm = () => { setFsmFast([]); setFsmSlow([]); setLoadingFsm(true) }

  useEffect(() => {
    if ((branchId || startDate || endDate || categoryId) && loadingVar) {
      (async () => {
        try {
          const data = await posApi.inventory.monthlyVariance(_extra({ year: varYear }))
          setVarRows(Array.isArray(data?.rows) ? data.rows : [])
          setVarMonths(data?.months || [])
        } catch { setVarRows([]); setVarMonths([]) } finally { setLoadingVar(false) }
      })()
    }
  }, [loadingVar, branchId, startDate, endDate, categoryId])

  const triggerVariance = () => { setVarRows([]); setVarMonths([]); setLoadingVar(true) }

  // ── download helpers ─────────────────────────────────────────────────
  const downloadFile = async (reportType, format) => {
    try {
      const p = new URLSearchParams()
      if (branchId) p.set('branch', branchId)
      if (startDate) p.set('start_date', startDate)
      if (endDate) p.set('end_date', endDate)
      if (categoryId) p.set('category', categoryId)
      p.set('export', format)
      let url
      if (reportType === 'valuation') url = `/stock/stock-valuation/?${p}`
      else if (reportType === 'fsm') { p.set('days', fsmPeriodDays || 30); url = `/stock/fast-slow-moving/?${p}` }
      else { p.set('year', varYear); url = `/stock/monthly-variance/?${p}` }
      const resp = await posApi.rawFetch(url)
      const blob = await resp.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${reportType}_report.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (err) {
      setMessage(err.message || 'Download failed.')
    }
  }

  const downloadCsv = (reportType) => downloadFile(reportType, 'csv')
  const downloadPdf = (reportType) => downloadFile(reportType, 'pdf')

  const barChart = (vals, maxVal) => vals.map((v, i) => {
    const safeMax = Math.max(maxVal, 1)
    const pct = Math.max(0, Math.min(100, Math.round((Number(v) / safeMax) * 100)))
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:18px">
      <div style="font-size:9px;color:#94a3b8;font-weight:500">${Number(v).toLocaleString()}</div>
      <div style="width:100%;height:60px;background:#f1f5f9;border-radius:2px 2px 0 0;padding:0 1px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${pct}%;background:linear-gradient(180deg,#10b981,#059669);border-radius:2px 2px 0 0;transition:height .3s" /></div>
    </div>`
  }).join('')

  // trivial strip: total over N items grouped in slots for visual density
  const quickBar = (rows, key, maxBase) => {
    if (!rows?.length) return '<div class="text-xs text-slate-400 p-2">No data</div>'
    const maxVal = Math.max(...rows.map(r => Number(r[key]) || 0), 1)
    return `<div class="flex gap-1 h-10 items-end px-1">${barChart(rows.map(r => Number(r[key]) || 0), maxVal)}</div>`
  }

  const fmt = (v) => {
    const n = Number(v || 0)
    if (Math.abs(n) >= 1_000_000) return `${money(n / 1_000_000).replace('KES', 'KES')}M`
    if (Math.abs(n) >= 1_000) return `${money(n / 1_000).replace('KES', 'KES')}K`
    return money(n)
  }

  return (
    <div className="space-y-5">
      {message && <Toast message={message} onClose={() => setMessage('')} />}

      {/* ── Global Filters ───────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Branch</span>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All branches</option>
            {authBranches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            {authBranch && !branchId && <option value="">{authBranch.name} (current)</option>}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">From</span>
          <input type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            min="" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">To</span>
          <input type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Category</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button onClick={triggerValuation}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
            Apply Filters
          </button>
        </div>
      </div>

      {/* ═══ 1 · Stock Valuation ═══ */}
      <Panel
        title="Stock Valuation"
        icon={FaBoxes}
        action={
          <div className="flex gap-1">
            <button onClick={triggerValuation}
              disabled={loadingVal}
              className="px-2 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              {loadingVal ? 'Loading…' : 'Refresh'}
            </button>
<button onClick={() => downloadCsv('valuation')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaDownload className="inline mr-1" /> CSV</button>
             <button onClick={() => downloadPdf('valuation')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaFilePdf className="inline mr-1" /> PDF</button>
          </div>
        }
      >
        {/* Summary KPI strip */}
        {valuationSummary && (
          <div className="p-3 border-b border-slate-100 flex gap-4 flex-wrap">
            <div className="px-3 py-2 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500 font-semibold uppercase">Items</p>
              <p className="text-lg font-bold text-slate-900">{valuationSummary.item_count?.toLocaleString()}</p>
            </div>
            <div className="px-3 py-2 bg-emerald-50 rounded-lg">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase">Cost Value</p>
              <p className="text-lg font-bold text-emerald-700">{fmt(valuationSummary.total_cost_value)}</p>
            </div>
            <div className="px-3 py-2 bg-blue-50 rounded-lg">
              <p className="text-[10px] text-blue-600 font-semibold uppercase">Retail Value</p>
              <p className="text-lg font-bold text-blue-700">{fmt(valuationSummary.total_retail_value)}</p>
            </div>
            <div className="px-3 py-2 bg-violet-50 rounded-lg">
              <p className="text-[10px] text-violet-600 font-semibold uppercase">Wholesale Value</p>
              <p className="text-lg font-bold text-violet-700">{fmt(valuationSummary.total_wholesale_value)}</p>
            </div>
          </div>
        )}
        {/* Category mini-bar */}
        {valuationRows.length > 0 && (() => {
          const byCat = {}
          valuationRows.forEach(r => { const k = r.category || 'Uncategorised'; byCat[k] = (byCat[k] || 0) + Number(r.value_at_cost || 0) })
          const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
          const maxCat = catEntries[0]?.[1] || 1
          return (
            <div className="p-3 border-b border-slate-100 pt-0 mt-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Value by category (top 8)</p>
              <div className="flex gap-1 h-12 items-end">
                {catEntries.map(([cat, val]) => {
                  const pct = Math.max(0, Math.min(100, Math.round((val / maxCat) * 100)))
                  return <div key={cat} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 18 }}>
                    <div className="text-[9px] text-slate-400 font-semibold">{fmt(val)}</div>
                    <div style={{ width: '100%', height: '60px', background: '#f1f5f9', borderRadius: '2px 2px 0 0', padding: '0 1px', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: 'linear-gradient(180deg,#10b981,#059669)', borderRadius: '2px 2px 0 0' }} />
                    </div>
                  </div>
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {catEntries.map(([cat]) => <div key={cat} style={{ flex: 1, textAlign: 'center', minWidth: 18 }} className="text-[8px] text-slate-500 truncate">{cat}</div>)}
              </div>
            </div>
          )
        })()}
        {/* Items table */}
        <DenseTable
          columns={['Item', 'SKU', 'Category', 'Branch', 'Qty', 'Cost Price', 'Cost Value', 'Retail', 'Retail Value', 'WS Price', 'WS Value']}
          rows={valuationRows.map(r => [
            r.product_name, r.sku, r.category, r.branch,
            r.quantity, r.cost_price, r.value_at_cost,
            r.retail_price, r.value_at_retail,
            r.wholesale_price, r.value_at_wholesale,
          ])}
          numericColumns={[4, 5, 6, 7, 8, 9, 10]}
        />
        {!loadingVal && valuationRows.length === 0 && (
          <div className="p-4 text-sm text-slate-500 text-center">Click <strong>Apply Filters</strong> to load the stock valuation report.</div>
        )}
        {loadingVal && (
          <div className="p-4 text-sm text-slate-500 text-center">Loading valuation data…</div>
        )}
      </Panel>

      {/* ═══ 2 · Fast vs Slow Moving ═══ */}
      <Panel
        title="Fast vs Slow Moving Items"
        icon={FaChartLine}
        action={
          <div className="flex gap-1 flex-wrap items-center">
            <select value={fsmPeriodDays || 30}
              onChange={e => setFsmPeriodDays(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-slate-300 rounded">
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <button onClick={triggerFsm}
              disabled={loadingFsm}
              className="px-2 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              {loadingFsm ? 'Loading…' : 'Refresh'}
            </button>
<button onClick={() => downloadCsv('fsm')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaDownload className="inline mr-1" /> CSV</button>
             <button onClick={() => downloadPdf('fsm')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaFilePdf className="inline mr-1" /> PDF</button>
          </div>
        }
      >
        {/* Period & avg strip */}
        <div className="p-3 border-b border-slate-100 flex gap-4 flex-wrap">
          <div className="px-3 py-2 bg-slate-50 rounded-lg">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Period</p>
            <p className="text-lg font-bold text-slate-900">Last {fsmPeriodDays?.toLocaleString() || '30'} days</p>
          </div>
          <div className="px-3 py-2 bg-blue-50 rounded-lg">
            <p className="text-[10px] text-blue-600 font-semibold uppercase">Avg movement</p>
            <p className="text-lg font-bold text-blue-700">{fsmAvg?.toFixed(1) || '0'}</p>
          </div>
          <div className="px-3 py-2 bg-emerald-50 rounded-lg">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Fast-movers</p>
            <p className="text-lg font-bold text-emerald-700">{fsmFast?.length || 0}</p>
          </div>
          <div className="px-3 py-2 bg-amber-50 rounded-lg">
            <p className="text-[10px] text-amber-600 font-semibold uppercase">Slow-movers</p>
            <p className="text-lg font-bold text-amber-700">{fsmSlow?.length || 0}</p>
          </div>
        </div>
        {/* Polarised side-by-side bars per item */}
        {fsmFast.length > 0 && (
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Fast-moving (top 12)</p>
            {(() => {
              const top = fsmFast.slice(0, 12)
              const maxVal = Math.max(...top.map(r => r.movement_count || 0), 1)
              const topByProd = top.map(r => r.total_qty_in_out || 0)
              const maxProd = Math.max(...topByProd, 1)
              return (
                <div className="space-y-1">
                  {top.map(r => {
                    const pct = Math.max(5, Math.min(100, Math.round((r.total_qty_in_out / maxProd) * 100)))
                    return (
                      <div key={r.product_id} className="flex items-center gap-2">
                        <span className="w-28 truncate text-[11px] text-slate-600" title={r.product_name}>{r.product_name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 text-right text-[11px] font-semibold text-slate-600">{r.movement_count?.toLocaleString()} moves · {r.total_qty_in_out?.toLocaleString()} qty</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
        {fsmSlow.length > 0 && (
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Slow-moving</p>
            {(() => {
              const topSlow = fsmSlow.slice(0, 12)
              const maxProd2 = Math.max(...topSlow.map(r => r.total_qty_in_out || 0), 1)
              return (
                <div className="space-y-1">
                  {topSlow.map(r => {
                    const pct = Math.max(5, Math.min(100, Math.round((r.total_qty_in_out / maxProd2) * 100)))
                    return (
                      <div key={r.product_id} className="flex items-center gap-2">
                        <span className="w-28 truncate text-[11px] text-slate-600" title={r.product_name}>{r.product_name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 text-right text-[11px] font-semibold text-slate-600">{r.movement_count?.toLocaleString()} moves · {r.total_qty_in_out?.toLocaleString()} qty</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
        <DenseTable
          columns={['Item', 'SKU', 'Category', 'Moves', 'Qty In/Out', 'Stock']}
          rows={fsmFast.map(r => [
            <span key={r.product_id} className="font-semibold text-emerald-700">{r.product_name}</span>,
            r.sku, r.category, r.movement_count, r.total_qty_in_out, r.current_stock,
          ]).concat(fsmSlow.map(r => [
            <span key={r.product_id} className="font-semibold text-amber-700">{r.product_name}</span>,
            r.sku, r.category, r.movement_count, r.total_qty_in_out, r.current_stock,
          ]))}
          numericColumns={[3, 4, 5]}
        />
        {!loadingFsm && fsmFast.length === 0 && fsmSlow.length === 0 && (
          <div className="p-4 text-sm text-slate-500 text-center">Click <strong>Apply Filters</strong> to load the movement report.</div>
        )}
        {loadingFsm && (
          <div className="p-4 text-sm text-slate-500 text-center">Loading movement data…</div>
        )}
      </Panel>

      {/* ═══ 3 · Monthly Variance ═══ */}
      <Panel
        title="Monthly Variance"
        icon={FaChartLine}
        action={
          <div className="flex gap-1 flex-wrap items-center">
            <select value={varYear}
              onChange={e => setVarYear(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-300 rounded">
              {[String(new Date().getFullYear() - 2), String(new Date().getFullYear() - 1), String(new Date().getFullYear())].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={triggerVariance}
              disabled={loadingVar}
              className="px-2 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              {loadingVar ? 'Loading…' : 'Refresh'}
            </button>
<button onClick={() => downloadCsv('variance')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaDownload className="inline mr-1" /> CSV</button>
             <button onClick={() => downloadPdf('variance')}
               className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"><FaFilePdf className="inline mr-1" /> PDF</button>
          </div>
        }
      >
        {/* Monthly trend visual */}
        {varMonths.length > 0 && varRows.length > 0 && (() => {
          const months = varMonths
          const totalsByMonth = months.map(m =>
            varRows.reduce((s, r) => s + (Number(r[`closing_stock_${m}`]) || 0), 0)
          )
          const maxM = Math.max(...totalsByMonth, 1)
          return (
            <div className="p-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Total closing stock by month</p>
              <div className="flex gap-1 h-10 items-end px-1">
                {totalsByMonth.map((val, i) => {
                  const pct = Math.max(2, Math.min(100, Math.round((val / maxM) * 100)))
                  return <div key={months[i]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 28 }}>
                    <div className="text-[9px] text-slate-500 font-semibold">{Number(val).toLocaleString()}</div>
                    <div style={{ width: '100%', height: '50px', background: '#f1f5f9', borderRadius: '2px 2px 0 0', padding: '0 1px', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: 'linear-gradient(180deg,#6366f1,#4f46e5)', borderRadius: '2px 2px 0 0' }} />
                    </div>
                  </div>
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {months.map(m => <div key={m} style={{ flex: 1, textAlign: 'center', minWidth: 28 }} className="text-[8px] text-slate-500">{m.slice(5)}</div>)}
              </div>
            </div>
          )
        })()}
        <DenseTable
          columns={varMonths.length >= 2
            ? ['Item', 'SKU', 'Category', `Close ${varMonths[0]}`, `Close ${varMonths.slice(-1)[0]}`, 'Variance']
            : ['Item', 'SKU', 'Category', ...(varMonths || ['Month']), 'Variance']
          }
          rows={varRows.map(r => {
            if (varMonths.length >= 2) {
              return [
                r.product_name, r.sku, r.category,
                r[`closing_stock_${varMonths[0]}`] ?? 0, r[`closing_stock_${varMonths.slice(-1)[0]}`] ?? 0,
                r.variance != null ? r.variance : '—',
              ]
            }
            return [
              r.product_name, r.sku, r.category,
              r[`closing_stock_${varMonths?.[0] || '—'}`] ?? 0,
              r.variance != null ? r.variance : '—',
            ]
          })}
          numericColumns={varMonths.length >= 2 ? [3, 4, 5] : [3, 4]}
        />
        {!loadingVar && varRows.length === 0 && (
          <div className="p-4 text-sm text-slate-500 text-center">Click <strong>Apply Filters</strong> to load the monthly variance report.</div>
        )}
        {loadingVar && (
          <div className="p-4 text-sm text-slate-500 text-center">Loading variance data…</div>
        )}
      </Panel>
    </div>
  )
}

const Panel = ({ title, icon: Icon, children, action, className }) => (
  <section className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${className ?? ''}`}>
    <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-3">
      <div className="flex items-center min-w-0">
        <Icon className="text-emerald-600 mr-2 shrink-0" />
        <h2 className="font-semibold text-sm text-slate-900 truncate">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
)

const FilterBar = ({ filters }) => (
  <div className="p-3 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_repeat(3,160px)] gap-2">
    <div className="relative">
      <FaSearch className="absolute left-3 top-3 text-slate-400 text-xs" />
      <input placeholder="Search product, SKU, barcode" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
    </div>
    {filters.map((filter) => <select key={filter} className="px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>{filter}</option></select>)}
  </div>
)

const DenseTable = ({ columns, rows, rowData = [], onRowClick, numericColumns = [], pinFirst = false, renderLimit = TABLE_RENDER_LIMIT }) => {
  const visibleRows = rows.slice(0, renderLimit)
  const capped = rows.length > visibleRows.length
  const paddingCols = 2
  const base = columns.length > 0 ? 64 / columns.length : 8
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ overflowX: 'auto', maxHeight: '68vh' }}>
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'auto', width: '100%' }}>
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
            <tr>{columns.map((column, index) => <th key={column} style={{ width: numericColumns.includes(index) ? '12%' : pinFirst && index === 0 ? '20%' : 'auto' }} className={`h-7 border-r border-slate-200 px-2 text-left font-bold uppercase text-slate-600 whitespace-nowrap ${numericColumns.includes(index) ? 'text-right' : ''} ${pinFirst && index === 0 ? 'sticky left-0 z-20 bg-slate-100 shadow-[1px_0_0_#cbd5e1]' : ''}`}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} onClick={() => onRowClick?.(rowData[rowIndex])} className={`${rowIndex % 2 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-emerald-50 ${onRowClick ? 'cursor-pointer' : ''}`}>
                {row.map((cell, cellIndex) => <td key={cellIndex} style={{ width: numericColumns.includes(cellIndex) ? '12%' : pinFirst && cellIndex === 0 ? '20%' : 'auto' }} className={`h-8 border-r border-b border-slate-200 px-2 whitespace-nowrap align-middle ${numericColumns.includes(cellIndex) ? 'text-right tabular-nums font-semibold' : ''} ${pinFirst && cellIndex === 0 ? 'sticky left-0 z-10 bg-inherit shadow-[1px_0_0_#e2e8f0]' : ''}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {capped && <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">Showing first {visibleRows.length.toLocaleString()} rows in this view. Use filters/search to narrow larger datasets.</div>}
    </div>
  )
}

const StockBar = ({ value, reorder, max = 120 }) => {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = value === 0 ? 'bg-red-500' : value <= reorder ? 'bg-amber-500' : 'bg-emerald-500'
  return <div><div className="flex justify-between text-[11px] mb-1"><span>{value}</span><span>min {Math.round(reorder)}</span></div><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div></div>
}

const Status = ({ product }) => {
  if (!product.is_active) return <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600">Inactive</span>
  const tone = product.stock === 0 ? 'bg-red-100 text-red-700' : product.stock <= product.reorderPoint ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
  const label = product.stock === 0 ? 'Out' : product.stock <= product.reorderPoint ? 'Low' : 'Healthy'
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${tone}`}>{label}</span>
}

const Badge = ({ children }) => <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">{children}</span>

const Metric = ({ label, value }) => <div className="bg-white rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-900 mt-1">{value}</p></div>

const InventoryModal = ({ modal, draft, setDraft, products, categories, suppliers, purchaseOrders, stocktakes, onClose, onConfirm, onDelete }) => (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
    <div className={`absolute inset-x-3 top-5 bottom-5 mx-auto overflow-hidden rounded-xl bg-white shadow-2xl sm:inset-x-6 sm:top-10 sm:bottom-auto ${['po', 'receive'].includes(modal.type) ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">Inventory workflow</p>
          <h2 className="text-lg font-bold">{modal.title}</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 inline-flex items-center justify-center"><FaTimes /></button>
      </div>
      <div className="max-h-[72vh] overflow-y-auto p-4">
        {modal.type === 'product' && <ProductForm data={draft} setData={setDraft} categories={categories} />}
        {modal.type === 'category' && <CategoryForm data={draft} setData={setDraft} />}
        {modal.type === 'po' && <POForm data={modal.data || draft} setData={setDraft} products={products} suppliers={suppliers} />}
        {modal.type === 'poDetail' && <PODetail data={modal.data} onEdit={() => openModal({ type: 'po', title: 'Edit ' + (modal.data.po_no || 'PO'), data: modal.data }) } onCancel={() => openModal({ type: 'poCancel', title: 'Cancel Purchase Order', data: modal.data })} />}
        {modal.type === 'receive' && <ReceivePreview purchaseOrders={purchaseOrders} data={draft} setData={setDraft} />}
        {modal.type === 'adjust' && <AdjustmentForm product={modal.data} data={draft} setData={setDraft} />}
        {modal.type === 'stocktake' && <StocktakeForm data={draft} setData={setDraft} />}
        {modal.type === 'countStocktake' && <StocktakeCountForm session={modal.data} data={draft} setData={setDraft} />}
        {modal.type === 'approveVariance' && <ApprovalPreview stocktakes={stocktakes} data={draft} setData={setDraft} />}
      {modal.type === 'transfer' && <TransferForm />}
      {modal.type === 'export' && <ReportsView />}
      {modal.type === 'supplier' && <SupplierForm data={draft} setData={setDraft} />}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        {['product', 'category', 'supplier'].includes(modal.type) && modal.data?.id && (
          <button onClick={onDelete} className="mr-auto px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg text-sm font-semibold">Delete</button>
        )}
        {['poCancel'].includes(modal.type) && modal.data?.id && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Reason (optional)</label>
            <input type="text" value={modalDraft.reason || ''} onChange={(event) => setModalDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Cancel reason" className="px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        )}
        {['poCancel', 'poDelete'].includes(modal.type) && modal.data?.id && (
          <button onClick={onDelete} className="mr-auto px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg text-sm font-semibold">Confirm</button>
        )}
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">Confirm</button>
      </div>
    </div>
  </div>
)

const Field = ({ label, value, onChange, type = 'text' }) => <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><input type={type} value={value || ''} onChange={(event) => onChange?.(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></label>

const CategoryForm = ({ data = {}, setData }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <Field label="Category name" value={data.name} onChange={(value) => setData((current) => ({ ...current, name: value }))} />
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">Color</span>
      <select value={data.color || ''} onChange={(event) => setData((current) => ({ ...current, color: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="">Default</option>
        <option value="emerald">Emerald</option>
        <option value="amber">Amber</option>
        <option value="blue">Blue</option>
        <option value="rose">Rose</option>
        <option value="violet">Violet</option>
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">Status</span>
      <select value={String(data.is_active ?? true)} onChange={(event) => setData((current) => ({ ...current, is_active: event.target.value === 'true' }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </label>
  </div>
)

const ProductForm = ({ data = {}, setData, categories = [] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <Field label="Name" value={data.name} onChange={(value) => setData((current) => ({ ...current, name: value }))} />
    <Field label="SKU" value={data.sku} onChange={(value) => setData((current) => ({ ...current, sku: value }))} />
    <Field label="Barcode" value={data.barcode} onChange={(value) => setData((current) => ({ ...current, barcode: value }))} />
    <label className="block"><span className="text-xs font-semibold text-slate-600">Category</span><select value={String(data.category_id ?? data.category ?? categories[0]?.id ?? '')} onChange={(event) => setData((current) => ({ ...current, category_id: Number(event.target.value), category: Number(event.target.value) }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">{!categories.length && <option value="">Create a category first</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="mt-1 block text-[11px] text-slate-500">Showing first {categories.length} categories. Use category search when the catalogue is large.</span></label>
    <Field label="Cost price" value={data.cost_price || data.cost} type="number" onChange={(value) => setData((current) => ({ ...current, cost_price: value }))} />
    <Field label="Retail selling price" value={data.retail_price || data.price} type="number" onChange={(value) => setData((current) => ({ ...current, retail_price: value }))} />
    <Field label="Wholesale price" value={data.wholesale_price || data.wholesale} type="number" onChange={(value) => setData((current) => ({ ...current, wholesale_price: value }))} />
    <Field label="Tax rate" value={data.tax_rate} type="number" onChange={(value) => setData((current) => ({ ...current, tax_rate: value }))} />
    <Field label="Reorder level" value={data.reorder_point || data.reorderPoint} type="number" onChange={(value) => setData((current) => ({ ...current, reorder_point: value }))} />
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">Status</span>
      <select value={String(data.is_active ?? true)} onChange={(event) => setData((current) => ({ ...current, is_active: event.target.value === 'true' }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </label>
    {!data.id && <Field label="Opening stock quantity" value={data.initial_stock || 0} type="number" onChange={(value) => setData((current) => ({ ...current, initial_stock: value }))} />}
  </div>
)

const POForm = ({ data = {}, setData, products = [], suppliers = [] }) => {

  const lines = data.items || []
  const page = Number(data.product_page || 1)
  const search = (data.product_search || '').toLowerCase()
  const activeProducts = products.filter((product) => product.is_active !== false)
  const filteredProducts = activeProducts.filter((product) => [product.name, product.sku, product.barcode].some((value) => String(value || '').toLowerCase().includes(search)))
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PO_PICKER_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageProducts = filteredProducts.slice((safePage - 1) * PO_PICKER_PAGE_SIZE, safePage * PO_PICKER_PAGE_SIZE)
  const isSelected = (product) => lines.some((line) => Number(line.product) === Number(product.id))
  const selectProduct = (product) => {
    if (!product || isSelected(product)) return
    setData((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          product: product.id,
          product_name: product.name,
          sku: product.sku,
          is_active: product.is_active,
          ordered_quantity: Number(current.ordered_quantity || 1),
          unit_cost: current.unit_cost || product.cost_price || product.cost || '0.00',
          current_buying_price: product.cost_price || product.cost || '0.00',
        },
      ],
    }))
  }
  const updateLine = (index, key, value) => {
    setData((current) => ({
      ...current,
      items: (current.items || []).map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)),
    }))
  }
  const removeLine = (index) => {
    setData((current) => ({ ...current, items: (current.items || []).filter((_, lineIndex) => lineIndex !== index) }))
  }
  const total = lines.reduce((sum, line) => sum + Number(line.ordered_quantity || 0) * Number(line.unit_cost || 0), 0)
  return (
  <div className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">Supplier</span>
        <select value={data.supplier || suppliers[0]?.name || ''} onChange={(event) => setData((current) => ({ ...current, supplier: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {suppliers.map((supplier) => <option key={supplier.name} value={supplier.name}>{supplier.name}</option>)}
        </select>
      </label>
      <Field label="Expected delivery" value={data.expected_at || ''} type="date" onChange={(value) => setData((current) => ({ ...current, expected_at: value }))} />
    </div>

    <Panel title="Select Items" icon={FaBoxes} action={<span className="text-[11px] font-semibold text-slate-500">Page {safePage} of {pageCount}</span>}>
      <div className="p-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <input value={data.product_search || ''} onChange={(event) => setData((current) => ({ ...current, product_search: event.target.value, product_page: 1 }))} placeholder="Search item, SKU, or barcode" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <button type="button" disabled={safePage <= 1} onClick={() => setData((current) => ({ ...current, product_page: safePage - 1 }))} className="px-3 py-2 bg-slate-100 rounded text-sm font-semibold disabled:opacity-40">Previous</button>
        <button type="button" disabled={safePage >= pageCount} onClick={() => setData((current) => ({ ...current, product_page: safePage + 1 }))} className="px-3 py-2 bg-slate-100 rounded text-sm font-semibold disabled:opacity-40">Next</button>
      </div>
      {pageProducts.length ? (
        <DenseTable
          columns={['Status', 'Item', 'SKU', 'Current BP', 'Stock', 'Action']}
          rows={pageProducts.map((product) => {
            const selected = isSelected(product)
            return [
              selected ? <Badge>Selected</Badge> : <span className="text-slate-400">Available</span>,
              product.name,
              product.sku,
              money(Number(product.cost_price || product.cost || 0)),
              product.stock,
              <button type="button" disabled={selected} onClick={() => selectProduct(product)} className={`px-2 py-1 rounded font-semibold ${selected ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white'}`}>{selected ? 'Added' : 'Select'}</button>,
            ]
          })}
          numericColumns={[3, 4]}
        />
      ) : (
        <div className="p-4 text-sm font-semibold text-amber-700">No active products match this search. Activate the product before adding it to a PO.</div>
      )}
    </Panel>

    <Panel title="Selected Items" icon={FaClipboardList} action={<span className="text-[11px] font-semibold text-slate-500">{lines.length} lines</span>}>
      <DenseTable
        columns={['Item', 'SKU', 'Qty', 'Current BP', 'Order BP', 'Line Total', '']}
        rows={lines.map((line, index) => [
          line.product_name,
          line.sku,
          <input type="number" min="1" value={line.ordered_quantity} onChange={(event) => updateLine(index, 'ordered_quantity', event.target.value)} className="w-24 px-2 py-1 border border-slate-300 rounded text-right" />,
          money(Number(line.current_buying_price || 0)),
          <input type="number" min="0" value={line.unit_cost} onChange={(event) => updateLine(index, 'unit_cost', event.target.value)} className="w-28 px-2 py-1 border border-slate-300 rounded text-right" />,
          money(Number(line.ordered_quantity || 0) * Number(line.unit_cost || 0)),
          <button type="button" onClick={() => removeLine(index)} className="px-2 py-1 rounded bg-red-50 text-red-700 font-semibold">Remove</button>,
        ])}
        numericColumns={[2, 3, 4, 5]}
      />
    </Panel>
    <div className="flex justify-end rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">Order total: {money(total)}</div>
  </div>
  )
}

const PODetail = ({ data, onEdit, onCancel }) => {
  const isLocked = ['cancelled', 'received', 'partial'].includes(data?.status)
  return <div className="space-y-3">
    <Metric label="Supplier" value={data.supplier} />
    <Metric label="Status" value={data.status} />
    <Metric label="Expected Delivery" value={data.expected_at || '—'} />
    <Metric label="Total" value={money(Number(data.total || 0))} />
    <DenseTable columns={['Product', 'Ordered', 'Received', 'Unit Cost']} rows={(data.items || []).map((item) => [item.product_name, item.ordered_quantity, item.received_quantity, money(Number(item.unit_cost))])} numericColumns={[1, 2, 3]} />
    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
      {isLocked ? <span className="text-xs font-semibold text-slate-500">This PO is locked and can no longer be edited or cancelled.</span> : <>
        <button onClick={onEdit} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">Edit PO</button>
        <button onClick={onCancel} className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold">Cancel PO</button>
      </>}
    </div>
  </div>
}

const ReceivePreview = ({ purchaseOrders = [], data = {}, setData }) => {
  const orderRows = Array.isArray(purchaseOrders) ? purchaseOrders : []
  const openOrders = orderRows.filter((po) => po.status !== 'received' && po.status !== 'cancelled')
  const selectedPo = openOrders.find((po) => po.id === Number(data.purchase_order)) || openOrders[0]
  const receivePage = Number(data.receive_page || 1)
  const receiveLines = selectedPo?.items || []
  const receivePageCount = Math.max(1, Math.ceil(receiveLines.length / RECEIVING_PAGE_SIZE))
  const safeReceivePage = Math.min(receivePage, receivePageCount)
  const visibleReceiveLines = receiveLines.slice((safeReceivePage - 1) * RECEIVING_PAGE_SIZE, safeReceivePage * RECEIVING_PAGE_SIZE)
  const setFullReceipt = () => {
    if (!selectedPo) return
    setData((current) => ({
      ...current,
      purchase_order: selectedPo.id,
      ...Object.fromEntries((selectedPo.items || []).map((item) => [`receive_${item.id}`, Math.max(0, Number(item.ordered_quantity) - Number(item.received_quantity))])),
    }))
  }
  const setZeroReceipt = () => {
    if (!selectedPo) return
    setData((current) => ({
      ...current,
      purchase_order: selectedPo.id,
      ...Object.fromEntries((selectedPo.items || []).map((item) => [`receive_${item.id}`, 0])),
    }))
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Purchase Order</span>
          <select value={data.purchase_order || selectedPo?.id || ''} onChange={(event) => setData((current) => ({ ...current, purchase_order: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            {openOrders.map((po) => <option key={po.id} value={po.id}>{po.po_no} / {po.supplier} / {po.status}</option>)}
          </select>
        </label>
        <button onClick={setFullReceipt} type="button" className="h-10 px-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold">Receive full</button>
        <button onClick={setZeroReceipt} type="button" className="h-10 px-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold">Clear</button>
      </div>
      {selectedPo ? (
        <>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
          <span>Showing {visibleReceiveLines.length.toLocaleString()} of {receiveLines.length.toLocaleString()} PO lines.</span>
          <div className="flex gap-2">
            <button type="button" disabled={safeReceivePage <= 1} onClick={() => setData((current) => ({ ...current, receive_page: safeReceivePage - 1 }))} className="px-2 py-1 rounded bg-white disabled:opacity-40">Previous</button>
            <span className="px-2 py-1">Page {safeReceivePage} of {receivePageCount}</span>
            <button type="button" disabled={safeReceivePage >= receivePageCount} onClick={() => setData((current) => ({ ...current, receive_page: safeReceivePage + 1 }))} className="px-2 py-1 rounded bg-white disabled:opacity-40">Next</button>
          </div>
        </div>
        <DenseTable
          columns={['Product', 'Ordered', 'Already Received', 'Remaining', 'Receive Now']}
          rows={visibleReceiveLines.map((item) => {
            const remaining = Math.max(0, Number(item.ordered_quantity) - Number(item.received_quantity))
            return [
              item.product_name,
              item.ordered_quantity,
              item.received_quantity,
              remaining,
              <input type="number" min="0" max={remaining} value={data[`receive_${item.id}`] ?? remaining} onChange={(event) => { const v = Math.max(0, Math.min(remaining, Number(event.target.value) || 0)); setData((current) => ({ ...current, [`receive_${item.id}`]: v })) }} className="w-28 px-2 py-1 border border-slate-300 rounded text-right" />,
            ]
          })}
          numericColumns={[1, 2, 3, 4]}
        />
        </>
      ) : (
        <div className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">No open purchase orders to receive.</div>
      )}
    </div>
  )
}
const AdjustmentForm = ({ product = {}, data = {}, setData }) => <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Product" value={product.name} /><label><span className="text-xs font-semibold text-slate-600">Reason</span><select value={data.reason || 'Manual correction'} onChange={(event) => setData((current) => ({ ...current, reason: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>Manual correction</option><option>Damage</option><option>Expiry</option><option>Receiving correction</option></select></label><Field label="Quantity change" value={data.quantity_delta || 1} type="number" onChange={(value) => setData((current) => ({ ...current, quantity_delta: value }))} /><div className="rounded-lg bg-amber-50 text-amber-700 p-3 text-sm font-semibold">Positive adds stock. Negative removes stock.</div></div>
const StocktakeForm = ({ data = {}, setData }) => <div className="grid grid-cols-1 gap-3"><Field label="Note" value={data.note || ''} onChange={(value) => setData((current) => ({ ...current, note: value }))} /><div className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold">Starting a stocktake snapshots current backend stock for the active branch.</div></div>
const StocktakeCountForm = ({ session, data = {}, setData }) => {
  const items = session.items || []
  return (
    <div className="space-y-3">
      <DenseTable
        columns={['Product', 'SKU', 'System Qty', 'Counted Qty', 'Variance']}
        rows={items.map((item) => {
          const counted = Number(data[`count_${item.id}`] ?? item.counted_quantity)
          const v = counted - Number(item.system_quantity || 0)
          return [
            item.product_name || item.product?.name || '—',
            item.sku || item.product?.sku || '—',
            item.system_quantity,
            <input
              type="number"
              min="0"
              value={counted}
              onChange={(event) => { setData((current) => ({ ...current, [`count_${item.id}`]: event.target.value })) }}
              className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
            />,
            <span className={`font-semibold ${v < 0 ? 'text-red-700' : v > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{v > 0 ? '+' : ''}{v}</span>,
          ]
        })}
        numericColumns={[2, 3, 4]}
      />
    </div>
  )
}
const ApprovalPreview = ({ stocktakes = [], data = {}, setData }) => {
  const pendingSessions = (stocktakes || []).filter((s) => s.status !== 'approved')
  const selected = pendingSessions.find((s) => s.id === Number(data.stocktake)) || pendingSessions[0]
  const items = selected?.items || []
  const v = items.reduce((sum, item) => sum + (Number(item.counted_quantity || 0) - Number(item.system_quantity || 0)), 0)
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">Stocktake Session</span>
        <select value={data.stocktake || selected?.id || ''} onChange={(event) => setData((current) => ({ ...current, stocktake: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {pendingSessions.length === 0 && <option value="">No sessions pending approval</option>}
          {pendingSessions.map((session) => <option key={session.id} value={session.id}>{session.session_no} · {session.status}</option>)}
        </select>
        {pendingSessions.length > 0 && <span className="mt-1 block text-[11px] text-slate-500">{pendingSessions.length} session{pendingSessions.length !== 1 ? 's' : ''} awaiting approval</span>}
      </label>
      {selected && (
        <div className="space-y-2 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-500">{selected.session_no} — {selected.branch_name || selected.branch?.name || 'Branch ' + selected.branch} · {selected.status}</p>
          <p className="text-xs text-slate-600">Items: {items.length} · Net variance qty: <span className={`font-semibold ${v < 0 ? 'text-red-700' : v > 0 ? 'text-emerald-700' : ''}`}>{v}</span></p>
          <p className="text-sm text-slate-600 mt-2">Approving posts counted variances into stock adjustments and locks the session.</p>
        </div>
      )}
    </div>
  )
}
const SupplierForm = ({ data = {}, setData }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <Field label="Company name" value={data.name} onChange={(value) => setData((current) => ({ ...current, name: value }))} />
    <Field label="Contact person" value={data.contact_person} onChange={(value) => setData((current) => ({ ...current, contact_person: value }))} />
    <Field label="Phone" value={data.phone} onChange={(value) => setData((current) => ({ ...current, phone: value }))} />
    <Field label="Email" value={data.email} type="email" onChange={(value) => setData((current) => ({ ...current, email: value }))} />
    <div className="md:col-span-2">
      <Field label="Address" value={data.address} onChange={(value) => setData((current) => ({ ...current, address: value }))} />
    </div>
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">Status</span>
      <select value={String(data.is_active ?? true)} onChange={(event) => setData((current) => ({ ...current, is_active: event.target.value === 'true' }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </label>
  </div>
)

const TransferForm = () => <div className="rounded-lg bg-blue-50 text-blue-700 p-3 text-sm font-semibold">Transfers need a dedicated backend transfer model. Current branch stock is visible in Warehouses.</div>

export default InventoryModule
