<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { tagApi, inventoryApi } from '@/utils/api'
import { TAG_TYPES } from '@/types'
import type { Item, SKU } from '@/types'

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()

interface TaggedItem {
  item: Item & { availableQuantity: number }
  sku?: SKU
  quantity: number
}

// Multi-step form state
const currentStep = ref(1)
const totalSteps = 3

// Step 1: Tag Details
const tagDetails = ref({
  tag_type: 'reserved' as const,
  customer_name: '',
  notes: '',
  due_date: ''
})

// Step 2: Items Selection
const taggedItems = ref<TaggedItem[]>([])
const skuInput = ref('')
const isScanning = ref(false)
const showItemSelector = ref(true) // Show by default for better UX
const availableItems = ref<Item[]>([])
const itemSearchQuery = ref('')
const itemTypeFilter = ref('all')
const showColorLegend = ref(false)

// Step 3: Review & Submit
const isSubmitting = ref(false)
const error = ref<string | null>(null)

// Computed properties
const customerFieldLabel = computed(() => {
  switch (tagDetails.value.tag_type) {
    case 'reserved':
      return 'Reserved For (Customer/Project/Department) *'
    case 'broken':
      return 'Reported By (Name/Department) *'
    case 'imperfect':
      return 'Noted By (Name/Department) *'
    case 'stock':
    default:
      return 'Tagged By (Name/Department) *'
  }
})

const customerFieldPlaceholder = computed(() => {
  switch (tagDetails.value.tag_type) {
    case 'reserved':
      return 'e.g., John Doe, Project Alpha, Warehouse Team'
    case 'broken':
      return 'e.g., Quality Control, John Doe, Shipping Dept'
    case 'imperfect':
      return 'e.g., QC Inspector, Sarah Smith, Receiving Dept'
    case 'stock':
    default:
      return 'e.g., Inventory Manager, Stock Team'
  }
})

const tagTypeDescription = computed(() => {
  switch (tagDetails.value.tag_type) {
    case 'stock':
      return 'Item is available for sale/use'
    case 'reserved':
      return 'Item is reserved for a specific customer, project, or purpose'
    case 'broken':
      return 'Item is damaged and may not be suitable for normal use'
    case 'imperfect':
      return 'Item has cosmetic defects but may be suitable for certain applications'
    default:
      return ''
  }
})

const canProceedToStep2 = computed(() => {
  return tagDetails.value.customer_name.trim().length > 0
})

const canProceedToStep3 = computed(() => {
  return taggedItems.value.length > 0 && taggedItems.value.every(ti => ti.quantity > 0)
})

const totalTaggedItems = computed(() => taggedItems.value.length)
const totalTaggedQuantity = computed(() => taggedItems.value.reduce((sum, ti) => sum + ti.quantity, 0))

// Filtered items for browsing
const filteredItems = computed(() => {
  let filtered = availableItems.value
  
  // Filter by type
  if (itemTypeFilter.value !== 'all') {
    filtered = filtered.filter(item => item.product_type === itemTypeFilter.value)
  }
  
  // Filter by search query
  if (itemSearchQuery.value.trim()) {
    const query = itemSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(item => {
      const itemName = getItemDisplayName(item).toLowerCase()
      const location = item.location?.toLowerCase() || ''
      return itemName.includes(query) || location.includes(query)
    })
  }
  
  return filtered
})

// Product types for filter
const productTypeOptions = computed(() => {
  const uniqueTypes = [...new Set(availableItems.value.map(item => item.product_type))]
  return [
    { label: 'All Types', value: 'all' },
    ...uniqueTypes.map(type => ({ 
      label: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '), 
      value: type 
    }))
  ]
})

// Methods
const getItemDisplayName = (item: Item) => {
  const details = item.product_details as any
  if (item.product_type === 'wall') {
    return `${details.product_line} - ${details.color_name} (${details.dimensions})`
  } else {
    let name = details.name || 'Unnamed Item'
    if (details.brand) name = `${details.brand} ${name}`
    if (details.model) name = `${name} (${details.model})`
    return name
  }
}

const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find(t => t.value === tagType)
  return type?.color || '#6c757d'
}

const getItemProductTypeClass = (item: Item) => {
  // Return CSS class based on product type for color-coded left border
  if (!item.product_type) {
    return 'product-unknown'
  }
  
  // Normalize product type: lowercase, replace spaces/underscores with hyphens
  const normalizedType = item.product_type
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '') // Remove any other special characters
  
  const className = `product-${normalizedType}`
  return className
}

