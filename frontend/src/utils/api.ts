import axios from 'axios'
import type { 
  LoginCredentials, 
  LoginResponse, 
  User, 
  InventoryResponse, 
  InventoryStats, 
  CreateItemRequest, 
  UpdateItemRequest,
  Item,
  TagResponse,
  ItemTagsResponse,
  CreateTagRequest,
  UpdateTagRequest,
  Tag,
  SKU,
  SKUResponse,
  CreateSKURequest,
  UpdateSKURequest,
  AddCostRequest,
  BatchScanRequest,
  BatchScanResponse,
  CreateMissingRequest,
  TagAssignmentRequest,
  LinkExistingRequest,
  ExportOptions
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/#/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  }
}

export const inventoryApi = {
  getItems: async (params?: {
    product_type?: string
    search?: string
    page?: number
    limit?: number
    in_stock_only?: boolean
  }): Promise<InventoryResponse> => {
    const response = await api.get('/inventory', { params })
    return response.data
  },

  getStats: async (): Promise<InventoryStats> => {
    const response = await api.get('/inventory/stats')
    return response.data
  },

  createItem: async (item: CreateItemRequest): Promise<{ message: string; item: Item }> => {
    const response = await api.post('/inventory', item)
    return response.data
  },

  updateItem: async (id: string, updates: UpdateItemRequest): Promise<{ message: string; item: Item }> => {
    const response = await api.put(`/inventory/${id}`, updates)
    return response.data
  },

  deleteItem: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/inventory/${id}`)
    return response.data
  }
}

export const tagApi = {
  getTags: async (params?: {
    item_id?: string
    customer_name?: string
    status?: string
    tag_type?: string
    page?: number
    limit?: number
  }): Promise<TagResponse> => {
    const response = await api.get('/tags', { params })
    return response.data
  },

  getItemTags: async (itemId: string): Promise<ItemTagsResponse> => {
    const response = await api.get(`/tags/item/${itemId}`)
    return response.data
  },

  createTag: async (tag: CreateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.post('/tags', tag)
    return response.data
  },

  updateTag: async (id: string, updates: UpdateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.put(`/tags/${id}`, updates)
    return response.data
  },

  deleteTag: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/tags/${id}`)
    return response.data
  },

  getStats: async (): Promise<{
    totalActiveTags: number
    uniqueCustomers: number
    byTagType: Array<{ _id: string; count: number; totalQuantity: number }>
  }> => {
    const response = await api.get('/tags/stats')
    return response.data
  },

  createBatchTags: async (data: {
    tag_type: string
    customer_name: string
    notes?: string
    due_date?: string
    tags: Array<{ item_id: string; quantity: number }>
  }): Promise<{ message: string; tags: Tag[] }> => {
    const response = await api.post('/tags/batch', data)
    return response.data
  },

  lookupBySku: async (skuCode: string): Promise<{ item: Item & { availableQuantity: number }; sku: SKU }> => {
    const response = await api.get(`/tags/lookup-sku/${encodeURIComponent(skuCode)}`)
    return response.data
  },

  sendForInstall: async (data: {
    customer_name: string
    scanned_barcodes?: string[]
    tag_ids?: string[]
    notes?: string
  }): Promise<{
    message: string
    customer_name: string
    results: {
      fulfilled: Tag[]
      failed: Array<{ barcode?: string; tag_id?: string; error: string }>
      inventory_reduced: Array<{
        item_id: string
        previous_quantity: number
        new_quantity: number
        reduced_by: number
      }>
    }
  }> => {
    const response = await api.post('/tags/send-for-install', data)
    return response.data
  },

  markUsed: async (data: {
    tag_ids: string[]
    notes?: string
  }): Promise<{
    message: string
    results: {
      fulfilled: Tag[]
      failed: Array<{ tag_id: string; error: string }>
      inventory_reduced: Array<{
        item_id: string
        previous_quantity: number
        new_quantity: number
        reduced_by: number
      }>
    }
  }> => {
    const response = await api.post('/tags/mark-used', data)
    return response.data
  },

  getCustomers: async (): Promise<{
    customers: Array<{
      name: string
      tag_count: number
      total_quantity: number
      tag_types: string[]
      date_range: {
        oldest: string
        newest: string
      }
    }>
  }> => {
    const response = await api.get('/tags/customers')
    return response.data
  }
}

