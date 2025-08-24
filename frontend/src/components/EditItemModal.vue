<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { skuApi } from '@/utils/api'
import type { UpdateSKURequest } from '@/types'

interface Props {
  item: any // Flexible to handle different data structures from Dashboard
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const isUpdating = ref(false)
const error = ref<string | null>(null)

// Form data for SKU editing
const formData = ref<UpdateSKURequest>({
  name: '',
  description: '',
  brand: '',
  model: '',
  color: '',
  dimensions: '',
  finish: '',
  unit_cost: 0,
  barcode: '',
  notes: '',
  category_id: ''
})

const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')
const currentSkuId = ref('')

const initializeForm = () => {
  console.log('Initializing form with item:', props.item)
  console.log('SKU data available at item.sku:', props.item.sku)
  console.log('SKU data available at item.sku_id:', props.item.sku_id)
  
  let skuData = {}
  let skuId = ''
  
  // Check for populated sku field first (as used by InventoryTable)
  if (props.item.sku && typeof props.item.sku === 'object') {
    // SKU is populated in the sku field
    skuData = props.item.sku
    skuId = props.item.sku._id
    console.log('Using populated SKU data from item.sku:', skuData)
  } else if (typeof props.item.sku_id === 'object' && props.item.sku_id !== null) {
    // SKU is populated in the sku_id field
    skuData = props.item.sku_id
    skuId = props.item.sku_id._id
    console.log('Using populated SKU data from item.sku_id:', skuData)
  } else {
    // No populated SKU data found
    console.error('No populated SKU data found in item')
    error.value = 'No SKU data available for editing'
    return
  }
  
  // Store the SKU ID for submission
  currentSkuId.value = skuId
  
  // Determine category_id value, handling populated category objects
  let categoryId = ''
  if (skuData.category_id) {
    // If category_id is a string, use it directly; if it's an object, use its _id
    categoryId = typeof skuData.category_id === 'string' ? skuData.category_id : skuData.category_id._id || ''
  } else if (skuData.category) {
    // Fallback to category field for backward compatibility
    categoryId = typeof skuData.category === 'string' ? skuData.category : skuData.category._id || ''
  }
  
  console.log('Category ID resolution:', {
    original_category_id: skuData.category_id,
    original_category: skuData.category,
    resolved_category_id: categoryId
  })
  
  // Initialize form with SKU data
  formData.value = {
    name: skuData.name || '',
    description: skuData.description || '',
    brand: skuData.brand || '',
    model: skuData.model || '',
    color: skuData.color || '',
    dimensions: skuData.dimensions || '',
    finish: skuData.finish || '',
    unit_cost: skuData.unit_cost || props.item.average_cost || 0,
    barcode: skuData.barcode || '',
    notes: skuData.notes || '',
    category_id: categoryId
  }
  
  console.log('Initialized form data:', formData.value)
  console.log('Current SKU ID:', skuId)
}

const handleSubmit = async () => {
  try {
    isUpdating.value = true
    error.value = null
    
    if (!currentSkuId.value) {
      error.value = 'SKU ID not found'
      return
    }
    
    console.log('Submitting SKU update:', {
      skuId: currentSkuId.value,
      formData: formData.value
    })
    
    // Clean up form data - remove empty strings to avoid validation issues
    const cleanedData = Object.fromEntries(
      Object.entries(formData.value).filter(([_, value]) => {
        // Keep the value if it's not an empty string, or if it's a number (including 0)
        return value !== '' && value !== null && value !== undefined
      })
    )
    
    console.log('Cleaned form data:', cleanedData)
    console.log('Cleaned form data keys:', Object.keys(cleanedData))
    console.log('Cleaned form data values:', Object.values(cleanedData))
    
    // Update the SKU data using the SKU API
    await skuApi.updateSKU(currentSkuId.value, cleanedData)
    
    console.log('SKU updated successfully')
    emit('success')
  } catch (err: any) {
    console.error('Update SKU error:', err)
    console.error('Error response:', err.response)
    console.error('Error response data:', err.response?.data)
    console.error('Full error object:', JSON.stringify(err.response?.data, null, 2))
    
    // Extract detailed error message
    let errorMessage = 'Failed to update SKU'
    
    if (err.response?.data) {
      console.log('Processing error data:', err.response.data)
      
      if (err.response.data.message) {
        errorMessage = err.response.data.message
      } else if (err.response.data.error) {
        errorMessage = err.response.data.error
      } else if (err.response.data.details) {
        errorMessage = `Validation failed: ${JSON.stringify(err.response.data.details)}`
      } else if (err.response.data.errors) {
        errorMessage = `Validation errors: ${JSON.stringify(err.response.data.errors)}`
      } else {
        // Show the full response for debugging
        errorMessage = `Server error: ${JSON.stringify(err.response.data)}`
      }
    }
    
    error.value = errorMessage
  } finally {
    isUpdating.value = false
  }
}

const handleClose = () => {
  emit('close')
}

onMounted(() => {
  console.log('EditItemModal mounted with item:', props.item)
  console.log('Item SKU structure:', props.item.sku_id)
  initializeForm()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit SKU</h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-if="error" class="alert alert-danger">
              {{ error }}
            </div>

            <!-- SKU Code (Read-only) -->
            <div class="form-group">
              <label class="form-label">SKU Code</label>
              <div class="sku-code-display">
                <span class="sku-code-badge">
                  {{ (item.sku && item.sku.sku_code) || (item.sku_id && item.sku_id.sku_code) || 'No SKU' }}
                </span>
              </div>
            </div>

            <!-- Inventory Summary (Read-only) -->
            <div class="form-group">
              <label class="form-label">Inventory Information</label>
              <div class="inventory-info">
                <div class="info-item">
                  <span class="info-label">Total Quantity:</span>
                  <span class="info-value">{{ item.total_quantity }}</span>
                </div>
                <div v-if="item.primary_location" class="info-item">
                  <span class="info-label">Primary Location:</span>
                  <span class="info-value">{{ item.primary_location }}</span>
                </div>
                <div v-if="item.category" class="info-item">
                  <span class="info-label">Category:</span>
                  <span class="info-value">{{ item.category.name }}</span>
                </div>
              </div>
            </div>

            <!-- SKU Details -->
            <div class="form-group">
              <label for="name" class="form-label">Product Name *</label>
              <input
                id="name"
                v-model="formData.name"
                type="text"
                class="form-control"
                required
              />
            </div>

            <div class="form-group">
              <label for="description" class="form-label">Description</label>
              <textarea
                id="description"
                v-model="formData.description"
                class="form-control"
                rows="3"
                placeholder="Detailed product description..."
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="brand" class="form-label">Brand</label>
                <input
                  id="brand"
                  v-model="formData.brand"
                  type="text"
                  class="form-control"
                  placeholder="Brand name"
                />
              </div>

              <div class="form-group">
                <label for="model" class="form-label">Model</label>
                <input
                  id="model"
                  v-model="formData.model"
                  type="text"
                  class="form-control"
                  placeholder="Model number/name"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="color" class="form-label">Color</label>
                <input
                  id="color"
                  v-model="formData.color"
                  type="text"
                  class="form-control"
                  placeholder="Color name"
                />
              </div>

              <div class="form-group">
                <label for="dimensions" class="form-label">Dimensions</label>
                <input
                  id="dimensions"
                  v-model="formData.dimensions"
                  type="text"
                  class="form-control"
                  placeholder="e.g., 24x48 inches"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="finish" class="form-label">Finish</label>
              <input
                id="finish"
                v-model="formData.finish"
                type="text"
                class="form-control"
                placeholder="Surface finish or treatment"
              />
            </div>

            <div class="form-group">
              <label for="barcode" class="form-label">Barcode</label>
              <input
                id="barcode"
                v-model="formData.barcode"
                type="text"
                class="form-control"
                placeholder="Product barcode/UPC/EAN"
              />
              <small class="form-text text-muted">
                Used for barcode scanning and product identification
              </small>
            </div>

            <div v-if="canEditCost" class="form-group">
              <label for="unit-cost" class="form-label">Unit Cost (USD)</label>
              <input
                id="unit-cost"
                v-model.number="formData.unit_cost"
                type="number"
                class="form-control"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <small class="form-text text-muted">
                Cost per unit for this SKU
              </small>
            </div>

            <div class="form-group">
              <label for="notes" class="form-label">Notes</label>
              <textarea
                id="notes"
                v-model="formData.notes"
                class="form-control"
                rows="2"
                placeholder="Additional notes about this SKU..."
              ></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" @click="handleClose">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isUpdating"
              >
                <span v-if="isUpdating" class="spinner mr-2"></span>
                {{ isUpdating ? 'Updating...' : 'Update SKU' }}
              </button>
            </div>
          </form>
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
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6c757d;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-button:hover {
  color: #000;
}

.modal-body {
  padding: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-control,
.form-select {
  display: block;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  font-size: 1rem;
  line-height: 1.5;
  background-color: #fff;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus,
.form-select:focus {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.form-control:disabled {
  background-color: #e9ecef;
  opacity: 1;
}

.form-text {
  margin-top: 0.25rem;
  font-size: 0.875em;
  color: #6c757d;
}

.alert {
  padding: 0.75rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
}

.alert-danger {
  color: #721c24;
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

.btn {
  display: inline-block;
  font-weight: 400;
  text-align: center;
  text-decoration: none;
  vertical-align: middle;
  cursor: pointer;
  border: 1px solid transparent;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0.375rem;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.btn:disabled {
  pointer-events: none;
  opacity: 0.65;
}

.btn-secondary {
  color: #fff;
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5c636a;
  border-color: #565e64;
}

.btn-primary {
  color: #fff;
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.btn-primary:hover {
  background-color: #0b5ed7;
  border-color: #0a58ca;
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 0.125em solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spinner-border 0.75s linear infinite;
}

@keyframes spinner-border {
  to {
    transform: rotate(360deg);
  }
}

.mr-2 {
  margin-right: 0.5rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

/* SKU Code Display */
.sku-code-display {
  margin-top: 0.25rem;
}

.sku-code-badge {
  display: inline-block;
  background-color: #6f42c1;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* Inventory Information Display */
.inventory-info {
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: #f8f9fa;
  margin-top: 0.25rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: #495057;
}

.info-value {
  font-size: 0.875rem;
  color: #6c757d;
}


@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }
  
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .sku-info-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .sku-info-label {
    min-width: auto;
  }
}
</style>