// SKU Scanning/Input
const handleSkuInput = async () => {
  const skuCode = skuInput.value.trim().toUpperCase()
  if (!skuCode) return

  try {
    isScanning.value = true
    error.value = null

    // Check if item already added
    const existingIndex = taggedItems.value.findIndex(ti => {
      const item = ti.item
      const sku = typeof item.sku_id === 'object' ? item.sku_id : null
      return sku?.sku_code === skuCode
    })

    if (existingIndex >= 0) {
      // Increment quantity of existing item
      taggedItems.value[existingIndex].quantity += 1
      skuInput.value = ''
      return
    }

    // Look up SKU and find associated items
    const response = await inventoryApi.getItems({
      search: skuCode,
      limit: 100
    })
    
    // Find items that match the SKU code
    const matchingItems = response.items.filter(item => {
      const sku = typeof item.sku_id === 'object' ? item.sku_id : null
      return sku?.sku_code === skuCode && item.quantity > 0
    })

    if (matchingItems.length === 0) {
      error.value = `No available items found for SKU: ${skuCode}`
      setTimeout(() => error.value = null, 3000)
      return
    }

    // Add the first matching item (or let user choose if multiple)
    const selectedItem = matchingItems[0]
    const taggedItem: TaggedItem = {
      item: { ...selectedItem, availableQuantity: selectedItem.quantity },
      sku: typeof selectedItem.sku_id === 'object' ? selectedItem.sku_id : undefined,
      quantity: 1
    }

    taggedItems.value.push(taggedItem)
    skuInput.value = ''

  } catch (err: any) {
    error.value = err.response?.data?.message || 'SKU not found'
    setTimeout(() => error.value = null, 3000)
  } finally {
    isScanning.value = false
  }
}

// Item Selection
const loadAvailableItems = async () => {
  console.log('=== Starting loadAvailableItems ===')
  
  try {
    console.log('Calling inventoryApi.getInventory...')
    
    const response = await inventoryApi.getInventory({
      status: 'all',
      limit: 1000
    })
    
    console.log('API call completed successfully!')
    console.log('Full response:', JSON.stringify(response, null, 2))
    console.log('Response keys:', Object.keys(response))
    
    if (response.inventory) {
      console.log('Found inventory array with', response.inventory.length, 'items')
      
      if (response.inventory.length > 0) {
        console.log('First raw inventory item:', JSON.stringify(response.inventory[0], null, 2))
      }
      
      // Filter for available items
      const availableInventory = response.inventory.filter(inv => {
        console.log(`Checking item ${inv.sku?.sku_code}: available_quantity = ${inv.available_quantity}`)
        return inv.available_quantity > 0
      })
      
      console.log('Items with available quantity:', availableInventory.length)
      
      // Convert inventory records to item-like objects that can be tagged
      availableItems.value = availableInventory.map(inv => {
        const converted = {
          _id: inv.sku._id, // Use SKU ID as the item ID for tagging
          sku_id: inv.sku,
          product_type: inv.sku.product_type || 'miscellaneous',
          product_details: inv.sku.details || { name: inv.sku.description || inv.sku.sku_code },
          location: inv.primary_location || 'Not specified',
          quantity: inv.available_quantity, // Available quantity for this SKU
          serial_number: inv.sku.sku_code
        }
        console.log('Converted item:', converted)
        return converted
      })
    } else {
      console.log('No inventory array found in response')
      availableItems.value = []
    }
    
    console.log('Final available items count:', availableItems.value.length)
    
  } catch (err: any) {
    console.error('=== API ERROR ====')
    console.error('Error details:', err)
    console.error('Error message:', err.message)
    console.error('Error response:', err.response?.data)
    console.error('Error status:', err.response?.status)
    console.error('===================')
    
    error.value = `Failed to load items: ${err.message}. Check console for details.`
  }
}

const addItemFromSelector = (item: Item) => {
  const existingIndex = taggedItems.value.findIndex(ti => ti.item._id === item._id)
  
  if (existingIndex >= 0) {
    taggedItems.value[existingIndex].quantity += 1
  } else {
    const taggedItem: TaggedItem = {
      item: { ...item, availableQuantity: item.quantity }, // Assume full quantity available for now
      quantity: 1
    }
    taggedItems.value.push(taggedItem)
  }
  
  // Don't close the selector - keep it open for multiple selections
}