export const skuApi = {
  getSKUs: async (params?: {
    product_type?: string
    status?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<SKUResponse> => {
    const response = await api.get('/skus', { params })
    return response.data
  },

  getSKU: async (id: string): Promise<SKU> => {
    const response = await api.get(`/skus/${id}`)
    return response.data
  },

  createSKU: async (sku: CreateSKURequest): Promise<SKU> => {
    const response = await api.post('/skus', sku)
    return response.data
  },

  updateSKU: async (id: string, updates: UpdateSKURequest): Promise<SKU> => {
    const response = await api.put(`/skus/${id}`, updates)
    return response.data
  },

  deleteSKU: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/skus/${id}`)
    return response.data
  },

  generateSKUCode: async (data: {
    product_type: string
    product_details: string
    template?: string
  }): Promise<{ sku_code: string }> => {
    const response = await api.post('/skus/generate', data)
    return response.data
  },

  addCost: async (id: string, costData: AddCostRequest): Promise<SKU> => {
    const response = await api.post(`/skus/${id}/cost`, costData)
    return response.data
  },

  getProductsForSKU: async (productType: string): Promise<{ products: any[] }> => {
    const response = await api.get(`/skus/products/${productType}`)
    return response.data
  },

  searchByBarcode: async (barcode: string): Promise<SKU> => {
    const response = await api.get(`/skus/search/barcode/${encodeURIComponent(barcode)}`)
    return response.data
  }
}

export const barcodeApi = {
  batchScan: async (data: BatchScanRequest): Promise<BatchScanResponse> => {
    const response = await api.post('/barcode/batch-scan', data)
    return response.data
  },

  createMissing: async (data: CreateMissingRequest): Promise<{
    created: Array<{ barcode: string; sku: SKU }>
    failed: Array<{ barcode: string; error: string }>
    summary: { total: number; created: number; failed: number }
  }> => {
    const response = await api.post('/barcode/create-missing', data)
    return response.data
  },

  assignToTag: async (data: TagAssignmentRequest): Promise<{
    success: Array<{
      barcodes: string[]
      tag: Tag
      item: Item
      sku: SKU
    }>
    failed: Array<{ barcode: string; error: string }>
    summary: { total: number; success: number; failed: number }
  }> => {
    const response = await api.post('/barcode/assign-to-tag', data)
    return response.data
  },

  linkExisting: async (data: LinkExistingRequest): Promise<{
    message: string
    sku: SKU
    item: Item
  }> => {
    const response = await api.post('/barcode/link-existing', data)
    return response.data
  }
}

export const exportApi = {
  inventory: async (options?: ExportOptions): Promise<string | any[]> => {
    const response = await api.get('/export/inventory', { params: options })
    return response.data
  },

  skus: async (options?: ExportOptions): Promise<string | any[]> => {
    const response = await api.get('/export/skus', { params: options })
    return response.data
  },

  reorderReport: async (options?: ExportOptions): Promise<string | any[]> => {
    const response = await api.get('/export/reorder-report', { params: options })
    return response.data
  },

  costAnalysis: async (options?: ExportOptions): Promise<string | any[]> => {
    const response = await api.get('/export/cost-analysis', { params: options })
    return response.data
  },

  // Helper to download CSV directly
  downloadCSV: async (endpoint: string, filename: string, options?: ExportOptions): Promise<void> => {
    const params = { ...options, format: 'csv' }
    const response = await api.get(`/export/${endpoint}`, { 
      params,
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }
}

export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string; environment: string }> => {
    const response = await api.get('/health')
    return response.data
  }
}

export default api
