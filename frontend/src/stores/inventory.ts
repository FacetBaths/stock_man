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
  // New architecture: Aggregated inventory data (matches BACKEND_API_REFERENCE.md exactly)
  const inventory = ref<Inventory[]>([])
  const stats = ref<InventoryStats | null>(null)
  const currentSKUInventory = ref<Inventory | null>(null)

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
    // If we have backend stats, use those (more accurate)
    if (stats.value?.summary) {
      const summary = stats.value.summary
      return {
        totalSKUs: summary.total_skus || 0,
        totalItems: summary.total_quantity || 0,
        inStock: summary.available_quantity || 0,
        totalValue: summary.total_value || 0,
        lowStock: summary.low_stock_count || 0,
        outOfStock: summary.out_of_stock_count || 0,
        needReorder: summary.needs_reorder_count || 0,
        overstock: summary.overstock_count || 0,
        totalQuantity: summary.total_quantity || 0,
        availableQuantity: summary.available_quantity || 0,
        reservedQuantity: summary.reserved_quantity || 0,
        brokenQuantity: summary.broken_quantity || 0,
        loanedQuantity: summary.loaned_quantity || 0
      }
    }

    // Fallback to computed from inventory list (less accurate but better than nothing)
    return {
      totalSKUs: inventory.value.length,
      totalItems: inventory.value.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
      inStock: inventory.value.reduce((sum, item) => sum + (item.available_quantity || 0), 0),
      totalValue: inventory.value.reduce((sum, item) => sum + (item.total_value || 0), 0),
      lowStock: inventoryByStatus.value.low_stock.length,
      outOfStock: inventoryByStatus.value.out_of_stock.length,
      needReorder: inventory.value.filter(item =>
        item.available_quantity <= item.reorder_point
      ).length,
      overstock: inventoryByStatus.value.overstock.length,
      totalQuantity: inventory.value.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
      availableQuantity: inventory.value.reduce((sum, item) => sum + (item.available_quantity || 0), 0),
      reservedQuantity: inventory.value.reduce((sum, item) => sum + (item.reserved_quantity || 0), 0),
      brokenQuantity: inventory.value.reduce((sum, item) => sum + (item.broken_quantity || 0), 0),
      loanedQuantity: inventory.value.reduce((sum, item) => sum + (item.loaned_quantity || 0), 0)
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
    category_id?: string,
    search?: string,
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder',
    page?: number,
    limit?: number,
    sort_by?: string,
    sort_order?: 'asc' | 'desc',
    include_tools?: 'true' | 'false' // Add parameter to include tools when needed
  }) => {
    // console.clear()
    // console.log('Fetching inventory...')
    try {
      isLoading.value = true
      error.value = null

      // Update filters - handle clearing category_id when not provided or set to undefined
      if (params) {
        const updatedFilters = { ...inventoryFilters.value, ...params }
        
        // If category_id was explicitly passed as undefined/empty, remove it from filters
        if ('category_id' in params && (params.category_id === undefined || params.category_id === '' || params.category_id === null)) {
          const { category_id, ...restFilters } = updatedFilters
          inventoryFilters.value = restFilters
          // console.log('🧹 [Store] Removed category_id from filters, new filters:', inventoryFilters.value)
        } else {
          inventoryFilters.value = updatedFilters
          // console.log('🔄 [Store] Updated filters with category_id:', params.category_id || 'no change')
        }
      }

      // Build API parameters and remove empty category_id if present
      let apiParams = {
        ...inventoryFilters.value,
        page: params?.page || pagination.value.current_page,
        limit: params?.limit || pagination.value.items_per_page,
        include_tools: params?.include_tools // Pass through include_tools parameter
      }
      
      // Remove empty category_id to avoid sending it to backend
      if (apiParams.category_id === '' || apiParams.category_id === null || apiParams.category_id === undefined) {
        const { category_id, ...restParams } = apiParams
        apiParams = restParams
      }
      
      console.log('📊 [Store] Final API params being sent:', apiParams)
      const response = await inventoryApi.getInventory(apiParams)

      // Store inventory data as-is from backend (clean architecture)
      inventory.value = response.inventory
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
    createItem
  }
})
