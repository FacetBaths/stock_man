<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { formatCurrency } from '@/utils/currency'
import { getProductTypeColor, getCategoryColorFromData } from '@/utils/colors'
import type { Inventory } from '@/types'
import { TAG_TYPES } from '@/types'
import StockStatusChip from '@/components/StockStatusChip.vue'

interface Props {
  canWrite: boolean
  items?: Inventory[]
  filters?: {
    category_id?: string
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder'
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }
  // Pagination props
  pagination?: {
    total_items: number
    total_pages: number
    current_page: number
    items_per_page: number
  }
  loading?: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

// Smart mounting - only fetch if needed and no infinite loop risk
onMounted(() => {
  console.log('InventoryTable: Component mounted with filters:', props.filters)
  // Let the Dashboard handle initial loading via setTimeout to prevent loops
  // This component now only responds to explicit refreshInventory() calls
})

// Use provided items or fallback to store inventory
const items = computed(() => props.items || inventoryStore.inventory)

const emit = defineEmits<{
  edit: [item: Inventory]
  delete: [item: Inventory]
  'page-change': [page: number]
  'page-size-change': [size: number]
}>()

// Expose a method to refresh data when filters change
const refreshInventory = async (filters?: any) => {
  const filtersToUse = filters || props.filters
  console.log('🔄 [InventoryTable] ====== REFRESH INVENTORY CALLED ======', filtersToUse)
  console.log('🔄 [InventoryTable] Current inventory count before fetch:', inventoryStore.inventory.length)
  console.log('🔄 [InventoryTable] Current pagination before fetch:', inventoryStore.pagination)
  console.log('🔄 [InventoryTable] Store loading state:', inventoryStore.isLoading)
  console.log('🔄 [InventoryTable] Filters to use:', filtersToUse)
  try {
    const result = await inventoryStore.fetchInventory(filtersToUse)
    console.log('✅ [InventoryTable] Fetch completed. New inventory count:', inventoryStore.inventory.length)
    console.log('✅ [InventoryTable] New pagination after fetch:', inventoryStore.pagination)
    console.log('✅ [InventoryTable] Fetch result pagination:', result?.pagination)
  } catch (error) {
    console.error('❌ [InventoryTable] Failed to refresh inventory:', error)
    console.error('❌ [InventoryTable] Error details:', error.response?.data || error.message)
  }
}

// Expose the refresh method to parent components
defineExpose({ refreshInventory })

// Dialog state for tag details
const showTagDialog = ref(false)
const selectedItem = ref<Inventory | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)
const pageSizeOptions = [25, 50, 100, 200]

// Watch for changes to pagination prop to sync local state
watch(() => props.pagination?.current_page, (newPage) => {
  if (newPage && newPage !== currentPage.value) {
    currentPage.value = newPage
  }
}, { immediate: true })

watch(() => props.pagination?.items_per_page, (newSize) => {
  if (newSize && newSize !== pageSize.value) {
    pageSize.value = newSize
  }
}, { immediate: true })

// Legacy function - no longer used with new inventory structure
// Keeping for compatibility but not called anywhere
const formatProductDetails = (item: any) => {
  // This function is kept for legacy compatibility but shouldn't be used
  // with the new inventory structure
  return {
    primary: 'Legacy Item',
    secondary: 'Legacy Description'
  }
}

const getStockStatus = (quantity: number) => {
  if (quantity === 0) return { class: 'out-of-stock', text: 'Out of Stock', color: 'negative' }
  if (quantity <= 5) return { class: 'low-stock', text: 'Low Stock', color: 'warning' }
  return { class: 'in-stock', text: 'In Stock', color: 'positive' }
}

// Helper function to get category color from inventory item
const getCategoryColor = (item: any) => {
  // Try to use the category data if available (preferred)
  if (item.category) {
    return getCategoryColorFromData(item.category)
  }
  
  // Fallback to product type color for legacy support
  const productType = getProductType(item)
  return getProductTypeColor(productType)
}

// Helper to get contrast color for text on colored backgrounds
const getContrastColor = (hexcolor: string): string => {
  if (!hexcolor) return 'white'
  
  // Remove # if present
  const color = hexcolor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(color.slice(0, 2), 16)
  const g = parseInt(color.slice(2, 4), 16)
  const b = parseInt(color.slice(4, 6), 16)
  
  // Calculate relative luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? 'black' : 'white'
}