const removeTaggedItem = (index: number) => {
  taggedItems.value.splice(index, 1)
}

const updateItemQuantity = (index: number, quantity: number) => {
  if (quantity <= 0) {
    removeTaggedItem(index)
  } else {
    const maxQuantity = taggedItems.value[index].item.availableQuantity || taggedItems.value[index].item.quantity
    taggedItems.value[index].quantity = Math.min(quantity, maxQuantity)
  }
}

// Navigation
const nextStep = async () => {
  if (currentStep.value === 1 && canProceedToStep2.value) {
    currentStep.value = 2
    if (availableItems.value.length === 0) {
      await loadAvailableItems()
    }
  } else if (currentStep.value === 2 && canProceedToStep3.value) {
    currentStep.value = 3
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const validateStep1 = () => {
  if (!tagDetails.value.customer_name.trim()) {
    error.value = 'Please fill in the customer/department field'
    return false
  }
  return true
}

// Submit
const handleSubmit = async () => {
  if (!canProceedToStep3.value) return

  try {
    isSubmitting.value = true
    error.value = null

    const submitData = {
      tag_type: tagDetails.value.tag_type,
      customer_name: tagDetails.value.customer_name.trim(),
      notes: tagDetails.value.notes?.trim(),
      due_date: tagDetails.value.due_date || undefined,
      project_name: '', // Add project_name if needed
      items: taggedItems.value.map(ti => ({
        item_id: ti.item._id,
        quantity: ti.quantity,
        notes: '' // Add notes for individual items if needed
      }))
    }

    // Debug: Log the exact payload being sent
    console.log('=== CREATE TAG REQUEST ===')
    console.log('Payload:', JSON.stringify(submitData, null, 2))
    console.log('Tagged items:', taggedItems.value)
    console.log('==========================')

    await tagApi.createTag(submitData)
    emit('success')
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to create tag'
    console.error('Create tag error:', err)
  } finally {
    isSubmitting.value = false
  }
}

const handleClose = () => {
  emit('close')
}

const clearError = () => {
  error.value = null
}

// Focus management
const skuInputRef = ref<HTMLInputElement>()

const focusSkuInput = async () => {
  await nextTick()
  skuInputRef.value?.focus()
}

onMounted(() => {
  // Pre-load available items for better UX
  loadAvailableItems()
  
  if (currentStep.value === 2) {
    focusSkuInput()
  }
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <h3>
              <q-icon name="local_offer" class="q-mr-sm" />
              Create New Tags
            </h3>
            <div class="step-indicator">
              Step {{ currentStep }} of {{ totalSteps }}
            </div>
          </div>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <!-- Progress Bar -->
        <div class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
            ></div>
          </div>
          <div class="step-labels">
            <span :class="{ active: currentStep >= 1, completed: currentStep > 1 }">Tag Details</span>
            <span :class="{ active: currentStep >= 2, completed: currentStep > 2 }">Add Items</span>
            <span :class="{ active: currentStep >= 3 }">Review & Create</span>
          </div>
        </div>

        <div class="modal-body">
          <!-- Error Display -->
          <div v-if="error" class="alert alert-danger">
            {{ error }}
            <button type="button" class="btn-close" @click="clearError">&times;</button>
          </div>

          <!-- Step 1: Tag Details -->
          <div v-if="currentStep === 1" class="step-content">
            <h4>Configure Tag Details</h4>
            
            <!-- Tag Type Selection -->
            <div class="form-group">
              <label for="tag-type" class="form-label">Tag Type *</label>
              <select
                id="tag-type"
                v-model="tagDetails.tag_type"
                class="form-select"
                required
              >
                <option v-for="type in TAG_TYPES" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              <small class="form-text tag-description">
                {{ tagTypeDescription }}
              </small>
            </div>

            <!-- Customer/Reserved For Field -->
            <div class="form-group">
              <label for="customer-name" class="form-label">{{ customerFieldLabel }}</label>
              <input
                id="customer-name"
                v-model="tagDetails.customer_name"
                type="text"
                class="form-control"
                :placeholder="customerFieldPlaceholder"
                required
              />
            </div>

            <!-- Due Date (for reserved items) -->
            <div v-if="tagDetails.tag_type === 'reserved'" class="form-group">
              <label for="due-date" class="form-label">Expected Date (Optional)</label>
              <input
                id="due-date"
                v-model="tagDetails.due_date"
                type="date"
                class="form-control"
              />
              <small class="form-text">
                When this reservation is expected to be fulfilled
              </small>
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label for="notes" class="form-label">Notes (Optional)</label>
              <textarea
                id="notes"
                v-model="tagDetails.notes"
                class="form-control"
                rows="3"
                :placeholder="tagDetails.tag_type === 'broken' ? 'Describe the damage or issue...' : 
                             tagDetails.tag_type === 'imperfect' ? 'Describe the defect or cosmetic issue...' : 
                             'Additional notes about these tags...'"
              ></textarea>
            </div>
          </div>
          <!-- Step 2: Add Items -->
          <div v-if="currentStep === 2" class="step-content step-2-content">
            <h4>Add Items to Tag</h4>
            <p class="step-description">
              Scan SKU codes or browse & select items to add them to this {{ tagDetails.tag_type }} tag for <strong>{{ tagDetails.customer_name }}</strong>.
            </p>

            <!-- SKU Scanner -->
            <div class="scanner-section">
              <div class="form-group">
                <label for="sku-input" class="form-label">
                  <q-icon name="qr_code_scanner" class="q-mr-sm" />
                  Scan or Enter SKU Code
                </label>
                <div class="sku-input-container">
                  <input
                    ref="skuInputRef"
                    id="sku-input"
                    v-model="skuInput"
                    type="text"
                    class="form-control sku-input"
                    placeholder="Scan barcode or enter SKU code..."
                    @keyup.enter="handleSkuInput"
                    @focus="isScanning = true"
                    @blur="isScanning = false"
                  />
                  
                  <button 
                    type="button" 
                    class="btn btn-primary add-sku-btn"
                    @click="handleSkuInput"
                    :disabled="!skuInput.trim() || isScanning"
                  >
                    <span v-if="isScanning" class="spinner mr-2"></span>
                    Add
                  </button>
                </div>
                <small class="form-text">
                  <q-icon name="info" class="q-mr-xs" />
                  Press Enter or click Add after scanning/typing a SKU
                </small>
              </div>
            </div>

            <!-- Two-Panel Layout -->
            <div class="two-panel-layout">
              <!-- Left Panel: Item Browser -->
              <div class="item-browser-panel">
                <div class="panel-header">
                  <h5>
                    <q-icon name="inventory_2" class="q-mr-sm" />
                    Browse Items ({{ filteredItems.length }})
                  </h5>
                  <div class="panel-header-controls">
                    <button 
                      type="button" 
                      class="btn btn-sm btn-ghost legend-btn"
                      @click="showColorLegend = true"
                      title="Show color legend"
                    >
                      <q-icon name="palette" size="14px" />
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-sm btn-outline-primary"
                      @click="showItemSelector = !showItemSelector"
                    >
                      {{ showItemSelector ? 'Hide' : 'Show' }}
                    </button>
                  </div>
                </div>

                <div v-if="showItemSelector" class="panel-content">
                  <!-- Search & Filter Controls -->
                  <div class="browser-controls">
                    <div class="search-control">
                      <input
                        v-model="itemSearchQuery"
                        type="text"
                        class="form-control search-input"
                        placeholder="Search by name or location..."
                      />
                      <q-icon name="search" class="search-icon" />
                    </div>
                    <div class="filter-control">
                      <select
                        v-model="itemTypeFilter"
                        class="form-select filter-select"
                      >
                        <option v-for="option in productTypeOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- Items Grid -->
                  <div class="items-grid">
                    <div 
                      v-for="item in filteredItems" 
                      :key="item._id"
                      :class="['item-card', getItemProductTypeClass(item)]"
                      @click="addItemFromSelector(item)"
                    >
                      <div class="item-info">
                        <strong>{{ getItemDisplayName(item) }}</strong>
                        <div class="item-meta">
                          <span class="item-location">{{ item.location || 'No location' }}</span>
                          <span class="item-quantity">Qty: {{ item.quantity }}</span>
                        </div>
                      </div>
                      <div class="add-icon">
                        <q-icon name="add" />
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="filteredItems.length === 0" class="no-results">
                    <q-icon name="search_off" size="32px" color="grey" />
                    <p>No items found matching your search.</p>
                  </div>
                </div>
              </div>

              <!-- Right Panel: Selected Items -->
              <div class="selected-items-panel">
                <div class="panel-header">
                  <h5>
                    <q-icon name="shopping_cart" class="q-mr-sm" />
                    Selected Items ({{ totalTaggedItems }})
                  </h5>
                  <div v-if="totalTaggedItems > 0" class="panel-stats">
                    Total: {{ totalTaggedQuantity }} units
                  </div>
                </div>

                <div class="panel-content">
                  <div v-if="taggedItems.length > 0" class="selected-items-list">
                    <div 
                      v-for="(taggedItem, index) in taggedItems" 
                      :key="`selected-${taggedItem.item._id}-${index}`"
                      class="selected-item"
                    >
                      <div class="item-info">
                        <strong>{{ getItemDisplayName(taggedItem.item) }}</strong>
                        <div class="item-meta">
                          <span v-if="taggedItem.sku" class="sku-code">{{ taggedItem.sku.sku_code }}</span>
                          <span class="availability">Available: {{ taggedItem.item.availableQuantity || taggedItem.item.quantity }}</span>
                        </div>
                      </div>
                      <div class="item-controls">
                        <div class="quantity-controls">
                          <button 
                            type="button" 
                            class="qty-btn"
                            @click="updateItemQuantity(index, taggedItem.quantity - 1)"
                          >
                            <q-icon name="remove" size="12px" />
                          </button>
                          <input 
                            type="number" 
                            class="qty-input"
                            :value="taggedItem.quantity"
                            :max="taggedItem.item.availableQuantity || taggedItem.item.quantity"
                            min="1"
                            @input="updateItemQuantity(index, parseInt(($event.target as HTMLInputElement).value))"
                          />
                          <button 
                            type="button" 
                            class="qty-btn"
                            @click="updateItemQuantity(index, taggedItem.quantity + 1)"
                            :disabled="taggedItem.quantity >= (taggedItem.item.availableQuantity || taggedItem.item.quantity)"
                          >
                            <q-icon name="add" size="12px" />
                          </button>
                        </div>
                        <button 
                          type="button" 
                          class="remove-btn"
                          @click="removeTaggedItem(index)"
                        >
                          <q-icon name="close" size="14px" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="no-selection-message">
                    <q-icon name="add_shopping_cart" size="48px" color="grey" />
                    <p>No items selected yet.</p>
                    <small>Scan SKUs or browse items to get started.</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Review & Submit -->
          <div v-if="currentStep === 3" class="step-content">
            <h4>Review & Create Tags</h4>
            
            <!-- Tag Summary -->
            <div class="tag-summary">
              <div class="summary-header">
                <div class="tag-badge" :style="{ backgroundColor: getTagTypeColor(tagDetails.tag_type) }">
                  {{ TAG_TYPES.find(t => t.value === tagDetails.tag_type)?.label }}
                </div>
                <div class="summary-stats">
                  <span><strong>{{ totalTaggedItems }}</strong> items</span>
                  <span><strong>{{ totalTaggedQuantity }}</strong> total quantity</span>
                </div>
              </div>
              
              <div class="summary-details">
                <div class="detail-row">
                  <strong>{{ tagDetails.tag_type === 'reserved' ? 'Reserved For:' : 
                             tagDetails.tag_type === 'broken' ? 'Reported By:' : 
                             tagDetails.tag_type === 'imperfect' ? 'Noted By:' : 
                             'Tagged By:' }}</strong>
                  {{ tagDetails.customer_name }}
                </div>
                <div v-if="tagDetails.due_date" class="detail-row">
                  <strong>Expected Date:</strong>
                  {{ new Date(tagDetails.due_date).toLocaleDateString() }}
                </div>
                <div v-if="tagDetails.notes" class="detail-row">
                  <strong>Notes:</strong>
                  {{ tagDetails.notes }}
                </div>
              </div>
            </div>

            <!-- Items List -->
            <div class="review-items">
              <h5>Items to be Tagged</h5>
              <div class="review-items-list">
                <div 
                  v-for="(taggedItem, index) in taggedItems" 
                  :key="`review-${taggedItem.item._id}-${index}`"
                  class="review-item"
                >
                  <div class="item-info">
                    <strong>{{ getItemDisplayName(taggedItem.item) }}</strong>
                    <div class="item-details">
                      <span v-if="taggedItem.sku">SKU: {{ taggedItem.sku.sku_code }}</span>
                      <span>Location: {{ taggedItem.item.location || 'N/A' }}</span>
                    </div>
                  </div>
                  <div class="item-quantity">
                    <span class="quantity-badge">{{ taggedItem.quantity }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer">
          <button 
            v-if="currentStep > 1" 
            type="button" 
            class="btn btn-secondary" 
            @click="prevStep"
          >
            <q-icon name="arrow_back" class="q-mr-sm" />
            Back
          </button>
          
          <div class="flex-spacer"></div>
          
          <button type="button" class="btn btn-secondary" @click="handleClose">
            Cancel
          </button>
          
          <button
            v-if="currentStep < totalSteps"
            type="button"
            class="btn btn-primary"
            @click="nextStep"
            :disabled="(currentStep === 1 && !canProceedToStep2) || (currentStep === 2 && !canProceedToStep3)"
          >
            Next
            <q-icon name="arrow_forward" class="q-ml-sm" />
          </button>
          
          <button
            v-else
            type="button"
            class="btn btn-success"
            @click="handleSubmit"
            :disabled="isSubmitting || !canProceedToStep3"
          >
            <span v-if="isSubmitting" class="spinner mr-2"></span>
            {{ isSubmitting ? 'Creating Tags...' : 'Create Tags' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Color Legend Modal -->
    <div v-if="showColorLegend" class="legend-overlay" @click.self="showColorLegend = false">
      <div class="legend-modal">
        <div class="legend-header">
          <h4>
            <q-icon name="palette" class="q-mr-sm" />
            Product Type Colors
          </h4>
          <button class="close-button" @click="showColorLegend = false">&times;</button>
        </div>
        <div class="legend-content">
          <p class="legend-description">
            Each item has a colored left border that indicates its product type:
          </p>
          <div class="legend-items">
            <div class="legend-item">
              <div class="legend-color" style="background-color: #3b82f6;"></div>
              <span>Walls</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #06b6d4;"></div>
              <span>Toilets</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #8b5cf6;"></div>
              <span>Vanities</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #84cc16;"></div>
              <span>Bases</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #0ea5e9;"></div>
              <span>Tubs</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #f59e0b;"></div>
              <span>Shower Doors</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #6b7280;"></div>
              <span>Raw Materials</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #ec4899;"></div>
              <span>Accessories</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: #f97316;"></div>
              <span>Miscellaneous</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-dialog {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 900px;
  max-height: 95vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0.75rem 0.75rem 0 0;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-content h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  color: #111827;
}

.step-indicator {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.progress-container {
  padding: 1rem 1.5rem 0;
  background: #f9fafb;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.step-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.step-labels span {
  color: #9ca3af;
  transition: color 0.2s;
}

.step-labels span.active {
  color: #3b82f6;
}

.step-labels span.completed {
  color: #059669;
}

.modal-body {
  padding: 2rem 1.5rem 6rem 1.5rem;
  min-height: 400px;
}

.step-content h4 {
  margin-bottom: 0.5rem;
  color: #111827;
  font-weight: 600;
}

.step-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-control, .form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-control:focus, .form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-text {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.tag-description {
  font-style: italic;
}

/* SKU Scanner Styles */
.scanner-section {
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.sku-input-container {
  display: flex;
  gap: 0.75rem;
}

.sku-input {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 1.1rem;
}

.add-sku-btn {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
  min-width: 80px;
}

.add-sku-btn:hover:not(:disabled) {
  background: #2563eb;
}

.add-sku-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Two-Panel Layout Styles */
.step-2-content {
  max-height: 600px;
  overflow: visible;
}

.two-panel-layout {
  display: flex;
  gap: 1.5rem;
  margin-top: 1.5rem;
  height: 400px;
}

.item-browser-panel,
.selected-items-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: white;
  overflow: hidden;
}

.panel-header {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panel-header h5 {
  margin: 0;
  color: #111827;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.panel-stats {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.panel-header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Browser Controls */
.browser-controls {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.search-control {
  flex: 2;
  position: relative;
}

.search-input {
  padding-right: 2.5rem;
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}

.filter-control {
  flex: 1;
}

.filter-select {
  font-size: 0.875rem;
}

/* Items Grid */
.items-grid {
  flex: 1;
  overflow-y: auto;
}

.item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  border-left: 4px solid #10b981; /* Default green for stock items */
  cursor: pointer;
  transition: all 0.15s ease;
}

.item-card:hover {
  background-color: #f8fafc;
}

.item-card:last-child {
  border-bottom: none;
}

/* Product type color indicators */
.item-card.product-wall {
  border-left-color: #3b82f6; /* Blue for walls */
}

.item-card.product-toilet {
  border-left-color: #06b6d4; /* Cyan for toilets */
}

.item-card.product-vanity {
  border-left-color: #8b5cf6; /* Purple for vanities */
}

.item-card.product-base {
  border-left-color: #84cc16; /* Lime for bases */
}

.item-card.product-tub {
  border-left-color: #0ea5e9; /* Sky blue for tubs */
}

.item-card.product-shower-door {
  border-left-color: #f59e0b; /* Amber for shower doors */
}

.item-card.product-raw-material {
  border-left-color: #6b7280; /* Gray for raw materials */
}

.item-card.product-accessory {
  border-left-color: #ec4899; /* Pink for accessories */
}

.item-card.product-miscellaneous {
  border-left-color: #f97316; /* Orange for miscellaneous */
}

/* Default color for unknown product types */
.item-card:not([class*="product-"]) {
  border-left-color: #10b981; /* Default green */
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.item-info strong {
  color: #111827;
  font-size: 0.9rem;
  line-height: 1.3;
}

.item-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.item-location {
  font-style: italic;
}

.item-quantity {
  font-weight: 500;
}

.add-icon {
  width: 28px;
  height: 28px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.item-card:hover .add-icon {
  background: #059669;
  transform: scale(1.05);
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

.no-results p {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

/* Selected Items Panel */
.selected-items-list {
  flex: 1;
  overflow-y: auto;
}

.selected-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  gap: 1rem;
}

.selected-item:last-child {
  border-bottom: none;
}

.selected-item .item-info {
  flex: 1;
  min-width: 0;
}

.selected-item .item-info strong {
  font-size: 0.9rem;
  line-height: 1.3;
  word-break: break-word;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  width: 28px;
  height: 28px;
  background: #e5e7eb;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.qty-btn:hover:not(:disabled) {
  background: #d1d5db;
}

.qty-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qty-input {
  width: 50px;
  text-align: center;
  padding: 0.375rem 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #dc2626;
}

.no-selection-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

.no-selection-message p {
  margin: 0.5rem 0;
  font-size: 1rem;
  font-weight: 500;
}

.no-selection-message small {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Tagged Items Styles */
.tagged-items {
  margin-top: 2rem;
}

.tagged-items h5 {
  color: #111827;
  margin-bottom: 1rem;
  font-weight: 600;
}

.tagged-items-list {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.tagged-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.tagged-item:last-child {
  border-bottom: none;
}

.tagged-item .item-details {
  flex: 1;
}

.tagged-item .item-details strong {
  display: block;
  color: #111827;
  margin-bottom: 0.25rem;
}

.item-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.sku-code {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #3b82f6;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  width: 32px;
  height: 32px;
  background: #e5e7eb;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: background-color 0.15s ease;
}

.qty-btn:hover:not(:disabled) {
  background: #d1d5db;
}

.qty-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qty-input {
  width: 60px;
  text-align: center;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.remove-btn:hover {
  background: #dc2626;
}

.no-items-message {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

/* Review Styles */
.tag-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.tag-badge {
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.875rem;
}

.summary-stats {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.summary-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  color: #374151;
}

.review-items h5 {
  color: #111827;
  margin-bottom: 1rem;
  font-weight: 600;
}

.review-items-list {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.review-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.review-item:last-child {
  border-bottom: none;
}

.review-item .item-info strong {
  display: block;
  color: #111827;
  margin-bottom: 0.25rem;
}

.review-item .item-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.quantity-badge {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
}

.flex-spacer {
  flex: 1;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-outline-primary {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-outline-primary:hover {
  background: #3b82f6;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alert {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alert-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
}

/* Button Styles for Small Buttons */
.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.btn-ghost {
  background: transparent;
  color: #6b7280;
  border: none;
}

.btn-ghost:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Color Legend Modal */
.legend-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.legend-modal {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.legend-header h4 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  color: #111827;
}

.legend-content {
  padding: 1.25rem;
}

.legend-description {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.5;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.legend-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-item span {
  font-size: 0.9rem;
  color: #374151;
}
</style>
