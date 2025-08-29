<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { skuApi } from '@/utils/api'
import type { SKU, UpdateSKURequest } from '@/types'

interface Props {
  modelValue: boolean
  item: any // Flexible to handle different data structures from Dashboard
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const $q = useQuasar()
const authStore = useAuthStore()
const isUpdating = ref(false)
const error = ref<string | null>(null)

// Dialog visibility
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Form data for SKU editing
const formData = ref<UpdateSKURequest>({
  sku_code: '',
  category_id: '',
  name: '',
  description: '',
  brand: '',
  model: '',
  details: {
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: '',
    tool_type: '',
    manufacturer: '',
    serial_number: '',
    voltage: '',
    features: [],
    weight: 0,
    specifications: {}
  },
  unit_cost: 0,
  currency: 'USD',
  status: 'active',
  barcode: '',
  supplier_info: {
    supplier_name: '',
    supplier_sku: '',
    lead_time_days: 0
  },
  images: [],
  stock_thresholds: {
    understocked: 0,
    overstocked: 0
  }
})

const canEditCost = computed(() => authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager')
const currentSkuId = ref('')

// Status options
const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Discontinued', value: 'discontinued' }
]

const initializeForm = () => {
  console.log('🔍 EditItemModal: Initializing form with item:', props.item)

  // Return early if no item is provided
  if (!props.item) {
    console.log('🔍 EditItemModal: No item provided, skipping form initialization')
    return
  }

  console.log('🔍 EditItemModal: SKU data at item.sku:', props.item.sku)
  console.log('🔍 EditItemModal: SKU data at item.sku_id:', props.item.sku_id)
  console.log('🔍 EditItemModal: Item keys:', Object.keys(props.item))

  let skuData: SKU = {} as SKU
  let skuId = ''

  // Check for populated sku field first (as used by InventoryTable)
  if (props.item.sku && typeof props.item.sku === 'object') {
    // SKU is populated in the sku field
    skuData = props.item.sku
    skuId = props.item.sku._id
    console.log('✅ EditItemModal: Using populated SKU data from item.sku:', skuData)
    console.log('✅ EditItemModal: SKU ID:', skuId)
  } else if (typeof props.item.sku_id === 'object' && props.item.sku_id !== null) {
    // SKU is populated in the sku_id field
    skuData = props.item.sku_id
    skuId = props.item.sku_id._id
    console.log('✅ EditItemModal: Using populated SKU data from item.sku_id:', skuData)
    console.log('✅ EditItemModal: SKU ID:', skuId)
  } else {
    // No populated SKU data found
    console.error('❌ EditItemModal: No populated SKU data found in item')
    console.log('❌ EditItemModal: item.sku type:', typeof props.item.sku)
    console.log('❌ EditItemModal: item.sku_id type:', typeof props.item.sku_id)
    error.value = 'No SKU data available for editing'
    return
  }

  // Store the SKU ID for submission
  currentSkuId.value = skuId

  // Determine category_id value, handling populated category objects
  let categoryId = ''
  if (skuData.category_id) {
    // If category_id is a string, use it directly; if it's an object, use its _id
    categoryId = typeof skuData.category_id === 'string' ? skuData.category_id : skuData.category_id._id || ''
  } else if (skuData.category) {
    // Fallback to category field for backward compatibility
    categoryId = typeof skuData.category === 'string' ? skuData.category : skuData.category._id || ''
  } else if (props.item.category) {
    // Check if category is available at item level
    categoryId = typeof props.item.category === 'string' ? props.item.category : props.item.category._id || ''
  }

  // If we still don't have a category_id, try to find it in the SKU's details object
  if (!categoryId && skuData.details && skuData.details.category_id) {
    categoryId = typeof skuData.details.category_id === 'string' ? skuData.details.category_id : skuData.details.category_id._id || ''
  }

  console.log('Category ID resolution:', {
    original_category_id: skuData.category_id,
    original_category: skuData.category,
    resolved_category_id: categoryId
  })

  // Initialize form with SKU data - handle both root level and details object fields
  // Based on your SKU structure, some fields are at root level, some are in details
  console.log('Raw SKU details object:', skuData.details)

  // Handle unit_cost which might be a MongoDB number object
  let unitCost = 0
  if (typeof skuData.unit_cost === 'object' && skuData.unit_cost?.$numberInt) {
    unitCost = parseInt(skuData.unit_cost.$numberInt)
  } else if (typeof skuData.unit_cost === 'number') {
    unitCost = skuData.unit_cost
  } else if (props.item.average_cost) {
    unitCost = props.item.average_cost
  }

  console.clear()
  console.log('🔄 EditItemModal: Initializing form with SKU data:', skuData)
  formData.value = {
    // Root level fields from SKU
    name: skuData.name ||'SKU Product',
    description: skuData.description || '',
    brand: skuData.brand || '',
    model: skuData.model || '',

    // Details object - only category-specific fields (per SKU model schema)
    details: {
      // Wall-specific fields
      product_line: skuData.details?.product_line || '',
      color_name: skuData.details?.color_name || '',
      dimensions: skuData.details?.dimensions || '',
      finish: skuData.details?.finish || '',

      // Tool-specific fields
      tool_type: skuData.details?.tool_type || '',
      manufacturer: skuData.details?.manufacturer || '',
      serial_number: skuData.details?.serial_number || '',
      voltage: skuData.details?.voltage || '',
      features: skuData.details?.features || [],

      // Common fields
      weight: skuData.details?.weight || 0,
      specifications: skuData.details?.specifications || {}
    },

    unit_cost: unitCost,
    currency: skuData.currency || 'USD',
    barcode: skuData.barcode || '',
    status: skuData.status || 'active',
    // Only include category_id if it's valid, otherwise exclude it to avoid validation error
    ...(categoryId && categoryId !== '' ? { category_id: categoryId } : {})
  }

  console.log('Initialized form data:', formData.value)
  console.log('Current SKU ID:', skuId)
}

const handleSubmit = async () => {
  try {
    isUpdating.value = true
    error.value = null

    if (!currentSkuId.value) {
      error.value = 'SKU ID not found'
      return
    }

    console.log('Submitting SKU update:', {
      skuId: currentSkuId.value,
      formData: formData.value
    })

    // Clean up form data - remove empty strings to avoid validation issues
    const cleanedData = Object.fromEntries(
      Object.entries(formData.value).filter(([key, value]) => {
        // Always keep the details object even if it's empty
        if (key === 'details') {
          return true
        }
        // Keep the value if it's not an empty string, or if it's a number (including 0)
        return value !== '' && value !== null && value !== undefined
      })
    )

    console.log('Cleaned form data:', cleanedData)
    console.log('Cleaned form data keys:', Object.keys(cleanedData))
    console.log('Cleaned form data values:', Object.values(cleanedData))

    // Update the SKU data using the SKU API
    await skuApi.updateSKU(currentSkuId.value, cleanedData)

    console.log('SKU updated successfully')
    $q.notify({
      type: 'positive',
      message: 'SKU updated successfully'
    })
    emit('success')
    showDialog.value = false
  } catch (err: any) {
    console.error('Update SKU error:', err)
    console.error('Error response:', err.response)
    console.error('Error response data:', err.response?.data)
    console.error('Full error object:', JSON.stringify(err.response?.data, null, 2))

    // Extract detailed error message
    let errorMessage = 'Failed to update SKU'

    if (err.response?.data) {
      console.log('Processing error data:', err.response.data)

      if (err.response.data.message) {
        errorMessage = err.response.data.message
      } else if (err.response.data.error) {
        errorMessage = err.response.data.error
      } else if (err.response.data.details) {
        errorMessage = `Validation failed: ${JSON.stringify(err.response.data.details)}`
      } else if (err.response.data.errors) {
        errorMessage = `Validation errors: ${JSON.stringify(err.response.data.errors)}`
      } else {
        // Show the full response for debugging
        errorMessage = `Server error: ${JSON.stringify(err.response.data)}`
      }
    }

    error.value = errorMessage
    $q.notify({
      type: 'negative',
      message: errorMessage
    })
  } finally {
    isUpdating.value = false
  }
}

const handleClose = () => {
  showDialog.value = false
}

const onValidationError = () => {
  $q.notify({
    type: 'negative',
    message: 'Please correct the form errors'
  })
}

// Watch for dialog opening and item changes
watch(() => props.modelValue, (newValue) => {
  if (newValue && props.item) {
    console.log('🎯 EditItemModal: Dialog opened, initializing form')
    initializeForm()
  }
})

// Watch for item changes
watch(() => props.item, (newItem) => {
  if (newItem && props.modelValue) {
    console.log('🎯 EditItemModal: Item changed, reinitializing form')
    initializeForm()
  }
}, { deep: true })

onMounted(() => {
  console.log('EditItemModal mounted with item:', props.item)
  if (props.item) {
    console.log('Item SKU structure:', props.item.sku_id)
    // Only initialize on mount if dialog is already open
    if (props.modelValue) {
      initializeForm()
    }
  } else {
    console.log('No item provided to EditItemModal')
  }
})
</script>

<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 600px; max-width: 800px;">
      <q-card-section class="row items-center">
        <div class="text-h6">
          <q-icon name="edit" class="q-mr-sm" />
          Edit SKU
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" />
      </q-card-section>

