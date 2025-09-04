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
}>({
  name: '',
  type: '',
  description: '',
  sort_order: 0,
  status: 'active'
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
const resetForm = () => {
  if (isEditing.value && props.category) {
    form.name = props.category.name
    form.type = props.category.type
    form.description = props.category.description || ''
    form.sort_order = props.category.sort_order
    form.status = props.category.status
  } else {
    form.name = ''
    form.type = ''
    form.description = ''
    form.sort_order = 0
    form.status = 'active'
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
        status: form.status
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
        status: 'active'
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
</style>
