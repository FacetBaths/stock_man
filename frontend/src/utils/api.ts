import axios from 'axios'
import type { 
  LoginCredentials, 
  LoginResponse, 
  TokenRefreshResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
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
  ExportOptions,
  Category,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UseItemsRequest,
  FulfillTagRequest,
  Inventory
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

let authStore: any = null

// Helper to get auth store instance (lazy loaded to avoid circular dependency)
const getAuthStore = async () => {
  if (!authStore) {
    const { useAuthStore } = await import('@/stores/auth')
    authStore = useAuthStore()
  }
  return authStore
}

// Request interceptor to add auth token with automatic refresh
api.interceptors.request.use(async (config) => {
  try {
    const store = await getAuthStore()
    const accessToken = await store.getValidAccessToken()
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    } else {
      // Fallback to legacy token for backward compatibility
      const legacyToken = localStorage.getItem('token')
      if (legacyToken) {
        config.headers.Authorization = `Bearer ${legacyToken}`
      }
    }
  } catch (error) {
    console.warn('Failed to get access token:', error)
    // Continue with request without token
  }
  
  return config
}, (error) => {
  return Promise.reject(error)
})

// Response interceptor to handle auth errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors with automatic token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true // Prevent infinite retry loops
      
      try {
        const store = await getAuthStore()
        
        // Skip auth endpoints to avoid infinite loops
        if (originalRequest.url?.includes('/auth/')) {
          console.log('Auth endpoint failed, clearing auth data')
          if (store && typeof store.clearAuthData === 'function') {
            store.clearAuthData()
          }
          return Promise.reject(error)
        }
        
        // If we have a refresh token, try to refresh
        if (store?.refreshToken) {
          try {
            console.log('401 error - attempting token refresh')
            await store.refreshTokens()
            
            // Retry the original request with new token
            const newToken = await store.getValidAccessToken()
            if (newToken && originalRequest) {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return api.request(originalRequest)
            }
          } catch (refreshError) {
            console.error('Token refresh failed, clearing auth:', refreshError)
            // Clear auth data and fall through to redirect
            if (store && typeof store.clearAuthData === 'function') {
              store.clearAuthData()
            }
          }
        }
        
        // If no refresh token or refresh failed, clear auth and redirect
        console.log('No valid refresh token or refresh failed, redirecting to login')
        if (store && typeof store.clearAuthData === 'function') {
          store.clearAuthData()
        }
        
        // Only redirect if we're not already on login page
        if (typeof window !== 'undefined' && window.location.hash !== '#/login') {
          window.location.href = '/#/login'
        }
      } catch (storeError) {
        console.error('Error handling 401:', storeError)
        // Fallback cleanup
        try {
          localStorage.clear()
        } catch (storageError) {
          console.error('Failed to clear localStorage:', storageError)
        }
        if (typeof window !== 'undefined' && window.location.hash !== '#/login') {
          window.location.href = '/#/login'
        }
      }
    }
    
    return Promise.reject(error)
  }
)

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  refreshToken: async (refreshToken: string): Promise<TokenRefreshResponse> => {
    const response = await api.post('/auth/refresh', { refreshToken })
    return response.data
  },

  logout: async (refreshToken?: string): Promise<void> => {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken })
    } else {
      await api.post('/auth/logout')
    }
  },

  logoutWithToken: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout-token', { refreshToken })
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  },

  updateProfile: async (profileData: UpdateProfileRequest): Promise<{ message: string; user: User }> => {
    const response = await api.put('/auth/profile', profileData)
    return response.data
  },

  changePassword: async (passwordData: ChangePasswordRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-password', passwordData)
    return response.data
  }
}