      <q-separator />

      <q-form @submit="handleSubmit" @validation-error="onValidationError">
        <q-card-section>
          <div v-if="error" class="q-mb-md">
            <q-banner class="text-white bg-red">
              <q-icon name="error" class="q-mr-sm" />
              {{ error }}
            </q-banner>
          </div>

          <div class="row q-col-gutter-md">
            <!-- SKU Code (Read-only) -->
            <div v-if="item" class="col-12">
              <q-card flat bordered class="q-pa-md bg-grey-1">
                <div class="text-subtitle2 text-weight-medium q-mb-sm">
                  <q-icon name="qr_code" class="q-mr-xs" />
                  SKU Information
                </div>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <div class="text-caption text-grey-6">SKU Code</div>
                    <q-chip
                      :label="
                        (item.sku && item.sku.sku_code) ||
                        (item.sku_id && item.sku_id.sku_code) ||
                        'No SKU'
                      "
                      color="primary"
                      text-color="white"
                      icon="qr_code"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="text-caption text-grey-6">Total Quantity</div>
                    <div class="text-body1 text-weight-medium">
                      {{ item.total_quantity || 0 }}
                    </div>
                  </div>
                  <div v-if="item.primary_location" class="col-12 col-sm-6">
                    <div class="text-caption text-grey-6">Primary Location</div>
                    <div class="text-body1">{{ item.primary_location }}</div>
                  </div>
                  <div v-if="item.category" class="col-12 col-sm-6">
                    <div class="text-caption text-grey-6">Category</div>
                    <div class="text-body1">{{ item.category.name }}</div>
                  </div>
                </div>
              </q-card>
            </div>

