<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { useCategoryStore } from '@/stores/category'
import { skuApi } from '@/utils/api'
import { formatCategoryName } from '@/utils/formatting'
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

const route = useRoute()
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
  
  // SKU creation fields - Tool specific defaults
  sku_code: '',
  category_id: '', // Will be auto-filled with tool category if available
  name: '',
  description: '',
  brand: '',
  model: '',
  
  // Tool-specific details
  tool_type: '',
  manufacturer: '',
  serial_number: '',
  voltage: '',
  features: [] as string[],
  
  // Standard fields
  unit_cost: 0,
  barcode: props.initialBarcode || '',
  notes: '',
  
  // Instance creation fields
  quantity: 1,
  location: 'Tool Storage',
  supplier: '',
  reference_number: ''
})

const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')

// Get only tool categories
const toolCategories = computed(() => {
  return categoryStore.categories
    .filter(cat => cat.type === 'tool' && cat.status === 'active')
    .map(cat => ({
      value: cat._id,
      label: formatCategoryName(cat.displayName || cat.name)
    }))
})

// Get tool type options from database categories (Category.name)
const toolTypeOptions = computed(() => {
  return categoryStore.categories
    .filter(cat => cat.type === 'tool' && cat.status === 'active')
    .map(cat => formatCategoryName(cat.name || cat.displayName || 'Unnamed'))
    .sort()
})

// Load tool SKUs only for add_stock mode
const loadToolSKUs = async () => {
  try {
    isLoadingSKUs.value = true
    const response = await skuApi.getSKUs({ 
      status: 'active',
      limit: 100
    })
    // Filter to only tool SKUs based on category
    const toolCategoryIds = categoryStore.categories
      .filter(cat => cat.type === 'tool')
      .map(cat => cat._id)
    
    availableSKUs.value = response.skus.filter(sku => 
      sku.category && toolCategoryIds.includes(sku.category._id || sku.category_id)
    )
  } catch (error) {
    console.error('Failed to load tool SKUs:', error)
    availableSKUs.value = []
  } finally {
    isLoadingSKUs.value = false
  }
}

