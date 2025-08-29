<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { useCategoryStore } from '@/stores/category'
import { skuApi } from '@/utils/api'
import type { CreateSKURequest, SKU } from '@/types'

interface Props {
  initialMode?: 'create' | 'add_stock'
  initialBarcode?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: 'create',
  initialBarcode: ''
})

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const inventoryStore = useInventoryStore()
const categoryStore = useCategoryStore()

// Mode toggle: 'create' for new SKU, 'add_stock' for existing SKU
const mode = ref<'create' | 'add_stock'>(props.initialMode)
const availableSKUs = ref<SKU[]>([])
const isLoadingSKUs = ref(false)

const formData = ref({
  // Mode selection
  existing_sku_id: '',
  
  // SKU creation fields (EXACT backend field names from FRONTEND_DEV_REFERENCE.md)
  sku_code: '', // Allow custom SKU codes (manufacturer SKUs)
  category_id: '',
  name: '',
  description: '',
  brand: '',
  model: '',
  color: '',
  dimensions: '',
  finish: '',
  unit_cost: 0,
  barcode: props.initialBarcode || '',
  notes: '',
  
  // Instance creation fields (EXACT backend field names)
  quantity: 1,
  location: '',
  supplier: '',
  reference_number: ''
})

const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')

// Load all active SKUs for add_stock mode
const loadSKUs = async () => {
  try {
    isLoadingSKUs.value = true
    const response = await skuApi.getSKUs({ 
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

// Watch mode changes to load SKUs when needed
watch(mode, (newMode) => {
  if (newMode === 'add_stock') {
    loadSKUs()
  }
}, { immediate: false })

// Helper function to format SKU description
const formatSKUDescription = (sku: SKU): string => {
  if (!sku) return 'No description'
  
  if (sku.description && sku.description.trim()) {
    return sku.description
  }
  
  if (sku.name && sku.name.trim()) {
    return sku.name
  }
  
  return sku.sku_code || 'No description'
}

const handleSubmit = async () => {
  try {
    if (mode.value === 'create') {
      // Create new SKU with instances using EXACT backend fields
      await inventoryStore.createItem({
        sku_code: formData.value.sku_code, // Custom SKU code support
        category_id: formData.value.category_id,
        name: formData.value.name,
        description: formData.value.description,
        brand: formData.value.brand,
        model: formData.value.model,
        color: formData.value.color,
        dimensions: formData.value.dimensions,
        finish: formData.value.finish,
        unit_cost: formData.value.unit_cost,
        barcode: formData.value.barcode,
        notes: formData.value.notes,
        quantity: formData.value.quantity,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number
      })
    } else {
      // Add stock to existing SKU using EXACT backend API
      if (!formData.value.existing_sku_id) {
        throw new Error('Please select a SKU')
      }
      
      await inventoryStore.addStock({
        sku_id: formData.value.existing_sku_id,
        quantity: formData.value.quantity,
        unit_cost: formData.value.unit_cost,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number,
        notes: formData.value.notes
      })
    }
    
    emit('success')
  } catch (error) {
    console.error('Create/Add item error:', error)
  }
}

const handleClose = () => {
  emit('close')
}

// Load categories on component mount
onMounted(() => {
  categoryStore.fetchCategories()
})
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

            <!-- Mode Selection -->
            <div class="form-group mode-selector">
              <label class="form-label">What would you like to do?</label>
              <div class="mode-buttons">
                <button
                  type="button"
                  :class="['mode-btn', { active: mode === 'create' }]"
                  @click="mode = 'create'"
                >
                  <q-icon name="add_circle" class="q-mr-sm" />
                  Create New SKU
                </button>
                <button
                  type="button"
                  :class="['mode-btn', { active: mode === 'add_stock' }]"
                  @click="mode = 'add_stock'"
                >
                  <q-icon name="inventory_2" class="q-mr-sm" />
                  Add Stock to Existing SKU
                </button>
              </div>
              <small class="form-text text-muted">
                {{ mode === 'create' 
                  ? 'Create a new product (SKU) and add initial stock' 
                  : 'Add stock to an existing product (SKU)' }}
              </small>
            </div>

            <!-- Existing SKU Selection (add_stock mode only) -->
            <div v-if="mode === 'add_stock'" class="form-group">
              <label for="existing_sku_id" class="form-label">Select SKU *</label>
              <select
                id="existing_sku_id"
                v-model="formData.existing_sku_id"
                class="form-select"
                :disabled="isLoadingSKUs"
                required
              >
                <option value="">{{ isLoadingSKUs ? 'Loading SKUs...' : 'Select a SKU...' }}</option>
                <option 
                  v-for="sku in availableSKUs" 
                  :key="sku._id" 
                  :value="sku._id"
                >
                  {{ sku.sku_code }} - {{ formatSKUDescription(sku) }}
                </option>
              </select>
              <small class="form-text text-muted">Choose the SKU you want to add stock to</small>
            </div>

            <!-- SKU Creation Fields (create mode only) -->
            <div v-if="mode === 'create'">
              <!-- SKU Code Field -->
              <div class="form-group">
                <label for="sku_code" class="form-label">SKU Code</label>
                <input
                  id="sku_code"
                  v-model="formData.sku_code"
                  type="text"
                  class="form-control"
                  placeholder="Enter custom SKU code or leave blank for auto-generation"
                />
                <small class="form-text text-muted">
                  Optional: Enter manufacturer's part number. If model number is provided, system will default to "FR-{model}". Leave blank for category-based auto-generation.
                </small>
              </div>

              <!-- Basic Product Details -->
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
                placeholder="Describe the product..."
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
                />
              </div>

              <div class="form-group">
                <label for="model" class="form-label">Model</label>
                <input
                  id="model"
                  v-model="formData.model"
                  type="text"
                  class="form-control"
                />
              </div>
            </div>

            <!-- Category and Barcode -->
            <div class="form-row">
              <div class="form-group">
                <label for="category_id" class="form-label">Category *</label>
                <select
                  id="category_id"
                  v-model="formData.category_id"
                  class="form-select"
                  :disabled="categoryStore.isLoading"
                  required
                >
                  <option value="">Select a category...</option>
                  <option v-if="categoryStore.isLoading" disabled>Loading categories...</option>
                  <option 
                    v-for="category in categoryStore.activeCategories" 
                    :key="category._id" 
                    :value="category._id"
                  >
                    {{ category.name }} ({{ category.type }})
                  </option>
                </select>
                <small class="form-text text-muted">Required: Category for this SKU</small>
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
                <small class="form-text text-muted">Optional: Barcode for this SKU</small>
              </div>
            </div>
            </div>

            <!-- Stock/Instance Fields (both modes) -->
            <div class="stock-section">
              <h4 class="section-title">{{ mode === 'create' ? 'Initial Stock' : 'Stock Details' }}</h4>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="quantity" class="form-label">Quantity *</label>
                  <input
                    id="quantity"
                    v-model.number="formData.quantity"
                    type="number"
                    class="form-control"
                    min="1"
                    required
                  />
                </div>

                <div v-if="canEditCost" class="form-group">
                  <label for="unit_cost" class="form-label">Unit Cost (USD)</label>
                  <input
                    id="unit_cost"
                    v-model.number="formData.unit_cost"
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

              <div class="form-row">
                <div class="form-group">
                  <label for="supplier" class="form-label">Supplier</label>
                  <input
                    id="supplier"
                    v-model="formData.supplier"
                    type="text"
                    class="form-control"
                    placeholder="Supplier name"
                  />
                </div>

                <div class="form-group">
                  <label for="reference_number" class="form-label">Reference #</label>
                  <input
                    id="reference_number"
                    v-model="formData.reference_number"
                    type="text"
                    class="form-control"
                    placeholder="PO#, Invoice#, etc."
                  />
                </div>
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

/* Mode Selector Styles */
.mode-selector {
  margin-bottom: 1.5rem;
}

.mode-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 0.375rem;
  background-color: #fff;
  color: #6c757d;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  border-color: #0d6efd;
  color: #0d6efd;
}

.mode-btn.active {
  border-color: #0d6efd;
  background-color: #0d6efd;
  color: #fff;
}

/* Section Titles */
.section-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.stock-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
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
