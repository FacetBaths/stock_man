<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import type { Item, UpdateItemRequest, WallDetails, ProductDetails } from '@/types'

interface Props {
  item: Item
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const inventoryStore = useInventoryStore()

const formData = ref<UpdateItemRequest>({
  quantity: 0,
  location: '',
  notes: '',
  product_details: {}
})

const isWallProduct = computed(() => props.item.product_type === 'wall')

const initializeForm = () => {
  formData.value = {
    quantity: props.item.quantity,
    location: props.item.location || '',
    notes: props.item.notes || '',
    product_details: { ...props.item.product_details }
  }
}

const handleSubmit = async () => {
  try {
    await inventoryStore.updateItem(props.item._id, formData.value)
    emit('success')
  } catch (error) {
    console.error('Update item error:', error)
  }
}

const handleClose = () => {
  emit('close')
}

onMounted(() => {
  initializeForm()
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Item</h3>
          <button class="close-button" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-if="inventoryStore.error" class="alert alert-danger">
              {{ inventoryStore.error }}
            </div>

            <!-- Product Type (Read-only) -->
            <div class="form-group">
              <label class="form-label">Product Type</label>
              <input
                type="text"
                class="form-control"
                :value="item.product_type.replace('_', ' ')"
                readonly
                disabled
              />
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
                class="btn btn-primary"
                :disabled="inventoryStore.isUpdating"
              >
                <span v-if="inventoryStore.isUpdating" class="spinner mr-2"></span>
                {{ inventoryStore.isUpdating ? 'Updating...' : 'Update Item' }}
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
