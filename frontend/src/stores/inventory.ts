import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Instance,
  InventoryStats, 
  AddStockRequest,
  UpdateInstanceRequest,
  Inventory,
  InventoryResponse
} from '@/types'
import { inventoryApi, instancesApi, skuApi } from '@/utils/api'

export const useInventoryStore = defineStore('inventory', () => {
  // New architecture: Aggregated inventory data
  const inventory = ref<any[]>([])
  const stats = ref<InventoryStats | null>(null)
  const currentSKUInventory = ref<any | null>(null)
  
  // Individual instances for stock management
  const instances = ref<Instance[]>([])
  const currentInstance = ref<Instance | null>(null)
  
  // Loading states
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const isReceiving = ref(false)
  const isMoving = ref(false)
  const isRemoving = ref(false)
  const isSyncing = ref(false)
  const error = ref<string | null>(null)
  
  // Pagination
  const pagination = ref({
    total_items: 0,
    total_pages: 0,
    current_page: 1,
    items_per_page: 50
  })
  
  // Current filters for inventory
  const inventoryFilters = ref({
    category_id: '',
    search: '',
    status: 'all' as 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder',
    sort_by: 'sku_code',
    sort_order: 'asc' as 'asc' | 'desc'
  })
  
  // Current filters for instances
  const instanceFilters = ref({
    sku_id: '',
    location: '',
    search: '',
    available_only: false
  })

  // Computed properties for inventory
  const inventoryByStatus = computed(() => {
    const result = {
      low_stock: [] as any[],
      out_of_stock: [] as any[],
      overstock: [] as any[],
      adequate: [] as any[]
    }
    
    inventory.value.forEach(item => {
      if (item.is_low_stock) result.low_stock.push(item)
      else if (item.is_out_of_stock) result.out_of_stock.push(item)
      else if (item.is_overstock) result.overstock.push(item)
      else result.adequate.push(item)
    })
    
    return result
  })

  const inventoryStats = computed(() => {
    return {
      totalSKUs: inventory.value.length,
      lowStock: inventoryByStatus.value.low_stock.length,
      outOfStock: inventoryByStatus.value.out_of_stock.length,
      overstock: inventoryByStatus.value.overstock.length,
      totalValue: inventory.value.reduce((sum, item) => sum + (item.total_value || 0), 0),
      totalQuantity: inventory.value.reduce((sum, item) => sum + (item.total_quantity || 0), 0)
    }
  })

  // Computed properties for instances
  const instancesByLocation = computed(() => {
    const result: Record<string, Instance[]> = {}
    instances.value.forEach(instance => {
      if (!result[instance.location]) {
        result[instance.location] = []
      }
      result[instance.location].push(instance)
    })
    return result
  })

  // Actions for inventory management
  const fetchInventory = async (params?: {
    category_id?: string
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder'
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }) => {
    try {
      isLoading.value = true
      error.value = null
      
      // Update filters
      if (params) {
        inventoryFilters.value = { ...inventoryFilters.value, ...params }
      }

      const response = await inventoryApi.getInventory({
        ...inventoryFilters.value,
        page: params?.page || inventoryFilters.value.current_page
      })
      
      // Transform backend inventory data to match frontend expectations
      inventory.value = response.inventory.map((item: any) => ({
        // Keep all original inventory properties
        ...item,
        // Map common fields for component compatibility
        _id: item._id,
        quantity: item.total_quantity || 0,
        product_type: item.category?.name?.toLowerCase().replace(/\s+/g, '_') || 'miscellaneous',
        location: item.primary_location || 'Unknown',
        notes: '', // inventory records don't have notes
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        // Transform tag_summary to tagSummary with camelCase properties
        tagSummary: item.tag_summary ? {
          reserved: item.tag_summary.reserved || 0,
          broken: item.tag_summary.broken || 0,
          loaned: item.tag_summary.loaned || 0,
          imperfect: item.tag_summary.imperfect || 0, // Add support for imperfect tags if backend adds them
          totalTagged: item.tag_summary.totalTagged || 0
        } : {
          reserved: 0,
          broken: 0,
          loaned: 0,
          imperfect: 0,
          totalTagged: 0
        },
        // CRITICAL FIX: Preserve original SKU data structure for EditItemModal
        // The EditItemModal expects populated SKU data in item.sku
        sku: item.sku ? {
          _id: item.sku._id,
          sku_code: item.sku.sku_code || '',
          name: item.sku.name || 'Unknown Product',
          description: item.sku.description || '',
          brand: item.sku.brand || '',
          model: item.sku.model || '',
          color: item.sku.color || '',
          dimensions: item.sku.dimensions || '',
          finish: item.sku.finish || '',
          unit_cost: item.sku.unit_cost || 0,
          barcode: item.sku.barcode || '',
          notes: item.sku.notes || '',
          category_id: item.sku.category_id || item.category?._id || '',
          status: item.sku.status || 'active',
          current_cost: item.sku.unit_cost || item.average_cost || 0
        } : null,
        // Also preserve sku_id for fallback
        sku_id: item.sku_id,
        // Add product details for display (legacy compatibility)
        product_details: {
          name: item.sku?.name || 'Unknown Product',
          description: item.sku?.description || '',
          brand: item.sku?.brand || '',
          model: item.sku?.model || ''
        },
        // Map cost fields
        cost: item.average_cost || 0,
        // Map SKU fields for backward compatibility
        sku_code: item.sku?.sku_code || '',
        barcode: item.sku?.barcode || ''
      }))
      pagination.value = {
        total_items: response.pagination.total_items,
        total_pages: response.pagination.total_pages,
        current_page: response.pagination.current_page,
        items_per_page: response.pagination.items_per_page
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch inventory'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchStats = async () => {
    try {
      const response = await inventoryApi.getStats()
      stats.value = response
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch stats'
      throw err
    }
  }

  const fetchSKUInventory = async (skuId: string) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await inventoryApi.getSKUInventory(skuId)
      currentSKUInventory.value = response
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch SKU inventory'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateInventorySettings = async (skuId: string, updates: {
    available?: number
    reserved?: number
    broken?: number
    loaned?: number
    minimum_stock_level?: number
    reorder_point?: number
    maximum_stock_level?: number
    primary_location?: string
    average_cost?: number
  }) => {
    try {
      isUpdating.value = true
      error.value = null
      
      const response = await inventoryApi.updateInventorySettings(skuId, updates)
      
      // Update in inventory list if exists
      const index = inventory.value.findIndex(item => item.sku_id === skuId)
      if (index !== -1) {
        inventory.value[index] = { ...inventory.value[index], ...response.inventory }
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update inventory settings'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const receiveStock = async (skuId: string, data: {
    quantity: number
    cost?: number
    location?: string
    notes?: string
  }) => {
    try {
      isReceiving.value = true
      error.value = null
      
      const response = await inventoryApi.receiveStock(skuId, data)
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to receive stock'
      throw err
    } finally {
      isReceiving.value = false
    }
  }

  const moveStock = async (skuId: string, data: {
    quantity: number
    from_status: string
    to_status: string
    reason?: string
    notes?: string
  }) => {
    try {
      isMoving.value = true
      error.value = null
      
      const response = await inventoryApi.moveStock(skuId, data)
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to move stock'
      throw err
    } finally {
      isMoving.value = false
    }
  }

  const removeStock = async (skuId: string, data: {
    quantity: number
    from_status: string
    reason: string
    notes?: string
  }) => {
    try {
      isRemoving.value = true
      error.value = null
      
      const response = await inventoryApi.removeStock(skuId, data)
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to remove stock'
      throw err
    } finally {
      isRemoving.value = false
    }
  }

  // ✅ Actions for instance management using instancesApi (correct backend endpoints)
  const fetchInstances = async (skuId: string, params?: {
    available_only?: boolean
    include_tagged?: boolean
  }) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await instancesApi.getInstances(skuId, params)
      instances.value = response.instances || []
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch instances'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const addStock = async (data: AddStockRequest) => {
    try {
      isCreating.value = true
      error.value = null
      
      const response = await instancesApi.addStock(data)
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to add stock'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  const updateInstance = async (id: string, updates: UpdateInstanceRequest) => {
    try {
      isUpdating.value = true
      error.value = null
      
      const response = await instancesApi.updateInstance(id, updates)
      
      // Update in local instances if present
      const index = instances.value.findIndex(instance => instance._id === id)
      if (index !== -1) {
        instances.value[index] = { ...instances.value[index], ...response.instance }
      }
      
      // Update current instance if it's the same
      if (currentInstance.value?._id === id) {
        currentInstance.value = { ...currentInstance.value, ...response.instance }
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update instance'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const getCostBreakdown = async (skuId: string) => {
    try {
      const response = await instancesApi.getCostBreakdown(skuId)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to get cost breakdown'
      throw err
    }
  }

  // Alerts and reports
  const fetchLowStockAlerts = async () => {
    try {
      return await inventoryApi.getLowStockAlerts()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch low stock alerts'
      throw err
    }
  }

  const fetchOutOfStockAlerts = async () => {
    try {
      return await inventoryApi.getOutOfStockAlerts()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch out of stock alerts'
      throw err
    }
  }

  const fetchReorderAlerts = async () => {
    try {
      return await inventoryApi.getReorderAlerts()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch reorder alerts'
      throw err
    }
  }

  const fetchValuationReport = async (categoryId?: string) => {
    try {
      return await inventoryApi.getValuationReport(categoryId)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch valuation report'
      throw err
    }
  }

  const fetchMovementReport = async (params?: {
    days?: number
    category_id?: string
    sku_id?: string
  }) => {
    try {
      return await inventoryApi.getMovementReport(params)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch movement report'
      throw err
    }
  }

  // Sync inventory
  const syncInventory = async (forceRebuild = false) => {
    try {
      isSyncing.value = true
      error.value = null
      
      const response = await inventoryApi.syncInventory(forceRebuild)
      
      // Refresh all data after sync
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to sync inventory'
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  // Helper functions
  const clearError = () => {
    error.value = null
  }

  const updateInventoryFilters = (newFilters: Partial<typeof inventoryFilters.value>) => {
    inventoryFilters.value = { ...inventoryFilters.value, ...newFilters }
    fetchInventory({ page: 1 })
  }

  const clearInventoryFilters = () => {
    inventoryFilters.value = {
      category_id: '',
      search: '',
      status: 'all',
      sort_by: 'sku_code',
      sort_order: 'asc'
    }
    fetchInventory({ page: 1 })
  }

  const updateInstanceFilters = (newFilters: Partial<typeof instanceFilters.value>) => {
    instanceFilters.value = { ...instanceFilters.value, ...newFilters }
  }

  const clearInstanceFilters = () => {
    instanceFilters.value = {
      sku_id: '',
      location: '',
      search: '',
      available_only: false
    }
  }

  // Item creation method that creates SKU and adds stock
  const createItem = async (itemData: {
    category_id: string
    name: string
    description: string
    brand?: string
    model?: string
    details?: any
    unit_cost?: number
    currency?: string
    barcode?: string
    quantity: number
    location?: string
    notes?: string
  }) => {
    try {
      isCreating.value = true
      error.value = null

      // Step 1: Create the SKU
      const skuResponse = await skuApi.createSKU({
        category_id: itemData.category_id,
        name: itemData.name,
        description: itemData.description,
        brand: itemData.brand,
        model: itemData.model,
        details: itemData.details,
        unit_cost: itemData.unit_cost,
        currency: itemData.currency || 'USD',
        barcode: itemData.barcode
      })

      // Step 2: Add stock instances if quantity > 0
      if (itemData.quantity > 0) {
        await addStock({
          sku_id: skuResponse.sku._id,
          quantity: itemData.quantity,
          unit_cost: itemData.unit_cost || 0,
          location: itemData.location,
          notes: itemData.notes
        })
      }

      // Refresh inventory data
      await fetchInventory()
      await fetchStats()

      return skuResponse
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create item'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  // Backward compatibility methods
  const loadItems = async (params?: { 
    in_stock_only?: boolean
    product_type?: string
    search?: string 
    page?: number
  }) => {
    // Map to fetchInventory for backward compatibility
    return await fetchInventory({
      search: params?.search,
      page: params?.page || 1,
      status: params?.in_stock_only ? undefined : 'all'
    })
  }

  const loadStats = async () => {
    return await fetchStats()
  }

  // Computed property for backward compatibility  
  const itemsByType = computed(() => {
    const result: Record<string, any[]> = {}
    inventory.value.forEach(item => {
      const type = item.product_type || 'unknown'
      if (!result[type]) {
        result[type] = []
      }
      result[type].push(item)
    })
    return result
  })

  return {
    // State - Inventory
    inventory,
    currentSKUInventory,
    inventoryFilters,
    
    // State - Instances
    instances,
    currentInstance,
    instanceFilters,
    
    // State - General
    stats,
    pagination,
    
    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isReceiving,
    isMoving,
    isRemoving,
    isSyncing,
    error,
    
    // Computed
    inventoryByStatus,
    inventoryStats,
    instancesByLocation,
    itemsByType, // Backward compatibility
    
    // Actions - Inventory
    fetchInventory,
    fetchStats,
    fetchSKUInventory,
    updateInventorySettings,
    receiveStock,
    moveStock,
    removeStock,
    
    // Actions - Instances
    fetchInstances,
    addStock,
    updateInstance,
    getCostBreakdown,
    
    // Actions - Alerts & Reports
    fetchLowStockAlerts,
    fetchOutOfStockAlerts,
    fetchReorderAlerts,
    fetchValuationReport,
    fetchMovementReport,
    
    // Actions - Sync
    syncInventory,
    
    // Helpers
    clearError,
    updateInventoryFilters,
    clearInventoryFilters,
    
    // Item creation (full workflow)
    createItem,
    
    // Backward compatibility methods
    loadItems,
    loadStats
  }
})
