<template>
  <q-dialog v-model="show" persistent position="top" maximized class="sku-form-dialog-container">
    <q-card class="sku-form-dialog" style="min-width: 700px; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
      <q-card-section class="row items-center">
        <div class="text-h6">
          {{ isEditing ? 'Edit SKU' : 'Create New SKU' }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-form @submit="onSubmit" @validation-error="onValidationError" class="flex-1 flex flex-col">
        <q-card-section class="flex-1" style="overflow-y: auto; max-height: calc(90vh - 140px);">
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

            <!-- Product Type (for creating only) -->
            <div class="col-12 col-sm-6" v-if="!isEditing">
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
                behavior="menu"
                menu-self="top left"
                menu-anchor="bottom left"
                :menu-offset="[0, 8]"
              />
            </div>

            <!-- Category (for editing only) -->
            <div class="col-12 col-sm-6" v-if="isEditing">
              <q-select
                v-model="form.category_id"
                :options="categoryOptions"
                label="Category *"
                dense
                outlined
                emit-value
                map-options
                :rules="[val => !!val || 'Category is required']"
                @update:model-value="onCategoryChange"
                behavior="menu"
                menu-self="top left"
                menu-anchor="bottom left"
                :menu-offset="[0, 8]"
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
                label="Existing Product *"
                hint="Select an existing product to use as a reference"
                outlined
                dense
                :options="productDetailsOptions"
                option-value="_id"
                option-label="name"
                emit-value
                map-options
                :rules="[val => (!form.is_bundle && productMode === 'existing') ? (!!val || 'Existing product selection is required') : true]"
                :loading="loadingProducts"
                clearable
                use-input
                input-debounce="0"
                @filter="filterProductDetails"
                @update:model-value="onProductDetailsChange"
                behavior="menu"
                menu-self="top left"
                menu-anchor="bottom left"
                :menu-offset="[0, 8]"
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
                          behavior="menu"
                          menu-self="top left"
                          menu-anchor="bottom left"
                          :menu-offset="[0, 8]"
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
                          behavior="menu"
                          menu-self="top left"
                          menu-anchor="bottom left"
                          :menu-offset="[0, 8]"
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

            <!-- Product Details Section (for editing mode) -->
            <template v-if="isEditing">
              <div class="col-12">
                <q-expansion-item label="Product Details" default-opened>
                  <div class="row q-col-gutter-md q-pt-md">
                    <!-- Wall product specific fields -->
                    <template v-if="form.product_type === 'walls'">
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.product_line"
                          label="Product Line"
                          outlined
                          dense
                          placeholder="e.g., Monterey"
                        />
                      </div>
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.color_name"
                          label="Color Name"
                          outlined
                          dense
                          placeholder="e.g., Carrara"
                        />
                      </div>
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.dimensions"
                          label="Dimensions"
                          outlined
                          dense
                          placeholder="e.g., 36x96"
                        />
                      </div>
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.finish"
                          label="Finish"
                          outlined
                          dense
                          placeholder="e.g., Velvet"
                        />
                      </div>
                    </template>
                    <!-- Generic product fields for other types -->
                    <template v-else>
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.color_name"
                          label="Color"
                          outlined
                          dense
                        />
                      </div>
                      <div class="col-12 col-sm-6">
                        <q-input
                          v-model="form.finish"
                          label="Finish"
                          outlined
                          dense
                        />
                      </div>
                      <div class="col-12">
                        <q-input
                          v-model="form.dimensions"
                          label="Dimensions"
                          outlined
                          dense
                        />
                      </div>
                    </template>
                  </div>
                </q-expansion-item>
              </div>
            </template>

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
                v-model.number="form.unit_cost"
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
                behavior="menu"
                menu-self="top left"
                menu-anchor="bottom left"
                :menu-offset="[0, 8]"
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

            <!-- SKU Notes -->
            <div class="col-12">
              <q-input
                v-model="form.sku_notes"
                label="SKU Notes"
                outlined
                dense
                type="textarea"
                rows="2"
                hint="Notes specific to this SKU"
              />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md" style="flex-shrink: 0;">
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
import { useCategoryStore } from '@/stores/category'
import { skuApi } from '@/utils/api'
import { formatCategoryName } from '@/utils/formatting'
import { type SKU, type CreateSKURequest, type UpdateSKURequest } from '@/types'

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
const categoryStore = useCategoryStore()

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
const productMode = ref<'existing' | 'new'>('new')
// Bundle item management state
const bundleItemProductOptions = ref<any[][]>([])
const bundleItemLoading = ref<boolean[]>([])

// Form bundle item interface for the form (different from backend SKU.bundle_items)
interface FormBundleItem {
  product_type: string
  product_details: string
  quantity: number
  description: string
}

// Form data
const defaultForm = {
  sku_code: '',
  product_type: '',
  product_details: '',
  category_id: '',
  is_bundle: false,
  bundle_items: [] as FormBundleItem[],
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
  unit_cost: 0,
  stock_thresholds: {
    understocked: 5,  // Sensible default that can be manually overridden to 0
    overstocked: 100
  },
  description: '',
  sku_notes: '',
  status: 'active',
  // Product detail fields (from details object)
  product_line: '',
  color_name: '',
  dimensions: '',
  finish: ''
}

const form = ref({ ...defaultForm })

// Options - Load from category store instead of hardcoded PRODUCT_TYPES
const productTypeOptions = computed(() => {
  // Filter to only product categories (not tools) and active categories
  const productCategories = categoryStore.productCategories.filter(cat => cat.status === 'active')
  
  return productCategories.map(category => ({
    label: formatCategoryName(category.name), // Use proper category name formatting
    value: category.name, // Use category name as value for compatibility
    categoryId: category._id // Store the actual category ID we need for the API
  }))
})

// Category options for editing mode (includes all active categories)
const categoryOptions = computed(() => {
  const allCategories = [...categoryStore.productCategories, ...categoryStore.toolCategories]
    .filter(cat => cat.status === 'active')
  
  return allCategories.map(category => ({
    label: formatCategoryName(category.name), // Use proper category name formatting
    value: category._id // Use category ID as the value for editing
  }))
})

const statusOptions = [
  { label: 'Active', value: 'active' as const },
  { label: 'Pending', value: 'pending' as const },
  { label: 'Discontinued', value: 'discontinued' as const }
]

const productModeOptions = [
  { label: 'Select Existing Product', value: 'existing' },
  { label: 'Create New Product', value: 'new' }
]

// Methods
const resetForm = () => {
  form.value = { ...defaultForm }
  productDetailsOptions.value = []
  productMode.value = 'new' // Default to new product mode for creating SKUs
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
      // Default to 'wall' if available, otherwise first available product type
      const defaultProductType = form.value.product_type || 
        (productTypeOptions.value.find(opt => opt.value === 'walls')?.value) ||
        (productTypeOptions.value[0]?.value) ||
        'wall'
      
      form.value.bundle_items = [{
        product_type: defaultProductType,
        product_details: '',
        quantity: 1,
        description: ''
      }]
      
      // Initialize bundle item options and loading arrays
      bundleItemProductOptions.value = [[]]
      bundleItemLoading.value = [false]
      
      // Load products for the first bundle item
      if (defaultProductType) {
        loadBundleItemProducts(0, defaultProductType)
      }
    }
    productMode.value = 'existing' // Bundle mode defaults to existing products
  } else {
    // When switching from bundle mode, clear bundle items and their options
    form.value.bundle_items = []
    bundleItemProductOptions.value = []
    bundleItemLoading.value = []
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
    
    // Get the category ID for the selected product type (same logic as loadExistingSKUs)
    const selectedCategory = productTypeOptions.value.find(opt => opt.value === productType)
    
    if (!selectedCategory || !selectedCategory.categoryId) {
      console.error('No matching category found for product type:', productType)
      bundleItemProductOptions.value[index] = []
      return
    }
    
    // Load existing SKUs filtered by the correct category ID
    const response = await skuApi.getSKUs({
      category_id: selectedCategory.categoryId, // Use category ID instead of generic search
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
    // Initialize with empty array to avoid undefined
    bundleItemProductOptions.value[index] = []
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
    console.log('Loading SKUs for product type:', productType)
    
    // Get the category ID for the selected product type
    const selectedCategory = productTypeOptions.value.find(opt => opt.value === productType)
    
    if (!selectedCategory || !selectedCategory.categoryId) {
      console.error('No matching category found for product type:', productType)
      productDetailsOptions.value = []
      return
    }
    
    // Load existing SKUs filtered by the correct category ID
    const response = await skuApi.getSKUs({
      category_id: selectedCategory.categoryId, // Use category ID instead of name search
      status: 'active',
      limit: 100
    })
    
    console.log('Found SKUs:', response.skus.length)
    
    // Format SKUs for dropdown display
    productDetailsOptions.value = response.skus.map(sku => ({
      _id: sku._id,
      name: `${sku.sku_code} - ${sku.name}`,
      sku_code: sku.sku_code,
      sku_name: sku.name,
      brand: sku.brand,
      model: sku.model
    }))
    
    console.log('Loaded product options:', productDetailsOptions.value.length)
  } catch (error) {
    console.error('Error loading existing SKUs:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load existing SKUs'
    })
    // Initialize with empty array to avoid undefined
    productDetailsOptions.value = []
  } finally {
    loadingProducts.value = false
  }
}

