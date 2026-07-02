/**
 * Pull-based catalog sync: download products, categories, and customers from
 * the server and cache them in IndexedDB for offline use.
 */

import {
  saveCatalogProducts, getCatalogProducts,
  saveCatalogCategories, getCatalogCategories,
  saveLocalCustomers, getLocalCustomers,
  getSyncMeta, setSyncMeta,
} from './db'

const API_BASE = import.meta.env.VITE_POS_API_URL || '/api/pos'

function authHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('nexa-pos-session') || 'null')?.token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function metaKey(entity, branchId) {
  return `${entity}_sync_${branchId}`
}

/**
 * Pull catalog changes from the server for a branch.
 * Pass { full: true } to ignore the last-sync timestamp and re-fetch everything.
 */
export async function pullCatalog(branchId, { full = false } = {}) {
  if (!branchId) return { success: false, error: 'No branch ID' }

  const since = full ? null : await getSyncMeta(metaKey('catalog', branchId))
  const params = new URLSearchParams({ branch: branchId })
  if (since) params.set('since', since)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  let data
  try {
    const res = await fetch(`${API_BASE}/sync/pull/?${params}`, {
      headers: { ...authHeaders() },
      credentials: 'include',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Sync pull failed: ${res.status}`)
    data = await res.json()
  } finally {
    clearTimeout(timer)
  }

  const pulledAt = new Date().toISOString()

  const products = data.products || []
  const categories = data.categories || []
  const customers = data.customers || []

  if (products.length) await saveCatalogProducts(branchId, products)
  if (categories.length) await saveCatalogCategories(branchId, categories)
  if (customers.length) await saveLocalCustomers(branchId, customers)

  if (products.length || categories.length || customers.length) {
    await setSyncMeta(metaKey('catalog', branchId), pulledAt)
  }

  return { success: true, products: products.length, categories: categories.length, customers: customers.length, pulledAt }
}

export async function getLocalProducts(branchId) {
  return getCatalogProducts(branchId)
}

export async function getLocalCategories(branchId) {
  return getCatalogCategories(branchId)
}

export async function getLocalCustomersFiltered(branchId, search = '') {
  return getLocalCustomers(branchId, search)
}

export async function getCatalogLastSync(branchId) {
  return getSyncMeta(metaKey('catalog', branchId))
}

/**
 * Save fresh API data to the local catalog cache (called after a successful
 * online API fetch so the cache stays current without a separate pull).
 */
export async function saveApiDataToCache(branchId, { products = [], categories = [], customers = [] } = {}) {
  const tasks = []
  if (products.length) tasks.push(saveCatalogProducts(branchId, products))
  if (categories.length) tasks.push(saveCatalogCategories(branchId, categories))
  if (customers.length) tasks.push(saveLocalCustomers(branchId, customers))
  if (tasks.length) {
    await Promise.all(tasks)
    await setSyncMeta(metaKey('catalog', branchId), new Date().toISOString())
  }
}
