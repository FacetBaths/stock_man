<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 600px">
      <q-card-section class="row items-center">
        <div class="text-h6">
          {{ isEditing ? 'Edit SKU' : 'Create New SKU' }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-form @submit="onSubmit" @validation-error="onValidationError">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <!-- SKU Code -->
            <div class="col-12">
              <div class="row q-col-gutter-sm">
                <div class="col">
                  <q-input
                    v-model="form.sku_code"
                    label="SKU Code *"
                    outlined
                    dense
                    :rules="[val => !!val || 'SKU Code is required']"
                    :disable="isEditing"
                    @blur="validateSKUCode"
                  />
                </div>
                <div class="col-auto" v-if="!isEditing">
                  <q-btn
                    color="secondary"
                    label="Generate"
                    @click="generateSKUCode"
                    :loading="generating"
                    :disable="!form.product_type || !form.product_details"
                  />
                </div>
              </div>
            </div>

            <!-- Product Type -->
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.product_type"
                label="Product Type *"
                outlined
                dense
                :options="productTypeOptions"
                emit-value
                map-options
                :rules="[val => !!val || 'Product Type is required']"
                @update:model-value="onProductTypeChange"
              />
            </div>

            <!-- Product Details -->
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.product_details"
                label="Product Details *"
                outlined
                dense
                :options="productDetailsOptions"
                option-value="_id"
                option-label="name"
                emit-value
                map-options
                :rules="[val => !!val || 'Product Details is required']"
                :loading="loadingProducts"
              />
            </div>

            <!-- Manufacturer Model -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.manufacturer_model"
                label="Manufacturer Model"
                outlined
                dense
              />
            </div>

            <!-- Barcode -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.barcode"
                label="Barcode"
                outlined
                dense
              />
            </div>

            <!-- Current Cost -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model.number="form.current_cost"
                label="Current Cost"
                outlined
                dense
                type="number"
                step="0.01"
                min="0"
                prefix="$"
              />
            </div>

            <!-- Status (for editing only) -->
            <div class="col-12 col-sm-6" v-if="isEditing">
              <q-select
                v-model="form.status"
                label="Status"
                outlined
                dense
                :options="statusOptions"
                emit-value
                map-options
              />
            </div>

            <!-- Stock Thresholds -->
            <div class="col-12">
              <q-expansion-item label="Stock Thresholds" default-opened>
                <div class="row q-col-gutter-md q-pt-md">
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model.number="form.stock_thresholds.understocked"
                      label="Understocked Threshold"
                      outlined
                      dense
                      type="number"
                      min="0"
                      :rules="[val => val >= 0 || 'Must be non-negative']"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model.number="form.stock_thresholds.overstocked"
                      label="Overstocked Threshold"
                      outlined
                      dense
                      type="number"
                      min="0"
                      :rules="[val => val >= 0 || 'Must be non-negative']"
                    />
                  </div>
                </div>
              </q-expansion-item>
            </div>

            <!-- Description -->
            <div class="col-12">
              <q-input
                v-model="form.description"
                label="Description"
                outlined
                dense
                type="textarea"
                rows="3"
              />
            </div>

            <!-- Notes -->
            <div class="col-12">
              <q-input
                v-model="form.notes"
                label="Notes"
                outlined
                dense
                type="textarea"
                rows="2"
              />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right">
          <q-btn flat color="grey-7" @click="close">Cancel</q-btn>
          <q-btn 
            color="primary" 
            type="submit"
            :loading="saving"
          >
            {{ isEditing ? 'Update SKU' : 'Create SKU' }}
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useSKUStore } from '@/stores/sku'
import { inventoryApi } from '@/utils/api'
import { PRODUCT_TYPES, type SKU, type CreateSKURequest, type UpdateSKURequest } from '@/types'

interface Props {
  modelValue: boolean
  sku?: SKU | null
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const props = defineProps<Props>()

const $q = useQuasar()
const skuStore = useSKUStore()

// State
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.sku)
const saving = ref(false)
const generating = ref(false)
const loadingProducts = ref(false)
const productDetailsOptions = ref<any[]>([])

// Form data
const defaultForm = {
  sku_code: '',
  product_type: '',
  product_details: '',
  manufacturer_model: '',
  barcode: '',
  current_cost: 0,
  stock_thresholds: {
    understocked: 5,
    overstocked: 100
  },
  description: '',
  notes: '',
  status: 'active'
}