const onProductTypeChange = (productType: string) => {
  console.log('Product type changed to:', productType)
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
    // Clear options first to show loading state properly
    productDetailsOptions.value = []
    loadExistingSKUs(productType)
  }
}

const onCategoryChange = (categoryId: string) => {
  console.log('Category changed to:', categoryId)
  // In editing mode, we just update the category - no need to reset other fields
  // as the user is editing an existing SKU, not creating a new one
}

const generateSKUCode = async () => {
  if (!form.value.product_type) {
    $q.notify({
      type: 'warning',
      message: 'Please select product type first'
    })
    return
  }

  try {
    generating.value = true
    
    // Get the category ID for the selected product type
    const selectedProductType = productTypeOptions.value.find(option => option.value === form.value.product_type)
    if (!selectedProductType) {
      throw new Error('Invalid product type selected')
    }
    
    console.log('Generating SKU code for category:', selectedProductType.categoryId)
    
    // Extract manufacturer model from form if available
    let manufacturerModel = ''
    if (productMode.value === 'new') {
      // Use brand + model combination if available
      const brand = form.value.new_product.brand || form.value.brand || ''
      const model = form.value.new_product.model || form.value.model || ''
      if (brand && model) {
        manufacturerModel = `${brand}-${model}`.replace(/[^A-Z0-9\-_]/gi, '')
      } else if (model) {
        manufacturerModel = model.replace(/[^A-Z0-9\-_]/gi, '')
      }
    }
    
    const skuCode = await skuStore.generateSKUCode({
      category_id: selectedProductType.categoryId,
      manufacturer_model: manufacturerModel || undefined
    })
    
    form.value.sku_code = skuCode
    console.log('Generated SKU code:', skuCode)
    
  } catch (error: any) {
    console.error('SKU generation error:', error)
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
  
  try {
console.log('Validating SKU code:', form.value.sku_code)
    // For new SKUs, check if SKU code already exists via API
    const response = await skuApi.lookupSKU(form.value.sku_code)
    if (response) {
      $q.notify({
        type: 'warning', 
        message: 'SKU code already exists'
      })
    }
  } catch (error: any) {
    // If 404, SKU doesn't exist (good)
    if (error.response?.status === 404) {
      return // SKU code is available
    }
    // For other errors, just log and continue
    console.warn('Error validating SKU code:', error.message)
  }
}

const onSubmit = async () => {
  try {
    saving.value = true
    
    // Validation for editing mode
    if (isEditing.value && !form.value.category_id) {
      $q.notify({
        type: 'warning',
        message: 'Please select a category'
      })
      return
    }
    
    // Validation for bundle mode
    if (form.value.is_bundle) {
      if (!form.value.bundle_items || form.value.bundle_items.length === 0) {
        $q.notify({
          type: 'warning',
          message: 'Bundle must have at least one component'
        })
        return
      }
      
      // Validate each bundle item
      for (let i = 0; i < form.value.bundle_items.length; i++) {
        const item = form.value.bundle_items[i]
        if (!item.product_details) {
          $q.notify({
            type: 'warning',
            message: `Please select a product for bundle item ${i + 1}`
          })
          return
        }
        if (!item.quantity || item.quantity <= 0) {
          $q.notify({
            type: 'warning',
            message: `Bundle item ${i + 1} must have a quantity greater than 0`
          })
          return
        }
      }
    }
    
    if (isEditing.value && props.sku) {
      // Update existing SKU - match backend API exactly from BACKEND_API_REFERENCE.md
      const updates: UpdateSKURequest = {
        // Core SKU fields from backend model
        sku_code: form.value.sku_code,
        name: form.value.name || props.sku.name || 'SKU Product',
        description: form.value.description,
        brand: form.value.brand,
        model: form.value.model,
        barcode: form.value.barcode,
        status: form.value.status as 'active' | 'discontinued' | 'pending',
        unit_cost: form.value.unit_cost,
        currency: 'USD', // Default currency
        
        // Details object - merge existing details with form updates  
        details: {
          // Preserve existing details from backend
          ...props.sku.details,
          
          // Include supplier_sku in details if provided (not root level)
          ...(form.value.supplier_sku && { 
            supplier_sku: form.value.supplier_sku 
          }),
          
          // Update product detail fields from form
          product_line: form.value.product_line || props.sku.details?.product_line || '',
          color_name: form.value.color_name || props.sku.details?.color_name || '',
          dimensions: form.value.dimensions || props.sku.details?.dimensions || '',
          finish: form.value.finish || props.sku.details?.finish || '',
          
          // Preserve other existing detail fields
          weight: props.sku.details?.weight,
          specifications: props.sku.details?.specifications
        },
        
        // Stock thresholds - preserve 0 values
        stock_thresholds: {
          understocked: Number(form.value.stock_thresholds.understocked) ?? 5,  // Use nullish coalescing to allow 0
          overstocked: Number(form.value.stock_thresholds.overstocked) ?? 100
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
        }),
        
        // SKU notes
        sku_notes: form.value.sku_notes
      }
      
      // Add category_id from form (user can now change this)
      if (form.value.category_id) {
        updates.category_id = form.value.category_id
      }
      
      // Handle bundle items if this is a bundle SKU
      if (form.value.is_bundle && form.value.bundle_items.length > 0) {
        updates.bundle_items = form.value.bundle_items.map(item => ({
          sku_id: item.product_details, // product_details is the SKU ID selected from dropdown
          quantity: item.quantity,
          description: item.description || ''
        }))
        console.log('Bundle items to update:', updates.bundle_items)
      }
      
      console.log('Frontend: About to update SKU with data:', JSON.stringify(updates, null, 2))
      await skuStore.updateSKU(props.sku._id, updates)
      
      // Add cost if changed
      if (form.value.unit_cost !== props.sku.unit_cost) {
        await skuStore.addCost(props.sku._id, {
          cost: form.value.unit_cost,
          notes: 'Updated from form'
        })
      }
    } else {
      // Create new SKU
// Map product_type name to category_id for API
      const selectedProductType = productTypeOptions.value.find(option => option.value === form.value.product_type)
      if (!selectedProductType) {
        throw new Error('Please select a valid product type')
      }
      
      console.log('Selected product type:', selectedProductType)
      
      const skuData: any = {
        sku_code: form.value.sku_code,
        category_id: selectedProductType.categoryId, // Use the actual category ID from the loaded categories
        name: form.value.new_product.name || form.value.name || 'New Product', // ✅ REQUIRED: Add name field
        description: form.value.description || '',
        brand: form.value.brand || '',
        model: form.value.model || '',
        is_bundle: form.value.is_bundle,
        barcode: form.value.barcode || '',
        unit_cost: form.value.unit_cost || 0,
        currency: 'USD',
        stock_thresholds: form.value.stock_thresholds || { understocked: 5, overstocked: 100 },
        
        // ✅ Fix: Move supplier_sku into supplier_info object where backend expects it
        supplier_info: {
          supplier_name: '',
          supplier_sku: form.value.supplier_sku || '',
          lead_time_days: 0
        },
        
        // ✅ Add details object based on product mode and type
        details: productMode.value === 'new' ? {
          // Wall-specific fields
          product_line: form.value.new_product.product_line || '',
          color_name: form.value.new_product.color_name || '',
          dimensions: form.value.new_product.dimensions || '',
          finish: form.value.new_product.finish || '',
          
          // Generic fields
          weight: 0,
          specifications: {}
        } : {},
        
        sku_notes: form.value.sku_notes || ''
      }
      
      if (form.value.is_bundle) {
        // Bundle SKU: Transform frontend bundle items to backend format
        skuData.bundle_items = form.value.bundle_items.map(item => ({
          sku_id: item.product_details, // product_details is the SKU ID selected from dropdown
          quantity: item.quantity,
          description: item.description || ''
        }))
        
        // For bundle name generation, use first bundle item's name
        const firstBundleItem = bundleItemProductOptions.value[0]?.find(opt => opt._id === form.value.bundle_items[0]?.product_details)
        if (firstBundleItem) {
          skuData.name = `Bundle: ${firstBundleItem.sku_code} + ${form.value.bundle_items.length - 1} more`
        } else {
          skuData.name = `Bundle (${form.value.bundle_items.length} items)`
        }
      } else {
        // Regular SKU: send product_details or new_product
        if (productMode.value === 'existing') {
          // When using existing product, find the selected product and copy relevant details
          const selectedProduct = productDetailsOptions.value.find(p => p._id === form.value.product_details)
          if (selectedProduct) {
            console.log('Using existing product as reference:', selectedProduct.sku_code)
            // Extract name from new_product fields if provided, otherwise use a generated name
            skuData.name = form.value.new_product.name || 
                          form.value.name || 
                          `${selectedProduct.sku_name} (${form.value.sku_code})` || 
                          `Product ${form.value.sku_code}`
            // Copy details from existing product as reference
            skuData.brand = selectedProduct.brand || ''
            skuData.model = selectedProduct.model || ''
          } else {
            // Fallback if no product is found
            skuData.name = form.value.new_product.name || form.value.name || `Product ${form.value.sku_code}`
          }
        } else if (productMode.value === 'new') {
          // When creating new product, use new_product fields
          if (form.value.product_type === 'wall') {
            // For walls, generate name from product details
            const parts = []
            if (form.value.new_product.product_line) parts.push(form.value.new_product.product_line)
            if (form.value.new_product.color_name) parts.push(form.value.new_product.color_name)
            if (form.value.new_product.dimensions) parts.push(`(${form.value.new_product.dimensions})`)
            skuData.name = parts.length > 0 ? parts.join(' ') : `Wall Product ${form.value.sku_code}`
          } else {
            // For other product types, use the name field
            skuData.name = form.value.new_product.name || `Product ${form.value.sku_code}`
          }
          
          // Copy new product details
          skuData.brand = form.value.new_product.brand || ''
          skuData.model = form.value.new_product.model || ''
        }
      }
      
      console.log('Frontend: About to create SKU with data:', JSON.stringify(skuData, null, 2))
      await skuStore.createSKU(skuData)
    }
    
    emit('saved')
    close() // Close modal after successful save
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
      console.log('No filter applied, showing all options:', productDetailsOptions.value.length)
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    const filtered = productDetailsOptions.value.filter(v => 
      v.name.toLowerCase().indexOf(needle) > -1
    )
    console.log(`Filter "${needle}" found ${filtered.length} matches`)
    productDetailsOptions.value = filtered
  })
}

