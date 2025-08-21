<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { PRODUCT_TYPES } from '@/types'
import { skuApi } from '@/utils/api'
import type { CreateItemRequest, WallDetails, ProductDetails, SKU } from '@/types'

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

// SKU-related state
const availableSKUs = ref<SKU[]>([])
const isLoadingSKUs = ref(false)
const selectedSKU = ref<string>('')

const formData = ref<CreateItemRequest>({
  product_type: 'wall',
  product_details: {
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: ''
  } as WallDetails,
  quantity: 0,
  location: '',
  notes: '',
  cost: undefined,
  sku_id: undefined,
  barcode: undefined
})

const isWallProduct = computed(() => formData.value.product_type === 'wall')
const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')

// Load SKUs for the selected product type
const loadSKUs = async () => {
  try {
    isLoadingSKUs.value = true
    const response = await skuApi.getSKUs({ 
      product_type: formData.value.product_type,
      status: 'active',
      limit: 100
    })
    availableSKUs.value = response.skus
  } catch (error) {
    console.error('Failed to load SKUs:', error)
    availableSKUs.value = []
  } finally {
    isLoadingSKUs.value = false
  }
}

// Watch for product type changes to reload SKUs
watch(() => formData.value.product_type, () => {
  selectedSKU.value = ''
  formData.value.sku_id = undefined
  loadSKUs()
}, { immediate: true })

// Helper function to format SKU description
const formatSKUDescription = (sku: SKU): string => {
  if (!sku) return 'No description'
  
  // If SKU has a description, use it
  if (sku.description && sku.description.trim()) {
    return sku.description
  }
  
  // Otherwise, try to build from populated product_details
  if (sku.product_details && typeof sku.product_details === 'object') {
    const details = sku.product_details as any
    
    if (sku.product_type === 'wall') {
      return `${details.product_line || ''} ${details.color_name || ''} ${details.dimensions || ''}`.trim()
    } else {
      return `${details.name || ''} ${details.brand || ''} ${details.model || ''}`.trim()
    }
  }
  
  // Fallback to product type
  return sku.product_type || 'No description'
}

// Watch for SKU selection changes
watch(() => selectedSKU.value, (newSKU) => {
  formData.value.sku_id = newSKU || undefined
})

// Reset product details when product type changes
watch(() => formData.value.product_type, (newType) => {
  if (newType === 'wall') {
    formData.value.product_details = {
      product_line: '',
      color_name: '',
      dimensions: '',
      finish: ''
    } as WallDetails
  } else {
    formData.value.product_details = {
      name: '',
      brand: '',
      model: '',
      color: '',
      dimensions: '',
      finish: '',
      description: ''
    } as ProductDetails
  }
})

