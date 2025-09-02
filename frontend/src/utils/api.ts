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
    // Skip auth for login and refresh endpoints to avoid circular calls
    const skipAuthUrls = ['/auth/login', '/auth/refresh', '/auth/logout-token']
    const shouldSkipAuth = skipAuthUrls.some(url => config.url?.includes(url))
    
    if (!shouldSkipAuth) {
      const store = await getAuthStore()
      const accessToken = await store.getValidAccessToken()
      
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
        console.log('Added auth token to request:', config.url)
      } else {
        // Fallback to legacy token for backward compatibility
        const legacyToken = localStorage.getItem('token')
        if (legacyToken) {
          config.headers.Authorization = `Bearer ${legacyToken}`
          console.log('Added legacy token to request:', config.url)
        }
      }
    } else {
      console.log('Skipping auth for URL:', config.url)
    }
  } catch (error) {
    console.warn('Failed to get access token for request:', config.url, error)
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
      console.log('=== 401 UNAUTHORIZED ERROR DETECTED ===')
      console.log('Request URL:', originalRequest.url)
      
      originalRequest._retry = true // Prevent infinite retry loops
      
      try {
        const store = await getAuthStore()
        
        // Skip auth endpoints to avoid infinite loops
        if (originalRequest.url?.includes('/auth/')) {
          console.log('401 on auth endpoint - clearing auth data and rejecting')
          if (store && typeof store.clearAuthData === 'function') {
            store.clearAuthData()
          }
          // Force redirect to login if not already there
          if (typeof window !== 'undefined' && !window.location.hash.includes('/login')) {
            console.log('Redirecting to login from auth endpoint failure')
            window.location.href = '/#/login'
          }
          return Promise.reject(error)
        }
        
        // Check if we have auth data to work with
        if (!store) {
          console.log('No auth store available, redirecting to login')
          if (typeof window !== 'undefined' && !window.location.hash.includes('/login')) {
            window.location.href = '/#/login'
          }
          return Promise.reject(error)
        }
        
        // If we have a refresh token, try to refresh
        if (store.refreshToken) {
          try {
            console.log('401 error - attempting token refresh for URL:', originalRequest.url)
            await store.refreshTokens()
            console.log('Token refresh successful, retrying original request')
            
            // Retry the original request with new token
            const newToken = await store.getValidAccessToken()
            if (newToken && originalRequest) {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              console.log('Retrying request with new token')
              return api.request(originalRequest)
            } else {
              console.log('No valid token after refresh, clearing auth')
              store.clearAuthData()
            }
          } catch (refreshError) {
            console.error('Token refresh failed during 401 handling:', refreshError)
            // Clear auth data and fall through to redirect
            store.clearAuthData()
          }
        } else {
          console.log('No refresh token available, clearing auth')
          store.clearAuthData()
        }
        
        // If we get here, auth failed - clear everything and redirect
        console.log('Authentication failed completely, redirecting to login')
        
        // Only redirect if we're not already on login page
        if (typeof window !== 'undefined' && !window.location.hash.includes('/login')) {
          console.log('Forcing redirect to login page')
          window.location.href = '/#/login'
        }
        
      } catch (storeError) {
        console.error('Error in 401 handler:', storeError)
        // Fallback cleanup
        try {
          console.log('Clearing localStorage as fallback')
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        } catch (storageError) {
          console.error('Failed to clear localStorage:', storageError)
        }
        
        if (typeof window !== 'undefined' && !window.location.hash.includes('/login')) {
          console.log('Fallback redirect to login')
          window.location.href = '/#/login'
        }
      }
      
      console.log('=== 401 ERROR HANDLING COMPLETED ===')
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

// New architecture: Inventory API for aggregated inventory data (matches BACKEND_API_REFERENCE.md EXACTLY)
export const inventoryApi = {
  // Get inventory overview with filtering and pagination - GET /api/inventory
  getInventory: async (params?: {
    category_id?: string
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder'
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
    include_tools?: 'true' | 'false' // Add parameter to include tools when needed
  }) => {
    console.log('🔍 [Frontend API] inventoryApi.getInventory called with params:', params)
    console.log('📊 [Frontend API] category_id type and value:', typeof params?.category_id, params?.category_id)
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
    
    // Map in_stock_only to status filter - use correct backend status values
    if (params?.in_stock_only) {
      // Don't filter by status for in_stock_only, let backend handle availability
      // The backend will return items with their availability status
    }
    
    const response = await api.get('/inventory', { params: newParams })
    
    // Transform response to match InventoryResponse interface exactly
    return {
      inventory: response.data.inventory || [],
      pagination: {
        current_page: response.data.pagination?.current_page || 1,
        total_pages: response.data.pagination?.total_pages || 0,
        total_items: response.data.pagination?.total_items || 0,
        items_per_page: response.data.pagination?.items_per_page || (params?.limit || 50)
      },
      filters: {
        status: newParams.status || 'all',
        sort_by: newParams.sort_by || 'sku_code',
        sort_order: newParams.sort_order || 'asc'
      }
    }
  },

  // Get inventory statistics for dashboard - GET /api/inventory/stats
  getStats: async (): Promise<InventoryStats> => {
    const response = await api.get('/inventory/stats')
    return response.data
  },

  // Get low stock items - GET /api/inventory/low-stock
  getLowStock: async () => {
    const response = await api.get('/inventory/low-stock')
    return response.data
  },

  // Get detailed inventory for specific SKU - GET /api/inventory/:sku_id
  getSKUInventory: async (skuId: string) => {
    const response = await api.get(`/inventory/${skuId}`)
    return response.data
  },

  // Update inventory settings/thresholds - PUT /api/inventory/:sku_id
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

  // Receive new stock - POST /api/inventory/:sku_id/receive
  receiveStock: async (skuId: string, data: {
    quantity: number
    cost?: number
    location?: string
    notes?: string
  }) => {
    const response = await api.post(`/inventory/${skuId}/receive`, data)
    return response.data
  },

  // Move inventory between statuses - POST /api/inventory/:sku_id/move
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

  // Remove inventory (damage, theft, etc.) - POST /api/inventory/:sku_id/remove
  removeStock: async (skuId: string, data: {
    quantity: number
    from_status: string
    reason: string
    notes?: string
  }) => {
    const response = await api.post(`/inventory/${skuId}/remove`, data)
    return response.data
  },

  // Get low stock alerts - GET /api/inventory/alerts/low-stock
  getLowStockAlerts: async () => {
    const response = await api.get('/inventory/alerts/low-stock')
    return response.data
  },

  // Get out of stock alerts - GET /api/inventory/alerts/out-of-stock
  getOutOfStockAlerts: async () => {
    const response = await api.get('/inventory/alerts/out-of-stock')
    return response.data
  },

  // Get reorder alerts - GET /api/inventory/alerts/reorder
  getReorderAlerts: async () => {
    const response = await api.get('/inventory/alerts/reorder')
    return response.data
  },

  // Get valuation report - GET /api/inventory/reports/valuation
  getValuationReport: async (categoryId?: string) => {
    const response = await api.get('/inventory/reports/valuation', {
      params: categoryId ? { category_id: categoryId } : undefined
    })
    return response.data
  },

  // Get movement report - GET /api/inventory/reports/movement
  getMovementReport: async (params?: {
    days?: number
    category_id?: string
    sku_id?: string
  }) => {
    const response = await api.get('/inventory/reports/movement', { params })
    return response.data
  },

  // Sync inventory from existing data - POST /api/inventory/sync
  syncInventory: async (forceRebuild = false) => {
    const response = await api.post('/inventory/sync', { force_rebuild: forceRebuild })
    return response.data
  }
}

// ✅ Instances API - matches BACKEND_API_REFERENCE.md EXACTLY
export const instancesApi = {
  // Get instances for specific SKU - /api/instances/:sku_id
  getInstances: async (skuId: string, params?: {
    available_only?: boolean
    include_tagged?: boolean
  }) => {
    const response = await api.get(`/instances/${skuId}`, { params })
    return response.data
  },

  // Add new stock instances - POST /api/instances/add-stock
  addStock: async (data: {
    sku_id: string
    quantity: number
    unit_cost: number
    location?: string
    supplier?: string
    reference_number?: string
    notes?: string
  }) => {
    const response = await api.post('/instances/add-stock', data)
    return response.data
  },

  // Update instance details - PUT /api/instances/:id
  updateInstance: async (id: string, updates: {
    location?: string
    supplier?: string
    reference_number?: string
    notes?: string
  }) => {
    const response = await api.put(`/instances/${id}`, updates)
    return response.data
  },

  // Get cost analysis - GET /api/instances/cost-breakdown/:sku_id
  getCostBreakdown: async (skuId: string) => {
    const response = await api.get(`/instances/cost-breakdown/${skuId}`)
    return response.data
  },

  // Adjust quantity for a SKU - POST /api/instances/adjust-quantity
  adjustQuantity: async (data: {
    sku_id: string
    adjustment: number // positive to increase, negative to decrease
    reason?: string
  }): Promise<{
    message: string
    sku: {
      _id: string
      sku_code: string
      name: string
    }
    adjustment_details: {
      action: 'increased' | 'decreased'
      quantity: number
      instances_created?: any[]
      instances_removed?: number
      cost_per_unit?: number
      total_value_removed?: number
      average_cost_removed?: number
    }
    inventory_summary: any
  }> => {
    const response = await api.post('/instances/adjust-quantity', data)
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

// Tools Dashboard API - for tools-specific functionality and loan management
export const toolsApi = {
  // Get active loans (tools currently loaned out)
  getActiveLoans: async (params?: {
    customer_name?: string
    overdue_only?: boolean
    project_name?: string
    sort_by?: 'due_date' | 'customer_name' | 'created_at'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
  }) => {
    const response = await api.get('/tags', {
      params: {
        tag_type: 'loaned',
        status: 'active',
        include_items: true,
        ...params,
        // Ensure limit is within backend validation range (1-100)
        limit: Math.min(params?.limit || 50, 100)
      }
    })
    return response.data
  },

  // Get tools inventory (tools category items with status)
  getToolsInventory: async (params?: {
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock'
    available_only?: boolean
    sort_by?: 'sku_code' | 'name'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
  }) => {
    // Get tool categories first to filter by them
    const categoriesResponse = await categoryApi.getCategories({ active_only: true })
    const toolCategories = categoriesResponse.categories.filter(cat => cat.type === 'tool')
    
    if (toolCategories.length === 0) {
      return { inventory: [], pagination: { total_items: 0, total_pages: 0, current_page: 1, items_per_page: 50 } }
    }

    const toolCategoryIds = toolCategories.map(cat => cat._id)
    
    // Get inventory for tool categories
    const response = await inventoryApi.getInventory({
      ...params,
      // Filter by tool categories - we'll need to make multiple calls or enhance the backend
      // For now, get all inventory and filter client-side
    })

    // Filter results to only include tools
    const toolsInventory = response.inventory.filter(item => 
      item.sku && toolCategoryIds.includes(item.sku.category_id)
    )

    return {
      ...response,
      inventory: toolsInventory
    }
  },

  // Get tools dashboard stats
  getDashboardStats: async () => {
    try {
      // Use the new tools-specific stats endpoint
      const statsResponse = await api.get('/tools/stats')
      
      // Get active loans for additional context
      const loansResponse = await toolsApi.getActiveLoans({ limit: 100 })
      
      return {
        stats: statsResponse.data.stats,
        activeLoans: loansResponse.tags || [],
        recentActivity: [], // This would need backend support for activity tracking
        meta: statsResponse.data.meta
      }
    } catch (error) {
      console.error('Failed to fetch tools dashboard stats:', error)
      throw error
    }
  },

  // Create new tool loan
  createLoan: async (loanData: {
    customer_name: string
    sku_items: Array<{
      sku_id: string
      quantity: number
      selection_method?: 'auto' | 'manual' | 'fifo'
      selected_instance_ids?: string[]
      notes?: string
    }>
    project_name?: string
    due_date?: string
    notes?: string
  }) => {
    const response = await tagApi.createTag({
      ...loanData,
      tag_type: 'loaned'
    })
    return response
  },

  // Return loaned tools
  returnLoan: async (tagId: string, returnData?: {
    notes?: string
    condition_notes?: string
  }) => {
    const response = await tagApi.fulfillTag(tagId, {
      fulfillment_items: [] // This would need to be populated based on the tag's items
    })
    return response
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
    status?: 'active' | 'discontinued' | 'pending'
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
    const response = await api.post('/skus/batch-scan', data)
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

// User Management API (Admin only)
export const userApi = {
  // Get all users with filtering and pagination - GET /api/users
  getUsers: async (params?: {
    page?: number
    limit?: number
    role?: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
    search?: string
    active?: boolean
  }) => {
    const response = await api.get('/users', { params })
    return response.data
  },

  // Get user statistics - GET /api/users/stats
  getStats: async () => {
    const response = await api.get('/users/stats')
    return response.data
  },

  // Get specific user - GET /api/users/:id
  getUser: async (id: string) => {
    const response = await api.get(`/users/${id}`)
    return response.data
  },

  // Create new user - POST /api/users
  createUser: async (userData: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    role: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
  }) => {
    const response = await api.post('/users', userData)
    return response.data
  },

  // Update user - PUT /api/users/:id
  updateUser: async (id: string, updates: {
    username?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
    isActive?: boolean
  }) => {
    const response = await api.put(`/users/${id}`, updates)
    return response.data
  },

  // Reset user password - PUT /api/users/:id/reset-password
  resetPassword: async (id: string, newPassword: string) => {
    const response = await api.put(`/users/${id}/reset-password`, { newPassword })
    return response.data
  },

  // Unlock user account - PUT /api/users/:id/unlock
  unlockUser: async (id: string) => {
    const response = await api.put(`/users/${id}/unlock`)
    return response.data
  },

  // Deactivate user (soft delete) - DELETE /api/users/:id
  deactivateUser: async (id: string) => {
    const response = await api.delete(`/users/${id}`)
    return response.data
  },

  // Permanently delete user (hard delete) - DELETE /api/users/:id/hard-delete
  deleteUser: async (id: string) => {
    const response = await api.delete(`/users/${id}/hard-delete`)
    return response.data
  },

  // Get user activity history - GET /api/users/:id/activity
  getUserActivity: async (id: string, params?: {
    limit?: number
    days?: number
  }) => {
    const response = await api.get(`/users/${id}/activity`, { params })
    return response.data
  }
}

export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string; environment: string }> => {
    const response = await api.get('/health')
    return response.data
  }
}

export default api