// Legacy helper function to get type colors using new color utility
const getTypeColor = (productType: string) => {
  return getProductTypeColor(productType)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const formatCost = (cost?: number) => {
  if (cost === undefined || cost === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cost)
}

const formatTotalInvested = (item: any) => {
  const cost = getCost(item)
  const quantity = getQuantity(item)
  if (!cost || cost === null) return '-'
  // Calculate total value using current unit cost (not historical acquisition cost)
  // This shows the current value of inventory based on latest SKU cost
  const total = cost * quantity
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(total)
}

const canViewCost = computed(() => authStore.hasPermission('view_cost') || authStore.hasRole(['admin', 'warehouse_manager']))

// Helper function to get tag status badges
const getTagStatusBadges = (item: any) => {
  const tagSummary = item.tag_summary || item.tagSummary
  if (!tagSummary) return []

  const badges = []
  if (tagSummary.reserved > 0) {
    badges.push({
      type: 'reserved',
      quantity: tagSummary.reserved,
      label: 'Reserved',
      color: '#007bff'
    })
  }
  if (tagSummary.broken > 0) {
    badges.push({
      type: 'broken',
      quantity: tagSummary.broken,
      label: 'Broken',
      color: '#dc3545'
    })
  }
  if (tagSummary.imperfect > 0) {
    badges.push({
      type: 'imperfect',
      quantity: tagSummary.imperfect,
      label: 'Imperfect',
      color: '#fd7e14'
    })
  }
  return badges
}

// Calculate available quantity (total - tagged)
const getAvailableQuantity = (item: any) => {
  // For new inventory structure, use available_quantity directly
  if (item.available_quantity !== undefined) {
    return item.available_quantity
  }
  // Fallback for legacy structure
  if (!item.tagSummary) return item.quantity || 0
  return (item.quantity || 0) - (item.tagSummary.totalTagged || 0)
}

// Check if item has any quality issues
const hasQualityIssues = (item: any) => {
  if (!item.tag_summary) return false
  return item.tag_summary.broken > 0 || item.tag_summary.imperfect > 0
}

// Get primary tag status for an item (focuses on availability for tagging/reservation)
const getPrimaryTagStatus = (item: any) => {
  // Get the total quantity - handle both new and legacy structures
  const totalQty = getQuantity(item)

  // First check if item is actually out of stock
  if (totalQty === 0) {
    return { text: 'None Available', color: 'negative', clickable: false }
  }

  // Check if we have tag data - use tag_summary from API response
  const tagSummary = item.tag_summary
  if (!tagSummary || tagSummary.totalTagged === 0) {
    return { text: 'Available', color: 'positive', clickable: false }
  }

  // Calculate available quantity
  const availableQty = getAvailableQuantity(item)

  if (availableQty === 0) {
    // All items are tagged - no "Partially" prefix
    if (tagSummary.broken > 0) {
      return { text: 'Broken', color: 'negative', clickable: true }
    }
    if (tagSummary.imperfect > 0) {
      return { text: 'Imperfect', color: 'warning', clickable: true }
    }
    if (tagSummary.reserved > 0) {
      return { text: 'Reserved', color: 'info', clickable: true }
    }
    if (tagSummary.loaned > 0) {
      return { text: 'Loaned', color: 'purple', clickable: true }
    }
  } else {
    // Some items available, some tagged - show "Partially"
    if (tagSummary.broken > 0) {
      return { text: 'Partially Broken', color: 'negative', clickable: true }
    }
    if (tagSummary.imperfect > 0) {
      return { text: 'Partially Imperfect', color: 'warning', clickable: true }
    }
    if (tagSummary.reserved > 0) {
      return { text: 'Partially Reserved', color: 'info', clickable: true }
    }
    if (tagSummary.loaned > 0) {
      return { text: 'Partially Loaned', color: 'purple', clickable: true }
    }
  }

// Default fallback - some items available
  return { text: 'Available', color: 'positive', clickable: false }
}

// Helper function to get product type from the inventory data structure
const getProductType = (item: any) => {
  // First, try to use the category data that's actually provided by the backend
  // The backend DOES populate category information via the aggregation pipeline
  if (item.category && item.category.name) {
    const categoryName = item.category.name.toLowerCase()
    // Map category names to product types for styling consistency
    const categoryToTypeMap: { [key: string]: string } = {
      'walls': 'wall',
      'accessories': 'accessory',
      'toilets': 'toilet',
      'bases': 'base',
      'tubs': 'tub',
      'vanities': 'vanity',
      'shower doors': 'shower_door',
      'raw materials': 'raw_material',
      'miscellaneous': 'miscellaneous',
      'tools': 'accessory'
    }
    const mappedType = categoryToTypeMap[categoryName] || categoryName.replace(/s$/, '') // remove plural 's'
    if (mappedType !== categoryName) return mappedType
  }

  // Fallback to SKU code analysis if category isn't available or mapped
  if (item.sku && item.sku.sku_code) {
    const skuCode = item.sku.sku_code.toLowerCase()
    // Extract product type from SKU code patterns
    if (skuCode.includes('toilet')) return 'toilet'
    if (skuCode.includes('wall')) return 'wall'
    if (skuCode.includes('base')) return 'base'
    if (skuCode.includes('tub')) return 'tub'
    if (skuCode.includes('vanity')) return 'vanity'
    if (skuCode.includes('shower')) return 'shower_door'
    if (skuCode.includes('door')) return 'shower_door'
    if (skuCode.includes('access')) return 'accessory'
    if (skuCode.includes('raw')) return 'raw_material'
    if (skuCode.includes('material')) return 'raw_material'
  }

  // Check description if available
  if (item.sku && item.sku.description) {
    const desc = item.sku.description.toLowerCase()
    if (desc.includes('toilet')) return 'toilet'
    if (desc.includes('wall')) return 'wall'
    if (desc.includes('base')) return 'base'
    if (desc.includes('tub')) return 'tub'
    if (desc.includes('vanity')) return 'vanity'
    if (desc.includes('shower')) return 'shower_door'
    if (desc.includes('door')) return 'shower_door'
    if (desc.includes('access')) return 'accessory'
    if (desc.includes('raw')) return 'raw_material'
    if (desc.includes('material')) return 'raw_material'
  }

  // Handle legacy item structure
  if (item.product_type) {
    return item.product_type
  }

  // Fallback
  return 'miscellaneous'
}

// Helper to get SKU code from either structure
const getSKUCode = (item: any) => {
  if (item.sku && item.sku.sku_code) {
    return item.sku.sku_code
  }
  if (item.sku_code) {
    return item.sku_code
  }
  return null
}

// Helper to get barcode from either structure
const getBarcode = (item: any) => {
  if (item.sku && item.sku.barcode) {
    return item.sku.barcode
  }
  if (item.barcode) {
    return item.barcode
  }
  return null
}

// Helper to format product details for new inventory API structure
const formatProductDetailsNew = (item: any) => {
  if (item.sku) {
    // The backend actually provides full SKU data including name, description, and brand
    const productName = item.sku.name || item.sku.description || 'Unknown Product'
    const brandPrefix = item.sku.brand ? `${item.sku.brand} ` : ''
    const modelSuffix = item.sku.model ? ` ${item.sku.model}` : ''

    return {
      primary: `${brandPrefix}${productName}${modelSuffix}`,
      secondary: item.sku.sku_code || ''
    }
  }
  return {
    primary: 'Unknown Product',
    secondary: ''
  }
}

// Helper to get quantity from new structure
const getQuantity = (item: any) => {
  // New inventory structure uses total_quantity
  if (item.total_quantity !== undefined) {
    return item.total_quantity
  }
  // Legacy structure uses quantity
  if (item.quantity !== undefined) {
    return item.quantity
  }
  return 0
}

// Helper to get available quantity from new structure
const getAvailableQuantityNew = (item: any) => {
  if (item.available_quantity !== undefined) {
    return item.available_quantity
  }
  return getQuantity(item)
}

// Helper to get cost from inventory API response structure
const getCost = (item: any) => {
  // The inventory response has:
  // - unit_cost in the nested sku object (current SKU cost from SKU model)
  // - average_cost at the inventory level (historical acquisition cost average)
  // Prioritize unit_cost for current cost display as it represents the current/latest cost
  if (item.sku && item.sku.unit_cost !== undefined && item.sku.unit_cost !== null) {
    return item.sku.unit_cost
  }
  // Fallback to average_cost from historical acquisition costs if unit_cost not available
  if (item.average_cost !== undefined && item.average_cost !== null) {
    return item.average_cost
  }
  return 0
}

// Helper to get total value from new inventory structure
const getTotalValue = (item: any) => {
  if (item.total_value !== undefined) {
    return item.total_value
  }
  return getCost(item) * getQuantity(item)
}

// Helper to get stock status for new inventory structure
const getStockStatusNew = (item: any) => {
  if (item.is_out_of_stock) {
    return { class: 'out-of-stock', text: 'Out of Stock', color: 'negative' }
  }
  if (item.is_low_stock) {
    return { class: 'low-stock', text: 'Low Stock', color: 'warning' }
  }
  if (item.is_overstock) {
    return { class: 'overstock', text: 'Overstock', color: 'orange' }
  }
  if (item.needs_reorder) {
    return { class: 'needs-reorder', text: 'Reorder', color: 'info' }
  }
  const availableQty = getAvailableQuantityNew(item)
  if (availableQty === 0) {
    return { class: 'out-of-stock', text: 'Out of Stock', color: 'negative' }
  }
  if (availableQty <= 5) {
    return { class: 'low-stock', text: 'Low Stock', color: 'warning' }
  }
  return { class: 'in-stock', text: 'In Stock', color: 'positive' }
}

// Helper to convert inventory stock status to StockStatusChip compatible format
const getStockStatusForChip = (item: any): StockStatus => {
  // Get stock thresholds from SKU if available
  const thresholds = item.sku?.stock_thresholds || { understocked: 5, overstocked: 100 }
  const availableQty = getAvailableQuantityNew(item)
  const totalQty = getQuantity(item)

  // Check for out of stock first (zero quantity)
  if (item.is_out_of_stock || availableQty === 0 || totalQty === 0) {
    return 'out'
  }

  // Check for overstock (if available)
  if (item.is_overstock || (thresholds.overstocked && totalQty >= thresholds.overstocked)) {
    return 'overstocked'
  }

  // Check for understocked (low stock but not out)
  if (item.is_low_stock || (thresholds.understocked && availableQty <= thresholds.understocked)) {
    return 'understocked'
  }

  // Default to adequate stock
  return 'adequate'
}

// Handle tag status click
const handleTagStatusClick = (item: Inventory) => {
  const status = getPrimaryTagStatus(item)
  if (status.clickable) {
    selectedItem.value = item
    showTagDialog.value = true
  }
}

// Debug pagination data
watch(() => props.pagination, (newPagination) => {
  console.log('🔍 [InventoryTable] Pagination prop changed:', newPagination)
  console.log('🔍 [InventoryTable] - Total items:', newPagination?.total_items)
  console.log('🔍 [InventoryTable] - Total pages:', newPagination?.total_pages)
  console.log('🔍 [InventoryTable] - Current page:', newPagination?.current_page)
  console.log('🔍 [InventoryTable] - Items per page:', newPagination?.items_per_page)
}, { deep: true, immediate: true })

// Local loading state to control skeleton display with minimum duration
const isLocalLoading = ref(false)
const minLoadingDuration = 300 // Minimum 300ms to show skeleton, prevents flash

// Pagination handlers
const handlePageChange = (page: number) => {
  console.log('📄 [InventoryTable] Page change requested:', page)
  
  // Always refresh when pagination is clicked, regardless of current state
  currentPage.value = page
  emit('page-change', page)
  
  // Show loading with minimum duration
  isLocalLoading.value = true
  const startTime = Date.now()
  
  // Actually refresh the data with the new page
  const filters = {
    ...props.filters,
    page: page
  }
  
  refreshInventory(filters).finally(() => {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, minLoadingDuration - elapsed)
    
    setTimeout(() => {
      isLocalLoading.value = false
    }, remaining)
  })
}