            <!-- Product Name -->
            <div class="col-12">
              <q-input
                v-model="formData.name"
                label="Product Name *"
                outlined
                dense
                :rules="[(val: string) => !!val || 'Product name is required']"
              />
            </div>

            <!-- Description -->
            <div class="col-12">
              <q-input
                v-model="formData.description"
                label="Description"
                outlined
                dense
                type="textarea"
                rows="3"
                placeholder="Detailed product description..."
              />
            </div>

            <!-- Brand and Model -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.brand"
                label="Brand"
                outlined
                dense
                placeholder="Brand name"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.model"
                label="Model"
                outlined
                dense
                placeholder="Model number/name"
              />
            </div>

            <!-- Color and Dimensions -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.color_name"
                label="Color"
                outlined
                dense
                placeholder="Color name"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.dimensions"
                label="Dimensions"
                outlined
                dense
                placeholder="e.g., 24x48 inches"
              />
            </div>

            <!-- Finish -->
            <div class="col-12">
              <q-input
                v-model="formData.details.finish"
                label="Finish"
                outlined
                dense
                placeholder="Surface finish or treatment"
              />
            </div>

            <!-- Product Line and Tool Type -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.product_line"
                label="Product Line"
                outlined
                dense
                placeholder="Product line name"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.tool_type"
                label="Tool Type"
                outlined
                dense
                placeholder="Tool category"
              />
            </div>

            <!-- Barcode -->
            <div class="col-12">
              <q-input
                v-model="formData.barcode"
                label="Barcode"
                outlined
                dense
                placeholder="Product barcode/UPC/EAN"
                hint="Used for barcode scanning and product identification"
              />
            </div>

            <!-- Unit Cost (if authorized) -->
            <div v-if="canEditCost" class="col-12 col-sm-6">
              <q-input
                v-model.number="formData.unit_cost"
                label="Unit Cost"
                outlined
                dense
                type="number"
                min="0"
                step="0.01"
                prefix="$"
                placeholder="0.00"
                hint="Cost per unit for this SKU"
              />
            </div>

            <!-- Status -->
            <div class="col-12 col-sm-6">
              <q-select
                v-model="formData.status"
                label="Status"
                outlined
                dense
                :options="statusOptions"
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right">
          <q-btn flat color="grey-7" @click="handleClose">Cancel</q-btn>
          <q-btn color="primary" type="submit" :loading="isUpdating">
            Update SKU
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