// New architecture: Inventory API for aggregated inventory data
export const inventoryApi = {
  // Get inventory overview with filtering and pagination
  getInventory: async (params?: {
    category_id?: string
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder'
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }) => {
    const response = await api.get('/inventory', { params })
    return response.data
  },

  // Backward compatibility method - maps to new inventory endpoint
  getItems: async (params?: {
    product_type?: string
    search?: string
    page?: number
    limit?: number
    in_stock_only?: boolean
  }): Promise<InventoryResponse> => {
    // Map old parameters to new inventory endpoint structure
    const newParams: any = {
      search: params?.search,
      page: params?.page,
      limit: params?.limit
    }
    
    // Map product_type to category filtering if needed
    if (params?.product_type && params.product_type !== 'all') {
      // This would need category ID mapping in real implementation
      // For now, we'll use the search to filter by product type
      newParams.search = params.product_type
    }
    
    // Map in_stock_only to status filter
    if (params?.in_stock_only) {
      newParams.status = 'available' // or however this should be mapped
    }
    
    const response = await api.get('/inventory', { params: newParams })
    
    // Transform response to match old InventoryResponse format
    // The backend returns 'inventory' array, but old system expected 'items'
    const inventoryItems = response.data.inventory || []
    
    return {
      items: inventoryItems,
      totalItems: response.data.pagination?.total_items || 0,
      totalPages: response.data.pagination?.total_pages || 0,
      currentPage: response.data.pagination?.current_page || 1
    }
  },

  // Get inventory statistics for dashboard
  getStats: async (): Promise<InventoryStats> => {
    const response = await api.get('/inventory/stats')
    return response.data
  },

  // Get detailed inventory for specific SKU
  getSKUInventory: async (skuId: string) => {
    const response = await api.get(`/inventory/${skuId}`)
    return response.data
  },

  // Update inventory settings/thresholds
  updateInventorySettings: async (skuId: string, updates: {
    available?: number
    reserved?: number
    broken?: number
    loaned?: number
    minimum_stock_level?: number
    reorder_point?: number
    maximum_stock_level?: number
    primary_location?: string
    average_cost?: number
    locations?: Array<{ location_name: string; quantity: number }>
  }) => {
    const response = await api.put(`/inventory/${skuId}`, updates)
    return response.data
  },

  // Receive new stock
  receiveStock: async (skuId: string, data: {
    quantity: number
    cost?: number
    location?: string
    notes?: string
  }) => {
    const response = await api.post(`/inventory/${skuId}/receive`, data)
    return response.data
  },

  // Move inventory between statuses
  moveStock: async (skuId: string, data: {
    quantity: number
    from_status: string
    to_status: string
    reason?: string
    notes?: string
  }) => {
    const response = await api.post(`/inventory/${skuId}/move`, data)
    return response.data
  },

  // Remove inventory (damage, theft, etc.)
  removeStock: async (skuId: string, data: {
    quantity: number
    from_status: string
    reason: string
    notes?: string
  }) => {
    const response = await api.post(`/inventory/${skuId}/remove`, data)
    return response.data
  },

  // Get alerts
  getLowStockAlerts: async () => {
    const response = await api.get('/inventory/alerts/low-stock')
    return response.data
  },

  getOutOfStockAlerts: async () => {
    const response = await api.get('/inventory/alerts/out-of-stock')
    return response.data
  },

  getReorderAlerts: async () => {
    const response = await api.get('/inventory/alerts/reorder')
    return response.data
  },

  // Reports
  getValuationReport: async (categoryId?: string) => {
    const response = await api.get('/inventory/reports/valuation', {
      params: categoryId ? { category_id: categoryId } : undefined
    })
    return response.data
  },

  getMovementReport: async (params?: {
    days?: number
    category_id?: string
    sku_id?: string
  }) => {
    const response = await api.get('/inventory/reports/movement', { params })
    return response.data
  },

  // Sync inventory from existing data
  syncInventory: async (forceRebuild = false) => {
    const response = await api.post('/inventory/sync', { force_rebuild: forceRebuild })
    return response.data
  }
}

