<script setup lang="ts">
import { ref, computed } from 'vue'
import { barcodeApi, inventoryApi, instancesApi, skuApi } from '@/utils/api'
import type { SKU } from '@/types'
import AddItemModal from './AddItemModal.vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

interface ScannedItem {
  barcode: string
  sku?: SKU
  found: boolean
  quantity: number
  timestamp: Date
}

const barcodeInput = ref('')
const scannedItems = ref<ScannedItem[]>([])
const isLoading = ref(false)
const isProcessing = ref(false)
const error = ref<string | null>(null)
// Always use batch mode internally, but present as "Quick Scan" to users

// Add Item Modal state for creating SKUs
const showAddItemModal = ref(false)
const selectedBarcodeForSKU = ref('')

const canScan = computed(() => barcodeInput.value.trim().length > 0)
const foundItems = computed(() => scannedItems.value.filter(item => item.found))
const notFoundItems = computed(() => scannedItems.value.filter(item => !item.found))
const hasScannedItems = computed(() => scannedItems.value.length > 0)
const canProcess = computed(() => foundItems.value.length > 0)

const handleScan = async () => {
  const barcode = barcodeInput.value.trim()
  if (!barcode) return

  // Check if already scanned
  const existingItem = scannedItems.value.find(item => item.barcode === barcode)
  if (existingItem) {
    // Increment quantity for existing found items
    if (existingItem.found) {
      existingItem.quantity += 1
      barcodeInput.value = ''
      return
    }
    
    error.value = 'Barcode already scanned'
    setTimeout(() => { error.value = null }, 3000)
    barcodeInput.value = ''
    return
  }

  try {
    isLoading.value = true
    error.value = null
    
    // Use batch scan API (works for single items too)
    const response = await barcodeApi.batchScan({ barcodes: [barcode] })
    const foundItem = response.found.find(item => item.barcode === barcode)
    
    const newItem: ScannedItem = {
      barcode,
      sku: foundItem?.sku,
      found: !!foundItem,
      quantity: 1,
      timestamp: new Date()
    }
    
    scannedItems.value.unshift(newItem)
    
    // Clear input for next scan
    barcodeInput.value = ''
    
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Failed to scan barcode'
    console.error('Scan error:', err)
  } finally {
    isLoading.value = false
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleScan()
  }
}

const clearHistory = () => {
  scannedItems.value = []
  error.value = null
}

const removeItem = (index: number) => {
  scannedItems.value.splice(index, 1)
}

const processAllItems = async () => {
  if (!canProcess.value) return

  try {
    isProcessing.value = true
    error.value = null
    
    let totalCreated = 0
    let totalFailed = 0
    const results: string[] = []
    
    // Process each found item by creating Item instances
    for (const scannedItem of foundItems.value) {
      if (!scannedItem.sku) continue
      
      try {
        // Create multiple instances for the scanned quantity using instancesApi
        const response = await instancesApi.addStock({
          sku_id: scannedItem.sku._id,
          quantity: scannedItem.quantity,
          unit_cost: scannedItem.sku.unit_cost || 0,
          location: 'Scanned Location', // Could be made configurable
          notes: `Created from scan of ${scannedItem.barcode} on ${scannedItem.timestamp.toLocaleDateString()}`
        })
        
        totalCreated += response.instances?.length || scannedItem.quantity
        results.push(`${scannedItem.sku.sku_code}: Created ${scannedItem.quantity} items`)
      } catch (itemError: any) {
        console.error(`Failed to create items for ${scannedItem.sku?.sku_code}:`, itemError)
        totalFailed += scannedItem.quantity
        results.push(`${scannedItem.sku?.sku_code}: Failed - ${itemError.message}`)
      }
    }
    
    // Show summary message
    let message = 'Batch processing completed! '
    if (totalCreated > 0) {
      message += `Created ${totalCreated} new item instances. `
    }
    if (totalFailed > 0) {
      message += `Failed to create ${totalFailed} items.`
    }
    
    // Clear the scanned items on success
    scannedItems.value = []
    
    // Emit success to trigger inventory refresh
    emit('success')
    
    // Log detailed results
    console.log('Batch processing results:', {
      message,
      totalCreated,
      totalFailed,
      details: results
    })
    
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Failed to process batch items'
    console.error('Batch processing error:', err)
  } finally {
    isProcessing.value = false
  }
}

const formatSKUDescription = (sku: SKU): string => {
  if (!sku) return 'Unknown item'
  
  // If SKU has a description, use it
  if (sku.description && sku.description.trim()) {
    return sku.description
  }
  
  // Build description from name and brand/model
  if (sku.name && sku.name.trim()) {
    let desc = sku.name
    if (sku.brand) desc += ` - ${sku.brand}`
    if (sku.model) desc += ` ${sku.model}`
    return desc
  }
  
  // Otherwise, try to build from details object
  if (sku.details && typeof sku.details === 'object') {
    const details = sku.details as any
    
    // For product items (walls, etc.)
    if (details.product_line || details.color_name || details.dimensions) {
      return `${details.product_line || ''} ${details.color_name || ''} ${details.dimensions || ''}`.trim()
    }
    
    // For tools
    if (details.tool_type || details.manufacturer) {
      return `${details.tool_type || ''} ${details.manufacturer || ''}`.trim()
    }
  }
  
  // Fallback to SKU code
  return sku.sku_code || 'Unknown item'
}

