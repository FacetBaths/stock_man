<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 700px; max-width: 900px">
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
                    @blur="validateSKUCode"
                  />
                </div>
                <div class="col-auto" v-if="!isEditing">
                  <q-btn
                    color="secondary"
                    label="Generate"
                    @click="generateSKUCode"
                    :loading="generating"
                    :disable="!form.product_type"
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

            <!-- Bundle/Kit Toggle -->
            <div class="col-12">
              <q-checkbox
                v-model="form.is_bundle"
                label="This is a Bundle/Kit (contains multiple products)"
                color="primary"
                :disable="isEditing"
                @update:model-value="onBundleModeChange"
              />
              <div class="text-caption text-grey-6" v-if="form.is_bundle">
                Perfect for wall kits that contain multiple wall panels or other product combinations.
              </div>
              <div v-if="isEditing" class="text-caption text-grey-6">
                Bundle configuration cannot be changed when editing
              </div>
            </div>

            <!-- Product Mode Toggle (only show if not bundle and not editing) -->
            <div class="col-12" v-if="!form.is_bundle && !isEditing">
              <q-option-group
                v-model="productMode"
                :options="productModeOptions"
                color="primary"
                inline
                @update:model-value="onProductModeChange"
              />
            </div>

            <!-- Select Existing Product -->
            <div class="col-12 col-sm-6" v-if="!form.is_bundle && !isEditing && productMode === 'existing'">
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
                :rules="[val => (!form.is_bundle && productMode === 'existing') ? (!!val || 'Product Details is required') : true]"
                :loading="loadingProducts"
                clearable
                use-input
                input-debounce="0"
                @filter="filterProductDetails"
              />
            </div>

            <!-- Inline Product Creation Fields -->
            <template v-if="!form.is_bundle && productMode === 'new'">
              <!-- Wall Product Fields -->
              <template v-if="form.product_type === 'wall'">
                <div class="col-12">
                  <div class="text-subtitle2 text-weight-medium q-mb-sm text-primary">
                    <q-icon name="business" class="q-mr-xs" />
                    Wall Product Details
                  </div>
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.product_line"
                    label="Product Line *"
                    outlined
                    dense
                    :rules="[val => (!form.is_bundle && productMode === 'new' && form.product_type === 'wall') ? (!!val || 'Product Line is required') : true]"
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.color_name"
                    label="Color Name *"
                    outlined
                    dense
                    :rules="[val => (!form.is_bundle && productMode === 'new' && form.product_type === 'wall') ? (!!val || 'Color Name is required') : true]"
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.dimensions"
                    label="Dimensions *"
                    outlined
                    dense
                    placeholder="e.g., 24x48 inches"
                    :rules="[val => (!form.is_bundle && productMode === 'new' && form.product_type === 'wall') ? (!!val || 'Dimensions is required') : true]"
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.finish"
                    label="Finish *"
                    outlined
                    dense
                    :rules="[val => (!form.is_bundle && productMode === 'new' && form.product_type === 'wall') ? (!!val || 'Finish is required') : true]"
                  />
                </div>
              </template>
              
              <!-- Generic Product Fields -->
              <template v-else>
                <div class="col-12">
                  <div class="text-subtitle2 text-weight-medium q-mb-sm text-primary">
                    <q-icon name="inventory" class="q-mr-xs" />
                    Product Details
                  </div>
                </div>
                
                <div class="col-12">
                  <q-input
                    v-model="form.new_product.name"
                    label="Product Name *"
                    outlined
                    dense
                    :rules="[val => (!form.is_bundle && productMode === 'new' && form.product_type !== 'wall') ? (!!val || 'Product Name is required') : true]"
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.brand"
                    label="Brand"
                    outlined
                    dense
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.model"
                    label="Model"
                    outlined
                    dense
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.color"
                    label="Color"
                    outlined
                    dense
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.dimensions"
                    label="Dimensions"
                    outlined
                    dense
                  />
                </div>
                
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="form.new_product.finish"
                    label="Finish"
                    outlined
                    dense
                  />
                </div>
                
                <div class="col-12">
                  <q-input
                    v-model="form.new_product.description"
                    label="Description"
                    outlined
                    dense
                    type="textarea"
                    rows="3"
                  />
                </div>
              </template>
            </template>

            <!-- Bundle Items Section -->
            <template v-if="form.is_bundle">
              <div class="col-12">
                <div class="text-subtitle1 text-weight-medium q-mb-md text-primary">
                  <q-icon name="inventory_2" class="q-mr-xs" />
                  Bundle Contents
                </div>
                
                <div class="q-mb-md" v-for="(item, index) in form.bundle_items" :key="index">
                  <q-card flat bordered class="q-pa-md">
                    <div class="row q-col-gutter-md items-end">
                      <div class="col-12 col-sm-3">
                        <q-select
                          v-model="item.product_type"
                          label="Product Type *"
                          outlined
                          dense
                          :options="productTypeOptions"
                          emit-value
                          map-options
                          :rules="[val => !!val || 'Product Type is required']"
                          @update:model-value="(val) => onBundleItemProductTypeChange(index, val)"
                        />
                      </div>
                      
                      <div class="col-12 col-sm-4">
                        <q-select
                          v-model="item.product_details"
                          label="Product *"
                          outlined
                          dense
                          :options="bundleItemProductOptions[index] || []"
                          option-value="_id"
                          option-label="name"
                          emit-value
                          map-options
                          :rules="[val => !!val || 'Product is required']"
                          :loading="bundleItemLoading[index]"
                        />
                      </div>
                      
                      <div class="col-12 col-sm-2">
                        <q-input
                          v-model.number="item.quantity"
                          label="Quantity *"
                          outlined
                          dense
                          type="number"
                          min="1"
                          :rules="[val => val > 0 || 'Quantity must be greater than 0']"
                        />
                      </div>
                      
                      <div class="col-12 col-sm-2">
                        <q-input
                          v-model="item.description"
                          label="Description"
                          outlined
                          dense
                        />
                      </div>
                      
                      <div class="col-auto">
                        <q-btn
                          icon="delete"
                          color="negative"
                          flat
                          round
                          size="sm"
                          @click="removeBundleItem(index)"
                          :disable="form.bundle_items.length <= 1"
                        >
                          <q-tooltip>Remove Item</q-tooltip>
                        </q-btn>
                      </div>
                    </div>
                  </q-card>
                </div>
                
                <div class="row q-col-gutter-sm">
                  <div class="col-auto">
                    <q-btn
                      color="primary"
                      icon="add"
                      label="Add Bundle Item"
                      outline
                      @click="addBundleItem"
                    />
                  </div>
                  <div class="col-auto">
                    <q-chip
                      color="primary"
                      text-color="white"
                      icon="info"
                    >
                      {{ form.bundle_items.length }} item{{ form.bundle_items.length !== 1 ? 's' : '' }} in bundle
                    </q-chip>
                  </div>
                </div>
              </div>
            </template>

            <!-- Product Name (for editing mode) -->
            <div v-if="isEditing" class="col-12">
              <q-input
                v-model="form.name"
                label="Product Name *"
                outlined
                dense
                :rules="[val => !!val || 'Product name is required']"
              />
            </div>

            <!-- Brand and Model (for editing mode) -->
            <div v-if="isEditing" class="col-12 col-sm-6">
              <q-input
                v-model="form.brand"
                label="Brand"
                outlined
                dense
                placeholder="Brand name"
              />
            </div>

            <div v-if="isEditing" class="col-12 col-sm-6">
              <q-input
                v-model="form.model"
                label="Model"
                outlined
                dense
                placeholder="Model number/name"
              />
            </div>

            <!-- Supplier SKU (instead of manufacturer_model which doesn't exist in backend) -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.supplier_sku"
                label="Supplier SKU"
                outlined
                dense
                hint="SKU code used by supplier"
              />
            </div>

            <!-- Barcode -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.barcode"
                label="Barcode"
                outlined
                dense
                :hint="props.barcode ? `From scan: ${props.barcode}` : ''"
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
import { skuApi } from '@/utils/api'
import { PRODUCT_TYPES, type SKU, type CreateSKURequest, type UpdateSKURequest } from '@/types'

interface Props {
  modelValue: boolean
  sku?: SKU | null
  barcode?: string
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
const productMode = ref<'existing' | 'new'>('existing')
// Bundle item management state
const bundleItemProductOptions = ref<any[][]>([])
const bundleItemLoading = ref<boolean[]>([])

// Form data
const defaultForm = {
  sku_code: '',
  product_type: '',
  product_details: '',
  is_bundle: false,
  bundle_items: [],
  new_product: {
    // Wall specific fields
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: '',
    // Generic product fields
    name: '',
    brand: '',
    model: '',
    color: '',
    description: ''
  },
  // Editing mode fields
  name: '',
  brand: '',
  model: '',
  supplier_sku: '', // Replace manufacturer_model with supplier_sku
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

const productModeOptions = [
  { label: 'Select Existing Product', value: 'existing' },
  { label: 'Create New Product', value: 'new' }
]

// Methods
const resetForm = () => {
  form.value = { ...defaultForm }
  productDetailsOptions.value = []
  productMode.value = 'existing'
  bundleItemProductOptions.value = []
  bundleItemLoading.value = []
}

const onBundleModeChange = (isBundle: boolean) => {
  if (isBundle) {
    // When switching to bundle mode, reset non-bundle fields
    form.value.product_details = ''
    form.value.new_product = {
      product_line: '',
      color_name: '',
      dimensions: '',
      finish: '',
      name: '',
      brand: '',
      model: '',
      color: '',
      description: ''
    }
    // Initialize with one bundle item
    if (form.value.bundle_items.length === 0) {
      form.value.bundle_items = [{
        product_type: form.value.product_type,
        product_details: '',
        quantity: 1,
        description: ''
      }]
    }
    productMode.value = 'existing' // Bundle mode defaults to existing products
  } else {
    // When switching from bundle mode, clear bundle items
    form.value.bundle_items = []
  }
}

// Bundle item management methods
const addBundleItem = () => {
  form.value.bundle_items.push({
    product_type: 'wall',
    product_details: '',
    quantity: 1,
    description: ''
  })
  // Initialize options and loading state for new item
  bundleItemProductOptions.value.push([])
  bundleItemLoading.value.push(false)
}

const removeBundleItem = (index: number) => {
  if (form.value.bundle_items.length > 1) {
    form.value.bundle_items.splice(index, 1)
    bundleItemProductOptions.value.splice(index, 1)
    bundleItemLoading.value.splice(index, 1)
  }
}

const loadBundleItemProducts = async (index: number, productType: string) => {
  if (!productType) return
  
  try {
    bundleItemLoading.value[index] = true
    // Load existing SKUs of the specified product type for bundle items
    const response = await skuApi.getSKUs({
      search: productType,
      status: 'active',
      limit: 100
    })
    
    // Format SKUs for dropdown display
    bundleItemProductOptions.value[index] = response.skus.map(sku => ({
      _id: sku._id,
      name: `${sku.sku_code} - ${sku.name}`,
      sku_code: sku.sku_code,
      sku_name: sku.name
    }))
  } catch (error) {
    console.error('Error loading bundle item SKUs:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to load SKUs for ${productType}`
    })
  } finally {
    bundleItemLoading.value[index] = false
  }
}

const onBundleItemProductTypeChange = (index: number, productType: string) => {
  // Reset product_details when type changes
  form.value.bundle_items[index].product_details = ''
  // Load products for this type
  loadBundleItemProducts(index, productType)
}

const onProductModeChange = (mode: 'existing' | 'new') => {
  // Reset product-related fields when switching modes
  form.value.product_details = ''
  form.value.new_product = {
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: '',
    name: '',
    brand: '',
    model: '',
    color: '',
    description: ''
  }
}

const loadExistingSKUs = async (productType: string) => {
  if (!productType) return
  
  try {
    loadingProducts.value = true
    // Load existing SKUs of the same product type to use as bundle components
    const response = await skuApi.getSKUs({
      // Filter by category name that matches product type
      search: productType,
      status: 'active',
      limit: 100
    })
    
    // Format SKUs for dropdown display
    productDetailsOptions.value = response.skus.map(sku => ({
      _id: sku._id,
      name: `${sku.sku_code} - ${sku.name}`,
      sku_code: sku.sku_code,
      sku_name: sku.name,
      brand: sku.brand,
      model: sku.model
    }))
  } catch (error) {
    console.error('Error loading existing SKUs:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load existing SKUs'
    })
  } finally {
    loadingProducts.value = false
  }
}

const onProductTypeChange = (productType: string) => {
  form.value.product_details = ''
  // Reset new product fields when product type changes
  form.value.new_product = {
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: '',
    name: '',
    brand: '',
    model: '',
    color: '',
    description: ''
  }
  if (productMode.value === 'existing') {
    loadExistingSKUs(productType)
  }
}

const generateSKUCode = async () => {
  if (!form.value.product_type) {
    $q.notify({
      type: 'warning',
      message: 'Please select product type first'
    })
    return
  }

  if (productMode.value === 'existing' && !form.value.product_details) {
    $q.notify({
      type: 'warning',
      message: 'Please select product details first'
    })
    return
  }

  try {
    generating.value = true
    // For new products, we'll generate based on type and a placeholder
    const productDetails = productMode.value === 'existing' 
      ? form.value.product_details 
      : 'new-product-placeholder'
    
    const skuCode = await skuStore.generateSKUCode({
      product_type: form.value.product_type,
      product_details: productDetails
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
      // Update existing SKU - match backend API exactly from BACKEND_API_REFERENCE.md
      const updates: UpdateSKURequest = {
        // Core SKU fields from backend model
        name: form.value.name || props.sku.name || 'SKU Product',
        description: form.value.description,
        brand: form.value.brand,
        model: form.value.model,
        barcode: form.value.barcode,
        status: form.value.status,
        unit_cost: form.value.current_cost,
        currency: 'USD', // Default currency
        
        // Details object - merge existing details with form updates  
        details: {
          // Preserve existing details from backend
          ...props.sku.details,
          
          // Include supplier_sku in details if provided (not root level)
          ...(form.value.supplier_sku && { 
            supplier_sku: form.value.supplier_sku 
          }),
          
          // Extract and preserve product_details fields in details object
          ...(props.sku.product_details && typeof props.sku.product_details === 'object' ? {
            product_line: (props.sku.product_details as any)?.product_line || props.sku.details?.product_line,
            color_name: (props.sku.product_details as any)?.color_name || props.sku.details?.color_name,
            dimensions: (props.sku.product_details as any)?.dimensions || props.sku.details?.dimensions,
            finish: (props.sku.product_details as any)?.finish || props.sku.details?.finish,
            // Include any other product detail fields
            weight: (props.sku.product_details as any)?.weight || props.sku.details?.weight,
            specifications: (props.sku.product_details as any)?.specifications || props.sku.details?.specifications
          } : {})
        },
        
        // Stock thresholds
        stock_thresholds: {
          understocked: Number(form.value.stock_thresholds.understocked) || 5,
          overstocked: Number(form.value.stock_thresholds.overstocked) || 100
        },
        
        // Supplier info - merge existing with form updates
        supplier_info: {
          // Preserve existing supplier_info
          ...(props.sku.supplier_info || {}),
          // Update supplier_sku from form
          supplier_sku: form.value.supplier_sku || ''
        },
        
        // Images if available (preserve existing)
        ...(props.sku.images && {
          images: props.sku.images
        })
      }
      
      // Extract category_id - this is required by backend validation
      let categoryId = null
      if (props.sku.category_id) {
        if (typeof props.sku.category_id === 'object' && props.sku.category_id._id) {
          categoryId = props.sku.category_id._id
        } else if (typeof props.sku.category_id === 'string') {
          categoryId = props.sku.category_id
        }
      }
      
      // Debug logging to understand the category_id issue
      console.log('Frontend: props.sku.category_id:', props.sku.category_id)
      console.log('Frontend: extracted categoryId:', categoryId)
      console.log('Frontend: categoryId type:', typeof categoryId)
      
      if (categoryId) {
        updates.category_id = categoryId
      } else {
        console.error('Frontend: No valid category_id found in SKU object')
        throw new Error('Category ID is required but missing from SKU')
      }
      
      console.log('Frontend: About to update SKU with data:', JSON.stringify(updates, null, 2))
      await skuStore.updateSKU(props.sku._id, updates)
      
      // Add cost if changed
      if (form.value.current_cost !== props.sku.unit_cost) {
        await skuStore.addCost(props.sku._id, {
          cost: form.value.current_cost,
          notes: 'Updated from form'
        })
      }
    } else {
      // Create new SKU
      const skuData: any = {
        sku_code: form.value.sku_code,
        product_type: form.value.product_type,
        is_bundle: form.value.is_bundle,
        supplier_sku: form.value.supplier_sku,
        barcode: form.value.barcode,
        current_cost: form.value.current_cost,
        stock_thresholds: form.value.stock_thresholds,
        description: form.value.description,
        notes: form.value.notes
      }
      
      if (form.value.is_bundle) {
        // Bundle SKU: send bundle_items
        skuData.bundle_items = form.value.bundle_items
        // For bundle SKUs, we need a main product_details (first bundle item)
        skuData.product_details = form.value.bundle_items[0]?.product_details
      } else {
        // Regular SKU: send product_details or new_product
        if (productMode.value === 'existing') {
          skuData.product_details = form.value.product_details
        } else if (productMode.value === 'new') {
          skuData.new_product = form.value.new_product
        }
      }
      
      console.log('Frontend: About to create SKU with data:', JSON.stringify(skuData, null, 2))
      await skuStore.createSKU(skuData)
    }
    
    emit('saved')
  } catch (error: any) {
    console.error('Frontend: SKU creation error:', error)
    console.error('Frontend: Error response:', error.response?.data)
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || error.message || 'Failed to save SKU'
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

// Filter method for product details dropdown
const filterProductDetails = (val: string, update: (fn: () => void) => void) => {
  if (val === '') {
    update(() => {
      // Show all options when no filter
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    productDetailsOptions.value = productDetailsOptions.value.filter(v => 
      v.name.toLowerCase().indexOf(needle) > -1
    )
  })
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  console.log('SKUFormDialog modelValue changed to:', newValue)
  console.log('props.sku:', props.sku)
  console.log('props.barcode:', props.barcode)
  if (newValue) {
    if (props.sku) {
      // Editing mode
      console.log('SKUFormDialog: Editing mode')
      // Extract product type from category
      let productType = ''
      if (props.sku.category_id) {
        if (typeof props.sku.category_id === 'object' && props.sku.category_id.name) {
          productType = props.sku.category_id.name
        } else if (typeof props.sku.category_id === 'string') {
          // If it's just a string ID, we may need to look it up, but for now use existing product_type
          productType = props.sku.product_type || 'wall'
        }
      } else {
        productType = props.sku.product_type || 'wall'
      }

      // Extract supplier SKU from nested supplier_info object
      let supplierSku = ''
      if (props.sku.supplier_info && props.sku.supplier_info.supplier_sku) {
        supplierSku = props.sku.supplier_info.supplier_sku
      }

      form.value = {
        sku_code: props.sku.sku_code,
        product_type: productType,
        product_details: typeof props.sku.product_details === 'string' 
          ? props.sku.product_details 
          : (props.sku.product_details as any)?._id || '',
        is_bundle: props.sku.is_bundle || false,
        bundle_items: props.sku.bundle_items || [],
        new_product: {
          product_line: '',
          color_name: '',
          dimensions: '',
          finish: '',
          name: '',
          brand: '',
          model: '',
          color: '',
          description: ''
        },
        // Editing mode fields
        name: props.sku.name || 'SKU Product',
        brand: props.sku.brand || '',
        model: props.sku.model || '',
        supplier_sku: supplierSku,
        barcode: props.sku.barcode || '',
        current_cost: props.sku.unit_cost || 0,
        stock_thresholds: { 
          understocked: props.sku.stock_thresholds?.understocked || 5,
          overstocked: props.sku.stock_thresholds?.overstocked || 100
        },
        description: props.sku.description || '',
        notes: props.sku.notes || '',
        status: props.sku.status
      }
      
      // If editing a bundle, initialize bundle item options
      if (props.sku.is_bundle && props.sku.bundle_items) {
        bundleItemProductOptions.value = []
        bundleItemLoading.value = []
        for (let i = 0; i < props.sku.bundle_items.length; i++) {
          bundleItemProductOptions.value.push([])
          bundleItemLoading.value.push(false)
          // Load products for each bundle item
          const item = props.sku.bundle_items[i]
          if (item.product_type) {
            loadBundleItemProducts(i, item.product_type)
          }
        }
      }
      
      productMode.value = 'existing'
      
      // First, add the current product to options if it's populated
      if (props.sku.product_details && typeof props.sku.product_details === 'object') {
        console.log('Current product details:', props.sku.product_details)
        
        // Generate a human-readable name for the product
        let productName = ''
        const details = props.sku.product_details
        
        if (details.name) {
          productName = details.name
        } else if (details.product_line && details.color_name) {
          productName = `${details.product_line} ${details.color_name}`
          if (details.dimensions) productName += ` (${details.dimensions})`
        } else if (details.brand && details.model) {
          productName = `${details.brand} ${details.model}`
          if (details.color) productName += ` - ${details.color}`
        } else {
          // Try to build a name from any available fields
          const parts = []
          if (details.brand) parts.push(details.brand)
          if (details.model) parts.push(details.model)
          if (details.product_line) parts.push(details.product_line)
          if (details.color_name) parts.push(details.color_name)
          if (details.color) parts.push(details.color)
          if (details.finish) parts.push(details.finish)
          
          productName = parts.length > 0 ? parts.join(' ') : `${props.sku.product_type} product`
        }
        
        console.log('Generated product name:', productName)
        
        const currentProduct = {
          _id: props.sku.product_details._id,
          name: productName,
          ...props.sku.product_details
        }
        console.log('Created current product option:', currentProduct)
        
        // Add current product to options immediately
        productDetailsOptions.value = [currentProduct]
      }
      
      // Then load additional products
      loadExistingSKUs(props.sku.product_type).then(() => {
        // Ensure current product is still first in the list after loading
        if (props.sku.product_details && typeof props.sku.product_details === 'object') {
          const currentProductId = props.sku.product_details._id
          const existingIndex = productDetailsOptions.value.findIndex(opt => opt._id === currentProductId)
          if (existingIndex > 0) {
            // Move current product to first position
            const currentProduct = productDetailsOptions.value.splice(existingIndex, 1)[0]
            productDetailsOptions.value.unshift(currentProduct)
          }
        }
      })
    } else {
      // Create mode
      console.log('SKUFormDialog: Create mode')
      resetForm()
      // Prefill barcode if provided
      if (props.barcode) {
        form.value.barcode = props.barcode
        console.log('Prefilled barcode:', props.barcode)
      }
    }
  }
})
</script>