// Handle when a product is selected from the dropdown
const onProductDetailsChange = (productId: string) => {
  if (!productId) return
  
  console.log('Product selected:', productId)
  const selectedProduct = productDetailsOptions.value.find(p => p._id === productId)
  
  if (selectedProduct) {
    console.log('Selected product details:', selectedProduct)
    // You could pre-fill other fields based on the selected product if desired
  }
}

// Load categories when component mounts
onMounted(async () => {
  try {
    console.log('SKUFormDialog: Loading categories on mount...')
    await categoryStore.fetchCategories({ active_only: true })
    console.log('SKUFormDialog: Categories loaded successfully:', categoryStore.productCategories.length, 'categories')
    
    // Pre-select first product type if none is selected (walls if available)
    if (!form.value.product_type && productTypeOptions.value.length > 0) {
      // Try to find 'walls' category first, otherwise use first available
      const wallsCategory = productTypeOptions.value.find(opt => opt.value === 'walls')
      form.value.product_type = wallsCategory ? wallsCategory.value : productTypeOptions.value[0].value
      console.log('Auto-selected product type:', form.value.product_type)
      
      // Only load existing SKUs if we're in existing product mode
      if (productMode.value === 'existing') {
        await loadExistingSKUs(form.value.product_type)
      }
    }
  } catch (error) {
    console.error('SKUFormDialog: Failed to load categories:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load product categories'
    })
  }
})