const handlePageSizeChange = (size: number) => {
  console.log('📄 [InventoryTable] Page size change requested:', size)
  
  // Always refresh when page size is changed, regardless of current state
  pageSize.value = size
  currentPage.value = 1 // Reset to first page when changing page size
  emit('page-size-change', size)
  emit('page-change', 1)
  
  // Show loading with minimum duration
  isLocalLoading.value = true
  const startTime = Date.now()
  
  // Actually refresh the data with the new page size
  const filters = {
    ...props.filters,
    page: 1,
    limit: size
  }
  console.log('📄 [InventoryTable] Refreshing with new page size filters:', filters)
  
  refreshInventory(filters).finally(() => {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, minLoadingDuration - elapsed)
    
    setTimeout(() => {
      isLocalLoading.value = false
    }, remaining)
  })
}
</script>

<template>
  <div class="inventory-list-container">
    <q-banner v-if="items.length === 0" class="no-items-banner" rounded>
      <template v-slot:avatar>
        <q-icon name="inventory_2" color="grey-6" />
      </template>
      No items found matching your criteria.
    </q-banner>

    <div v-else>
      <!-- Header Section -->
      <div class="list-header glass-header q-pa-md q-mb-sm">
        <div class="header-row">
          <div class="header-section details-header">
            <q-icon name="inventory" class="q-mr-xs" />
            Product Details
          </div>
          <div class="header-section sku-header">
            <q-icon name="qr_code" class="q-mr-xs" />
            SKU
          </div>
          <div class="header-section quantity-header">
            <q-icon name="tag" class="q-mr-xs" />
            Qty
          </div>
          <div class="header-section tag-header">
            <q-icon name="label" class="q-mr-xs" />
            Tag Status
          </div>
          <div v-if="canViewCost" class="header-section cost-header">
            <q-icon name="attach_money" class="q-mr-xs" />
            Cost
          </div>
          <div class="header-section status-header">
            <q-icon name="info" class="q-mr-xs" />
            Status & Info
          </div>
          <div v-if="canWrite" class="header-section actions-header">
            <q-icon name="settings" class="q-mr-xs" />
            Actions
          </div>
        </div>
      </div>

      <!-- Top Pagination Controls -->
      <div v-if="props.pagination && props.pagination.total_pages > 1" class="pagination-section q-mb-md">
        <q-card flat class="pagination-card">
          <q-card-section class="pagination-content">
            <div class="pagination-info">
              <q-chip 
                color="primary" 
                text-color="white" 
                size="sm"
                icon="inventory"
              >
                {{ props.pagination.total_items }} items total
              </q-chip>
              <div class="text-caption text-grey-6 q-mt-xs">
                Page {{ props.pagination.current_page }} of {{ props.pagination.total_pages }}
              </div>
            </div>
            
            <q-pagination
              v-model="currentPage"
              :max="props.pagination.total_pages"
              :max-pages="7"
              direction-links
              boundary-links
              color="primary"
              :disable="isLocalLoading || props.loading"
              @update:model-value="handlePageChange"
              class="pagination-control"
            />
            
            <div class="page-size-control">
              <q-select
                v-model="pageSize"
                :options="pageSizeOptions"
                label="Per page"
                dense
                outlined
                :disable="isLocalLoading || props.loading"
                @update:model-value="handlePageSizeChange"
                style="min-width: 100px;"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="inventory-list">
        <!-- Quasar Skeleton Loading Cards -->
        <template v-if="isLocalLoading || props.loading">
          <q-card
            v-for="n in (props.pagination?.items_per_page || 10)"
            :key="`skeleton-${n}`"
            class="inventory-item skeleton-card"
            flat
            bordered
          >
            <q-card-section class="item-row">
              <!-- Details Section Skeleton -->
              <div class="item-section details-section">
                <q-skeleton type="rect" width="80px" height="16px" class="q-mb-sm" />
                <q-skeleton type="text" width="180px" />
                <q-skeleton type="text" width="120px" />
              </div>
              
              <!-- SKU Section Skeleton -->
              <div class="item-section sku-section">
                <q-skeleton type="QChip" />
              </div>
              
              <!-- Quantity Section Skeleton -->
              <div class="item-section quantity-section">
                <q-skeleton type="QBadge" />
              </div>
              
              <!-- Tag Section Skeleton -->
              <div class="item-section tag-section">
                <q-skeleton type="QChip" />
              </div>
              
              <!-- Cost Section Skeleton (if visible) -->
              <div v-if="canViewCost" class="item-section cost-section">
                <q-skeleton type="text" width="60px" />
                <q-skeleton type="text" width="80px" />
              </div>
              
              <!-- Status Section Skeleton -->
              <div class="item-section status-section">
                <q-skeleton type="QChip" />
                <q-skeleton type="text" width="40px" />
                <q-skeleton type="text" width="60px" />
              </div>
              
              <!-- Actions Section Skeleton (if visible) -->
              <div v-if="canWrite" class="item-section actions-section">
                <q-skeleton type="QBtn" size="sm" />
                <q-skeleton type="QBtn" size="sm" class="q-ml-sm" />
              </div>
            </q-card-section>
          </q-card>
        </template>
        
        <!-- Actual Inventory Cards -->
        <template v-else>
          <q-card
            v-for="item in items"
            :key="`${item._id}-${item.sku_id}`"
            class="inventory-item"
            :class="`type-${getProductType(item)}`"
            @click="canWrite ? emit('edit', item) : null"
            :style="{ 
              cursor: canWrite ? 'pointer' : 'default',
              borderLeft: `5px solid ${getCategoryColor(item)}`
            }"
            flat
            bordered
          >
          <q-card-section class="item-row">
            <!-- Details Section -->
            <div class="item-section details-section">
              <div
                class="product-type-banner"
                :style="{ 
                  backgroundColor: getCategoryColor(item),
                  color: getContrastColor(getCategoryColor(item))
                }"
              >
                {{ getProductType(item).replace("_", " ").toUpperCase() }}
              </div>
              <div class="item-title">
                {{ formatProductDetailsNew(item).primary }}
              </div>
              <div
                v-if="formatProductDetailsNew(item).secondary"
                class="item-subtitle"
              >
                {{ formatProductDetailsNew(item).secondary }}
              </div>
              <div v-if="item.notes" class="item-notes">
                <q-icon name="note" size="xs" class="q-mr-xs" />{{ item.notes }}
              </div>
            </div>

            <!-- Mobile Metrics Row (only visible on mobile) -->
            <q-card class="mobile-metrics-row" flat>
              <q-card-section class="metrics-container">
                <!-- Cost Metric (if can view cost) -->
                <q-card v-if="canViewCost" class="mobile-cost-metric" flat>
                  <q-card-section class="metric-content">
                    <div
                      class="mobile-metric-value"
                      style="color: rgba(40, 167, 69, 0.9);"
                    >
                      {{ formatCost(getCost(item)) }}
                    </div>
                    <div class="mobile-metric-label">Unit Cost</div>
                    <div
                      class="mobile-metric-label"
                      style="font-size: 0.6rem; margin-top: 2px;"
                    >
                      {{ formatCost(getCost(item) * getQuantity(item)) }} total
                    </div>
                  </q-card-section>
                </q-card>

                <!-- Status Metric -->
                <q-card class="mobile-status-metric" flat>
                  <q-card-section class="metric-content">
                    <StockStatusChip
                      :status="getStockStatusForChip(item)"
                      :quantity="getAvailableQuantityNew(item)"
                      :thresholds="item.sku?.stock_thresholds"
                      style="margin-bottom: 0.25rem;"
                    />
                    <div class="mobile-metric-label">Stock Status</div>
                    <div
                      v-if="item.location"
                      class="mobile-metric-label"
                      style="font-size: 0.6rem; margin-top: 2px;"
                    >
                      📍 {{ item.location }}
                    </div>
                  </q-card-section>
                </q-card>
              </q-card-section>
              <!-- Total Quantity -->
              <q-card-section>
                <q-card
                  class="mobile-quantity-metric"
                  flat
                  v-if="item.tag_summary?.totalTagged == 0"
                >
                  <q-card-section class="metric-content">
                    <div
                      class="mobile-metric-value"
                      :style="{ color: getStockStatusNew(item).color }"
                    >
                      {{ getQuantity(item) }}
                    </div>
                    <div class="mobile-metric-label">Total Qty</div>
                    <div
                      v-if="
                        item.tag_summary && item.tag_summary.totalTagged > 0
                      "
                      class="mobile-metric-label"
                      style="font-size: 0.6rem; margin-top: 2px;"
                    >
                      {{ getAvailableQuantity(item) }} available
                    </div>
                  </q-card-section>
                </q-card>

                <!-- Available Quantity (if different from total) -->
                <q-card
                  v-if="item.tag_summary && item.tag_summary.totalTagged > 0"
                  class="mobile-available-metric tagged"
                  flat
                >
                  <q-card-section
                    class="metric-content"
                    v-if="item.tag_summary && item.tag_summary.totalTagged > 0"
                    flat
                  >
                    <div
                      class="mobile-metric-value"
                      :style="{
                        color:
                          getAvailableQuantity(item) === 0
                            ? '#dc3545'
                            : '#FFFFFF',
                      }"
                    >
                      {{ getAvailableQuantity(item) }}
                    </div>
                    <div class="mobile-metric-label text-white">Available</div>
                    <div
                      class="mobile-metric-label text-white"
                      style="font-size: 0.6rem; margin-top: 2px;"
                    >
                      {{ item.tag_summary.totalTagged }} tagged
                    </div>
                  </q-card-section>
                </q-card>
              </q-card-section>
            </q-card>

            <!-- SKU Section -->
            <div class="item-section sku-section">
              <div v-if="getSKUCode(item)" class="sku-display">
                <q-chip
                  color="purple"
                  text-color="white"
                  size="sm"
                  :label="getSKUCode(item)"
                  class="sku-chip"
                  icon="qr_code"
                >
                  <q-tooltip>SKU Code</q-tooltip>
                </q-chip>
                <div v-if="getBarcode(item)" class="barcode-display">
                  <q-icon name="barcode_reader" size="xs" class="q-mr-xs" />
                  <span class="barcode-text">{{ getBarcode(item) }}</span>
                </div>
              </div>
              <div v-else class="no-sku-display">
                <q-chip
                  color="grey-5"
                  text-color="grey-8"
                  size="sm"
                  label="No SKU"
                  class="no-sku-chip"
                  icon="help_outline"
                >
                  <q-tooltip>No SKU assigned</q-tooltip>
                </q-chip>
              </div>
            </div>

            <!-- Quantity Section -->
            <div class="item-section quantity-section">
              <div class="quantity-display">
                <!-- Total Quantity Badge -->
                <q-badge
                  :color="getStockStatusNew(item).color"
                  :label="getQuantity(item).toString()"
                  class="total-quantity-badge"
                  :title="`Total: ${getQuantity(item)} items`"
                />

                <!-- Reserved/Available Breakdown -->
                <div
                  v-if="item.tag_summary && item.tag_summary.totalTagged > 0"
                  class="quantity-breakdown"
                >
                  <div class="breakdown-text">
                    {{ item.tag_summary.totalTagged }} tagged /
                    {{ getAvailableQuantity(item) }} free
                  </div>
                </div>
            </div>

            <!-- Tag Section -->
              <q-chip
                :color="getPrimaryTagStatus(item).color"
                text-color="white"
                size="sm"
                :label="getPrimaryTagStatus(item).text"
                :class="[
                  'tag-status-chip',
                  { clickable: getPrimaryTagStatus(item).clickable },
                ]"
                :clickable="getPrimaryTagStatus(item).clickable"
                @click="handleTagStatusClick(item)"
              >
                <q-tooltip v-if="getPrimaryTagStatus(item).clickable">
                  Click to view details
                </q-tooltip>
              </q-chip>
            </div>

            <!-- Cost Section (if can view cost) -->
            <div v-if="canViewCost" class="item-section cost-section">
              <div class="cost-label">{{ formatCost(getCost(item)) }}</div>
              <div class="total-invested-label">
                Total: {{ formatCost(getCost(item) * getQuantity(item)) }}
              </div>
            </div>

            <!-- Status & Info Section -->
            <div class="item-section status-section">
              <StockStatusChip
                :status="getStockStatusForChip(item)"
                :quantity="getAvailableQuantityNew(item)"
                :thresholds="item.sku?.stock_thresholds"
              />
              <div class="location-label">
                <q-icon name="place" size="xs" class="q-mr-xs" />
                {{ item.location || "No location" }}
              </div>
              <div class="date-label">
                {{ formatDate(item.updatedAt) }}
              </div>
            </div>

            <!-- Actions Section -->
            <div v-if="canWrite" class="item-section actions-section">
              <div class="action-buttons">
                <q-btn
                  @click.stop="emit('edit', item)"
                  color="primary"
                  icon="edit"
                  size="sm"
                  round
                  flat
                  class="action-btn"
                >
                  <q-tooltip>Edit item</q-tooltip>
                </q-btn>
                <q-btn
                  @click.stop="emit('delete', item)"
                  color="negative"
                  icon="delete"
                  size="sm"
                  round
                  flat
                  class="action-btn"
                >
                  <q-tooltip>Delete item</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-card-section>
        </q-card>
        </template>
      </div>
      
      <!-- Pagination Controls -->
      <div v-if="props.pagination && props.pagination.total_pages >= 1" class="pagination-section q-mt-md">
        <q-card flat class="pagination-card">
          <q-card-section class="pagination-content">
            <div class="pagination-info">
              <q-chip 
                color="primary" 
                text-color="white" 
                size="sm"
                icon="inventory"
              >
                {{ props.pagination.total_items }} items total
              </q-chip>
              <div class="text-caption text-grey-6 q-mt-xs">
                Page {{ props.pagination.current_page }} of {{ props.pagination.total_pages }}
              </div>
            </div>
            
            <q-pagination
              v-model="currentPage"
              :max="props.pagination.total_pages"
              :max-pages="7"
              direction-links
              boundary-links
              color="primary"
              :disable="isLocalLoading || props.loading"
              @update:model-value="handlePageChange"
              class="pagination-control"
            />
            
            <div class="page-size-control">
              <q-select
                v-model="pageSize"
                :options="pageSizeOptions"
                label="Per page"
                dense
                outlined
                :disable="isLocalLoading || props.loading"
                @update:model-value="handlePageSizeChange"
                style="min-width: 100px;"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Tag Details Dialog -->
    <q-dialog v-model="showTagDialog" persistent>
      <q-card class="tag-details-dialog" style="min-width: 500px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Tag Details</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="selectedItem">
          <!-- Item Summary -->
          <div class="q-mb-md">
            <div class="text-subtitle1 text-weight-bold">
              {{ formatProductDetails(selectedItem).primary }}
            </div>
            <div
              class="text-body2 text-grey-7"
              v-if="formatProductDetails(selectedItem).secondary"
            >
              {{ formatProductDetails(selectedItem).secondary }}
            </div>
          </div>

          <!-- Overall Summary -->
          <div class="summary-section q-mb-md">
            <q-separator class="q-mb-md" />
            <div class="row q-gutter-md">
              <div class="col">
                <div class="text-body2 text-grey-7">Total Quantity</div>
                <div class="text-h6">{{ selectedItem.quantity }}</div>
              </div>
              <div class="col" v-if="selectedItem.tagSummary">
                <div class="text-body2 text-grey-7">Total Tagged</div>
                <div class="text-h6 text-negative">
                  {{ selectedItem.tagSummary.totalTagged }}
                </div>
              </div>
              <div class="col">
                <div class="text-body2 text-grey-7">Available</div>
                <div class="text-h6 text-positive">
                  {{ getAvailableQuantity(selectedItem) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Tag Breakdown -->
          <div
            v-if="
              selectedItem.tagSummary && selectedItem.tagSummary.totalTagged > 0
            "
          >
            <q-separator class="q-mb-md" />
            <div class="text-subtitle2 q-mb-md">Tag Breakdown:</div>

            <!-- Reserved Items -->
            <div
              v-if="selectedItem.tagSummary.reserved > 0"
              class="tag-detail-section q-mb-md"
            >
              <q-chip
                color="info"
                text-color="white"
                icon="bookmark"
                class="q-mr-sm"
              >
                Reserved: {{ selectedItem.tagSummary.reserved }}
              </q-chip>
              <div class="q-mt-sm">
                <div v-if="selectedItem.tags" class="reservation-details">
                  <div
                    v-for="tag in selectedItem.tags.filter(
                      (tag) => tag.tag_type === 'reserved'
                    )"
                    :key="tag._id"
                    class="reservation-item q-mb-xs"
                  >
                    <div class="text-body2">
                      <strong>{{ tag.customer_name }}</strong> -
                      {{ tag.quantity }} item{{ tag.quantity !== 1 ? "s" : "" }}
                    </div>
                    <div v-if="tag.due_date" class="text-caption text-grey-6">
                      Due: {{ new Date(tag.due_date).toLocaleDateString() }}
                    </div>
                    <div v-if="tag.notes" class="text-caption text-grey-6">
                      {{ tag.notes }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-body2 text-grey-7">
                  Items currently reserved for reserving parties
                </div>
              </div>
            </div>

            <!-- Broken Items -->
            <div
              v-if="selectedItem.tagSummary.broken > 0"
              class="tag-detail-section q-mb-md"
            >
              <q-chip
                color="negative"
                text-color="white"
                icon="broken_image"
                class="q-mr-sm"
              >
                Broken: {{ selectedItem.tagSummary.broken }}
              </q-chip>
              <div class="q-mt-sm text-body2 text-grey-7">
                Items marked as damaged or broken
              </div>
            </div>

            <!-- Imperfect Items -->
            <div
              v-if="selectedItem.tagSummary.imperfect > 0"
              class="tag-detail-section q-mb-md"
            >
              <q-chip
                color="warning"
                text-color="white"
                icon="warning"
                class="q-mr-sm"
              >
                Imperfect: {{ selectedItem.tagSummary.imperfect }}
              </q-chip>
              <div class="q-mt-sm text-body2 text-grey-7">
                Items with minor defects or imperfections
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
/* List Container */
.inventory-list-container {
  background: transparent;
  border-radius: 20px;
  overflow: hidden;
  width: 100%;
}

/* No Items Banner */
.no-items-banner {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(33, 37, 41, 0.7);
}

/* Header Section */
.list-header {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  margin-bottom: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 10px;
}

.header-section {
  color: rgba(33, 37, 41, 0.8);
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 80px;
}

.details-header {
  flex: 1 1 auto;
  justify-content: flex-start;
  max-width: 300px;
}

/* List Styling */
.inventory-list {
  background: transparent;
  position: relative;
}

/* Smooth transitions between skeleton and content */
.inventory-list .inventory-item {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton Loading Cards */
.skeleton-card {
  background: rgba(255, 255, 255, 0.05) !important;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Individual Item Styling */
.inventory-item {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 12px;
  transition: all 0.3s ease, opacity 0.2s ease, transform 0.2s ease;
  padding: 20px;
  min-height: 80px;
  align-items: center;
  opacity: 1;
  transform: translateY(0);
}


.inventory-item:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Color-coded left borders for product types */
.inventory-item.type-wall {
  border-left: 5px solid var(--q-primary);
}

.inventory-item.type-toilet {
  border-left: 5px solid var(--q-positive);
}

.inventory-item.type-base {
  border-left: 5px solid #ffc107;
}

.inventory-item.type-tub {
  border-left: 5px solid #00bcd4;
}

.inventory-item.type-vanity {
  border-left: 5px solid #673ab7;
}

.inventory-item.type-shower_door,
.inventory-item.type-shower-door,
.inventory-item.type-showerdoor,
.inventory-item.type-shower_doors,
.inventory-item.type-shower-doors,
.inventory-item.type-showerdoors {
  border-left: 5px solid #ff6f00;
}

.inventory-item.type-raw_material,
.inventory-item.type-raw-material,
.inventory-item.type-rawmaterial,
.inventory-item.type-raw_materials,
.inventory-item.type-raw-materials,
.inventory-item.type-rawmaterials {
  border-left: 5px solid #5d4037;
}

.inventory-item.type-accessory {
  border-left: 5px solid #e91e63;
}

.inventory-item.type-miscellaneous,
.inventory-item.type-misc {
  border-left: 5px solid #616161;
}

/* Item Row Layout */
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 10px;
}

.item-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 80px;
}

.details-section {
  flex: 1 1 auto;
  align-items: flex-start;
  text-align: left;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Type Chip */
.type-chip {
  text-transform: capitalize;
  font-weight: 600;
  font-size: 11px;
  border-radius: 12px;
  user-select: none;
  cursor: default;
}

/* Product Type Banner */
.product-type-banner {
  opacity: 0;
  transform: translateY(-8px);
  transition: all 0.3s ease;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 8px;
  margin-bottom: 6px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  align-self: flex-start;
}

.inventory-item:hover .product-type-banner {
  opacity: 1;
  transform: translateY(0);
}

/* Product type banner colors */
.type-banner-wall {
  background: var(--q-primary);
  color: white;
}

.type-banner-toilet {
  background: var(--q-positive);
  color: white;
}

.type-banner-base {
  background: #ffc107;
  color: white;
}

.type-banner-tub {
  background: #00bcd4;
  color: white;
}

.type-banner-vanity {
  background: #673ab7;
  color: white;
}

.type-banner-shower_door,
.type-banner-shower-door,
.type-banner-showerdoor,
.type-banner-shower_doors,
.type-banner-shower-doors,
.type-banner-showerdoors {
  background: var(--q-deep-orange);
  color: white;
}

.type-banner-raw_material,
.type-banner-raw-material,
.type-banner-rawmaterial,
.type-banner-raw_materials,
.type-banner-raw-materials,
.type-banner-rawmaterials {
  background: var(--q-brown);
  color: white;
}

.type-banner-accessory {
  background: #e91e63;
  color: white;
}

.type-banner-miscellaneous,
.type-banner-misc {
  background: var(--q-grey);
  color: white;
}

/* Item Content */
.item-title {
  color: rgba(33, 37, 41, 0.9);
  font-weight: 600;
  font-size: 16px;
  line-height: 1.4;
}

.item-subtitle {
  color: rgba(33, 37, 41, 0.7);
  font-size: 14px;
  margin-top: 4px;
}

.item-notes {
  color: rgba(33, 37, 41, 0.6);
  font-style: italic;
  font-size: 13px;
  margin-top: 4px;
}

/* Quantity Section */
.quantity-section {
  min-width: 80px;
  text-align: center;
}

.quantity-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Total Quantity Badge */
.total-quantity-badge {
  font-weight: 700;
  font-size: 18px;
  border-radius: 12px;
  user-select: none;
  cursor: default;
  margin-bottom: 4px;
}

/* Quantity Breakdown */
.quantity-breakdown {
  margin: 4px 0;
}

.breakdown-text {
  color: rgba(33, 37, 41, 0.75);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  user-select: none;
}

.tag-badges-container {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  max-width: 90px;
  margin-top: 4px;
}

.tag-chip {
  font-weight: 600;
  font-size: 10px;
  border-radius: 10px;
  min-width: 20px;
  user-select: none;
  cursor: default;
}

/* SKU Section */
.sku-section {
  min-width: 140px;
  text-align: center;
}

.sku-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.sku-chip {
  font-weight: 600;
  font-size: 12px;
  border-radius: 12px;
  user-select: text;
  cursor: pointer;
}

.no-sku-display {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.no-sku-chip {
  font-weight: 500;
  font-size: 11px;
  border-radius: 12px;
  user-select: none;
  cursor: default;
  opacity: 0.7;
}

.barcode-display {
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.barcode-text {
  color: rgba(33, 37, 41, 0.6);
  font-size: 11px;
  font-family: monospace;
  user-select: text;
}

/* Tag Status Section */
.tag-section {
  min-width: 120px;
  text-align: center;
}

.tag-status-chip {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 12px;
}

/* Cost Section */
.cost-section {
  min-width: 120px;
  text-align: right;
}

.cost-label {
  color: rgba(40, 167, 69, 0.9);
  font-weight: 600;
  font-size: 16px;
}

.total-invested-label {
  color: rgba(0, 86, 179, 0.8);
  font-weight: 500;
  font-size: 13px;
  margin-top: 2px;
}

/* Status Section */
.status-section {
  min-width: 140px;
  text-align: center;
}

.status-chip {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 12px;
  margin-bottom: 6px;
  user-select: none;
  cursor: default;
}

.location-label {
  color: rgba(33, 37, 41, 0.6);
  font-size: 12px;
  margin-top: 4px;
}

.date-label {
  color: rgba(33, 37, 41, 0.5);
  font-size: 11px;
  margin-top: 2px;
}

/* Actions Section */
.actions-section {
  min-width: 100px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-btn {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* Hide mobile metrics row on desktop by default */
.mobile-metrics-row {
  display: none;
}

/* Hide mobile quantity card on desktop by default */
.mobile-quantity-card {
  display: none;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .cost-section {
    min-width: 100px;
  }

  .status-section {
    min-width: 120px;
  }
}

/* Mobile Card Layout - Complete Revamp */
@media (max-width: 768px) {
  /* Hide desktop table header on mobile */
  .list-header {
    display: none;
  }

  /* Transform items into mobile cards */
  .inventory-item {
    padding: 1.25rem;
    border-radius: 16px;
    margin-bottom: 1.25rem;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    position: relative;
    overflow: hidden;
  }

  .inventory-item:hover {
    background: rgba(255, 255, 255, 0.28);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  /* Add subtle gradient overlay */
  .inventory-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Ensure content is above overlay */
  .item-row {
    position: relative;
    z-index: 2;
  }

  /* Mobile card row - vertical stack */
  .item-row {
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    gap: 0.75rem;
  }

  /* All sections become full-width blocks */
  .item-section {
    width: 100%;
    flex: none;
    align-items: stretch;
    min-width: auto;
  }

  /* HEADER SECTION - Product info with type banner */
  .details-section {
    max-width: none;
    align-items: flex-start;
    order: 1;
  }

  .product-type-banner {
    opacity: 1;
    transform: translateY(0);
    font-size: 9px;
    padding: 3px 8px;
    margin-bottom: 0.5rem;
    display: inline-block;
  }

  .item-title {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 0.25rem;
  }

  .item-subtitle {
    font-size: 0.85rem;
    opacity: 0.8;
    margin-bottom: 0.25rem;
  }

  .item-notes {
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  /* Show mobile metrics row only on mobile */
  .mobile-metrics-row {
    display: block;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    margin: 0.75rem 0;
    order: 2;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .metrics-container {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    padding: 1rem;
    gap: 0.75rem;
  }

  .metric-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.25rem;
  }

  /* SKU Section - Horizontal chips */
  .sku-section {
    order: 3;
    align-items: flex-start;
  }

  .sku-display {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .sku-chip {
    font-size: 0.8rem;
    padding: 0.375rem 0.75rem;
  }

  .barcode-display {
    flex: 1;
    justify-content: flex-end;
    margin-top: 0;
  }

  .barcode-text {
    font-size: 0.75rem;
  }

  /* Tag Status - Full width chip */
  .tag-section {
    order: 4;
    align-items: stretch;
  }

  .tag-status-chip {
    width: 100%;
    justify-content: center;
    padding: 0.5rem;
    font-size: 0.85rem;
  }

  /* Actions - Full width buttons */
  .actions-section {
    order: 5;
    align-items: stretch;
    margin-top: 0.5rem;
  }

  .action-buttons {
    width: 100%;
    justify-content: space-around;
    gap: 0.75rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.5rem;
    border-radius: 8px;
  }

  /* Quantity metrics in mobile row */
  .mobile-quantity-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    min-height: 65px;
  }

  .mobile-metric-value {
    font-size: 1.25rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .mobile-metric-label {
    font-size: 0.65rem;
    opacity: 0.75;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    color: rgba(33, 37, 41, 0.7);
    text-align: center;
    line-height: 1.2;
  }

  /* Cost metrics in mobile row */
  .mobile-cost-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: rgba(40, 167, 69, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(40, 167, 69, 0.2);
    min-height: 65px;
  }

  /* Available quantity metrics in mobile row */
  .mobile-available-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: #28a74514;
    border-radius: 10px;
    border: 1px solid rgba(40, 167, 69, 0.15);
    min-height: 65px;
  }

  .tagged {
    background: #14F195;
  }

  /* Status metrics in mobile row */
  .mobile-status-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    min-height: 65px;
  }

  /* Hide desktop-only sections on mobile */
  .quantity-section,
  .cost-section,
  .status-section {
    display: none;
  }
}

@media (max-width: 480px) {
  .inventory-item {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .item-title {
    font-size: 0.9rem;
  }

  .item-subtitle {
    font-size: 0.8rem;
  }

  .mobile-metrics-row {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .mobile-metric-value {
    font-size: 1rem;
  }

  .mobile-metric-label {
    font-size: 0.65rem;
  }

  .sku-chip {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  .action-btn {
    padding: 0.4rem;
    font-size: 0.8rem;
  }

  .tag-status-chip {
    padding: 0.4rem;
    font-size: 0.8rem;
  }
}

/* Modal Styling */
.reservation-details {
  border-left: 3px solid #007bff;
  padding-left: 12px;
  margin-left: 8px;
}

.reservation-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.reservation-item:last-child {
  border-bottom: none;
}

.tag-detail-section .q-chip {
  margin-bottom: 8px;
}

/* Pagination Styling */
.pagination-section {
  margin-top: 20px;
}

.pagination-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
}

.pagination-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
}

.pagination-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 140px;
}

.pagination-control {
  flex: 1;
  display: flex;
  justify-content: center;
}

.page-size-control {
  min-width: 100px;
}

/* Mobile Pagination */
@media (max-width: 768px) {
  .pagination-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .pagination-info {
    align-items: center;
    width: 100%;
  }
  
  .pagination-control {
    width: 100%;
  }
  
  .page-size-control {
    width: 100%;
  }
}
</style>
