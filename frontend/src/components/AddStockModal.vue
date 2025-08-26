<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { skuApi } from '@/utils/api'
import type { AddStockRequest, SKU } from '@/types'

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

// SKU-related state
const availableSKUs = ref<SKU[]>([])
const isLoadingSKUs = ref(false)

const formData = ref<AddStockRequest>({
  sku_id: '',
  quantity: 1,
  unit_cost: 0,
  location: '',
  supplier: '',
  reference_number: '',
  notes: ''
})

const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')

// Load all active SKUs
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

// Helper function to format SKU description
const formatSKUDescription = (sku: SKU): string => {
  if (!sku) return 'No description'
  
  // If SKU has a description, use it
  if (sku.description && sku.description.trim()) {
    return sku.description
  }
  
  // Build description from SKU name or category
  if (sku.name && sku.name.trim()) {
    return sku.name
  }
  
  // Fallback to SKU code
  return sku.sku_code || 'No description'
}

const handleSubmit = async () => {
  try {
    if (!formData.value.sku_id) {
      throw new Error('Please select a SKU')
    }
    
    await inventoryStore.addStock(formData.value)
    emit('success')
  } catch (error) {
    console.error('Add stock error:', error)
  }
}

const handleClose = () => {
  emit('close')
}

// Load SKUs on mount
onMounted(() => {
  loadSKUs()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Stock</h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-if="inventoryStore.error" class="alert alert-danger">
              {{ inventoryStore.error }}
            </div>

            <!-- SKU Selection -->
            <div class="form-group">
              <label for="sku" class="form-label">SKU *</label>
              <select
                id="sku"
                v-model="formData.sku_id"
                class="form-select"
                :disabled="isLoadingSKUs"
                required
              >
                <option value="">Select a SKU to add stock to...</option>
                <option v-if="isLoadingSKUs" disabled>Loading SKUs...</option>
                <option 
                  v-for="sku in availableSKUs" 
                  :key="sku._id" 
                  :value="sku._id"
                >
                  {{ sku.sku_code }} - {{ formatSKUDescription(sku) }}
                </option>
              </select>
              <small class="form-text text-muted">Select the SKU you want to add stock instances for</small>
            </div>

            <!-- Stock Details -->
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
              </div>
            </div>

            <div class="form-row">
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

              <div class="form-group">
                <label for="supplier" class="form-label">Supplier</label>
                <input
                  id="supplier"
                  v-model="formData.supplier"
                  type="text"
                  class="form-control"
                  placeholder="e.g., ABC Supply Co."
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
                placeholder="e.g., PO#12345, Invoice#INV-001"
              />
              <small class="form-text text-muted">Optional: Purchase order, invoice, or receipt number</small>
            </div>

            <div class="form-group">
              <label for="notes" class="form-label">Notes</label>
              <textarea
                id="notes"
                v-model="formData.notes"
                class="form-control"
                rows="3"
                placeholder="Any additional notes about this stock receipt..."
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
                {{ inventoryStore.isCreating ? 'Adding Stock...' : 'Add Stock' }}
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
