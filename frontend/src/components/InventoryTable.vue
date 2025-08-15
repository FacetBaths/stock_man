<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Item, WallDetails, ProductDetails } from '@/types'
import { TAG_TYPES } from '@/types'

interface Props {
  items: Item[]
  canWrite: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()

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

const canViewCost = (authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')

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
const getAvailableQuantity = (item: Item) => {
  if (!item.tagSummary) return item.quantity
  return item.quantity - item.tagSummary.totalTagged
}

// Check if item has any quality issues
const hasQualityIssues = (item: Item) => {
  if (!item.tagSummary) return false
  return item.tagSummary.broken > 0 || item.tagSummary.imperfect > 0
}

// Get primary tag status for an item
const getPrimaryTagStatus = (item: Item) => {
  // If no tags or all quantities are 0, default to in-stock
  if (!item.tagSummary || item.tagSummary.totalTagged === 0) {
    return { text: 'In Stock', color: 'positive', clickable: false }
  }
  
  const availableQty = item.quantity - item.tagSummary.totalTagged
  
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
  }
  
// Default fallback
  return { text: 'In Stock', color: 'positive', clickable: false }
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
          <div class="header-section type-header">
            <q-icon name="category" class="q-mr-xs" />
            Type
          </div>
          <div class="header-section details-header">
            <q-icon name="inventory" class="q-mr-xs" />
            Product Details
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
        >
          <div class="item-row">
            <!-- Type Section -->
            <div class="item-section type-section">
              <q-chip 
                :color="getTypeColor(item.product_type)"
                text-color="white"
                size="sm"
                class="type-chip"
              >
                {{ item.product_type.replace('_', ' ') }}
              </q-chip>
            </div>

            <!-- Details Section -->
            <div class="item-section details-section">
              <div class="item-title">
                {{ formatProductDetails(item).primary }}
              </div>
              <div v-if="formatProductDetails(item).secondary" class="item-subtitle">
                {{ formatProductDetails(item).secondary }}
              </div>
              <div v-if="item.notes" class="item-notes">
                <q-icon name="note" size="xs" class="q-mr-xs" />{{ item.notes }}
              </div>
            </div>

            <!-- Quantity Section -->
            <div class="item-section quantity-section">
              <div class="quantity-display">
                <!-- Total Quantity Badge -->
                <q-badge 
                  :color="getStockStatus(item.quantity).color" 
                  :label="item.quantity.toString()"
                  class="total-quantity-badge"
                  :title="`Total: ${item.quantity} items`"
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
              <div class="cost-label">{{ formatCost(item.cost) }}</div>
              <div class="total-invested-label">
                Total: {{ formatTotalInvested(item) }}
              </div>
            </div>

            <!-- Status & Info Section -->
            <div class="item-section status-section">
              <q-chip 
                :color="getStockStatus(item.quantity).color"
                text-color="white"
                size="sm"
                :label="getStockStatus(item.quantity).text"
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
  justify-content: space-evenly;
  align-items: center;
  width: 100%;
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
  flex: 1;
}

.details-header {
  flex: 2;
  justify-content: flex-start;
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

/* Item Row Layout */
.item-row {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  width: 100%;
}

.item-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.details-section {
  flex: 2;
  align-items: flex-start;
  text-align: left;
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
