<template>
  <q-card class="category-form-card">
    <q-card-section class="q-pb-none">
      <div class="text-h6 q-mb-md">
        <q-icon :name="isEditing ? 'edit' : 'add_circle_outline'" class="q-mr-sm" />
        {{ isEditing ? 'Edit Category' : 'Add New Category' }}
      </div>
    </q-card-section>

    <q-form @submit="handleSubmit" class="category-form">
      <q-card-section>
        <!-- Name -->
        <q-input
          v-model="form.name"
          label="Category Name *"
          :rules="[val => !!val || 'Category name is required']"
          outlined
          dense
          class="q-mb-md"
          :loading="isSubmitting"
        />

        <!-- Type Selection -->
        <q-select
          v-model="form.type"
          :options="typeOptions"
          label="Category Type *"
          :rules="[val => !!val || 'Category type is required']"
          outlined
          dense
          emit-value
          map-options
          class="q-mb-md"
          :loading="isSubmitting"
        />


        <!-- Description -->
        <q-input
          v-model="form.description"
          label="Description"
          type="textarea"
          rows="3"
          outlined
          dense
          class="q-mb-md"
          :loading="isSubmitting"
        />

        <!-- Sort Order -->
        <q-input
          v-model.number="form.sort_order"
          label="Sort Order"
          type="number"
          outlined
          dense
          class="q-mb-md"
          :loading="isSubmitting"
          hint="Lower numbers appear first"
        />

        <!-- Color Picker -->
        <div class="q-mb-md">
          <div class="text-body2 q-mb-sm">Category Color</div>
          <div class="row items-center q-gutter-md">
            <q-input
              v-model="form.color"
              label="Color"
              outlined
              dense
              :rules="[val => /^#[0-9A-Fa-f]{6}$/.test(val) || 'Must be a valid hex color (e.g. #1976d2)']"
              placeholder="#1976d2"
              class="col-8"
            >
              <template v-slot:prepend>
                <q-icon name="palette" />
              </template>
            </q-input>
            <q-btn
              :style="{ backgroundColor: form.color, color: getContrastColor(form.color) }"
              round
              size="md"
              class="col-auto color-preview"
            >
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-color
                  v-model="form.color"
                  default-value="#1976d2"
                  no-header
                  no-footer
                  class="color-picker"
                />
              </q-popup-proxy>
              <q-tooltip>Click to pick color</q-tooltip>
            </q-btn>
          </div>
        </div>

        <!-- Status (only for editing) -->
        <q-select
          v-if="isEditing"
          v-model="form.status"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          emit-value
          map-options
          class="q-mb-md"
          :loading="isSubmitting"
        />
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-md q-pt-none">
        <q-btn 
          flat 
          label="Cancel" 
          @click="$emit('cancel')"
          :disable="isSubmitting"
        />
        <q-btn 
          type="submit"
          color="primary" 
          :label="isEditing ? 'Update' : 'Create'"
          :loading="isSubmitting"
        />
      </q-card-actions>
    </q-form>

    <!-- Error Display -->
    <q-banner v-if="error" class="bg-negative text-white q-ma-md">
      <template v-slot:avatar>
        <q-icon name="error" />
      </template>
      {{ error }}
    </q-banner>
  </q-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useCategoryStore } from '@/stores/category'
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/types'

const props = defineProps<{
  category?: Category | null
  mode: 'create' | 'edit'
}>()

const emit = defineEmits<{
  'submit': [category: Category]
  'cancel': []
}>()

// Store
const categoryStore = useCategoryStore()

// State
const form = reactive<{
  name: string
  type: 'product' | 'tool' | ''
  description: string
  sort_order: number
  status: 'active' | 'inactive'
  color: string
}>({
  name: '',
  type: '',
  description: '',
  sort_order: 0,
  status: 'active',
  color: '#1976d2'
})

const isSubmitting = ref(false)
const error = ref<string | null>(null)

// Computed
const isEditing = computed(() => props.mode === 'edit' && !!props.category)

const typeOptions = [
  { label: 'Product Category', value: 'product', description: 'For inventory products' },
  { label: 'Tool Category', value: 'tool', description: 'For tools and equipment' }
]

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
]

// Methods
const getContrastColor = (hexcolor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexcolor.slice(1, 3), 16)
  const g = parseInt(hexcolor.slice(3, 5), 16)
  const b = parseInt(hexcolor.slice(5, 7), 16)
  
  // Calculate relative luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? 'black' : 'white'
}

const resetForm = () => {
  if (isEditing.value && props.category) {
    form.name = props.category.name
    form.type = props.category.type
    form.description = props.category.description || ''
    form.sort_order = props.category.sort_order
    form.status = props.category.status
    form.color = props.category.color || '#1976d2'
  } else {
    form.name = ''
    form.type = ''
    form.description = ''
    form.sort_order = 0
    form.status = 'active'
    form.color = '#1976d2'
  }
  error.value = null
}

const handleSubmit = async () => {
  if (isSubmitting.value) return
  
  try {
    isSubmitting.value = true
    error.value = null
    
    if (isEditing.value && props.category) {
      // Update existing category
      const updateData: UpdateCategoryRequest = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        attributes: [],
        sort_order: form.sort_order,
        status: form.status,
        color: form.color
      }
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof UpdateCategoryRequest] === undefined) {
          delete updateData[key as keyof UpdateCategoryRequest]
        }
      })
      
      const response = await categoryStore.updateCategory(props.category._id, updateData)
      emit('submit', response.category)
    } else {
      // Create new category
      const createData: CreateCategoryRequest = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        attributes: [],
        sort_order: form.sort_order || 0,
        status: 'active',
        color: form.color
      }
      
      // Remove undefined values
      Object.keys(createData).forEach(key => {
        if (createData[key as keyof CreateCategoryRequest] === undefined) {
          delete createData[key as keyof CreateCategoryRequest]
        }
      })
      
      const response = await categoryStore.createCategory(createData)
      emit('submit', response.category)
    }
  } catch (err: any) {
    console.error('Category form submission error:', err)
    error.value = err.response?.data?.message || err.message || 'Failed to save category'
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  resetForm()
})

// Watch for category prop changes
watch(() => props.category, () => {
  resetForm()
}, { deep: true })

// Watch for mode changes
watch(() => props.mode, () => {
  resetForm()
})
</script>

<style scoped>
.category-form-card {
  min-width: 400px;
  max-width: 600px;
}

.category-form-card .category-form .q-field :deep(.q-field__control) {
  min-height: 48px;
}

.category-form-card .category-form .q-field :deep(.q-field__native) {
  min-height: 20px;
}

.category-form-card .category-form .q-textarea :deep(.q-field__native) {
  min-height: 60px;
}

/* Mobile adjustments */
@media (max-width: 599px) {
  .category-form-card {
    min-width: unset;
    width: 100%;
  }
  
  .category-form-card .category-form .q-card-section {
    padding: 16px 12px;
  }
  
  .category-form-card .category-form .q-card-actions {
    padding: 12px;
  }
}

/* Loading state styling */
.q-field--loading {
  opacity: 0.7;
}

/* Color picker styling */
.color-preview {
  border: 2px solid rgba(0, 0, 0, 0.12);
  min-width: 40px;
  min-height: 40px;
}

.color-preview:hover {
  border-color: rgba(0, 0, 0, 0.24);
}

.color-picker {
  min-width: 280px;
}
</style>