// New architecture: Items API for individual item instances
export const itemsApi = {
  // Get items with filtering
  getItems: async (params?: {
    sku_id?: string
    condition?: string
    location?: string
    search?: string
    page?: number
    limit?: number
  }) => {
    const response = await api.get('/items', { params })
    return response.data
  },

  // Get single item
  getItem: async (id: string) => {
    const response = await api.get(`/items/${id}`)
    return response.data
  },

  // Create new item instance
  createItem: async (item: CreateItemRequest) => {
    const response = await api.post('/items', item)
    return response.data
  },

  // Update item
  updateItem: async (id: string, updates: UpdateItemRequest) => {
    const response = await api.put(`/items/${id}`, updates)
    return response.data
  },

  // Delete item
  deleteItem: async (id: string) => {
    const response = await api.delete(`/items/${id}`)
    return response.data
  },

  // Use items (track usage)
  useItems: async (id: string, data: UseItemsRequest) => {
    const response = await api.post(`/items/${id}/use`, data)
    return response.data
  },

  // Find items by SKU code (for scanning workflow)
  findBySKU: async (skuCode: string, params?: {
    condition?: string
    location?: string
    available_only?: boolean
  }) => {
    const response = await api.get(`/items/sku/${encodeURIComponent(skuCode)}`, { params })
    return response.data
  },

  // Create multiple items from SKU scan (receiving workflow)
  createFromSKU: async (data: {
    sku_code: string
    quantity: number
    location?: string
    condition?: string
    purchase_price?: number
    batch_number?: string
    notes?: string
  }) => {
    const response = await api.post('/items/receive', data)
    return response.data
  },

  // Scan item for tagging/fulfillment
  scanItem: async (identifier: string) => {
    // identifier could be item ID, SKU code, or barcode
    const response = await api.get(`/items/scan/${encodeURIComponent(identifier)}`)
    return response.data
  },

  // Get items available for tagging
  getAvailableItems: async (params?: {
    sku_id?: string
    location?: string
    min_quantity?: number
    exclude_tagged?: boolean
  }) => {
    const response = await api.get('/items/available', { params })
    return response.data
  }
}

// New architecture: Category API
export const categoryApi = {
  // Get all categories with optional filtering
  getCategories: async (params?: {
    active_only?: boolean
    parent_id?: string | null
    include_children?: boolean
    search?: string
  }): Promise<CategoryResponse> => {
    const response = await api.get('/categories', { params })
    return response.data
  },

  // Get single category with stats
  getCategory: async (id: string): Promise<{ category: Category }> => {
    const response = await api.get(`/categories/${id}`)
    return response.data
  },

  // Create new category
  createCategory: async (category: CreateCategoryRequest): Promise<{ message: string; category: Category }> => {
    const response = await api.post('/categories', category)
    return response.data
  },

  // Update category
  updateCategory: async (id: string, updates: UpdateCategoryRequest): Promise<{ message: string; category: Category }> => {
    const response = await api.put(`/categories/${id}`, updates)
    return response.data
  },

  // Delete category
  deleteCategory: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/categories/${id}`)
    return response.data
  },

  // Get category hierarchy tree
  getHierarchy: async () => {
    const response = await api.get('/categories/hierarchy/tree')
    return response.data
  }
}

// Updated Tag API for new architecture
export const tagApi = {
  // Get tags with enhanced filtering
  getTags: async (params?: {
    customer_name?: string
    tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
    status?: 'active' | 'fulfilled' | 'cancelled'
    project_name?: string
    search?: string
    include_items?: boolean
    overdue_only?: boolean
    sort_by?: 'created_at' | 'due_date' | 'customer_name' | 'project_name'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
  }): Promise<TagResponse> => {
    const response = await api.get('/tags', { params })
    return response.data
  },

  // Get single tag with details
  getTag: async (id: string, includeItems = false): Promise<{ tag: Tag }> => {
    const response = await api.get(`/tags/${id}`, {
      params: { include_items: includeItems }
    })
    return response.data
  },

  // Create new tag
  createTag: async (tag: CreateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.post('/tags', tag)
    return response.data
  },

  // Update tag
  updateTag: async (id: string, updates: UpdateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.put(`/tags/${id}`, updates)
    return response.data
  },

  // Delete tag
  deleteTag: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/tags/${id}`)
    return response.data
  },

  // Partially fulfill tag items
  fulfillTag: async (id: string, fulfillmentItems: Array<{
    item_id: string
    quantity_fulfilled: number
  }>): Promise<{ message: string; tag: Tag }> => {
    const response = await api.post(`/tags/${id}/fulfill`, {
      fulfillment_items: fulfillmentItems
    })
    return response.data
  },

  // Get tag statistics
  getStats: async () => {
    const response = await api.get('/tags/stats')
    return response.data
  },

  // Get all customers from tags
  getCustomers: async () => {
    const response = await api.get('/tags/customers')
    return response.data
  }
}

