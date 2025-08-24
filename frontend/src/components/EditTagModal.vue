<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { tagApi, inventoryApi } from '@/utils/api'
import { TAG_TYPES } from '@/types'
import type { UpdateTagRequest, Tag, Item } from '@/types'

interface Props {
  tag: Tag
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()

// Form data
const formData = ref<UpdateTagRequest>({
  customer_name: '',
  tag_type: 'reserved',
  notes: '',
  status: 'active',
  due_date: '',
  project_name: '',
  items: []
})

// Component state
const isLoading = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const availableItems = ref<Item[]>([])
const selectedItem = ref<Item | null>(null)

// Computed properties
const maxQuantityForSelectedItem = computed(() => {
  if (!selectedItem.value) return 1
  // For editing, we need to account for the current tag's quantity
  const currentTagQuantity = props.tag.quantity
  return selectedItem.value.quantity + currentTagQuantity
})

const customerFieldLabel = computed(() => {
  switch (formData.value.tag_type) {
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
  switch (formData.value.tag_type) {
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
  switch (formData.value.tag_type) {
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

const getItemDisplayName = (item: Item | string) => {
  if (typeof item === 'string') return 'Loading...'
  
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#28a745'
    case 'fulfilled': return '#17a2b8'
    case 'cancelled': return '#dc3545'
    default: return '#6c757d'
  }
}

const initializeForm = () => {
  formData.value = {
    customer_name: props.tag.customer_name,
    tag_type: props.tag.tag_type,
    notes: props.tag.notes || '',
    status: props.tag.status,
    due_date: props.tag.due_date ? new Date(props.tag.due_date).toISOString().split('T')[0] : '',
    project_name: props.tag.project_name || '',
    items: props.tag.items?.map(item => ({
      item_id: typeof item.item_id === 'object' ? item.item_id._id : item.item_id,
      quantity: item.quantity,
      remaining_quantity: item.remaining_quantity,
      notes: item.notes || ''
    })) || []
  }
}

const loadItemDetails = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    // For new architecture, we don't have a single item_id
    // Instead, we need to work with the items array
    // The backend should have already populated the item details
    // So we don't need to fetch anything extra here
    
    // Just set loading to false since we're using the populated tag data
    isLoading.value = false
  } catch (err: any) {
    error.value = err.message || 'Failed to load item details'
    console.error('Load item details error:', err)
  } finally {
    isLoading.value = false
  }
}

const validateForm = () => {
  if (!formData.value.customer_name?.trim()) {
    error.value = 'Please fill in the required field'
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return
  
  try {
    isSubmitting.value = true
    error.value = null
    
    const submitData: UpdateTagRequest = {
      customer_name: formData.value.customer_name?.trim(),
      tag_type: formData.value.tag_type,
      notes: formData.value.notes?.trim(),
      status: formData.value.status,
      due_date: formData.value.due_date || undefined,
      project_name: formData.value.project_name?.trim() || undefined,
      items: formData.value.items
    }
    
    await tagApi.updateTag(props.tag._id, submitData)
    emit('success')
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to update tag'
    console.error('Update tag error:', err)
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
  initializeForm()
  loadItemDetails()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <q-icon name="edit" class="q-mr-sm" />
            Edit Tag
          </h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-if="error" class="alert alert-danger">
              {{ error }}
              <button type="button" class="btn-close" @click="clearError">&times;</button>
            </div>

            <!-- Item Display (Read-only) -->
            <div class="form-group">
              <label class="form-label">Item</label>
              <div class="item-display">
                <div v-if="isLoading" class="loading-state">
                  <div class="spinner"></div>
                  Loading item details...
                </div>
                <div v-else-if="selectedItem" class="item-info">
                  <div class="item-name">{{ getItemDisplayName(selectedItem) }}</div>
                  <div class="item-details">
                    Type: {{ selectedItem.product_type.replace('_', ' ') }} | 
                    Location: {{ selectedItem.location || 'Not specified' }} |
                    Available Stock: {{ selectedItem.quantity }}
                  </div>
                </div>
                <div v-else class="text-muted">
                  Unable to load item details
                </div>
              </div>
            </div>

            <!-- Tag Type Selection -->
            <div class="form-group">
              <label for="tag-type" class="form-label">Tag Type *</label>
              <select
                id="tag-type"
                v-model="formData.tag_type"
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

            <!-- Status Selection -->
            <div class="form-group">
              <label for="status" class="form-label">Status *</label>
              <select
                id="status"
                v-model="formData.status"
                class="form-select"
                required
              >
                <option value="active">Active</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <small class="form-text">
                Change status to fulfilled when tag is completed, or cancelled if no longer needed
              </small>
            </div>

            <!-- Customer/Reserved For Field -->
            <div class="form-group">
              <label for="customer-name" class="form-label">{{ customerFieldLabel }}</label>
              <input
                id="customer-name"
                v-model="formData.customer_name"
                type="text"
                class="form-control"
                :placeholder="customerFieldPlaceholder"
                required
              />
            </div>

            <!-- Quantity -->
            <div class="form-group">
              <label for="quantity" class="form-label">Quantity *</label>
              <input
                id="quantity"
                v-model.number="formData.quantity"
                type="number"
                class="form-control"
                :min="1"
                :max="maxQuantityForSelectedItem"
                required
              />
              <small class="form-text">
                Maximum: {{ maxQuantityForSelectedItem }} (includes current tag quantity)
              </small>
            </div>

            <!-- Due Date (for reserved items) -->
            <div v-if="formData.tag_type === 'reserved'" class="form-group">
              <label for="due-date" class="form-label">Expected Date (Optional)</label>
              <input
                id="due-date"
                v-model="formData.due_date"
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
                v-model="formData.notes"
                class="form-control"
                rows="3"
                :placeholder="formData.tag_type === 'broken' ? 'Describe the damage or issue...' : 
                             formData.tag_type === 'imperfect' ? 'Describe the defect or cosmetic issue...' : 
                             'Additional notes about this tag...'"
              ></textarea>
            </div>

            <!-- Tag Preview -->
            <div v-if="selectedItem && formData.customer_name" class="tag-preview">
              <div class="preview-header">Tag Preview:</div>
              <div class="preview-content">
                <div class="preview-item">
                  <strong>Item:</strong> {{ getItemDisplayName(selectedItem) }}
                </div>
                <div class="preview-customer">
                  <strong>{{ formData.tag_type === 'reserved' ? 'Reserved For:' : 
                             formData.tag_type === 'broken' ? 'Reported By:' : 
                             formData.tag_type === 'imperfect' ? 'Noted By:' : 
                             'Tagged By:' }}</strong> {{ formData.customer_name }}
                </div>
                <div class="preview-details">
                  <span class="preview-quantity">Qty: {{ formData.quantity }}</span>
                  <span 
                    class="preview-tag-type" 
                    :style="{ backgroundColor: getTagTypeColor(formData.tag_type), color: 'white' }"
                  >
                    {{ TAG_TYPES.find(t => t.value === formData.tag_type)?.label }}
                  </span>
                  <span 
                    class="preview-status"
                    :style="{ backgroundColor: getStatusColor(formData.status), color: 'white' }"
                  >
                    {{ formData.status?.toUpperCase() }}
                  </span>
                  <span v-if="formData.due_date" class="preview-due-date">
                    Due: {{ new Date(formData.due_date).toLocaleDateString() }}
                  </span>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" @click="handleClose">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isSubmitting || isLoading"
              >
                <span v-if="isSubmitting" class="spinner mr-2"></span>
                {{ isSubmitting ? 'Updating...' : 'Update Tag' }}
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

.item-display {
  padding: 0.75rem;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-weight: 600;
  color: #212529;
}

.item-details {
  font-size: 0.875rem;
  color: #6c757d;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
}

.text-muted {
  color: #6c757d;
  font-style: italic;
}

.form-text {
  color: #6c757d;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.tag-description {
  font-style: italic;
  color: #495057;
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

.tag-preview {
  margin-top: 1.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.preview-header {
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.75rem;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item,
.preview-customer {
  color: #212529;
}

.preview-details {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.preview-quantity,
.preview-due-date {
  font-weight: 600;
  color: #495057;
}

.preview-tag-type,
.preview-status {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
  
  .modal-actions {
    flex-direction: column;
  }
  
  .preview-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .item-details {
    word-break: break-word;
  }
}
</style>
