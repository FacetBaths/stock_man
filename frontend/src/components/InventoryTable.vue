<script setup lang="ts">
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
        <div class="row items-center no-wrap">
          <div class="col-auto header-section type-header">
            <q-icon name="category" class="q-mr-xs" />
            Type
          </div>
          <div class="col header-section details-header">
            <q-icon name="inventory" class="q-mr-xs" />
            Product Details
          </div>
          <div class="col-auto header-section quantity-header">
            <q-icon name="tag" class="q-mr-xs" />
            Qty
          </div>
          <div v-if="canViewCost" class="col-auto header-section cost-header">
            <q-icon name="attach_money" class="q-mr-xs" />
            Cost
          </div>
          <div class="col-auto header-section status-header">
            <q-icon name="info" class="q-mr-xs" />
            Status & Info
          </div>
          <div v-if="canWrite" class="col-auto header-section actions-header">
            <q-icon name="settings" class="q-mr-xs" />
            Actions
          </div>
        </div>
      </div>
      
      <q-list class="inventory-list" separator>
      <q-item 
        v-for="item in items" 
        :key="item._id" 
        class="inventory-item glass-item"
        clickable
        v-ripple
      >
        <!-- Main Item Section -->
        <q-item-section avatar>
          <q-chip 
            :color="getTypeColor(item.product_type)"
            text-color="white"
            size="sm"
            class="type-chip"
          >
            {{ item.product_type.replace('_', ' ') }}
          </q-chip>
        </q-item-section>

        <q-item-section>
          <q-item-label class="item-title">
            {{ formatProductDetails(item).primary }}
          </q-item-label>
          <q-item-label v-if="formatProductDetails(item).secondary" caption class="item-subtitle">
            {{ formatProductDetails(item).secondary }}
          </q-item-label>
          <q-item-label v-if="item.notes" caption class="item-notes">
            <q-icon name="note" size="xs" class="q-mr-xs" />{{ item.notes }}
          </q-item-label>
        </q-item-section>

        <!-- Quantity Section -->
        <q-item-section side class="quantity-section">
          <div class="quantity-display">
            <q-badge 
              :color="getStockStatus(item.quantity).color" 
              :label="item.quantity.toString()"
              class="quantity-badge"
            />
            <div v-if="getTagStatusBadges(item).length > 0" class="tag-badges-container">
              <q-chip
                v-for="badge in getTagStatusBadges(item)"
                :key="badge.type"
                :color="badge.color"
                text-color="white"
                size="xs"
                :label="badge.quantity.toString()"
                :title="`${badge.quantity} ${badge.label}`"
                class="tag-chip"
              />
            </div>
          </div>
        </q-item-section>

        <!-- Cost Section (if can view cost) -->
        <q-item-section v-if="canViewCost" side class="cost-section">
          <q-item-label class="cost-label">{{ formatCost(item.cost) }}</q-item-label>
          <q-item-label caption class="total-invested-label">
            Total: {{ formatTotalInvested(item) }}
          </q-item-label>
        </q-item-section>

        <!-- Status & Info Section -->
        <q-item-section side class="status-section">
          <q-chip 
            :color="getStockStatus(item.quantity).color"
            text-color="white"
            size="sm"
            :label="getStockStatus(item.quantity).text"
            class="status-chip"
          />
          <q-item-label caption class="location-label">
            <q-icon name="place" size="xs" class="q-mr-xs" />
            {{ item.location || 'No location' }}
          </q-item-label>
          <q-item-label caption class="date-label">
            {{ formatDate(item.updatedAt) }}
          </q-item-label>
        </q-item-section>

        <!-- Actions Section -->
        <q-item-section v-if="canWrite" side class="actions-section">
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
        </q-item-section>
      </q-item>
    </q-list>
    </div>
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

.header-section {
  color: rgba(33, 37, 41, 0.8);
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
}

.type-header {
  min-width: 100px;
}

.details-header {
  flex: 1;
}

.quantity-header {
  min-width: 80px;
  text-align: center;
  justify-content: center;
}

.cost-header {
  min-width: 120px;
  text-align: right;
  justify-content: flex-end;
}

.status-header {
  min-width: 140px;
  text-align: center;
  justify-content: center;
}

.actions-header {
  min-width: 100px;
  text-align: center;
  justify-content: center;
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
  margin-bottom: 8px;
  transition: all 0.3s ease;
  padding: 16px;
}

.inventory-item:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Type Chip */
.type-chip {
  text-transform: capitalize;
  font-weight: 600;
  font-size: 11px;
  border-radius: 12px;
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

.quantity-badge {
  font-weight: 700;
  font-size: 16px;
  border-radius: 12px;
}

.tag-badges-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  max-width: 80px;
}

.tag-chip {
  font-weight: 600;
  font-size: 10px;
  border-radius: 10px;
  min-width: 20px;
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
</style>