const form = ref({ ...defaultForm })

// Options
const productTypeOptions = PRODUCT_TYPES.map(type => ({
  label: type.label,
  value: type.value
}))

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Discontinued', value: 'discontinued' }
]

// Methods
const resetForm = () => {
  form.value = { ...defaultForm }
  productDetailsOptions.value = []
}

const loadProductDetails = async (productType: string) => {
  if (!productType) return
  
  try {
    loadingProducts.value = true
    const response = await inventoryApi.getItems({ product_type: productType, limit: 100 })
    
    // Get unique product details
    const uniqueProducts = new Map()
    response.items.forEach(item => {
      const details = item.product_details as any
      const key = JSON.stringify(details)
      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, {
          _id: item._id,
          name: details.name || `${details.product_line} ${details.color_name}` || `${productType} product`,
          ...details
        })
      }
    })
    
    productDetailsOptions.value = Array.from(uniqueProducts.values())
  } catch (error) {
    console.error('Error loading product details:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load product details'
    })
  } finally {
    loadingProducts.value = false
  }
}

const onProductTypeChange = (productType: string) => {
  form.value.product_details = ''
  loadProductDetails(productType)
}

const generateSKUCode = async () => {
  if (!form.value.product_type || !form.value.product_details) {
    $q.notify({
      type: 'warning',
      message: 'Please select product type and details first'
    })
    return
  }

  try {
    generating.value = true
    const skuCode = await skuStore.generateSKUCode({
      product_type: form.value.product_type,
      product_details: form.value.product_details
    })
    form.value.sku_code = skuCode
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to generate SKU code'
    })
  } finally {
    generating.value = false
  }
}

const validateSKUCode = async () => {
  if (!form.value.sku_code || isEditing.value) return
  
  // Check if SKU already exists
  const existing = skuStore.getSKUByCode(form.value.sku_code)
  if (existing) {
    $q.notify({
      type: 'warning',
      message: 'SKU code already exists'
    })
  }
}

const onSubmit = async () => {
  try {
    saving.value = true
    
    if (isEditing.value && props.sku) {
      // Update existing SKU
      const updates: UpdateSKURequest = {
        sku_code: form.value.sku_code,
        manufacturer_model: form.value.manufacturer_model,
        barcode: form.value.barcode,
        stock_thresholds: form.value.stock_thresholds,
        description: form.value.description,
        notes: form.value.notes,
        status: form.value.status
      }
      await skuStore.updateSKU(props.sku._id, updates)
      
      // Add cost if changed
      if (form.value.current_cost !== props.sku.current_cost) {
        await skuStore.addCost(props.sku._id, {
          cost: form.value.current_cost,
          notes: 'Updated from form'
        })
      }
    } else {
      // Create new SKU
      const skuData: CreateSKURequest = {
        sku_code: form.value.sku_code,
        product_type: form.value.product_type,
        product_details: form.value.product_details,
        manufacturer_model: form.value.manufacturer_model,
        barcode: form.value.barcode,
        current_cost: form.value.current_cost,
        stock_thresholds: form.value.stock_thresholds,
        description: form.value.description,
        notes: form.value.notes
      }
      await skuStore.createSKU(skuData)
    }
    
    emit('saved')
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to save SKU'
    })
  } finally {
    saving.value = false
  }
}

const onValidationError = () => {
  $q.notify({
    type: 'negative',
    message: 'Please correct the form errors'
  })
}

const close = () => {
  show.value = false
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    if (props.sku) {
      // Editing mode
      form.value = {
        sku_code: props.sku.sku_code,
        product_type: props.sku.product_type,
        product_details: typeof props.sku.product_details === 'string' 
          ? props.sku.product_details 
          : (props.sku.product_details as any)?._id || '',
        manufacturer_model: props.sku.manufacturer_model || '',
        barcode: props.sku.barcode || '',
        current_cost: props.sku.current_cost,
        stock_thresholds: { ...props.sku.stock_thresholds },
        description: props.sku.description || '',
        notes: props.sku.notes || '',
        status: props.sku.status
      }
      loadProductDetails(props.sku.product_type)
    } else {
      // Create mode
      resetForm()
    }
  }
})
</script>