// Watch mode changes to load SKUs when needed
watch(mode, (newMode) => {
  if (newMode === 'add_stock') {
    loadToolSKUs()
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
    console.log('🛠️ [AddToolModal] Starting tool submission...', { mode: mode.value })
    
    if (mode.value === 'create') {
      // Create new tool SKU with tool-specific details structure matching BACKEND_API_REFERENCE.md exactly
      const toolDetails = {
        tool_type: formData.value.tool_type,
        manufacturer: formData.value.manufacturer,
        serial_number: formData.value.serial_number,
        voltage: formData.value.voltage,
        features: formData.value.features,
        weight: null,
        specifications: {}
      }

      const createPayload = {
        sku_code: formData.value.sku_code,
        category_id: formData.value.category_id,
        name: formData.value.name,
        description: formData.value.description,
        brand: formData.value.brand,
        model: formData.value.model,
        details: toolDetails, // Tool-specific details go in details object as per backend spec
        unit_cost: formData.value.unit_cost,
        currency: 'USD',
        barcode: formData.value.barcode,
        quantity: formData.value.quantity,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number,
        notes: formData.value.notes
      }
      
      console.log('🛠️ [AddToolModal] Creating tool with payload:', createPayload)
      const result = await inventoryStore.createItem(createPayload)
      console.log('✅ [AddToolModal] Tool created successfully:', result)
      
    } else {
      // Add stock to existing tool SKU
      if (!formData.value.existing_sku_id) {
        throw new Error('Please select a tool SKU')
      }
      
      // Add stock to existing tool SKU using exact Instance API specification
      const addStockPayload = {
        sku_id: formData.value.existing_sku_id,
        quantity: formData.value.quantity,
        unit_cost: formData.value.unit_cost,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number,
        notes: formData.value.notes
      }
      
      console.log('📦 [AddToolModal] Adding stock with payload:', addStockPayload)
      const result = await inventoryStore.addStock(addStockPayload)
      console.log('✅ [AddToolModal] Stock added successfully:', result)
    }
    
    console.log('🎉 [AddToolModal] Tool operation completed, emitting success')
    emit('success')
  } catch (error) {
    console.error('❌ [AddToolModal] Create/Add tool error:', error)
    // Log more detailed error info
    if (error.response) {
      console.error('❌ [AddToolModal] Server response:', error.response.data)
      console.error('❌ [AddToolModal] Status:', error.response.status)
    }
    if (error.request) {
      console.error('❌ [AddToolModal] Request failed:', error.request)
    }
  }
}

const handleClose = () => {
  emit('close')
}

// Initialize with tool-specific defaults
const initializeToolDefaults = () => {
  // If we have tool categories and none is selected, pick the first one
  if (toolCategories.value.length > 0 && !formData.value.category_id) {
    formData.value.category_id = toolCategories.value[0].value
  }
  
  // Set tool-specific defaults
  if (!formData.value.location) {
    formData.value.location = 'Tool Storage'
  }
}

// Load categories on component mount and initialize tool defaults
onMounted(async () => {
  await categoryStore.fetchCategories()
  initializeToolDefaults()
})

// Watch for categories to load and then initialize defaults
watch(() => categoryStore.categories, () => {
  initializeToolDefaults()
}, { immediate: false })
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <q-icon name="build" class="q-mr-sm text-primary" />
            Add Tool
          </h3>
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
                  <q-icon name="build" class="q-mr-sm" />
                  Create New Tool
                </button>
                <button
                  type="button"
                  :class="['mode-btn', { active: mode === 'add_stock' }]"
                  @click="mode = 'add_stock'"
                >
                  <q-icon name="inventory_2" class="q-mr-sm" />
                  Add Stock to Existing Tool
                </button>
              </div>
              <small class="form-text text-muted">
                {{ mode === 'create' 
                  ? 'Create a new tool and add initial stock' 
                  : 'Add stock to an existing tool' }}
              </small>
            </div>

            <!-- Existing Tool SKU Selection (add_stock mode only) -->
            <div v-if="mode === 'add_stock'" class="form-group">
              <label for="existing_sku_id" class="form-label">Select Tool *</label>
              <select
                id="existing_sku_id"
                v-model="formData.existing_sku_id"
                class="form-select"
                :disabled="isLoadingSKUs"
                required
              >
                <option value="">Select a tool to add stock to...</option>
                <option v-if="isLoadingSKUs" disabled>Loading tools...</option>
                <option 
                  v-for="sku in availableSKUs" 
                  :key="sku._id" 
                  :value="sku._id"
                >
                  {{ sku.sku_code }} - {{ formatSKUDescription(sku) }}
                </option>
              </select>
              <small class="form-text text-muted">Select the tool you want to add stock instances for</small>
            </div>

            <!-- Tool Creation Fields (create mode only) -->
            <div v-if="mode === 'create'">
              <!-- Basic Tool Information -->
              <div class="form-section">
                <h4 class="section-title">
                  <q-icon name="info" class="q-mr-sm" />
                  Basic Information
                </h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="name" class="form-label">Tool Name *</label>
                    <input
                      id="name"
                      v-model="formData.name"
                      type="text"
                      class="form-control"
                      placeholder="e.g., Circular Saw, Drill Press, Impact Driver"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label for="category_id" class="form-label">Tool Category *</label>
                    <select
                      id="category_id"
                      v-model="formData.category_id"
                      class="form-select"
                      required
                    >
                      <option value="">Select tool category...</option>
                      <option 
                        v-for="category in toolCategories" 
                        :key="category.value" 
                        :value="category.value"
                      >
                        {{ category.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="brand" class="form-label">Brand</label>
                    <input
                      id="brand"
                      v-model="formData.brand"
                      type="text"
                      class="form-control"
                      placeholder="e.g., DeWalt, Makita, Milwaukee"
                    />
                  </div>

                  <div class="form-group">
                    <label for="model" class="form-label">Model Number</label>
                    <input
                      id="model"
                      v-model="formData.model"
                      type="text"
                      class="form-control"
                      placeholder="e.g., DCS570B, XSH03Z"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="sku_code" class="form-label">SKU Code</label>
                  <input
                    id="sku_code"
                    v-model="formData.sku_code"
                    type="text"
                    class="form-control"
                    placeholder="Leave blank to auto-generate"
                  />
                  <small class="form-text text-muted">
                    Optional: Custom SKU code (will be auto-generated if left blank)
                  </small>
                </div>

                <div class="form-group">
                  <label for="description" class="form-label">Description</label>
                  <textarea
                    id="description"
                    v-model="formData.description"
                    class="form-control"
                    rows="2"
                    placeholder="Brief description of the tool's purpose and features"
                  ></textarea>
                </div>
              </div>

              <!-- Tool-Specific Details -->
              <div class="form-section">
                <h4 class="section-title">
                  <q-icon name="settings" class="q-mr-sm" />
                  Tool Specifications
                </h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="tool_type" class="form-label">Tool Type</label>
                    <select
                      id="tool_type"
                      v-model="formData.tool_type"
                      class="form-select"
                    >
                      <option value="">Select tool type...</option>
                      <option 
                        v-for="type in toolTypeOptions" 
                        :key="type" 
                        :value="type"
                      >
                        {{ type }}
                      </option>
                    </select>
                    <small class="form-text text-muted">Type of tool (based on database categories)</small>
                  </div>

                  <div class="form-group">
                    <label for="voltage" class="form-label">Voltage</label>
                    <input
                      id="voltage"
                      v-model="formData.voltage"
                      type="text"
                      class="form-control"
                      placeholder="e.g., 18V, 120V, Battery"
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="manufacturer" class="form-label">Manufacturer</label>
                    <input
                      id="manufacturer"
                      v-model="formData.manufacturer"
                      type="text"
                      class="form-control"
                      placeholder="Original manufacturer (if different from brand)"
                    />
                  </div>

                  <div class="form-group">
                    <label for="serial_number" class="form-label">Serial Number</label>
                    <input
                      id="serial_number"
                      v-model="formData.serial_number"
                      type="text"
                      class="form-control"
                      placeholder="Serial number (if applicable)"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="barcode" class="form-label">Barcode</label>
                  <input
                    id="barcode"
                    v-model="formData.barcode"
                    type="text"
                    class="form-control"
                    placeholder="Scan or enter barcode"
                  />
                </div>
              </div>
            </div>

            <!-- Stock Details (both modes) -->
            <div class="form-section">
              <h4 class="section-title">
                <q-icon name="inventory" class="q-mr-sm" />
                Stock Details
              </h4>
              
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
                  <small class="form-text text-muted">Number of tool instances to add</small>
                </div>

                <div v-if="canEditCost" class="form-group">
                  <label for="unit_cost" class="form-label">Unit Cost (USD) *</label>
                  <input
                    id="unit_cost"
                    v-model.number="formData.unit_cost"
                    type="number"
                    class="form-control"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                  <small class="form-text text-muted">Cost per tool</small>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="location" class="form-label">Storage Location</label>
                  <input
                    id="location"
                    v-model="formData.location"
                    type="text"
                    class="form-control"
                    placeholder="Tool Storage, Workshop A, Mobile Cart"
                  />
                </div>

                <div class="form-group">
                  <label for="supplier" class="form-label">Supplier</label>
                  <input
                    id="supplier"
                    v-model="formData.supplier"
                    type="text"
                    class="form-control"
                    placeholder="e.g., Home Depot, Tool Warehouse, Online"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="reference_number" class="form-label">Reference Number</label>
                <input
                  id="reference_number"
                  v-model="formData.reference_number"
                  type="text"
                  class="form-control"
                  placeholder="e.g., PO#12345, Receipt#RCP-001"
                />
                <small class="form-text text-muted">Optional: Purchase order, receipt, or invoice number</small>
              </div>

              <div class="form-group">
                <label for="notes" class="form-label">Notes</label>
                <textarea
                  id="notes"
                  v-model="formData.notes"
                  class="form-control"
                  rows="3"
                  placeholder="Any additional notes about this tool or purchase..."
                ></textarea>
              </div>
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
                <q-icon name="build" class="q-mr-sm" />
                {{ inventoryStore.isCreating ? 'Adding Tool...' : 'Add Tool' }}
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
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  background: linear-gradient(135deg, #1976d2, #1565c0);
  color: white;
  border-radius: 0.5rem 0.5rem 0 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-button:hover {
  color: white;
}

.modal-body {
  padding: 1.5rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e3f2fd;
}

.mode-selector {
  margin-bottom: 1.5rem;
}

.mode-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 0.375rem;
  background: white;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95rem;
  font-weight: 500;
}

.mode-btn:hover {
  border-color: #1976d2;
  color: #1976d2;
  background: #f8f9fa;
}

.mode-btn.active {
  border-color: #1976d2;
  background: #1976d2;
  color: white;
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
  border-color: #1976d2;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(25, 118, 210, 0.25);
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
  display: flex;
  align-items: center;
  justify-content: center;
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
  
  .mode-buttons {
    flex-direction: column;
  }
  
  .modal-dialog {
    max-width: 100%;
  }
}
</style>