const handleSubmit = async () => {
  try {
    await inventoryStore.createItem(formData.value)
    emit('success')
  } catch (error) {
    console.error('Create item error:', error)
  }
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add New Item</h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-if="inventoryStore.error" class="alert alert-danger">
              {{ inventoryStore.error }}
            </div>

            <!-- Product Type -->
            <div class="form-group">
              <label for="product-type" class="form-label">Product Type *</label>
              <select
                id="product-type"
                v-model="formData.product_type"
                class="form-select"
                required
              >
                <option v-for="type in PRODUCT_TYPES" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>

            <!-- Wall Product Fields -->
            <template v-if="isWallProduct">
              <div class="form-group">
                <label for="product-line" class="form-label">Product Line *</label>
                <input
                  id="product-line"
                  v-model="(formData.product_details as WallDetails).product_line"
                  type="text"
                  class="form-control"
                  required
                />
              </div>

              <div class="form-group">
                <label for="color-name" class="form-label">Color Name *</label>
                <input
                  id="color-name"
                  v-model="(formData.product_details as WallDetails).color_name"
                  type="text"
                  class="form-control"
                  required
                />
              </div>

              <div class="form-group">
                <label for="dimensions" class="form-label">Dimensions *</label>
                <input
                  id="dimensions"
                  v-model="(formData.product_details as WallDetails).dimensions"
                  type="text"
                  class="form-control"
                  placeholder="e.g., 24x48 inches"
                  required
                />
              </div>

              <div class="form-group">
                <label for="finish" class="form-label">Finish *</label>
                <input
                  id="finish"
                  v-model="(formData.product_details as WallDetails).finish"
                  type="text"
                  class="form-control"
                  required
                />
              </div>
            </template>

            <!-- Generic Product Fields -->
            <template v-else>
              <div class="form-group">
                <label for="name" class="form-label">Product Name *</label>
                <input
                  id="name"
                  v-model="(formData.product_details as ProductDetails).name"
                  type="text"
                  class="form-control"
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="brand" class="form-label">Brand</label>
                  <input
                    id="brand"
                    v-model="(formData.product_details as ProductDetails).brand"
                    type="text"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label for="model" class="form-label">Model</label>
                  <input
                    id="model"
                    v-model="(formData.product_details as ProductDetails).model"
                    type="text"
                    class="form-control"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="color" class="form-label">Color</label>
                  <input
                    id="color"
                    v-model="(formData.product_details as ProductDetails).color"
                    type="text"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label for="product-dimensions" class="form-label">Dimensions</label>
                  <input
                    id="product-dimensions"
                    v-model="(formData.product_details as ProductDetails).dimensions"
                    type="text"
                    class="form-control"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="product-finish" class="form-label">Finish</label>
                <input
                  id="product-finish"
                  v-model="(formData.product_details as ProductDetails).finish"
                  type="text"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label for="description" class="form-label">Description</label>
                <textarea
                  id="description"
                  v-model="(formData.product_details as ProductDetails).description"
                  class="form-control"
                  rows="3"
                ></textarea>
              </div>
            </template>

            <!-- Common Fields -->
            <div class="form-row">
              <div class="form-group">
                <label for="quantity" class="form-label">Quantity *</label>
                <input
                  id="quantity"
                  v-model.number="formData.quantity"
                  type="number"
                  class="form-control"
                  min="0"
                  required
                />
              </div>

              <div v-if="canEditCost" class="form-group">
                <label for="cost" class="form-label">Cost (USD)</label>
                <input
                  id="cost"
                  v-model.number="formData.cost"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div class="form-group">
                <label for="location" class="form-label">Location</label>
                <input
                  id="location"
                  v-model="formData.location"
                  type="text"
                  class="form-control"
                  placeholder="e.g., Warehouse A, Shelf 3"
                />
              </div>
            </div>

            <!-- SKU and Barcode Fields -->
            <div class="form-row">
              <div class="form-group">
                <label for="sku" class="form-label">Associated SKU</label>
                <select
                  id="sku"
                  v-model="selectedSKU"
                  class="form-select"
                  :disabled="isLoadingSKUs"
                >
                  <option value="">No SKU (Manual Entry)</option>
                  <option v-if="isLoadingSKUs" disabled>Loading SKUs...</option>
                  <option 
                    v-for="sku in availableSKUs" 
                    :key="sku._id" 
                    :value="sku._id"
                  >
                    {{ sku.sku_code }} - {{ formatSKUDescription(sku) }}
                  </option>
                </select>
                <small class="form-text text-muted">Optional: Link this item to an existing SKU for barcode scanning</small>
              </div>

              <div class="form-group">
                <label for="barcode" class="form-label">Barcode</label>
                <input
                  id="barcode"
                  v-model="formData.barcode"
                  type="text"
                  class="form-control"
                  placeholder="Enter barcode if available"
                />
                <small class="form-text text-muted">Optional: Add a custom barcode for this specific item</small>
              </div>
            </div>

            <div class="form-group">
              <label for="notes" class="form-label">Notes</label>
              <textarea
                id="notes"
                v-model="formData.notes"
                class="form-control"
                rows="2"
                placeholder="Any additional notes..."
              ></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" @click="handleClose">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-success"
                :disabled="inventoryStore.isCreating"
              >
                <span v-if="inventoryStore.isCreating" class="spinner mr-2"></span>
                {{ inventoryStore.isCreating ? 'Adding...' : 'Add Item' }}
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

.btn-success {
  color: #fff;
  background-color: #198754;
  border-color: #198754;
}

.btn-success:hover {
  background-color: #157347;
  border-color: #146c43;
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
}
</style>
