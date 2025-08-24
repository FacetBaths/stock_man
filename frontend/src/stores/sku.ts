import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  SKU, 
  CreateSKURequest, 
  UpdateSKURequest, 
  AddCostRequest,
  StockStatus
} from '@/types'
import { skuApi } from '@/utils/api'

export const useSKUStore = defineStore('sku', () => {
  // State
  const skus = ref<SKU[]>([])
  const currentSKU = ref<SKU | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    currentPage: 1,
    totalPages: 0,
    totalSkus: 0,
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false
  })

  // Filters for new architecture
  const filters = ref({
    category_id: '',
    status: '' as 'active' | 'discontinued' | 'pending' | '',
    is_lendable: undefined as boolean | undefined,
    search: '',
    sort_by: 'sku_code' as 'sku_code' | 'name' | 'unit_cost' | 'created_at',
    sort_order: 'asc' as 'asc' | 'desc',
    include_inventory: true
  })

  // Computed properties for new architecture
  const activeSKUs = computed(() => 
    skus.value.filter(sku => sku.is_active && sku.status === 'active')
  )
  
  const inactiveSKUs = computed(() => 
    skus.value.filter(sku => !sku.is_active || sku.status === 'pending')
  )
  
  const discontinuedSKUs = computed(() => 
    skus.value.filter(sku => sku.status === 'discontinued')
  )
  
  const lendableSKUs = computed(() => 
    skus.value.filter(sku => sku.is_lendable)
  )
  
  const bundleSKUs = computed(() => 
    skus.value.filter(sku => sku.is_bundle)
  )

  const skusByCategory = computed(() => {
    const result: Record<string, SKU[]> = {}
    skus.value.forEach(sku => {
      const categoryId = typeof sku.category_id === 'string' 
        ? sku.category_id 
        : sku.category_id?._id || 'uncategorized'
      
      if (!result[categoryId]) {
        result[categoryId] = []
      }
      result[categoryId].push(sku)
    })
    return result
  })

  const skusByStockStatus = computed(() => {
    const result = {
      low_stock: [] as SKU[],
      adequate: [] as SKU[],
      out_of_stock: [] as SKU[],
      needs_reorder: [] as SKU[]
    }
    
    skus.value.forEach(sku => {
      const inventory = sku.inventory
      if (inventory) {
        if (inventory.is_out_of_stock) result.out_of_stock.push(sku)
        else if (inventory.is_low_stock) result.low_stock.push(sku)
        else if (inventory.needs_reorder) result.needs_reorder.push(sku)
        else result.adequate.push(sku)
      }
    })
    
    return result
  })

  const skuStats = computed(() => {
    const total = skus.value.length
    const active = activeSKUs.value.length
    const lendable = lendableSKUs.value.length
    const bundles = bundleSKUs.value.length
    const withBarcodes = skus.value.filter(sku => sku.barcode).length
    const totalValue = skus.value.reduce((sum, sku) => {
      const inventory = sku.inventory
      return sum + (inventory ? inventory.total_value || 0 : 0)
    }, 0)
    const totalQuantity = skus.value.reduce((sum, sku) => {
      const inventory = sku.inventory
      return sum + (inventory ? inventory.total_quantity || 0 : 0)
    }, 0)

    return {
      total,
      active,
      lendable,
      bundles,
      withBarcodes,
      totalQuantity,
      totalValue,
      lowStock: skusByStockStatus.value.low_stock.length,
      outOfStock: skusByStockStatus.value.out_of_stock.length,
      needsReorder: skusByStockStatus.value.needs_reorder.length
    }
  })

  // Actions for new architecture
  const fetchSKUs = async (params?: {
    category_id?: string
    status?: 'active' | 'discontinued' | 'pending'
    is_lendable?: boolean
    search?: string
    sort_by?: 'sku_code' | 'name' | 'unit_cost' | 'created_at'
    sort_order?: 'asc' | 'desc'
    include_inventory?: boolean
    page?: number
    limit?: number
  }) => {
    try {
      isLoading.value = true
      error.value = null

      // Merge with current filters
      const mergedParams = {
        ...filters.value,
        ...params
      }

      // Filter out empty strings and undefined values, convert booleans to strings
      const requestParams: any = {}
      Object.entries(mergedParams).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          // Convert boolean values to strings for backend compatibility
          if (typeof value === 'boolean') {
            requestParams[key] = value.toString()
          } else {
            requestParams[key] = value
          }
        }
      })

      const response = await skuApi.getSKUs(requestParams)
      
      console.log('SKU API Response:', response)
      console.log('Response type:', typeof response)
      console.log('Response keys:', Object.keys(response || {}))

      // Handle both direct response and nested data response structures
      if (response && response.skus) {
        skus.value = response.skus
        pagination.value = {
          currentPage: response.pagination?.currentPage || 1,
          totalPages: response.pagination?.totalPages || 0,
          totalSkus: response.pagination?.totalSkus || 0,
          limit: response.pagination?.limit || 50,
          hasNextPage: response.pagination?.hasNextPage || false,
          hasPrevPage: response.pagination?.hasPrevPage || false
        }
      } else if (Array.isArray(response)) {
        // Handle case where response is directly an array of SKUs
        skus.value = response
        pagination.value = {
          currentPage: 1,
          totalPages: 1,
          totalSkus: response.length,
          limit: 50,
          hasNextPage: false,
          hasPrevPage: false
        }
      } else {
        console.error('Unexpected response structure:', response)
        throw new Error('Invalid response structure from SKU API')
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch SKUs'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchSKU = async (id: string, params?: {
    include_inventory?: boolean
    include_items?: boolean
  }) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await skuApi.getSKU(id, params)
      currentSKU.value = response.sku

      // Update in list if exists
      const index = skus.value.findIndex(s => s._id === id)
      if (index !== -1) {
        skus.value[index] = response.sku
      }

      return response.sku
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch SKU'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const createSKU = async (skuData: CreateSKURequest) => {
    try {
      isCreating.value = true
      error.value = null

      const response = await skuApi.createSKU(skuData)
      
      // Add to local list
      skus.value.unshift(response.sku)
      pagination.value.totalSkus += 1

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create SKU'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  const updateSKU = async (id: string, updates: UpdateSKURequest) => {
    try {
      isUpdating.value = true
      error.value = null

      const response = await skuApi.updateSKU(id, updates)
      
      // Update in list
      const index = skus.value.findIndex(s => s._id === id)
      if (index !== -1) {
        skus.value[index] = response.sku
      }

      // Update current SKU if it's the same
      if (currentSKU.value?._id === id) {
        currentSKU.value = response.sku
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update SKU'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const deleteSKU = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null

      await skuApi.deleteSKU(id)
      
      // Remove from list
      const index = skus.value.findIndex(s => s._id === id)
      if (index !== -1) {
        skus.value.splice(index, 1)
        pagination.value.totalSkus -= 1
      }

      // Clear current SKU if it was deleted
      if (currentSKU.value?._id === id) {
        currentSKU.value = null
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete SKU'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const generateSKUCode = async (data: {
    product_type: string
    product_details: string
    template?: string
  }) => {
    try {
      const response = await skuApi.generateSKUCode(data)
      return response.sku_code
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to generate SKU code'
      throw err
    }
  }

  const addCost = async (id: string, costData: AddCostRequest) => {
    try {
      isLoading.value = true
      error.value = null

      const updatedSKU = await skuApi.addCost(id, costData)
      
      // Update in list
      const index = skus.value.findIndex(s => s._id === id)
      if (index !== -1) {
        skus.value[index] = updatedSKU
      }

      // Update current SKU if it's the same
      if (currentSKU.value?._id === id) {
        currentSKU.value = updatedSKU
      }

      return updatedSKU
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to add cost'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const searchByBarcode = async (barcode: string) => {
    try {
      error.value = null
      const sku = await skuApi.searchByBarcode(barcode)
      return sku
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null // Barcode not found
      }
      error.value = err.response?.data?.message || 'Failed to search by barcode'
      throw err
    }
  }

  const findSKUByBarcode = async (barcode: string) => {
    // Alias for searchByBarcode for consistency
    return await searchByBarcode(barcode)
  }

  const getSKUByCode = (skuCode: string) => {
    return skus.value.find(sku => sku.sku_code === skuCode)
  }

  const getSKUsByProduct = (productType: string) => {
    return skus.value.filter(sku => sku.product_type === productType)
  }

  const getSKUsByStatus = (status: string) => {
    return skus.value.filter(sku => sku.status === status)
  }

  const updateFilters = (newFilters: Partial<typeof filters.value>) => {
    filters.value = { ...filters.value, ...newFilters }
    fetchSKUs({ page: 1 }) // Reset to first page when filters change
  }

  // New API method: Lookup SKU by code
  const lookupSKU = async (skuCode: string) => {
    try {
      error.value = null
      const response = await skuApi.lookupSKU(skuCode)
      return response.sku
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null // SKU not found
      }
      error.value = err.response?.data?.message || 'Failed to lookup SKU'
      throw err
    }
  }

  // Helper methods
  const getSKUsByCategory = (categoryId: string) => {
    return skus.value.filter(sku => {
      const skuCategoryId = typeof sku.category_id === 'string' 
        ? sku.category_id 
        : sku.category_id?._id
      return skuCategoryId === categoryId
    })
  }

  const searchSKUs = (query: string) => {
    if (!query.trim()) return skus.value

    const searchTerm = query.toLowerCase()
    return skus.value.filter(sku => 
      sku.sku_code.toLowerCase().includes(searchTerm) ||
      sku.name.toLowerCase().includes(searchTerm) ||
      sku.description?.toLowerCase().includes(searchTerm) ||
      sku.barcode?.toLowerCase().includes(searchTerm)
    )
  }

  const clearFilters = () => {
    filters.value = {
      category_id: '',
      status: '',
      is_lendable: undefined,
      search: '',
      sort_by: 'sku_code',
      sort_order: 'asc',
      include_inventory: true
    }
    fetchSKUs({ page: 1 })
  }

  const clearError = () => {
    error.value = null
  }

  const setCurrentSKU = (sku: SKU | null) => {
    currentSKU.value = sku
  }

  return {
    // State
    skus,
    currentSKU,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    pagination,
    filters,

    // Computed
    activeSKUs,
    inactiveSKUs,
    discontinuedSKUs,
    lendableSKUs,
    bundleSKUs,
    skusByCategory,
    skusByStockStatus,
    skuStats,

    // Actions
    fetchSKUs,
    fetchSKU,
    createSKU,
    updateSKU,
    deleteSKU,
    generateSKUCode,
    addCost,
    lookupSKU,
    searchByBarcode,
    findSKUByBarcode,
    getSKUByCode,
    getSKUsByCategory,
    getSKUsByProduct,
    getSKUsByStatus,
    searchSKUs,
    updateFilters,
    clearFilters,
    clearError,
    setCurrentSKU
  }
})
