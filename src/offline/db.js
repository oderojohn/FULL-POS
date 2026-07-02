/**
 * IndexedDB wrapper for offline storage.
 * v2 adds catalog caching (products, categories, customers) and sync metadata.
 */

const DB_NAME = 'nexa-offline'
const DB_VERSION = 2

const STORE_SALES = 'pending_sales'
const STORE_PRODUCTS = 'catalog_products'
const STORE_CATEGORIES = 'catalog_categories'
const STORE_CUSTOMERS = 'local_customers'
const STORE_META = 'sync_metadata'

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      const oldVersion = e.oldVersion

      if (oldVersion < 1) {
        const salesStore = db.createObjectStore(STORE_SALES, { keyPath: 'receipt_no' })
        salesStore.createIndex('status', 'status', { unique: false })
        salesStore.createIndex('created_at', 'created_at', { unique: false })
      }

      if (oldVersion < 2) {
        const prodStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' })
        prodStore.createIndex('branch_id', 'branch_id', { unique: false })

        const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' })
        catStore.createIndex('branch_id', 'branch_id', { unique: false })

        const custStore = db.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id' })
        custStore.createIndex('branch_id', 'branch_id', { unique: false })

        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }
    req.onsuccess = (e) => {
      _db = e.target.result
      resolve(_db)
    }
    req.onerror = () => reject(req.error)
  })
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName))
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function savePendingSale(sale) {
  const store = await tx(STORE_SALES, 'readwrite')
  await promisify(store.put({ ...sale, status: 'pending', saved_at: new Date().toISOString() }))
}

export async function getPendingSales() {
  const store = await tx(STORE_SALES)
  const all = await promisify(store.getAll())
  return all.filter((s) => s.status === 'pending')
}

export async function markSaleSynced(receipt_no) {
  const store = await tx(STORE_SALES, 'readwrite')
  const sale = await promisify(store.get(receipt_no))
  if (sale) {
    sale.status = 'synced'
    sale.synced_at = new Date().toISOString()
    await promisify(store.put(sale))
  }
}

export async function markSaleFailed(receipt_no, error) {
  const store = await tx(STORE_SALES, 'readwrite')
  const sale = await promisify(store.get(receipt_no))
  if (sale) {
    sale.status = 'failed'
    sale.sync_error = String(error)
    await promisify(store.put(sale))
  }
}

export async function countPendingSales() {
  const store = await tx(STORE_SALES)
  const index = store.index('status')
  return promisify(index.count(IDBKeyRange.only('pending')))
}

export async function getAllSales() {
  const store = await tx(STORE_SALES)
  return promisify(store.getAll())
}

// ── Catalog: products ─────────────────────────────────────────────────────────

export async function saveCatalogProducts(branchId, products) {
  const db = await openDB()
  const txn = db.transaction(STORE_PRODUCTS, 'readwrite')
  const store = txn.objectStore(STORE_PRODUCTS)
  for (const p of products) {
    store.put({ ...p, branch_id: branchId })
  }
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve
    txn.onerror = () => reject(txn.error)
  })
}

export async function getCatalogProducts(branchId) {
  const store = await tx(STORE_PRODUCTS)
  if (!branchId) return promisify(store.getAll())
  return promisify(store.index('branch_id').getAll(branchId))
}

// ── Catalog: categories ───────────────────────────────────────────────────────

export async function saveCatalogCategories(branchId, categories) {
  const db = await openDB()
  const txn = db.transaction(STORE_CATEGORIES, 'readwrite')
  const store = txn.objectStore(STORE_CATEGORIES)
  for (const c of categories) {
    store.put({ ...c, branch_id: branchId })
  }
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve
    txn.onerror = () => reject(txn.error)
  })
}

export async function getCatalogCategories(branchId) {
  const store = await tx(STORE_CATEGORIES)
  if (!branchId) return promisify(store.getAll())
  return promisify(store.index('branch_id').getAll(branchId))
}

// ── Catalog: customers ────────────────────────────────────────────────────────

export async function saveLocalCustomers(branchId, customers) {
  const db = await openDB()
  const txn = db.transaction(STORE_CUSTOMERS, 'readwrite')
  const store = txn.objectStore(STORE_CUSTOMERS)
  for (const c of customers) {
    store.put({ ...c, branch_id: branchId })
  }
  return new Promise((resolve, reject) => {
    txn.oncomplete = resolve
    txn.onerror = () => reject(txn.error)
  })
}

export async function getLocalCustomers(branchId, search = '') {
  const store = await tx(STORE_CUSTOMERS)
  let customers
  if (branchId) {
    customers = await promisify(store.index('branch_id').getAll(branchId))
  } else {
    customers = await promisify(store.getAll())
  }
  if (!search) return customers
  const q = search.toLowerCase()
  return customers.filter(
    (c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q),
  )
}

// ── Sync metadata ─────────────────────────────────────────────────────────────

export async function getSyncMeta(key) {
  const store = await tx(STORE_META)
  const rec = await promisify(store.get(key))
  return rec?.value || null
}

export async function setSyncMeta(key, value) {
  const store = await tx(STORE_META, 'readwrite')
  await promisify(store.put({ key, value }))
}
