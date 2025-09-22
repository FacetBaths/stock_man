<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSKUStore } from '@/stores/sku'
import { tagApi } from '@/utils/api'
import type { Tag, SKU } from '@/types'

interface Props {
  tag: Tag
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const skuStore = useSKUStore()

// Component state
const isLoading = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<'adjust' | 'add' | 'remove'>('adjust')

// Form data for different operations
const adjustItems = ref<{ sku_id: string; current_quantity: number; new_quantity: number }[]>([])
const addItems = ref<{ sku_id: string; quantity: number; notes?: string }[]>([{ sku_id: '', quantity: 1, notes: '' }])
const removeItems = ref<{ sku_id: string; current_quantity: number; remove_quantity: number }[]>([])

// Available SKUs for adding
const availableSKUs = ref<SKU[]>([])
const skuSearch = ref('')

// Computed properties
const filteredSKUs = computed(() => {
  if (!skuSearch.value.trim()) return availableSKUs.value.slice(0, 20)
  
  const search = skuSearch.value.toLowerCase()
  return availableSKUs.value.filter(sku => 
    sku.sku_code.toLowerCase().includes(search) ||
    sku.name?.toLowerCase().includes(search) ||
    sku.description?.toLowerCase().includes(search)
  ).slice(0, 20)
})

const getSkuDisplayName = (sku: SKU) => {
  return `${sku.sku_code} - ${sku.name || sku.description || 'Unnamed SKU'}`
}

const initializeAdjustItems = () => {
  if (!props.tag.sku_items?.length) return
  
  adjustItems.value = props.tag.sku_items.map(item => ({
    sku_id: typeof item.sku_id === 'object' ? item.sku_id._id : item.sku_id,
    current_quantity: item.remaining_quantity || item.quantity || 0,
    new_quantity: item.remaining_quantity || item.quantity || 0
  }))
}

const initializeRemoveItems = () => {
  if (!props.tag.sku_items?.length) return
  
  removeItems.value = props.tag.sku_items.map(item => ({
    sku_id: typeof item.sku_id === 'object' ? item.sku_id._id : item.sku_id,
    current_quantity: item.remaining_quantity || item.quantity || 0,
    remove_quantity: 0
  }))
}

const loadAvailableSKUs = async () => {
  try {
    isLoading.value = true
    await skuStore.fetchSKUs({ include_inventory: false })
    availableSKUs.value = skuStore.skus || []
  } catch (err) {
    console.error('Failed to load SKUs:', err)
    error.value = 'Failed to load available SKUs'
  } finally {
    isLoading.value = false
  }
}

const addNewItem = () => {
  addItems.value.push({ sku_id: '', quantity: 1, notes: '' })
}

const removeAddItem = (index: number) => {
  if (addItems.value.length > 1) {
    addItems.value.splice(index, 1)
  }
}

const getSkuById = (skuId: string) => {
  return availableSKUs.value.find(sku => sku._id === skuId)
}

const getTagItemDisplayName = (skuItem: any) => {
  if (typeof skuItem.sku_id === 'object' && skuItem.sku_id) {
    return getSkuDisplayName(skuItem.sku_id)
  }
  
  const sku = getSkuById(skuItem.sku_id)
  return sku ? getSkuDisplayName(sku) : `SKU ID: ${skuItem.sku_id}`
}

const validateAdjustForm = () => {
  const hasChanges = adjustItems.value.some(item => 
    item.new_quantity !== item.current_quantity
  )
  
  if (!hasChanges) {
    error.value = 'No quantity changes detected'
    return false
  }
  
  const hasInvalid = adjustItems.value.some(item => 
    item.new_quantity < 0 || !Number.isInteger(item.new_quantity)
  )
  
  if (hasInvalid) {
    error.value = 'All quantities must be non-negative integers'
    return false
  }
  
  return true
}

const validateAddForm = () => {
  const validItems = addItems.value.filter(item => 
    item.sku_id && item.quantity > 0
  )
  
  if (validItems.length === 0) {
    error.value = 'Please select at least one SKU to add'
    return false
  }
  
  return true
}

const validateRemoveForm = () => {
  const validItems = removeItems.value.filter(item => 
    item.remove_quantity > 0
  )
  
  if (validItems.length === 0) {
    error.value = 'Please specify quantities to remove'
    return false
  }
  
  const hasInvalid = removeItems.value.some(item => 
    item.remove_quantity > item.current_quantity
  )
  
  if (hasInvalid) {
    error.value = 'Cannot remove more items than currently tagged'
    return false
  }
  
  return true
}

const handleAdjustQuantities = async () => {
  if (!validateAdjustForm()) return
  
  try {
    isSubmitting.value = true
    error.value = null
    
    const adjustments = adjustItems.value
      .filter(item => item.new_quantity !== item.current_quantity)
      .map(item => ({
        sku_id: item.sku_id,
        new_quantity: item.new_quantity
      }))
    
    await tagApi.adjustTagQuantities(props.tag._id, adjustments)
    emit('success')
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to adjust quantities'
    console.error('Adjust quantities error:', err)
  } finally {
    isSubmitting.value = false
  }
}

const handleAddItems = async () => {
  if (!validateAddForm()) return
  
  try {
    isSubmitting.value = true
    error.value = null
    
    const items = addItems.value.filter(item => 
      item.sku_id && item.quantity > 0
    )
    
    await tagApi.addTagItems(props.tag._id, items)
    emit('success')
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to add items'
    console.error('Add items error:', err)
  } finally {
    isSubmitting.value = false
  }
}

const handleRemoveItems = async () => {
  if (!validateRemoveForm()) return
  
  try {
    isSubmitting.value = true
    error.value = null
    
    const items = removeItems.value
      .filter(item => item.remove_quantity > 0)
      .map(item => ({
        sku_id: item.sku_id,
        quantity: item.remove_quantity
      }))
    
    await tagApi.removeTagItems(props.tag._id, items)
    emit('success')
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to remove items'
    console.error('Remove items error:', err)
  } finally {
    isSubmitting.value = false
  }
}

const handleSubmit = async () => {
  switch (activeTab.value) {
    case 'adjust':
      await handleAdjustQuantities()
      break
    case 'add':
      await handleAddItems()
      break
    case 'remove':
      await handleRemoveItems()
      break
  }
}

const clearError = () => {
  error.value = null
}

const handleClose = () => {
  emit('close')
}

// Watch for tab changes to reset error
watch(activeTab, () => {
  error.value = null
})

onMounted(() => {
  initializeAdjustItems()
  initializeRemoveItems()
  loadAvailableSKUs()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <q-icon name="edit_note" class="q-mr-sm" />
            Edit Tag Items
          </h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Tag Info -->
          <div class="tag-info">
            <div class="tag-title">
              <strong>{{ props.tag.customer_name }}</strong>
              <span class="tag-type">{{ props.tag.tag_type }}</span>
            </div>
            <div class="tag-meta">
              {{ props.tag.sku_items?.length || 0 }} items • 
              {{ props.tag.sku_items?.reduce((sum, item) => sum + (item.remaining_quantity || item.quantity || 0), 0) || 0 }} total quantity
            </div>
          </div>

          <!-- Tab Navigation -->
          <div class="tab-nav">
            <button 
              :class="['tab-button', { active: activeTab === 'adjust' }]"
              @click="activeTab = 'adjust'"
            >
              Adjust Quantities
            </button>
            <button 
              :class="['tab-button', { active: activeTab === 'add' }]"
              @click="activeTab = 'add'"
            >
              Add Items
            </button>
            <button 
              :class="['tab-button', { active: activeTab === 'remove' }]"
              @click="activeTab = 'remove'"
            >
              Remove Items
            </button>
          </div>

          <div v-if="error" class="alert alert-danger">
            {{ error }}
            <button type="button" class="btn-close" @click="clearError">&times;</button>
          </div>

          <!-- Adjust Quantities Tab -->
          <div v-if="activeTab === 'adjust'" class="tab-content">
            <div class="form-help">
              Adjust the quantity of existing items in this tag.
            </div>
            
            <div v-if="adjustItems.length === 0" class="empty-state">
              No items to adjust in this tag.
            </div>
            
            <div v-else class="items-list">
              <div v-for="(item, index) in adjustItems" :key="`adjust-${index}`" class="item-row">
                <div class="item-info">
                  <div class="item-name">{{ getTagItemDisplayName(props.tag.sku_items![index]) }}</div>
                  <div class="item-meta">Current: {{ item.current_quantity }}</div>
                </div>
                <div class="quantity-input">
                  <label :for="`adjust-qty-${index}`">New Quantity:</label>
                  <input
                    :id="`adjust-qty-${index}`"
                    v-model.number="item.new_quantity"
                    type="number"
                    min="0"
                    class="form-control"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Add Items Tab -->
          <div v-if="activeTab === 'add'" class="tab-content">
            <div class="form-help">
              Add new items to this tag from available inventory.
            </div>
            
            <div class="add-items-form">
              <div class="search-section">
                <label for="sku-search">Search SKUs:</label>
                <input
                  id="sku-search"
                  v-model="skuSearch"
                  type="text"
                  class="form-control"
                  placeholder="Search by SKU code, name, or description..."
                />
              </div>

              <div class="items-to-add">
                <div v-for="(item, index) in addItems" :key="`add-${index}`" class="add-item-row">
                  <div class="sku-select">
                    <label :for="`add-sku-${index}`">SKU:</label>
                    <select :id="`add-sku-${index}`" v-model="item.sku_id" class="form-select">
                      <option value="">Select a SKU...</option>
                      <option v-for="sku in filteredSKUs" :key="sku._id" :value="sku._id">
                        {{ getSkuDisplayName(sku) }}
                      </option>
                    </select>
                  </div>
                  <div class="quantity-input">
                    <label :for="`add-qty-${index}`">Quantity:</label>
                    <input
                      :id="`add-qty-${index}`"
                      v-model.number="item.quantity"
                      type="number"
                      min="1"
                      class="form-control"
                    />
                  </div>
                  <div class="notes-input">
                    <label :for="`add-notes-${index}`">Notes:</label>
                    <input
                      :id="`add-notes-${index}`"
                      v-model="item.notes"
                      type="text"
                      class="form-control"
                      placeholder="Optional notes..."
                    />
                  </div>
                  <div class="item-actions">
                    <button 
                      v-if="addItems.length > 1"
                      type="button" 
                      class="btn btn-sm btn-danger"
                      @click="removeAddItem(index)"
                    >
                      <q-icon name="delete" />
                    </button>
                  </div>
                </div>
                
                <button type="button" class="btn btn-sm btn-secondary" @click="addNewItem">
                  <q-icon name="add" /> Add Another Item
                </button>
              </div>
            </div>
          </div>

          <!-- Remove Items Tab -->
          <div v-if="activeTab === 'remove'" class="tab-content">
            <div class="form-help">
              Remove quantities from existing items in this tag.
            </div>
            
            <div v-if="removeItems.length === 0" class="empty-state">
              No items to remove from this tag.
            </div>
            
            <div v-else class="items-list">
              <div v-for="(item, index) in removeItems" :key="`remove-${index}`" class="item-row">
                <div class="item-info">
                  <div class="item-name">{{ getTagItemDisplayName(props.tag.sku_items![index]) }}</div>
                  <div class="item-meta">Available: {{ item.current_quantity }}</div>
                </div>
                <div class="quantity-input">
                  <label :for="`remove-qty-${index}`">Remove Quantity:</label>
                  <input
                    :id="`remove-qty-${index}`"
                    v-model.number="item.remove_quantity"
                    type="number"
                    min="0"
                    :max="item.current_quantity"
                    class="form-control"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="handleClose">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="isSubmitting || isLoading"
              @click="handleSubmit"
            >
              <span v-if="isSubmitting" class="spinner mr-2"></span>
              {{ isSubmitting ? 'Saving...' : 
                 activeTab === 'adjust' ? 'Update Quantities' :
                 activeTab === 'add' ? 'Add Items' : 'Remove Items' }}
            </button>
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
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
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
  display: flex;
  align-items: center;
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

.tag-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border-left: 4px solid #007bff;
}

.tag-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.tag-type {
  padding: 0.25rem 0.75rem;
  background-color: #007bff;
  color: white;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.tag-meta {
  color: #6c757d;
  font-size: 0.9rem;
}

.tab-nav {
  display: flex;
  border-bottom: 1px solid #dee2e6;
  margin-bottom: 1.5rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 500;
  color: #6c757d;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #007bff;
}

.tab-button.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.tab-content {
  min-height: 300px;
}

.form-help {
  padding: 1rem;
  background-color: #e7f3ff;
  border-radius: 0.375rem;
  color: #0056b3;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 2rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.item-meta {
  font-size: 0.8rem;
  color: #6c757d;
}

.quantity-input {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.quantity-input label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #495057;
}

.search-section {
  margin-bottom: 1.5rem;
}

.search-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.items-to-add {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.add-item-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr auto;
  gap: 1rem;
  align-items: end;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.sku-select,
.notes-input {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sku-select label,
.notes-input label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #495057;
}

.item-actions {
  display: flex;
  align-items: center;
}

.alert {
  position: relative;
  padding: 0.75rem 3rem 0.75rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
}

.alert-danger {
  color: #721c24;
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

.btn-close {
  position: absolute;
  top: 0.5rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.btn-close:hover {
  opacity: 1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }
  
  .add-item-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .item-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>