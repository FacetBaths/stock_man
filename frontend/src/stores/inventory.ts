import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Item, 
  InventoryStats, 
  CreateItemRequest, 
  UpdateItemRequest,
  UseItemsRequest,
  Inventory
} from '@/types'
import { inventoryApi, itemsApi } from '@/utils/api'

export const useInventoryStore = defineStore('inventory', () => {
  // New architecture: Aggregated inventory data
  const inventory = ref<any[]>([])
  const stats = ref<InventoryStats | null>(null)
  const currentSKUInventory = ref<any | null>(null)
  
  // Individual items for the new Items API
  const items = ref<Item[]>([])
  const currentItem = ref<Item | null>(null)
  
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
  
  // Current filters for items
  const itemFilters = ref({
    sku_id: '',
    condition: '',
    location: '',
    search: ''
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

  // Computed properties for items
  const itemsByCondition = computed(() => {
    const result: Record<string, Item[]> = {}
    items.value.forEach(item => {
      if (!result[item.condition]) {
        result[item.condition] = []
      }
      result[item.condition].push(item)
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

  // Actions for items management
  const fetchItems = async (params?: {
    sku_id?: string
    condition?: string
    location?: string
    search?: string
    page?: number
    limit?: number
  }) => {
    try {
      isLoading.value = true
      error.value = null
      
      // Update filters
      if (params) {
        itemFilters.value = { ...itemFilters.value, ...params }
      }

      const response = await itemsApi.getItems(itemFilters.value)
      items.value = response.items
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch items'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchItem = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await itemsApi.getItem(id)
      currentItem.value = response.item
      
      return response.item
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch item'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const createItem = async (itemData: CreateItemRequest) => {
    try {
      isCreating.value = true
      error.value = null
      
      const response = await itemsApi.createItem(itemData)
      
      // Add to local items list
      items.value.unshift(response.item)
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create item'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  const updateItem = async (id: string, updates: UpdateItemRequest) => {
    try {
      isUpdating.value = true
      error.value = null
      
      const response = await itemsApi.updateItem(id, updates)
      
      // Update in local state
      const index = items.value.findIndex(item => item._id === id)
      if (index !== -1) {
        items.value[index] = response.item
      }
      
      // Update current item if it's the same
      if (currentItem.value?._id === id) {
        currentItem.value = response.item
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update item'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const deleteItem = async (id: string) => {
    try {
      isDeleting.value = true
      error.value = null
      
      await itemsApi.deleteItem(id)
      
      // Remove from local state
      items.value = items.value.filter(item => item._id !== id)
      
      // Clear current item if it was deleted
      if (currentItem.value?._id === id) {
        currentItem.value = null
      }
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete item'
      throw err
    } finally {
      isDeleting.value = false
    }
  }

  const useItems = async (id: string, usageData: UseItemsRequest) => {
    try {
      isUpdating.value = true
      error.value = null
      
      const response = await itemsApi.useItems(id, usageData)
      
      // Update in local state
      const index = items.value.findIndex(item => item._id === id)
      if (index !== -1) {
        items.value[index] = response.item
      }
      
      // Refresh inventory data
      await fetchInventory()
      await fetchStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to use items'
      throw err
    } finally {
      isUpdating.value = false
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

  const updateItemFilters = (newFilters: Partial<typeof itemFilters.value>) => {
    itemFilters.value = { ...itemFilters.value, ...newFilters }
    fetchItems({ page: 1 })
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

  const clearItemFilters = () => {
    itemFilters.value = {
      sku_id: '',
      condition: '',
      location: '',
      search: ''
    }
    fetchItems({ page: 1 })
  }

  return {
    // State - Inventory
    inventory,
    currentSKUInventory,
    inventoryFilters,
    
    // State - Items  
    items,
    currentItem,
    itemFilters,
    
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
    itemsByCondition,
    
    // Actions - Inventory
    fetchInventory,
    fetchStats,
    fetchSKUInventory,
    updateInventorySettings,
    receiveStock,
    moveStock,
    removeStock,
    
    // Actions - Items
    fetchItems,
    fetchItem,
    createItem,
    updateItem,
    deleteItem,
    useItems,
    
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
    updateItemFilters,
    clearInventoryFilters,
    clearItemFilters
  }
})
