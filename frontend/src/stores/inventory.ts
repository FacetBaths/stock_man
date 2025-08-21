import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Item, InventoryStats, CreateItemRequest, UpdateItemRequest } from '@/types'
import { inventoryApi } from '@/utils/api'

export const useInventoryStore = defineStore('inventory', () => {
  const items = ref<Item[]>([])
  const stats = ref<InventoryStats | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const isUsing = ref(false)
  const error = ref<string | null>(null)
  
  const totalItems = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(1)
  
  // Current filters
  const currentProductType = ref<string>('all')
  const currentSearch = ref<string>('')
  const showInStockOnly = ref(false)

  const itemsByType = computed(() => {
    const grouped: Record<string, Item[]> = {}
    items.value.forEach(item => {
      if (!grouped[item.product_type]) {
        grouped[item.product_type] = []
      }
      grouped[item.product_type].push(item)
    })
    return grouped
  })

  const filteredItems = computed(() => {
    if (currentProductType.value === 'all') {
      return items.value
    }
    return items.value.filter(item => item.product_type === currentProductType.value)
  })

  const loadItems = async (params?: {
    product_type?: string
    search?: string
    page?: number
    in_stock_only?: boolean
  }) => {
    try {
      isLoading.value = true
      error.value = null
      
      // Update current filters
      if (params?.product_type !== undefined) currentProductType.value = params.product_type
      if (params?.search !== undefined) currentSearch.value = params.search
      if (params?.in_stock_only !== undefined) showInStockOnly.value = params.in_stock_only
      if (params?.page !== undefined) currentPage.value = params.page

      const response = await inventoryApi.getItems({
        product_type: currentProductType.value !== 'all' ? currentProductType.value : undefined,
        search: currentSearch.value || undefined,
        page: currentPage.value,
        in_stock_only: showInStockOnly.value
      })
      
      items.value = response.items
      totalItems.value = response.totalItems
      totalPages.value = response.totalPages
      currentPage.value = response.currentPage
      
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to load inventory'
      console.error('Load items error:', err)
    } finally {
      isLoading.value = false
    }
  }

  const loadStats = async () => {
    try {
      const response = await inventoryApi.getStats()
      stats.value = response
    } catch (err: any) {
      console.error('Load stats error:', err)
    }
  }

  const createItem = async (itemData: CreateItemRequest) => {
    try {
      isCreating.value = true
      error.value = null
      
      const response = await inventoryApi.createItem(itemData)
      
      // Reload items to get updated list
      await loadItems()
      await loadStats()
      
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
      
      const response = await inventoryApi.updateItem(id, updates)
      
      // Update the item in the local state
      const index = items.value.findIndex(item => item._id === id)
      if (index !== -1) {
        items.value[index] = response.item
      }
      
      await loadStats()
      
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
      
      await inventoryApi.deleteItem(id)
      
      // Remove the item from local state
      items.value = items.value.filter(item => item._id !== id)
      totalItems.value = Math.max(0, totalItems.value - 1)
      
      await loadStats()
      
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete item'
      throw err
    } finally {
      isDeleting.value = false
    }
  }

  const useItem = async (id: string, usageData: {
    quantity_used: number
    used_for: string
    location?: string
    project_name?: string
    customer_name?: string
    notes?: string
  }) => {
    try {
      isUsing.value = true
      error.value = null
      
      const response = await inventoryApi.useItem(id, usageData)
      
      // Update the item in the local state with new quantity
      const index = items.value.findIndex(item => item._id === id)
      if (index !== -1) {
        items.value[index] = response.item
      }
      
      await loadStats()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to use item'
      throw err
    } finally {
      isUsing.value = false
    }
  }

  const getUsageHistory = async (id: string) => {
    try {
      const response = await inventoryApi.getUsageHistory(id)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to get usage history'
      throw err
    }
  }

  const clearError = () => {
    error.value = null
  }

  const setFilters = (filters: {
    product_type?: string
    search?: string
    in_stock_only?: boolean
  }) => {
    if (filters.product_type !== undefined) currentProductType.value = filters.product_type
    if (filters.search !== undefined) currentSearch.value = filters.search
    if (filters.in_stock_only !== undefined) showInStockOnly.value = filters.in_stock_only
    currentPage.value = 1 // Reset to first page when filters change
  }

  return {
    items,
    stats,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isUsing,
    error,
    totalItems,
    totalPages,
    currentPage,
    currentProductType,
    currentSearch,
    showInStockOnly,
    itemsByType,
    filteredItems,
    loadItems,
    loadStats,
    createItem,
    updateItem,
    deleteItem,
    useItem,
    getUsageHistory,
    clearError,
    setFilters
  }
})