const handleCreateSKUForBarcode = (barcode: string) => {
  selectedBarcodeForSKU.value = barcode
  showAddItemModal.value = true
}

const handleAddItemSuccess = async () => {
  showAddItemModal.value = false
  
  // Refresh the barcode lookup for the newly created SKU
  if (selectedBarcodeForSKU.value) {
    try {
      const response = await barcodeApi.batchScan({ barcodes: [selectedBarcodeForSKU.value] })
      const foundItem = response.found.find(item => item.barcode === selectedBarcodeForSKU.value)
      
      if (foundItem) {
        // Update the existing scanned item to mark it as found
        const existingIndex = scannedItems.value.findIndex(item => item.barcode === selectedBarcodeForSKU.value)
        if (existingIndex >= 0) {
          scannedItems.value[existingIndex].found = true
          scannedItems.value[existingIndex].sku = foundItem.sku
        }
      }
    } catch (error) {
      console.error('Failed to refresh barcode lookup:', error)
    }
    
    selectedBarcodeForSKU.value = ''
  }
  
  // Emit success to trigger inventory refresh
  emit('success')
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
          <h3>
            <q-icon name="qr_code_scanner" class="q-mr-sm" />
            Quick Scan
          </h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="error" class="alert alert-danger">
            {{ error }}
          </div>

          <!-- Scan Input -->
          <div class="scan-section">
            <div class="form-group">
              <label for="barcode-input" class="form-label">Scan or Enter Barcode</label>
              <div class="scan-input-group">
                <input
                  id="barcode-input"
                  ref="barcodeInputRef"
                  v-model="barcodeInput"
                  type="text"
                  class="form-control scan-input"
                  placeholder="Scan barcode or type manually..."
                  @keypress="handleKeyPress"
                  :disabled="isLoading"
                  autofocus
                />
                <button
                  type="button"
                  class="btn btn-primary scan-btn"
                  @click="handleScan"
                  :disabled="!canScan || isLoading"
                >
                  <span v-if="isLoading" class="spinner mr-2"></span>
                  {{ isLoading ? 'Scanning...' : 'Scan' }}
                </button>
              </div>
              <small class="form-text text-muted">
                Scan multiple items, adjust quantities, and process them all at once.
              </small>
            </div>
          </div>

          <!-- Scan Results -->
          <div v-if="hasScannedItems" class="results-section">
            <div class="results-header">
              <h4>Scanned Items ({{ scannedItems.length }})</h4>
              <div class="results-actions">
                <button 
                  v-if="canProcess"
                  type="button" 
                  class="btn btn-success btn-sm"
                  @click="processAllItems"
                  :disabled="isProcessing"
                >
                  <span v-if="isProcessing" class="spinner mr-2"></span>
                  {{ isProcessing ? 'Processing...' : `Process ${foundItems.length} Items` }}
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" @click="clearHistory">
                  Clear All
                </button>
              </div>
            </div>

            <!-- Summary -->
            <div class="batch-summary">
              <div class="summary-chips">
                <span class="summary-chip found">{{ foundItems.length }} found</span>
                <span class="summary-chip not-found">{{ notFoundItems.length }} not found</span>
                <span class="summary-chip total">{{ scannedItems.reduce((sum, item) => sum + (item.found ? item.quantity : 0), 0) }} total quantity</span>
              </div>
            </div>

            <div class="results-list">
              <div
                v-for="(item, index) in scannedItems"
                :key="index"
                class="result-item batch-mode"
                :class="{ 'found': item.found, 'not-found': !item.found }"
              >
                <div class="result-icon">
                  <q-icon
                    :name="item.found ? 'check_circle' : 'error'"
                    :class="item.found ? 'text-success' : 'text-danger'"
                    size="24px"
                  />
                </div>
                
                <div class="result-content">
                  <div class="result-header">
                    <div class="result-barcode">
                      <strong>{{ item.barcode }}</strong>
                      <span class="timestamp">{{ item.timestamp.toLocaleTimeString() }}</span>
                    </div>
                    
                    <!-- Quantity controls -->
                    <div v-if="item.found" class="quantity-controls">
                      <button 
                        type="button" 
                        class="quantity-btn"
                        @click="item.quantity = Math.max(1, item.quantity - 1)"
                      >
                        -
                      </button>
                      <input 
                        v-model.number="item.quantity" 
                        type="number" 
                        min="1" 
                        class="quantity-input"
                      />
                      <button 
                        type="button" 
                        class="quantity-btn"
                        @click="item.quantity += 1"
                      >
                        +
                      </button>
                    </div>
                    
                    <!-- Remove button -->
                    <div class="item-actions">
                      <button 
                        type="button" 
                        class="remove-btn"
                        @click="removeItem(index)"
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  <div v-if="item.found && item.sku" class="result-details">
                    <div class="sku-info">
                      <span class="sku-code">{{ item.sku.sku_code }}</span>
                      <span class="sku-description">{{ formatSKUDescription(item.sku) }}</span>
                    </div>
                  </div>
                  
                  <div v-else class="result-details">
                    <div class="not-found-info">
                      <span class="not-found-text">Barcode not found in system</span>
                      <button 
                        type="button" 
                        class="btn btn-sm btn-primary create-sku-btn"
                        @click="handleCreateSKUForBarcode(item.barcode)"
                      >
                        Create SKU
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="empty-state">
            <div class="empty-icon">
              <q-icon 
                name="qr_code_2"
                size="64px" 
                color="grey-5" 
              />
            </div>
            <h4>Ready to Scan</h4>
            <p>
              Focus the input field above and scan barcodes with your scanner, or type them manually.
            </p>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Add Item Modal for creating SKUs -->
  <AddItemModal
    v-if="showAddItemModal"
    :mode="'create'"
    :initial-barcode="selectedBarcodeForSKU"
    @close="showAddItemModal = false"
    @success="handleAddItemSuccess"
  />
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
  gap: 1rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.mode-switcher {
  display: flex;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  padding: 0.25rem;
}

.mode-btn {
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6c757d;
}

.mode-btn.active {
  background-color: #fff;
  color: #495057;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mode-btn:hover:not(.active) {
  color: #495057;
  background-color: rgba(0, 0, 0, 0.05);
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
  max-height: 60vh;
  overflow-y: auto;
}

.scan-section {
  margin-bottom: 2rem;
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

.scan-input-group {
  display: flex;
  gap: 0.5rem;
}

.form-control {
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

.form-control:focus {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.scan-input {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 1.1rem;
}

.scan-btn {
  min-width: 100px;
}

.form-text {
  margin-top: 0.25rem;
  font-size: 0.875em;
  color: #6c757d;
}

.results-section {
  border-top: 1px solid #dee2e6;
  padding-top: 1.5rem;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.results-header h4 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.results-actions {
  display: flex;
  gap: 0.5rem;
}

.batch-summary {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
}

.summary-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.summary-chip {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.summary-chip.found {
  background-color: #d1e7dd;
  color: #0f5132;
}

.summary-chip.not-found {
  background-color: #f8d7da;
  color: #721c24;
}

.summary-chip.total {
  background-color: #cff4fc;
  color: #055160;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.result-item.batch-mode {
  padding: 1.25rem;
}

.result-item.found {
  border-color: #198754;
  background-color: #f8fff9;
}

.result-item.not-found {
  border-color: #dc3545;
  background-color: #fff8f8;
}

.result-icon {
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.result-barcode {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-barcode strong {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 1rem;
}

.timestamp {
  font-size: 0.75rem;
  color: #6c757d;
  font-family: inherit;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  padding: 0.25rem;
}

.quantity-btn {
  background-color: #fff;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.quantity-btn:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.quantity-input {
  width: 3rem;
  text-align: center;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.item-actions {
  display: flex;
  align-items: flex-start;
}

.remove-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background-color: #c82333;
  transform: scale(1.1);
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sku-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sku-code {
  background-color: #6f42c1;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  width: fit-content;
}

.sku-description {
  color: #495057;
  font-size: 0.9rem;
}

.quantity-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.quantity {
  font-weight: 500;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-understocked {
  background-color: #f8d7da;
  color: #721c24;
}

.status-adequate {
  background-color: #d1e7dd;
  color: #0a3622;
}

.status-overstocked {
  background-color: #fff3cd;
  color: #664d03;
}

.not-found-text {
  color: #dc3545;
  font-style: italic;
}

.not-found-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.create-sku-btn {
  flex-shrink: 0;
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6c757d;
}

.empty-icon {
  margin-bottom: 1rem;
}

.empty-state h4 {
  margin-bottom: 0.5rem;
  color: #495057;
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

.btn-primary {
  color: #fff;
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0b5ed7;
  border-color: #0a58ca;
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

.btn-outline-secondary {
  color: #6c757d;
  background-color: transparent;
  border-color: #6c757d;
}

.btn-outline-secondary:hover {
  color: #fff;
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-success {
  color: #fff;
  background-color: #198754;
  border-color: #198754;
}

.btn-success:hover:not(:disabled) {
  background-color: #157347;
  border-color: #146c43;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.25rem;
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
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
}

.text-success {
  color: #198754 !important;
}

.text-danger {
  color: #dc3545 !important;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }
  
  .modal-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .scan-input-group {
    flex-direction: column;
  }
  
  .scan-btn {
    min-width: auto;
  }
  
  .results-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .results-actions {
    justify-content: stretch;
  }
  
  .results-actions .btn {
    flex: 1;
  }
  
  .result-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .quantity-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .summary-chips {
    justify-content: center;
  }
}
</style>