// Watchers
// Initialize product types when form opens
const initializeProductTypes = async () => {
  try {
    if (categoryStore.productCategories.length === 0) {
      console.log('Fetching categories for product types...')
      await categoryStore.fetchCategories({ active_only: true })
      console.log('Categories loaded:', categoryStore.productCategories.length)
      
      if (form.value.product_type) {
        loadExistingSKUs(form.value.product_type)
      }
    }
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

watch(() => props.modelValue, async (newValue) => {
  console.log('🔄 SKUFormDialog modelValue changed to:', newValue)
  console.log('📋 props.sku:', props.sku)
  console.log('🔍 props.barcode:', props.barcode)
  console.log('📋 Current productTypeOptions:', productTypeOptions.value)
  console.log('🎯 Current productMode:', productMode.value)
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

      // Extract category ID
      let categoryId = ''
      if (props.sku.category_id) {
        if (typeof props.sku.category_id === 'object' && props.sku.category_id._id) {
          categoryId = props.sku.category_id._id
        } else if (typeof props.sku.category_id === 'string') {
          categoryId = props.sku.category_id
        }
      }
      
      form.value = {
        sku_code: props.sku.sku_code,
        product_type: productType,
        category_id: categoryId,
        product_details: typeof props.sku.product_details === 'string' 
          ? props.sku.product_details 
          : (props.sku.product_details as any)?._id || '',
        is_bundle: props.sku.is_bundle || false,
        bundle_items: [], // Will be populated below after transforming bundle items
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
        unit_cost: props.sku.unit_cost || 0,
        stock_thresholds: { 
          understocked: props.sku.stock_thresholds?.understocked ?? 5,  // Use nullish coalescing to allow 0 values
          overstocked: props.sku.stock_thresholds?.overstocked ?? 100
        },
        description: props.sku.description || '',
        sku_notes: props.sku.sku_notes || '',
        status: props.sku.status,
        // Product detail fields from details object
        product_line: props.sku.details?.product_line || '',
        color_name: props.sku.details?.color_name || '',
        dimensions: props.sku.details?.dimensions || '',
        finish: props.sku.details?.finish || ''
      }
      
      // If editing a bundle, transform backend bundle items to frontend format
      if (props.sku.is_bundle && props.sku.bundle_items && props.sku.bundle_items.length > 0) {
        console.log('Initializing bundle editing mode with items:', props.sku.bundle_items)
        
        bundleItemProductOptions.value = []
        bundleItemLoading.value = []
        
        // Transform backend bundle items to frontend FormBundleItem format
        const transformedBundleItems: FormBundleItem[] = await Promise.all(
          props.sku.bundle_items.map(async (backendItem: any, index: number) => {
            // Initialize arrays for this item
            bundleItemProductOptions.value.push([])
            bundleItemLoading.value.push(false)
            
            try {
              // Fetch the SKU details to get the category info
              const skuResponse = await skuApi.getSKU(backendItem.sku_id)
              const bundledSku = skuResponse.sku
              
              // Determine product type from category
              let productType = 'walls' // default fallback
              if (bundledSku.category_id) {
                if (typeof bundledSku.category_id === 'object' && bundledSku.category_id.name) {
                  productType = bundledSku.category_id.name
                } else {
                  // Find category name by ID
                  const category = [...categoryStore.productCategories, ...categoryStore.toolCategories].find(cat => cat._id === bundledSku.category_id)
                  productType = category?.name || 'walls'
                }
              }
              
              console.log(`Bundle item ${index}: SKU ${bundledSku.sku_code} has product type: ${productType}`)
              
              // Load products for this item's category
              await loadBundleItemProducts(index, productType)
              
              return {
                product_type: productType,
                product_details: backendItem.sku_id, // sku_id becomes product_details
                quantity: backendItem.quantity,
                description: backendItem.description || ''
              }
            } catch (error) {
              console.error(`Failed to load bundle item ${index}:`, error)
              // Return a fallback item
              return {
                product_type: 'walls',
                product_details: backendItem.sku_id,
                quantity: backendItem.quantity,
                description: backendItem.description || ''
              }
            }
          })
        )
        
        // Set the transformed bundle items to the form
        form.value.bundle_items = transformedBundleItems
        console.log('Transformed bundle items for editing:', form.value.bundle_items)
      }
      
      productMode.value = 'existing'
      
      // First, add the current product details from the details field
      if (props.sku.details && typeof props.sku.details === 'object') {
        console.log('Current SKU details:', props.sku.details)
        
        // Generate a human-readable name from details
        let productName = ''
        const details = props.sku.details
        
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
        
        // Only create currentProduct if product_details exists and has an _id
        if (props.sku.product_details && typeof props.sku.product_details === 'object' && props.sku.product_details._id) {
          const currentProduct = {
            _id: props.sku.product_details._id,
            name: productName,
            ...props.sku.product_details
          }
          console.log('Created current product option:', currentProduct)
          
          // Add current product to options immediately
          productDetailsOptions.value = [currentProduct]
        } else {
          console.log('No valid product_details found, skipping current product creation')
        }
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
      
      // Initialize with first product type if available (prefer walls)
      if (productTypeOptions.value.length > 0 && !form.value.product_type) {
        const wallsCategory = productTypeOptions.value.find(opt => opt.value === 'walls')
        form.value.product_type = wallsCategory ? wallsCategory.value : productTypeOptions.value[0].value
        console.log('Auto-selected product type in create mode:', form.value.product_type)
      }
      
      // Prefill barcode if provided
      if (props.barcode) {
        form.value.barcode = props.barcode
        console.log('Prefilled barcode:', props.barcode)
      }
      
      console.log('Form initialized in create mode:', {
        productType: form.value.product_type,
        productMode: productMode.value,
        isBundle: form.value.is_bundle
      })
    }
  }
})
</script>

<style scoped>
/* Dialog positioning and scrollable fixes */
.sku-form-dialog-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.sku-form-dialog {
  position: relative;
  z-index: 6000;
  margin: auto;
  width: 100%;
  /* Ensure the dialog card doesn't interfere with dropdowns */
  overflow: visible;
}

/* Scrollable content area */
.sku-form-dialog .q-card-section {
  scroll-behavior: smooth;
}

.sku-form-dialog .q-card-section::-webkit-scrollbar {
  width: 6px;
}

.sku-form-dialog .q-card-section::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.sku-form-dialog .q-card-section::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.sku-form-dialog .q-card-section::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

@media (max-width: 768px) {
  .sku-form-dialog-container {
    padding: 0.5rem;
  }
  
  .sku-form-dialog {
    min-width: auto !important;
    max-width: 100% !important;
    height: 95vh !important;
    max-height: 95vh !important;
  }
  
  .sku-form-dialog .q-card-section {
    max-height: calc(95vh - 120px) !important;
  }
}

/* Ensure dropdowns appear correctly within the dialog */
.sku-form-dialog :deep(.q-menu) {
  z-index: 9000 !important;
}

.sku-form-dialog :deep(.q-select__dropdown) {
  z-index: 9000 !important;
}

.sku-form-dialog :deep(.q-select__dropdown .q-item) {
  z-index: 9001 !important;
}

/* Fix for select options positioning */
.sku-form-dialog :deep(.q-select) {
  position: relative;
}

.sku-form-dialog :deep(.q-field__control) {
  position: relative;
}

/* Prevent card overflow issues */
.sku-form-dialog .q-card__section {
  overflow: visible;
}

/* Ensure form sections don't clip dropdowns */
.sku-form-dialog .q-form {
  overflow: visible;
}

/* Mobile Responsive Dialog Fixes */
@media (max-width: 768px) {
  /* Dialog Card Mobile Overrides */
  .q-card {
    width: 100vw !important;
    max-width: 100vw !important;
    min-width: auto !important;
    height: auto !important;
    max-height: 95vh !important;
    margin: 0 !important;
    border-radius: 16px !important;
  }
  
  /* Dialog Header */
  .q-card__section {
    padding: 1rem !important;
  }
  
  .text-h6 {
    font-size: 1.125rem !important;
  }
  
  /* Form Layout Improvements */
  .q-form .row.q-col-gutter-md {
    margin: -0.5rem !important;
  }
  
  .q-form .row.q-col-gutter-md > div {
    padding: 0.5rem !important;
  }
  
  .q-form .row.q-col-gutter-sm {
    margin: -0.25rem !important;
  }
  
  .q-form .row.q-col-gutter-sm > div {
    padding: 0.25rem !important;
  }
  
  /* All columns full width on mobile */
  .col-12.col-sm-6,
  .col-sm-6,
  .col-md-6 {
    width: 100% !important;
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  
  /* Form Fields */
  .q-field {
    margin-bottom: 1rem !important;
  }
  
  .q-input,
  .q-select {
    font-size: 1rem !important;
  }
  
  .q-field__label {
    font-size: 0.875rem !important;
  }
  
  .q-field__control {
    min-height: 48px !important;
  }
  
  /* Generate button full width on mobile */
  .row.q-col-gutter-sm .col-auto {
    width: 100% !important;
    flex: 0 0 100% !important;
    margin-top: 0.5rem !important;
  }
  
  .row.q-col-gutter-sm .col-auto .q-btn {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
  }
  
  /* Form Buttons */
  .q-card-actions {
    padding: 1rem !important;
    flex-wrap: wrap !important;
    gap: 0.75rem !important;
  }
  
  .q-card-actions .q-btn {
    flex: 1 !important;
    min-width: auto !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
  }
  
  /* Cancel buttons smaller */
  .q-card-actions .q-btn[color="grey-7"],
  .q-card-actions .q-btn.q-btn--flat {
    flex: 0 0 auto !important;
    min-width: 100px !important;
  }
  
  /* Checkbox and Radio Groups */
  .q-checkbox,
  .q-radio {
    font-size: 0.875rem !important;
  }
  
  .q-option-group {
    flex-direction: column !important;
    align-items: flex-start !important;
  }
  
  .q-option-group .q-radio {
    margin-bottom: 0.5rem !important;
  }
  
  /* Textarea */
  .q-input[type="textarea"] .q-field__control {
    min-height: 120px !important;
  }
  
  /* Number inputs */
  .q-input[type="number"] .q-field__control {
    min-height: 48px !important;
  }
  
  /* Select dropdowns */
  .q-select .q-field__control {
    min-height: 48px !important;
  }
  
  /* Loading states */
  .q-btn .q-spinner {
    width: 16px !important;
    height: 16px !important;
  }
  
  /* Separators */
  .q-separator {
    margin: 0.5rem 0 !important;
  }
  
  /* Text content */
  .text-caption {
    font-size: 0.75rem !important;
    line-height: 1.3 !important;
  }
  
  .text-subtitle2 {
    font-size: 0.875rem !important;
    margin-bottom: 0.75rem !important;
  }
  
  /* Icons */
  .q-icon {
    font-size: 1.25rem !important;
  }
  
  /* Close button */
  .q-btn[icon="close"] {
    width: 40px !important;
    height: 40px !important;
  }
  
  /* Focus states */
  .q-field--focused .q-field__control {
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2) !important;
  }
  
  /* Error states */
  .q-field--error .q-field__control {
    border-color: #f44336 !important;
  }
  
  /* Success states */
  .q-field--success .q-field__control {
    border-color: #4caf50 !important;
  }
  
  /* Disabled states */
  .q-field--disabled {
    opacity: 0.6 !important;
  }
  
  /* Product type specific sections */
  .text-primary {
    color: #1976d2 !important;
  }
  
  /* Bundle/Kit toggles */
  .q-checkbox__label {
    font-size: 0.875rem !important;
    line-height: 1.4 !important;
  }
  
  /* Spacing fixes for complex forms */
  .col-12:not(:last-child) {
    margin-bottom: 0.5rem !important;
  }
  
  /* Validation Messages */
  .q-field__messages {
    font-size: 0.75rem !important;
    padding: 0.25rem 0 !important;
  }
  
  /* Hint Text */
  .q-field__bottom {
    font-size: 0.75rem !important;
  }
}
</style>