// Updated SKU API for new architecture
export const skuApi = {
  // Get SKUs with enhanced filtering
  getSKUs: async (params?: {
    category_id?: string
    is_active?: boolean
    is_lendable?: boolean
    search?: string
    sort_by?: 'sku_code' | 'name' | 'unit_cost' | 'created_at'
    sort_order?: 'asc' | 'desc'
    include_inventory?: boolean
    page?: number
    limit?: number
  }): Promise<{ 
    skus: SKU[]
    pagination: {
      currentPage: number
      totalPages: number
      totalSkus: number
      limit: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }> => {
    const response = await api.get('/skus', { params })
    return response.data
  },

  // Get single SKU with optional inventory and items
  getSKU: async (id: string, params?: {
    include_inventory?: boolean
    include_items?: boolean
  }): Promise<{ sku: SKU }> => {
    const response = await api.get(`/skus/${id}`, { params })
    return response.data
  },

  // Create new SKU
  createSKU: async (sku: CreateSKURequest): Promise<{ message: string; sku: SKU }> => {
    const response = await api.post('/skus', sku)
    return response.data
  },

  // Update SKU
  updateSKU: async (id: string, updates: UpdateSKURequest): Promise<{ message: string; sku: SKU }> => {
    const response = await api.put(`/skus/${id}`, updates)
    return response.data
  },

  // Delete SKU
  deleteSKU: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/skus/${id}`)
    return response.data
  },

  // Lookup SKU by code (for barcode scanning)
  lookupSKU: async (skuCode: string): Promise<{ sku: SKU }> => {
    const response = await api.get(`/skus/lookup/${encodeURIComponent(skuCode)}`)
    return response.data
  },

  // Legacy methods for backward compatibility
  generateSKUCode: async (data: {
    category_id: string
    manufacturer_model?: string
  }): Promise<{ sku_code: string }> => {
    const response = await api.post('/skus/generate', data)
    return response.data
  },

  addCost: async (id: string, costData: AddCostRequest): Promise<{ message: string; sku: SKU }> => {
    const response = await api.post(`/skus/${id}/cost`, costData)
    return response.data
  },

  searchByBarcode: async (barcode: string): Promise<{ sku: SKU }> => {
    const response = await api.get(`/skus/search/barcode/${encodeURIComponent(barcode)}`)
    return response.data
  },

  // Bundle SKU expansion
  expandBundle: async (skuCode: string): Promise<{
    sku: SKU
    is_bundle: boolean
    components?: Array<{
      sku: SKU
      quantity: number
      available_sets: number
    }>
    available_sets: number
  }> => {
    const response = await api.get(`/skus/${encodeURIComponent(skuCode)}/expand`)
    return response.data
  },

  // Create bundle configuration
  createBundle: async (skuId: string, components: Array<{
    sku_id: string
    quantity: number
    notes?: string
  }>): Promise<{ message: string; sku: SKU }> => {
    const response = await api.post(`/skus/${skuId}/bundle`, { components })
    return response.data
  },

  // Update bundle configuration
  updateBundle: async (skuId: string, components: Array<{
    sku_id: string
    quantity: number
    notes?: string
  }>): Promise<{ message: string; sku: SKU }> => {
    const response = await api.put(`/skus/${skuId}/bundle`, { components })
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
