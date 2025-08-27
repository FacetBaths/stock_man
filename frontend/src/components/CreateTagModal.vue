<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { tagApi, inventoryApi, skuApi } from '@/utils/api'
import { TAG_TYPES } from '@/types'
import type { SKU, CreateTagRequest } from '@/types'

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()

interface TaggedSKU {
  sku: SKU
  quantity: number
  available_instances: number
  selection_method: 'fifo' | 'cost_based'
  notes: string
}

interface SKUInventory {
  sku: SKU
  total_quantity: number
  available_quantity: number
  reserved_quantity: number
  primary_location: string
  tag_summary: {
    reserved: number
    broken: number
    loaned: number
    totalTagged: number
  }
}

// Multi-step form state
const currentStep = ref(1)
const totalSteps = 3

// Step 1: Tag Details
const tagDetails = ref({
  tag_type: 'reserved' as const,
  customer_name: '',
  notes: '',
  due_date: '',
  project_name: ''
})

// Step 2: SKU Selection  
const taggedSKUs = ref<TaggedSKU[]>([])
const availableSKUs = ref<SKUInventory[]>([])
const skuInput = ref('')
const isScanning = ref(false)
const showSKUSelector = ref(true)
const skuSearchQuery = ref('')
const productTypeFilter = ref('all')
const isLoadingSKUs = ref(false)

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
    case 'loaned':
      return 'Loaned To (Name/Department) *'
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
    case 'loaned':
      return 'e.g., Installation Team, John Smith, Customer ABC'
    case 'stock':
    default:
      return 'e.g., Inventory Manager, Stock Team'
  }
})

const tagTypeDescription = computed(() => {
  switch (tagDetails.value.tag_type) {
    case 'stock':
      return 'Mark items as available stock (remove other tags)'
    case 'reserved':
      return 'Reserve items for a specific customer, project, or purpose'
    case 'broken':
      return 'Mark items as damaged and unsuitable for normal use'
    case 'imperfect':
      return 'Mark items with cosmetic defects but suitable for certain applications'
    case 'loaned':
      return 'Mark items as temporarily loaned out'
    default:
      return ''
  }
})

const canProceedToStep2 = computed(() => {
  return tagDetails.value.customer_name.trim().length > 0
})

const canProceedToStep3 = computed(() => {
  return taggedSKUs.value.length > 0 && taggedSKUs.value.every(ts => ts.quantity > 0)
})

const totalTaggedSKUs = computed(() => taggedSKUs.value.length)
const totalTaggedQuantity = computed(() => taggedSKUs.value.reduce((sum, ts) => sum + ts.quantity, 0))

// Filtered SKUs for browsing
const filteredSKUs = computed(() => {
  let filtered = availableSKUs.value
  
  // Filter by type
  if (productTypeFilter.value !== 'all') {
    filtered = filtered.filter(item => item.sku.product_type === productTypeFilter.value)
  }
  
  // Filter by search query
  if (skuSearchQuery.value.trim()) {
    const query = skuSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(item => {
      const skuName = getSKUDisplayName(item.sku).toLowerCase()
      const location = item.primary_location?.toLowerCase() || ''
      const skuCode = item.sku.sku_code?.toLowerCase() || ''
      return skuName.includes(query) || location.includes(query) || skuCode.includes(query)
    })
  }
  
  return filtered
})

// Product types for filter
const productTypeOptions = computed(() => {
  const uniqueTypes = [...new Set(availableSKUs.value.map(item => item.sku.product_type))]
  return [
    { label: 'All Types', value: 'all' },
    ...uniqueTypes.map(type => ({ 
      label: type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : 'Unknown', 
      value: type || 'unknown'
    }))
  ]
})

// Helper methods
const getSKUDisplayName = (sku: SKU): string => {
  if (sku.description && sku.description.trim()) {
    return `${sku.sku_code} - ${sku.description}`
  }
  return sku.sku_code || 'Unknown SKU'
}

const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find(t => t.value === tagType)
  return type?.color || '#6c757d'
}

