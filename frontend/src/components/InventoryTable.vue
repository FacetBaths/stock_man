<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import type { Item, WallDetails, ProductDetails } from '@/types'
import { TAG_TYPES } from '@/types'

interface Props {
  canWrite: boolean
  filters?: {
    category_id?: string
    search?: string
    status?: 'all' | 'low_stock' | 'out_of_stock' | 'overstock' | 'needs_reorder'
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

// Track previous filters to prevent unnecessary API calls
const prevFiltersRef = ref<string>('')

// Watch for changes in filters and fetch inventory accordingly
watchEffect(() => {
  if (inventoryStore.isLoading) return // Prevent multiple concurrent calls
  
  // Use JSON.stringify for deep comparison of filters object
  const currentFiltersKey = JSON.stringify(props.filters || {})
  
  // Only fetch if filters actually changed
  if (currentFiltersKey !== prevFiltersRef.value) {
    prevFiltersRef.value = currentFiltersKey
    inventoryStore.fetchInventory(props.filters).catch(console.error)
  }
})

// Use inventory data from store
const items = computed(() => inventoryStore.inventory)

const emit = defineEmits<{
  edit: [item: Item]
  delete: [item: Item]
}>()

// Dialog state for tag details
const showTagDialog = ref(false)
const selectedItem = ref<Item | null>(null)

const formatProductDetails = (item: Item) => {
  const details = item.product_details

  if (item.product_type === 'wall') {
    const wall = details as WallDetails
    return {
      primary: `${wall.product_line} - ${wall.color_name}`,
      secondary: `${wall.dimensions} | ${wall.finish}`
    }
  } else {
    const product = details as ProductDetails
    let primary = product.name || 'Unnamed Product'
    if (product.brand) primary = `${product.brand} ${primary}`
    if (product.model) primary = `${primary} (${product.model})`

    let secondary = []
    if (product.color) secondary.push(product.color)
    if (product.dimensions) secondary.push(product.dimensions)
    if (product.finish) secondary.push(product.finish)

    return {
      primary,
      secondary: secondary.join(' | ') || product.description || ''
    }
  }
}

const getStockStatus = (quantity: number) => {
  if (quantity === 0) return { class: 'out-of-stock', text: 'Out of Stock', color: 'negative' }
  if (quantity <= 5) return { class: 'low-stock', text: 'Low Stock', color: 'warning' }
  return { class: 'in-stock', text: 'In Stock', color: 'positive' }
}

// Helper function to get type colors
const getTypeColor = (productType: string) => {
  const colorMap: { [key: string]: string } = {
    'wall': 'primary',
    'toilet': 'positive',
    'base': 'amber',
    'tub': 'cyan',
    'vanity': 'deep-purple',
    'shower_door': 'deep-orange',
    'raw_material': 'brown',
    'accessory': 'pink',
    'miscellaneous': 'grey'
  }
  return colorMap[productType] || 'grey'
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

const formatTotalInvested = (item: Item) => {
  if (!item.cost || item.cost === null) return '-'
  const total = item.cost * item.quantity
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(total)
}

const canViewCost = computed(() => authStore.hasPermission('view_cost') || authStore.hasRole(['admin', 'warehouse_manager']))

// Helper function to get tag status badges
const getTagStatusBadges = (item: Item) => {
  if (!item.tagSummary) return []
  
  const badges = []
  if (item.tagSummary.reserved > 0) {
    badges.push({
      type: 'reserved',
      quantity: item.tagSummary.reserved,
      label: 'Reserved',
      color: '#007bff'
    })
  }
  if (item.tagSummary.broken > 0) {
    badges.push({
      type: 'broken',
      quantity: item.tagSummary.broken,
      label: 'Broken',
      color: '#dc3545'
    })
  }
  if (item.tagSummary.imperfect > 0) {
    badges.push({
      type: 'imperfect',
      quantity: item.tagSummary.imperfect,
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
const hasQualityIssues = (item: Item) => {
  if (!item.tagSummary) return false
  return item.tagSummary.broken > 0 || item.tagSummary.imperfect > 0
}

// Get primary tag status for an item (focuses on availability for tagging/reservation)
const getPrimaryTagStatus = (item: any) => {
  // Get the total quantity - handle both new and legacy structures
  const totalQty = getQuantity(item)
  
  // First check if item is actually out of stock
  if (totalQty === 0) {
    return { text: 'None Available', color: 'negative', clickable: false }
  }
  
  // Check if we have tag data
  if (!item.tagSummary || item.tagSummary.totalTagged === 0) {
    return { text: 'Available', color: 'positive', clickable: false }
  }
  
  // Calculate available quantity
  const availableQty = getAvailableQuantity(item)
  
  if (availableQty === 0) {
    // All items are tagged - no "Partially" prefix
    if (item.tagSummary.broken > 0) {
      return { text: 'Broken', color: 'negative', clickable: true }
    }
    if (item.tagSummary.imperfect > 0) {
      return { text: 'Imperfect', color: 'warning', clickable: true }
    }
    if (item.tagSummary.reserved > 0) {
      return { text: 'Reserved', color: 'info', clickable: true }
    }
    if (item.tagSummary.loaned > 0) {
      return { text: 'Loaned', color: 'purple', clickable: true }
    }
  } else {
    // Some items available, some tagged - show "Partially"
    if (item.tagSummary.broken > 0) {
      return { text: 'Partially Broken', color: 'negative', clickable: true }
    }
    if (item.tagSummary.imperfect > 0) {
      return { text: 'Partially Imperfect', color: 'warning', clickable: true }
    }
    if (item.tagSummary.reserved > 0) {
      return { text: 'Partially Reserved', color: 'info', clickable: true }
    }
    if (item.tagSummary.loaned > 0) {
      return { text: 'Partially Loaned', color: 'purple', clickable: true }
    }
  }
  
// Default fallback - some items available
  return { text: 'Available', color: 'positive', clickable: false }
}

// Helper function to get product type from the inventory data structure
const getProductType = (item: any) => {
  // Handle new inventory API structure (has nested sku and category)
  if (item.sku && item.category) {
    // Map category names to product types for styling consistency
    const categoryName = item.category.name.toLowerCase()
    const categoryToTypeMap: { [key: string]: string } = {
      'walls': 'wall',
      'accessories': 'accessory',
      'toilets': 'toilet',
      'bases': 'base',
      'tubs': 'tub',
      'vanities': 'vanity',
      'shower doors': 'shower_door',
      'raw materials': 'raw_material',
      'miscellaneous': 'miscellaneous'
    }
    return categoryToTypeMap[categoryName] || categoryName
  }
  // Handle legacy item structure
  if (item.product_type) {
    return item.product_type
  }
  // Fallback
  return 'unknown'
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

// Helper to format product details for new structure
const formatProductDetailsNew = (item: any) => {
  if (item.sku) {
    return {
      primary: item.sku.name || 'Unknown Product',
      secondary: item.sku.description || ''
    }
  }
  return formatProductDetails(item)
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

// Helper to get cost from either structure
const getCost = (item: any) => {
  if (item.sku && item.sku.unit_cost !== undefined) {
    return item.sku.unit_cost
  }
  if (item.average_cost !== undefined) {
    return item.average_cost
  }
  if (item.cost !== undefined) {
    return item.cost
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

// Handle tag status click
const handleTagStatusClick = (item: Item) => {
  const status = getPrimaryTagStatus(item)
  if (status.clickable) {
    selectedItem.value = item
    showTagDialog.value = true
  }
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
      
      <div class="inventory-list">
        <div 
          v-for="item in items" 
          :key="item._id" 
          class="inventory-item"
          :class="`type-${getProductType(item)}`"
          @click="canWrite ? emit('edit', item) : null"
          :style="{ cursor: canWrite ? 'pointer' : 'default' }"
        >
          <div class="item-row">
            <!-- Details Section -->
            <div class="item-section details-section">
              <div class="product-type-banner" :class="`type-banner-${getProductType(item)}`">
                {{ getProductType(item).replace('_', ' ').toUpperCase() }}
              </div>
              <div class="item-title">
                {{ formatProductDetailsNew(item).primary }}
              </div>
              <div v-if="formatProductDetailsNew(item).secondary" class="item-subtitle">
                {{ formatProductDetailsNew(item).secondary }}
              </div>
              <div v-if="item.notes" class="item-notes">
                <q-icon name="note" size="xs" class="q-mr-xs" />{{ item.notes }}
              </div>
            </div>

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
                  :color="getStockStatus(getQuantity(item)).color" 
                  :label="getQuantity(item).toString()"
                  class="total-quantity-badge"
                  :title="`Total: ${getQuantity(item)} items`"
                />
                
                <!-- Reserved/Available Breakdown -->
                <div v-if="item.tagSummary && item.tagSummary.totalTagged > 0" class="quantity-breakdown">
                  <div class="breakdown-text">
                    {{ item.tagSummary.totalTagged }} reserved / {{ getAvailableQuantity(item) }} free
                  </div>
                </div>
              </div>
            </div>

            <!-- Tag Status Section -->
            <div class="item-section tag-section">
              <q-chip 
                :color="getPrimaryTagStatus(item).color"
                text-color="white"
                size="sm"
                :label="getPrimaryTagStatus(item).text"
                :class="[
                  'tag-status-chip',
                  { 'clickable': getPrimaryTagStatus(item).clickable }
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
              <q-chip 
                :color="getStockStatus(getQuantity(item)).color"
                text-color="white"
                size="sm"
                :label="getStockStatus(getQuantity(item)).text"
                class="status-chip"
              />
              <div class="location-label">
                <q-icon name="place" size="xs" class="q-mr-xs" />
                {{ item.location || 'No location' }}
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
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Details Dialog -->
    <q-dialog v-model="showTagDialog" persistent>
      <q-card class="tag-details-dialog" style="min-width: 500px">
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
            <div class="text-body2 text-grey-7" v-if="formatProductDetails(selectedItem).secondary">
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
                <div class="text-h6 text-negative">{{ selectedItem.tagSummary.totalTagged }}</div>
              </div>
              <div class="col">
                <div class="text-body2 text-grey-7">Available</div>
                <div class="text-h6 text-positive">{{ getAvailableQuantity(selectedItem) }}</div>
              </div>
            </div>
          </div>

          <!-- Tag Breakdown -->
          <div v-if="selectedItem.tagSummary && selectedItem.tagSummary.totalTagged > 0">
            <q-separator class="q-mb-md" />
            <div class="text-subtitle2 q-mb-md">Tag Breakdown:</div>
            
            <!-- Reserved Items -->
            <div v-if="selectedItem.tagSummary.reserved > 0" class="tag-detail-section q-mb-md">
              <q-chip color="info" text-color="white" icon="bookmark" class="q-mr-sm">
                Reserved: {{ selectedItem.tagSummary.reserved }}
              </q-chip>
              <div class="q-mt-sm">
                <div v-if="selectedItem.tags" class="reservation-details">
                  <div 
                    v-for="tag in selectedItem.tags.filter(tag => tag.tag_type === 'reserved')"
                    :key="tag._id"
                    class="reservation-item q-mb-xs"
                  >
                    <div class="text-body2">
                      <strong>{{ tag.customer_name }}</strong> - {{ tag.quantity }} item{{ tag.quantity !== 1 ? 's' : '' }}
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
            <div v-if="selectedItem.tagSummary.broken > 0" class="tag-detail-section q-mb-md">
              <q-chip color="negative" text-color="white" icon="broken_image" class="q-mr-sm">
                Broken: {{ selectedItem.tagSummary.broken }}
              </q-chip>
              <div class="q-mt-sm text-body2 text-grey-7">
                Items marked as damaged or broken
              </div>
            </div>

            <!-- Imperfect Items -->
            <div v-if="selectedItem.tagSummary.imperfect > 0" class="tag-detail-section q-mb-md">
              <q-chip color="warning" text-color="white" icon="warning" class="q-mr-sm">
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
}

/* Individual Item Styling */
.inventory-item {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 12px;
  transition: all 0.3s ease;
  padding: 20px;
  min-height: 80px;
  align-items: center;
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

/* Responsive Design */
@media (max-width: 1024px) {
  .cost-section {
    min-width: 100px;
  }
  
  .status-section {
    min-width: 120px;
  }
}

@media (max-width: 768px) {
  .inventory-item {
    padding: 12px;
    flex-wrap: wrap;
  }
  
  .item-title {
    font-size: 14px;
  }
  
  .item-subtitle {
    font-size: 13px;
  }
  
  .quantity-section,
  .cost-section,
  .status-section,
  .actions-section {
    min-width: auto;
    flex-basis: 50%;
    margin-top: 8px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }
  
  .tag-badges-container {
    max-width: none;
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .inventory-item {
    padding: 8px;
  }
  
  .type-chip {
    font-size: 10px;
    padding: 4px 8px;
  }
  
  .item-title {
    font-size: 13px;
  }
  
  .item-subtitle {
    font-size: 12px;
  }
  
  .quantity-badge {
    font-size: 14px;
  }
  
  .cost-label {
    font-size: 14px;
  }
  
  .status-chip {
    font-size: 11px;
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
</style>