const getSKUProductTypeClass = (sku: SKU) => {
  if (!sku.product_type) {
    return 'product-unknown'
  }
  
  const normalizedType = sku.product_type
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  
  return `product-${normalizedType}`
}

// SKU Scanning/Input - Updated for new architecture
const handleSkuInput = async () => {
  const skuCode = skuInput.value.trim().toUpperCase()
  if (!skuCode) return

  try {
    isScanning.value = true
    error.value = null

    // Check if SKU already added
    const existingIndex = taggedSKUs.value.findIndex(ts => 
      ts.sku.sku_code === skuCode
    )

    if (existingIndex >= 0) {
      // Increment quantity of existing SKU
      const tagged = taggedSKUs.value[existingIndex]
      if (tagged.quantity < tagged.available_instances) {
        tagged.quantity += 1
      } else {
        error.value = `Maximum available quantity (${tagged.available_instances}) already selected for ${skuCode}`
        setTimeout(() => error.value = null, 3000)
      }
      skuInput.value = ''
      return
    }

    // Look up SKU in available inventory
    const matchingSKU = availableSKUs.value.find(inv => 
      inv.sku.sku_code === skuCode && inv.available_quantity > 0
    )

    if (!matchingSKU) {
      error.value = `No available inventory found for SKU: ${skuCode}`
      setTimeout(() => error.value = null, 3000)
      return
    }

    // Add SKU to tagged list
    const taggedSKU: TaggedSKU = {
      sku: matchingSKU.sku,
      quantity: 1,
      available_instances: matchingSKU.available_quantity,
      selection_method: 'fifo', // Default to FIFO
      notes: ''
    }

    taggedSKUs.value.push(taggedSKU)
    skuInput.value = ''

  } catch (err: any) {
    error.value = err.response?.data?.message || 'SKU lookup failed'
    setTimeout(() => error.value = null, 3000)
  } finally {
    isScanning.value = false
  }
}

// Load available SKUs with inventory - Updated for new architecture
const loadAvailableSKUs = async () => {
  try {
    isLoadingSKUs.value = true
    error.value = null
    
    // Use inventory API to get SKUs with available inventory
    const response = await inventoryApi.getInventory({
      status: 'available',
      limit: 1000
    })
    
    if (response.inventory && Array.isArray(response.inventory)) {
      // Filter to only SKUs with available quantity > 0
      const availableInventory = response.inventory.filter(inv => inv.available_quantity > 0)
      
      availableSKUs.value = availableInventory.map(inv => ({
        sku: inv.sku,
        total_quantity: inv.total_quantity,
        available_quantity: inv.available_quantity,
        reserved_quantity: inv.reserved_quantity || 0,
        primary_location: inv.primary_location || 'Not specified',
        tag_summary: inv.tag_summary || {
          reserved: 0,
          broken: 0,
          loaned: 0,
          totalTagged: 0
        }
      }))
    } else {
      availableSKUs.value = []
    }
    
  } catch (err: any) {
    console.error('Load available SKUs error:', err)
    error.value = `Failed to load SKUs: ${err.message}`
  } finally {
    isLoadingSKUs.value = false
  }
}

const addSKUFromSelector = (skuInventory: SKUInventory) => {
  const existingIndex = taggedSKUs.value.findIndex(ts => ts.sku._id === skuInventory.sku._id)
  
  if (existingIndex >= 0) {
    const tagged = taggedSKUs.value[existingIndex]
    if (tagged.quantity < tagged.available_instances) {
      tagged.quantity += 1
    }
  } else {
    const taggedSKU: TaggedSKU = {
      sku: skuInventory.sku,
      quantity: 1,
      available_instances: skuInventory.available_quantity,
      selection_method: 'fifo',
      notes: ''
    }
    taggedSKUs.value.push(taggedSKU)
  }
}

const removeTaggedSKU = (index: number) => {
  taggedSKUs.value.splice(index, 1)
}

const updateSKUQuantity = (index: number, quantity: number) => {
  if (quantity <= 0) {
    removeTaggedSKU(index)
  } else {
    const tagged = taggedSKUs.value[index]
    tagged.quantity = Math.min(quantity, tagged.available_instances)
  }
}

const updateSelectionMethod = (index: number, method: 'fifo' | 'cost_based') => {
  taggedSKUs.value[index].selection_method = method
}

// Navigation
const nextStep = async () => {
  if (currentStep.value === 1 && canProceedToStep2.value) {
    currentStep.value = 2
    if (availableSKUs.value.length === 0) {
      await loadAvailableSKUs()
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

// Submit - Updated for new sku_items structure
const handleSubmit = async () => {
  if (!canProceedToStep3.value) return

  try {
    isSubmitting.value = true
    error.value = null

    // Create tag request with sku_items structure
    const submitData: CreateTagRequest = {
      tag_type: tagDetails.value.tag_type,
      customer_name: tagDetails.value.customer_name.trim(),
      notes: tagDetails.value.notes?.trim() || '',
      due_date: tagDetails.value.due_date || undefined,
      project_name: tagDetails.value.project_name?.trim() || '',
      sku_items: taggedSKUs.value.map(ts => ({
        sku_id: ts.sku._id,
        quantity: ts.quantity,
        notes: ts.notes || '',
        remaining_quantity: ts.quantity, // Initially same as quantity
        selection_method: ts.selection_method
      }))
    }

    // Create tag with new architecture

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

onMounted(() => {
  loadAvailableSKUs()
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
            <span :class="{ active: currentStep >= 2, completed: currentStep > 2 }">Select SKUs</span>
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

            <!-- Project Name -->
            <div class="form-group">
              <label for="project-name" class="form-label">Project Name (Optional)</label>
              <input
                id="project-name"
                v-model="tagDetails.project_name"
                type="text"
                class="form-control"
                placeholder="e.g., Kitchen Renovation, Bathroom Install"
              />
              <small class="form-text">
                Optional project or job name for better organization
              </small>
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

          <!-- Step 2: Select SKUs -->
          <div v-if="currentStep === 2" class="step-content step-2-content">
            <h4>Select SKUs to Tag</h4>
            <p class="step-description">
              Scan SKU codes or browse & select SKUs to add them to this {{ tagDetails.tag_type }} tag for <strong>{{ tagDetails.customer_name }}</strong>.
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
                    id="sku-input"
                    v-model="skuInput"
                    type="text"
                    class="form-control sku-input"
                    placeholder="Scan barcode or enter SKU code..."
                    @keyup.enter="handleSkuInput"
                    :disabled="isScanning"
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
              <!-- Left Panel: SKU Browser -->
              <div class="sku-browser-panel">
                <div class="panel-header">
                  <h5>
                    <q-icon name="inventory_2" class="q-mr-sm" />
                    Available SKUs ({{ filteredSKUs.length }})
                  </h5>
                  <div class="panel-header-controls">
                    <button 
                      type="button" 
                      class="btn btn-sm btn-outline-primary"
                      @click="showSKUSelector = !showSKUSelector"
                    >
                      {{ showSKUSelector ? 'Hide' : 'Show' }}
                    </button>
                  </div>
                </div>

                <div v-if="showSKUSelector" class="panel-content">
                  <!-- Search & Filter Controls -->
                  <div class="browser-controls">
                    <div class="search-control">
                      <input
                        v-model="skuSearchQuery"
                        type="text"
                        class="form-control search-input"
                        placeholder="Search SKUs by code, name, or location..."
                      />
                      <q-icon name="search" class="search-icon" />
                    </div>
                    <div class="filter-control">
                      <select
                        v-model="productTypeFilter"
                        class="form-select filter-select"
                      >
                        <option v-for="option in productTypeOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- SKUs Grid -->
                  <div v-if="isLoadingSKUs" class="loading-state">
                    <q-icon name="hourglass_empty" size="32px" />
                    <p>Loading available SKUs...</p>
                  </div>

                  <div v-else class="skus-grid">
                    <div 
                      v-for="skuInv in filteredSKUs" 
                      :key="skuInv.sku._id"
                      :class="['sku-card', getSKUProductTypeClass(skuInv.sku)]"
                      @click="addSKUFromSelector(skuInv)"
                    >
                      <div class="sku-info">
                        <strong>{{ getSKUDisplayName(skuInv.sku) }}</strong>
                        <div class="sku-meta">
                          <span class="sku-location">{{ skuInv.primary_location }}</span>
                          <span class="sku-quantity">Available: {{ skuInv.available_quantity }}</span>
                          <span v-if="skuInv.reserved_quantity > 0" class="reserved-quantity">
                            Reserved: {{ skuInv.reserved_quantity }}
                          </span>
                        </div>
                      </div>
                      <div class="add-icon">
                        <q-icon name="add" />
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="!isLoadingSKUs && filteredSKUs.length === 0" class="no-results">
                    <q-icon name="search_off" size="32px" color="grey" />
                    <p>No SKUs found matching your search.</p>
                  </div>
                </div>
              </div>

              <!-- Right Panel: Selected SKUs -->
              <div class="selected-skus-panel">
                <div class="panel-header">
                  <h5>
                    <q-icon name="shopping_cart" class="q-mr-sm" />
                    Selected SKUs ({{ totalTaggedSKUs }})
                  </h5>
                  <div v-if="totalTaggedSKUs > 0" class="panel-stats">
                    Total: {{ totalTaggedQuantity }} instances
                  </div>
                </div>

                <div class="panel-content">
                  <div v-if="taggedSKUs.length > 0" class="selected-skus-list">
                    <div 
                      v-for="(taggedSKU, index) in taggedSKUs" 
                      :key="`selected-${taggedSKU.sku._id}-${index}`"
                      class="selected-sku"
                    >
                      <div class="sku-info">
                        <strong>{{ getSKUDisplayName(taggedSKU.sku) }}</strong>
                        <div class="sku-meta">
                          <span class="sku-code">{{ taggedSKU.sku.sku_code }}</span>
                          <span class="availability">Available: {{ taggedSKU.available_instances }}</span>
                        </div>
                      </div>
                      
                      <div class="sku-controls">
                        <!-- Quantity Controls -->
                        <div class="quantity-controls">
                          <button 
                            type="button" 
                            class="qty-btn"
                            @click="updateSKUQuantity(index, taggedSKU.quantity - 1)"
                          >
                            <q-icon name="remove" size="12px" />
                          </button>
                          <input 
                            type="number" 
                            class="qty-input"
                            :value="taggedSKU.quantity"
                            :max="taggedSKU.available_instances"
                            min="1"
                            @input="updateSKUQuantity(index, parseInt(($event.target as HTMLInputElement).value))"
                          />
                          <button 
                            type="button" 
                            class="qty-btn"
                            @click="updateSKUQuantity(index, taggedSKU.quantity + 1)"
                            :disabled="taggedSKU.quantity >= taggedSKU.available_instances"
                          >
                            <q-icon name="add" size="12px" />
                          </button>
                        </div>
                        
                        <!-- Instance Selection Button (NEW) -->
                        <div v-if="taggedSKU.quantity > 1" class="instance-selection">
                          <button 
                            type="button" 
                            class="instance-btn"
                            @click="showInstancePicker(index)"
                            :class="{ 'selected': taggedSKU.selected_instance_ids && taggedSKU.selected_instance_ids.length > 0 }"
                          >
                            <q-icon name="precision_manufacturing" size="14px" />
                            {{ taggedSKU.selected_instance_ids?.length ? 'Edit' : 'Select' }} Instances
                          </button>
                        </div>

                        <!-- Selection Method -->
                        <div class="selection-method">
                          <select 
                            :value="taggedSKU.selection_method"
                            @change="updateSelectionMethod(index, ($event.target as HTMLSelectElement).value as 'auto' | 'fifo' | 'cost_based' | 'manual')"
                            class="method-select"
                            title="Instance selection method"
                          >
                            <option value="auto">Auto (FIFO)</option>
                            <option value="fifo">FIFO</option>
                            <option value="cost_based">Cost-based</option>
                            <option value="manual" :disabled="!taggedSKU.selected_instance_ids || taggedSKU.selected_instance_ids.length === 0">Manual</option>
                          </select>
                        </div>

                        <!-- Remove Button -->
                        <button 
                          type="button" 
                          class="remove-btn"
                          @click="removeTaggedSKU(index)"
                        >
                          <q-icon name="close" size="14px" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="no-selection-message">
                    <q-icon name="add_shopping_cart" size="48px" color="grey" />
                    <p>No SKUs selected yet.</p>
                    <small>Scan SKU codes or browse SKUs to get started.</small>
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
                  <span><strong>{{ totalTaggedSKUs }}</strong> SKUs</span>
                  <span><strong>{{ totalTaggedQuantity }}</strong> total instances</span>
                </div>
              </div>
              
              <div class="summary-details">
                <div class="detail-row">
                  <strong>{{ tagDetails.tag_type === 'reserved' ? 'Reserved For:' : 
                             tagDetails.tag_type === 'broken' ? 'Reported By:' : 
                             tagDetails.tag_type === 'imperfect' ? 'Noted By:' : 
                             tagDetails.tag_type === 'loaned' ? 'Loaned To:' :
                             'Tagged By:' }}</strong>
                  {{ tagDetails.customer_name }}
                </div>
                <div v-if="tagDetails.project_name" class="detail-row">
                  <strong>Project:</strong>
                  {{ tagDetails.project_name }}
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

            <!-- SKUs List -->
            <div class="review-skus">
              <h5>SKUs to be Tagged</h5>
              <div class="review-skus-list">
                <div 
                  v-for="(taggedSKU, index) in taggedSKUs" 
                  :key="`review-${taggedSKU.sku._id}-${index}`"
                  class="review-sku"
                >
                  <div class="sku-info">
                    <strong>{{ getSKUDisplayName(taggedSKU.sku) }}</strong>
                    <div class="sku-details">
                      <span>SKU: {{ taggedSKU.sku.sku_code }}</span>
                      <span>Selection: {{ taggedSKU.selection_method === 'fifo' ? 'FIFO (First-In-First-Out)' : 'Cost-based' }}</span>
                    </div>
                  </div>
                  <div class="sku-quantity">
                    <span class="quantity-badge">{{ taggedSKU.quantity }} instances</span>
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
  </div>
</template>

<style scoped>
/* Add all the styles from the previous component but adapted for SKU architecture */
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
  padding: 2rem 1.5rem;
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

/* Scanner and panel styles */
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

.two-panel-layout {
  display: flex;
  gap: 1.5rem;
  margin-top: 1.5rem;
  height: 400px;
}

.sku-browser-panel,
.selected-skus-panel {
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

.panel-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

.skus-grid {
  flex: 1;
  overflow-y: auto;
}

.sku-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  border-left: 4px solid #10b981;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sku-card:hover {
  background-color: #f8fafc;
}

.sku-card.product-wall {
  border-left-color: #3b82f6;
}

.sku-card.product-toilet {
  border-left-color: #06b6d4;
}

.sku-card.product-vanity {
  border-left-color: #8b5cf6;
}

.sku-card.product-base {
  border-left-color: #84cc16;
}

.sku-card.product-tub {
  border-left-color: #0ea5e9;
}

.sku-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sku-info strong {
  color: #111827;
  font-size: 0.9rem;
  line-height: 1.3;
}

.sku-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.sku-quantity {
  font-weight: 500;
  color: #059669;
}

.reserved-quantity {
  font-weight: 500;
  color: #dc2626;
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

.sku-card:hover .add-icon {
  background: #059669;
  transform: scale(1.05);
}

.selected-skus-list {
  flex: 1;
  overflow-y: auto;
}

.selected-sku {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  gap: 1rem;
}

.sku-controls {
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

.qty-input {
  width: 50px;
  text-align: center;
  padding: 0.375rem 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.method-select {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background: white;
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

/* Review styles */
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

.review-skus h5 {
  color: #111827;
  margin-bottom: 1rem;
  font-weight: 600;
}

.review-skus-list {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.review-sku {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.review-sku:last-child {
  border-bottom: none;
}

.review-sku .sku-details {
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

.sku-code {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #3b82f6;
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

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}
</style>
