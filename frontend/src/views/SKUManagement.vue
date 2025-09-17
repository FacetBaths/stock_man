<script setup lang="ts">
import { ref, onMounted, computed,watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useSKUStore } from '@/stores/sku'
import { useCategoryStore } from '@/stores/category'
import { useInventoryStore } from '@/stores/inventory'
import { inventoryApi, instancesApi } from '@/utils/api'
import { PRODUCT_TYPES, type SKU } from '@/types'
import { getCategoryColor as utilGetCategoryColor, getCategoryColorFromData, getStatusColor as utilGetStatusColor } from '@/utils/colors'
import { formatCategoryName } from '@/utils/formatting'
import StockStatusChip from '@/components/StockStatusChip.vue'
import SKUFormDialog from '@/components/SKUFormDialog.vue'
import AddCostDialog from '@/components/AddCostDialog.vue'
import BatchScanDialog from '@/components/BatchScanDialog.vue'
import ExportDialog from '@/components/ExportDialog.vue'
import StatsCarousel from '@/components/StatsCarousel.vue'
// In your SKU Management component (e.g., SKUManagement.vue)
import { useRoute } from 'vue-router'





const $q = useQuasar()
const route = useRoute()
const authStore = useAuthStore()
const skuStore = useSKUStore()
const categoryStore = useCategoryStore()
const inventoryStore = useInventoryStore()

// State
const selectedSKUs = ref<SKU[]>([])
const selectedSKU = ref<SKU | null>(null)
const showFormDialog = ref(false)
const showAddCostDialog = ref(false)
const showBatchScanDialog = ref(false)
const showExportDialog = ref(false)

// Products without SKUs state
const productsWithoutSKUs = ref<any[]>([])
const selectedProductsWithoutSKUs = ref<any[]>([])
const loadingProductsWithoutSKUs = ref(false)
const productForSKUCreation = ref<any | null>(null)

// Table configuration
const columns = [
  {
    name: 'sku_code',
    label: 'SKU Code',
    field: 'sku_code',
    align: 'left',
    sortable: true
  },
  {
    name: 'category',
    label: 'Category',
    field: 'category_id',
    align: 'center',
    sortable: true
  },
  {
    name: 'barcode',
    label: 'Barcode',
    field: 'barcode',
    align: 'left',
    sortable: false
  },
  {
    name: 'stock_status',
    label: 'Stock Status',
    field: 'stockStatus',
    align: 'center',
    sortable: true
  },
  {
    name: 'current_cost',
    label: 'Current Cost',
    field: 'unit_cost',
    align: 'right',
    sortable: true
  },
  {
    name: 'totalQuantity',
    label: 'Total Quantity',
    field: (row: any) => row.inventory?.total_quantity || 0,
    align: 'right',
    sortable: true
  },
  {
    name: 'quantity_controls',
    label: 'Quick Adjust',
    field: '',
    align: 'center',
    sortable: false
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    field: '',
    align: 'center',
    sortable: false
  }
]

const tablePagination = computed(() => ({
  sortBy: 'sku_code',
  descending: false,
  page: skuStore.pagination.currentPage,
  rowsPerPage: skuStore.pagination.limit,
  rowsNumber: skuStore.pagination.totalSkus
}))


const categoryOptions = computed(() => {
  return categoryStore.categories.map(category => ({
    label: formatCategoryName(category.name),
    value: category._id
  }))
})

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Discontinued', value: 'discontinued' }
]

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const formatProductType = (type: string) => {
  const found = PRODUCT_TYPES.find(t => t.value === type)
  return found ? found.label : type
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const getStatusColor = (status: string) => {
  return utilGetStatusColor(status)
}

const getCategoryName = (categoryId: string | any) => {
  if (!categoryId) return 'Uncategorized'

  let categoryName = ''
  
  // Handle case where categoryId is already populated object from backend
  if (typeof categoryId === 'object' && categoryId.displayName) {
    categoryName = categoryId.displayName
  } else if (typeof categoryId === 'object' && categoryId.name) {
    categoryName = categoryId.name
  } else if (typeof categoryId === 'string') {
    // Handle case where categoryId is still just an ID string
    const category = categoryStore.categories.find(c => c._id === categoryId)
    categoryName = category ? category.name : 'Unknown Category'
  } else {
    categoryName = 'Unknown Category'
  }
  
  // Apply proper formatting
  return formatCategoryName(categoryName)
}

const getCategoryColor = (categoryId: string | any) => {
  // If categoryId is a populated category object, use the database color
  if (typeof categoryId === 'object' && categoryId) {
    return getCategoryColorFromData(categoryId)
  }
  
  // If it's just an ID string, find the category in store and use database color
  if (typeof categoryId === 'string') {
    const category = categoryStore.categories.find(c => c._id === categoryId)
    if (category) {
      return getCategoryColorFromData(category)
    }
  }
  
  // Fallback to generated color
  const color = utilGetCategoryColor(categoryId)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Category ${categoryId} assigned fallback color: ${color}`)
  }
  return color
}

// Get stock status from inventory data based on backend flags
const getStockStatus = (sku: any) => {
  if (!sku.inventory) return 'out_of_stock'

  // Use backend calculated flags first (preferred)
  if (sku.inventory.is_out_of_stock) {
    return 'out_of_stock'
  }
  if (sku.inventory.is_overstock) {
    return 'overstocked'
  }
  if (sku.inventory.is_low_stock) {
    return 'understocked'
  }

  // Fallback to manual calculation if backend flags not available
  const totalQty = sku.inventory.total_quantity || 0
  const availableQty = sku.inventory.available_quantity || 0
  const thresholds = sku.stock_thresholds || { understocked: 5, overstocked: 100 }

  if (totalQty === 0 || availableQty === 0) {
    return 'out_of_stock'
  }
  if (totalQty >= thresholds.overstocked) {
    return 'overstocked'
  }
  if (availableQty <= thresholds.understocked) {
    return 'understocked'
  }

  return 'adequate'
}

const refreshData = async () => {
  await skuStore.fetchSKUs({
    include_inventory: true, // Include inventory data for stock status
    ...skuStore.filters
  })
}

const applyFilters = async () => {
  await skuStore.fetchSKUs({
    include_inventory: true,
    ...skuStore.filters
  })
}

const clearFilters = async () => {
  skuStore.clearFilters()
  await skuStore.fetchSKUs({
    include_inventory: true
  })
}

const onTableRequest = (props: any) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  skuStore.fetchSKUs({
    page,
    limit: rowsPerPage,
    // Add sorting when backend supports it
  })
}

// Dialog methods
const openCreateDialog = () => {
  console.log('openCreateDialog called')
  selectedSKU.value = null
  showFormDialog.value = true
  console.log('showFormDialog set to:', showFormDialog.value)
}

const openEditDialog = async (sku: SKU) => {
  try {
    // Fetch the full SKU details with populated product_details
    const fullSKU = await skuStore.fetchSKU(sku._id)
    selectedSKU.value = fullSKU
    showFormDialog.value = true
  } catch (error: any) {
    console.error('Error fetching SKU details:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load SKU details'
    })
  }
}

const openAddCostDialog = (sku: SKU) => {
  selectedSKU.value = sku
  showAddCostDialog.value = true
}

const openBatchScanDialog = () => {
  showBatchScanDialog.value = true
}

const openExportDialog = () => {
  showExportDialog.value = true
}

// Event handlers
const onSKUSaved = async () => {
  showFormDialog.value = false
  selectedSKU.value = null
  productForSKUCreation.value = null

  await Promise.all([
    refreshData(),
    loadProductsWithoutSKUs()
  ])

  $q.notify({
    type: 'positive',
    message: 'SKU saved successfully'
  })
}

const onCostAdded = () => {
  showAddCostDialog.value = false
  selectedSKU.value = null
  refreshData()
  $q.notify({
    type: 'positive',
    message: 'Cost added successfully'
  })
}

const onBatchProcessed = () => {
  showBatchScanDialog.value = false
  refreshData()
}

// Delete methods
const confirmDelete = (sku: SKU) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete SKU "${sku.sku_code}"?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await skuStore.deleteSKU(sku._id)
      $q.notify({
        type: 'positive',
        message: 'SKU deleted successfully'
      })
    } catch (error: any) {
      $q.notify({
        type: 'negative',
        message: error.message || 'Failed to delete SKU'
      })
    }
  })
}

const confirmDeleteSelected = () => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete ${selectedSKUs.value.length} selected SKU(s)?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      for (const sku of selectedSKUs.value) {
        await skuStore.deleteSKU(sku._id)
      }
      selectedSKUs.value = []
      $q.notify({
        type: 'positive',
        message: 'SKUs deleted successfully'
      })
    } catch (error: any) {
      $q.notify({
        type: 'negative',
        message: error.message || 'Failed to delete SKUs'
      })
    }
  })
}

// Products without SKUs table columns
const productsWithoutSKUsColumns = [
  {
    name: 'product_info',
    label: 'Product',
    field: 'product_details',
    align: 'left',
    sortable: false
  },
  {
    name: 'quantity',
    label: 'Quantity',
    field: 'quantity',
    align: 'center',
    sortable: true
  },
  {
    name: 'location',
    label: 'Location',
    field: 'location',
    align: 'left',
    sortable: false
  },
  {
    name: 'cost',
    label: 'Cost',
    field: 'cost',
    align: 'right',
    sortable: true,
    format: (val: number) => `$${formatCurrency(val)}`
  },
  {
    name: 'actions',
    label: 'Actions',
    field: '',
    align: 'center',
    sortable: false
  }
]

// Products without SKUs methods
const loadProductsWithoutSKUs = async () => {
  try {
    loadingProductsWithoutSKUs.value = true
    // Get all items that don't have SKUs assigned
    const response = await inventoryApi.getItems({ limit: 1000 })
    // Handle case where response.items might be undefined
    if (response && response.items && Array.isArray(response.items)) {
      productsWithoutSKUs.value = response.items.filter(item => !item.sku_id)
    } else {
      console.warn('No items found in response or invalid response format')
      productsWithoutSKUs.value = []
    }
  } catch (error) {
    console.error('Error loading products without SKUs:', error)
    // Set empty array on error to prevent UI issues
    productsWithoutSKUs.value = []
    $q.notify({
      type: 'negative',
      message: 'Failed to load products without SKUs'
    })
  } finally {
    loadingProductsWithoutSKUs.value = false
  }
}

const getProductDisplayName = (item: any) => {
  const details = item.product_details as any
  if (details.name) {
    return details.name
  }
  if (details.product_line && details.color_name) {
    return `${details.product_line} - ${details.color_name}`
  }
  if (details.brand && details.model) {
    return `${details.brand} ${details.model}`
  }
  return `${formatProductType(item.product_type)} Product`
}

const openCreateSKUForProduct = (item: any) => {
  productForSKUCreation.value = item
  selectedSKU.value = null
  showFormDialog.value = true
}

const openBulkCreateDialog = () => {
  if (selectedProductsWithoutSKUs.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Please select products to create SKUs for'
    })
    return
  }

  $q.dialog({
    title: 'Bulk Create SKUs',
    message: `Create SKUs for ${selectedProductsWithoutSKUs.value.length} selected products?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      let created = 0
      let failed = 0

      for (const item of selectedProductsWithoutSKUs.value) {
        try {
          // Extract the Product ID from the item's product_details
          const productDetailsId = typeof item.product_details === 'string' ?
            item.product_details :
            (item.product_details as any)?._id

          if (!productDetailsId) {
            console.error(`No product_details ID found for item ${item._id}`)
            failed++
            continue
          }

          // TODO: This bulk creation functionality needs to be updated for new architecture
          // Generate SKU code using new category-based approach
          /*
          const skuCode = await skuStore.generateSKUCode({
            product_type: item.product_type,
            product_details: productDetailsId
          })
          */
          throw new Error('Bulk SKU creation is temporarily disabled - please use individual SKU creation')

          // Create SKU
          await skuStore.createSKU({
            sku_code: skuCode,
            product_type: item.product_type,
            product_details: productDetailsId,
            current_cost: item.cost || 0,
            stock_thresholds: item.stock_thresholds || {
              understocked: 5,
              overstocked: 100
            },
            description: `Auto-created for ${getProductDisplayName(item)}`,
            notes: 'Bulk created from products without SKUs'
          })

          created++
        } catch (error) {
          console.error(`Failed to create SKU for product ${item._id}:`, error)
          failed++
        }
      }

      // Refresh data
      await Promise.all([
        refreshData(),
        loadProductsWithoutSKUs()
      ])

      // Clear selection
      selectedProductsWithoutSKUs.value = []

      $q.notify({
        type: 'positive',
        message: `Created ${created} SKUs successfully${failed > 0 ? `, ${failed} failed` : ''}`
      })
    } catch (error: any) {
      $q.notify({
        type: 'negative',
        message: error.message || 'Failed to bulk create SKUs'
      })
    }
  })
}

// Quantity adjustment methods
const adjustQuantity = async (sku: SKU, adjustment: number) => {
  try {
    const response = await instancesApi.adjustQuantity({
      sku_id: sku._id,
      adjustment: adjustment,
      reason: 'Quick adjustment from SKU Management'
    })

    // Update the SKU in the local store optimistically
    const skuIndex = skuStore.skus.findIndex(s => s._id === sku._id)
    if (skuIndex !== -1 && skuStore.skus[skuIndex].inventory) {
      const currentAvailable = skuStore.skus[skuIndex].inventory!.available_quantity || 0
      const currentTotal = skuStore.skus[skuIndex].inventory!.total_quantity || 0

      skuStore.skus[skuIndex].inventory!.available_quantity = Math.max(0, currentAvailable + adjustment)
      skuStore.skus[skuIndex].inventory!.total_quantity = Math.max(0, currentTotal + adjustment)
    }

    $q.notify({
      type: 'positive',
      message: response.message || `Successfully ${adjustment > 0 ? 'increased' : 'decreased'} quantity by ${Math.abs(adjustment)}`
    })

    // Refresh data to get accurate counts
    await refreshData()
  } catch (error: any) {
    console.error('Error adjusting quantity:', error)
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || error.message || 'Failed to adjust quantity'
    })
  }
}

const openBulkAdjustDialog = (sku: SKU) => {
  $q.dialog({
    title: 'Bulk Adjust Quantity',
    message: `Current quantity: ${sku.inventory?.available_quantity || 0}`,
    prompt: {
      model: '',
      type: 'number',
      placeholder: 'Enter adjustment amount (+/-)',
      hint: 'Positive numbers increase, negative numbers decrease'
    },
    cancel: true,
    persistent: true
  }).onOk(async (adjustmentStr: string) => {
    const adjustment = parseInt(adjustmentStr)
    if (isNaN(adjustment) || adjustment === 0) {
      $q.notify({
        type: 'warning',
        message: 'Please enter a valid non-zero number'
      })
      return
    }

    const currentQuantity = sku.inventory?.available_quantity || 0
    if (adjustment < 0 && Math.abs(adjustment) > currentQuantity) {
      $q.notify({
        type: 'warning',
        message: `Cannot decrease by ${Math.abs(adjustment)}. Only ${currentQuantity} available.`
      })
      return
    }

    await adjustQuantity(sku, adjustment)
  })
}

// Computed stats for carousel
const skuStats = computed(() => [
  {
    value: skuStore.skuStats.total,
    label: 'Total SKUs',
    icon: 'inventory',
    iconColor: 'blue',
    colClass: 'col-12 col-sm-6 col-md-3'
  },
  {
    value: skuStore.skuStats.withBarcodes,
    label: 'With Barcodes',
    icon: 'qr_code',
    iconColor: 'green',
    colClass: 'col-12 col-sm-6 col-md-3'
  },
  {
    value: skuStore.skuStats.understocked,
    label: 'Low Stock',
    icon: 'warning',
    iconColor: 'red',
    colClass: 'col-12 col-sm-6 col-md-3'
  },
  {
    value: `$${formatCurrency(skuStore.skuStats.totalValue)}`,
    label: 'Total Value',
    icon: 'attach_money',
    iconColor: 'green',
    colClass: 'col-12 col-sm-6 col-md-3'
  }
])

console.log({skuStore})
console.log({categoryStore})
console.log({inventoryStore})

// Apply search from query params when component loads
onMounted(() => {
  const searchQuery = route.query.search as string
  if (searchQuery) {
    skuStore.updateFilters({ search: searchQuery })
    // Trigger search/fetch with the filter
    skuStore.fetchSKUs()
  }
})

// Watch for query changes (if user navigates with different search)
watch(() => route.query.search, (newSearch) => {
  if (newSearch) {
    skuStore.updateFilters({ search: newSearch as string })
    skuStore.fetchSKUs()
  }
})
// Lifecycle
onMounted(async () => {
  await Promise.all([
    categoryStore.fetchCategories(),
    skuStore.fetchSKUCount(), // Fetch accurate product SKU count (excluding tools)
    refreshData(),
    loadProductsWithoutSKUs()
  ])
})
</script>
<template>
  <div class="q-pa-md">
    <!-- Page Header -->
    <div class="glass-card q-pa-lg q-mb-lg">
      <div class="row items-center q-gutter-md">
        <q-icon name="qr_code" size="48px" class="text-primary" />
        <div>
          <h4 class="text-h4 q-ma-none text-weight-bold text-dark">SKU Management</h4>
          <p class="text-body1 q-ma-none text-grey-7">
            Manage product SKUs, barcodes, and stock levels
          </p>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="q-mb-md">
      <StatsCarousel :stats="skuStats" :is-loading="skuStore.loading" />
    </div>

    <!-- Filters -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="row q-col-gutter-md items-end">
          <div class="col-xs-12 col-sm-6 col-md-3">
            <q-input
              v-model="skuStore.filters.search"
              label="Search SKUs"
              outlined
              dense
              clearable
              @keyup.enter="applyFilters"
              @clear="applyFilters"
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <div class="col-xs-12 col-sm-6 col-md-3">
            <q-select
              v-model="skuStore.filters.category_id"
              label="Category"
              outlined
              dense
              clearable
              :options="categoryOptions"
              emit-value
              map-options
              @update:model-value="applyFilters"
            />
          </div>

          <div class="col-xs-12 col-sm-6 col-md-3">
            <q-select
              v-model="skuStore.filters.status"
              label="Status"
              outlined
              dense
              clearable
              :options="statusOptions"
              emit-value
              map-options
              @update:model-value="applyFilters"
            />
          </div>

          <div class="col-xs-12 col-sm-6 col-md-3">
            <q-btn
              color="primary"
              label="Apply Filters"
              icon="filter_list"
              @click="applyFilters"
            />
            <q-btn
              flat
              color="grey-7"
              label="Clear"
              @click="clearFilters"
              class="q-ml-sm"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Actions -->
    <div class="glass-card q-pa-md q-mb-lg">
      <div class="row items-center justify-between">
        <div class="col-auto">
          <h6 class="text-h6 q-ma-none text-weight-bold text-dark">Quick Actions</h6>
          <p class="text-caption q-ma-none text-grey-7">Create, scan, or export SKU data</p>
        </div>
        <div class="col-auto">
          <div class="row q-gutter-sm">
            <q-btn
              color="primary"
              label="Add SKU"
              icon="add"
              @click="openCreateDialog"
              :disable="!authStore.canWrite"
              class="action-btn"
              no-caps
              size="md"
            />
            <q-btn
              color="secondary"
              label="Batch Scan"
              icon="qr_code_scanner"
              @click="openBatchScanDialog"
              :disable="!authStore.canWrite"
              class="action-btn"
              no-caps
              size="md"
            />
            <q-btn
              color="accent"
              label="Export"
              icon="download"
              @click="openExportDialog"
              class="action-btn"
              no-caps
              size="md"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Products Without SKUs Section -->
    <q-card class="q-mb-md" v-if="productsWithoutSKUs.length > 0">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <div class="col">
            <div class="text-h6 text-weight-bold text-orange">
              <q-icon name="warning" class="q-mr-sm" />
              Products Without SKUs ({{ productsWithoutSKUs.length }})
            </div>
            <div class="text-caption text-grey-6">
              These products existed before SKU implementation and need SKUs
              assigned
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              color="orange"
              label="Bulk Create SKUs"
              icon="batch_prediction"
              @click="openBulkCreateDialog"
              :disable="
                !authStore.canWrite || selectedProductsWithoutSKUs.length === 0
              "
            />
          </div>
        </div>

        <q-table
          :rows="productsWithoutSKUs"
          :columns="productsWithoutSKUsColumns"
          :loading="loadingProductsWithoutSKUs"
          row-key="_id"
          selection="multiple"
          v-model:selected="selectedProductsWithoutSKUs"
          dense
          :pagination="{ rowsPerPage: 5 }"
          @row-click="(evt, row) => openCreateSKUForProduct(row)"
          class="products-without-skus-table"
        >
          <template v-slot:no-data>
            <div
              class="full-width row flex-center text-positive q-gutter-sm q-pa-lg"
            >
              <q-icon size="2em" name="check_circle" />
              <span>All products have SKUs assigned!</span>
            </div>
          </template>

          <template v-slot:body-cell-product_info="props">
            <q-td :props="props">
              <div class="text-weight-medium">
                {{ getProductDisplayName(props.row) }}
              </div>
              <div class="text-caption text-grey-6">
                {{ formatProductType(props.row.product_type) }}
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-quantity="props">
            <q-td :props="props">
              <q-chip
                :label="props.value"
                :color="props.value > 0 ? 'green' : 'grey'"
                text-color="white"
                dense
              />
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                size="sm"
                color="primary"
                label="Create SKU"
                @click.stop="openCreateSKUForProduct(props.row)"
                :disable="!authStore.canWrite"
              />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- SKU Table -->
    <q-card>
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">SKU Inventory</div>
        <q-space />
        <div class="text-caption text-grey-6">
          {{ skuStore.skus.length }} SKU{{
            skuStore.skus.length !== 1 ? "s" : ""
          }}
          loaded
        </div>
      </q-card-section>

      <!-- Mobile Card Layout -->
      <div class="mobile-sku-cards q-pa-md" v-if="$q.screen.lt.md">
        <div 
          v-for="sku in skuStore.skus" 
          :key="sku._id" 
          class="mobile-sku-card q-mb-md"
          @click="openEditDialog(sku)"
        >
          <q-card class="sku-mobile-card" :class="{ 'selected': selectedSKUs.includes(sku) }">
            <!-- Header Row -->
            <q-card-section class="sku-card-header">
              <div class="row items-center justify-between no-wrap">
                <div class="sku-main-info">
                  <div class="text-weight-bold text-body1">{{ sku.sku_code }}</div>
                  <q-chip
                    :label="getCategoryName(sku.category_id)"
                    :color="getCategoryColor(sku.category_id)"
                    text-color="white"
                    size="sm"
                    class="q-mt-xs"
                  />
                </div>
                <div class="selection-checkbox">
                  <q-checkbox 
                    v-model="selectedSKUs" 
                    :val="sku" 
                    @click.stop
                    size="sm"
                  />
                </div>
              </div>
            </q-card-section>
            
            <!-- Details Grid -->
            <q-card-section class="sku-card-details q-pt-none">
              <div class="row q-col-gutter-sm">
                <!-- Stock Status -->
                <div class="col-6">
                  <div class="detail-label">Stock Status</div>
                  <StockStatusChip
                    :status="getStockStatus(sku)"
                    :quantity="sku.inventory?.total_quantity || 0"
                    :thresholds="sku.stock_thresholds"
                    size="sm"
                  />
                </div>
                
                <!-- Current Cost -->
                <div class="col-6">
                  <div class="detail-label">Current Cost</div>
                  <div class="detail-value">
                    ${{ formatCurrency(sku.unit_cost || 0) }}
                  </div>
                </div>
                
                <!-- Status -->
                <div class="col-6">
                  <div class="detail-label">Status</div>
                  <q-chip
                    :label="formatStatus(sku.status)"
                    :color="getStatusColor(sku.status)"
                    text-color="white"
                    size="sm"
                  />
                </div>
                
                <!-- Total Quantity -->
                <div class="col-6">
                  <div class="detail-label">Total Quantity</div>
                  <div class="detail-value">{{ sku.inventory?.total_quantity || 0 }}</div>
                </div>
              </div>
              
              <!-- Barcode (if available) -->
              <div v-if="sku.barcode" class="row q-mt-sm">
                <div class="col-12">
                  <div class="detail-label">Barcode</div>
                  <div class="detail-value">
                    <q-icon name="qr_code" class="q-mr-xs" />
                    {{ sku.barcode }}
                  </div>
                </div>
              </div>
            </q-card-section>
            
            <!-- Quick Actions Row -->
            <q-card-section class="sku-card-actions q-pt-none">
              <div class="row q-col-gutter-xs items-center">
                <!-- Quantity Controls -->
                <div class="col-12 col-sm-6">
                  <div class="quantity-controls-mobile">
                    <q-btn
                      size="sm"
                      color="negative"
                      icon="remove"
                      round
                      @click.stop="adjustQuantity(sku, -1)"
                      :disable="
                        !authStore.canWrite ||
                        (sku.inventory?.available_quantity || 0) === 0
                      "
                    />
                    
                    <div class="current-quantity">
                      {{ sku.inventory?.available_quantity || 0 }}
                    </div>
                    
                    <q-btn
                      size="sm"
                      color="positive"
                      icon="add"
                      round
                      @click.stop="adjustQuantity(sku, 1)"
                      :disable="!authStore.canWrite"
                    />
                    
                    <q-btn
                      size="sm"
                      color="blue"
                      icon="tune"
                      round
                      @click.stop="openBulkAdjustDialog(sku)"
                      :disable="!authStore.canWrite"
                    />
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="col-12 col-sm-6">
                  <div class="action-buttons-mobile">
                    <q-btn
                      size="sm"
                      color="primary"
                      icon="edit"
                      round
                      @click.stop="openEditDialog(sku)"
                      :disable="!authStore.canWrite"
                    >
                      <q-tooltip>Edit SKU</q-tooltip>
                    </q-btn>
                    
                    <q-btn
                      size="sm"
                      color="green"
                      icon="attach_money"
                      round
                      @click.stop="openAddCostDialog(sku)"
                      :disable="!authStore.canWrite"
                    >
                      <q-tooltip>Add Cost</q-tooltip>
                    </q-btn>
                    
                    <q-btn
                      size="sm"
                      color="negative"
                      icon="delete"
                      round
                      @click.stop="confirmDelete(sku)"
                      :disable="!authStore.canWrite"
                    >
                      <q-tooltip>Delete SKU</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        
        <!-- Loading State -->
        <div v-if="skuStore.isLoading" class="text-center q-py-xl">
          <q-circular-progress
            indeterminate
            size="50px"
            color="primary"
            class="q-mb-md"
          />
          <div class="text-body1 text-grey-7">Loading SKUs...</div>
        </div>
        
        <!-- Empty State -->
        <div v-else-if="skuStore.skus.length === 0" class="text-center q-py-xl">
          <q-icon name="inventory" size="64px" class="text-grey-5 q-mb-md" />
          <div class="text-h6 text-grey-6 q-mb-sm">No SKUs Found</div>
          <div class="text-body2 text-grey-7 q-mb-md">
            No SKUs match your current filters.
          </div>
          <q-btn
            color="primary"
            @click="openCreateDialog"
            label="Create First SKU"
            icon="add"
          />
        </div>
      </div>
      
      <!-- Desktop Table Layout -->
      <q-table
        v-else
        :rows="skuStore.skus"
        :columns="columns"
        :loading="skuStore.isLoading"
        :pagination="tablePagination"
        @request="onTableRequest"
        row-key="_id"
        selection="multiple"
        v-model:selected="selectedSKUs"
        binary-state-sort
        @row-click="(evt, row) => openEditDialog(row)"
      >
        <!-- Loading slot -->
        <template v-slot:loading>
          <q-inner-loading showing color="primary" />
        </template>

        <!-- No data slot -->
        <template v-slot:no-data="{ icon, message, filter }">
          <div class="full-width row flex-center text-grey-7 q-gutter-sm">
            <q-icon size="2em" :name="filter ? 'filter_list' : icon" />
            <span>{{ filter ? "No matching SKUs found" : message }}</span>
          </div>
        </template>

        <!-- Header actions slot -->
        <template v-slot:top-right>
          <div class="row q-gutter-sm">
            <q-btn
              v-if="selectedSKUs.length > 0"
              color="negative"
              label="Delete Selected"
              icon="delete"
              @click="confirmDeleteSelected"
              :disable="!authStore.canWrite"
            />
            <q-btn
              color="primary"
              icon="refresh"
              round
              @click="refreshData"
              :loading="skuStore.isLoading"
            >
              <q-tooltip>Refresh</q-tooltip>
            </q-btn>
          </div>
        </template>

        <!-- Custom columns -->
        <template v-slot:body-cell-sku_code="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.value }}</div>
            <div
              v-if="props.row.is_auto_generated"
              class="text-caption text-grey-6"
            >
              <q-icon name="auto_mode" size="xs" /> Auto-generated
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-category="props">
          <q-td :props="props">
            <q-chip
              :label="getCategoryName(props.row.category_id)"
              :color="getCategoryColor(props.row.category_id)"
              text-color="white"
              dense
            />
          </q-td>
        </template>

        <template v-slot:body-cell-barcode="props">
          <q-td :props="props">
            <div v-if="props.value">
              <q-icon name="qr_code" class="q-mr-xs" />
              {{ props.value }}
            </div>
            <div v-else class="text-grey-6">
              <q-icon name="qr_code_off" class="q-mr-xs" />
              No barcode
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-stock_status="props">
          <q-td :props="props">
            <StockStatusChip
              :status="getStockStatus(props.row)"
              :quantity="props.row.inventory?.total_quantity || 0"
              :thresholds="props.row.stock_thresholds"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-current_cost="props">
          <q-td :props="props">
            <div class="text-weight-medium">
              ${{ formatCurrency(props.value) }}
            </div>
            <div
              v-if="props.row.cost_history?.length > 1"
              class="text-caption text-grey-6"
            >
              {{ props.row.cost_history.length }} price changes
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-totalQuantity="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.value || 0 }}</div>
            <div v-if="props.row.itemCount" class="text-caption text-grey-6">
              {{ props.row.itemCount }} item{{
                props.row.itemCount !== 1 ? "s" : ""
              }}
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-quantity_controls="props">
          <q-td :props="props">
            <div class="row q-gutter-xs no-wrap items-center justify-center">
              <q-btn
                size="xs"
                color="negative"
                icon="remove"
                round
                @click.stop="adjustQuantity(props.row, -1)"
                :disable="
                  !authStore.canWrite ||
                  (props.row.inventory?.available_quantity || 0) === 0
                "
              >
                <q-tooltip>Decrease quantity by 1</q-tooltip>
              </q-btn>

              <div class="text-body2 text-center" style="min-width: 30px;">
                {{ props.row.inventory?.available_quantity || 0 }}
              </div>

              <q-btn
                size="xs"
                color="positive"
                icon="add"
                round
                @click.stop="adjustQuantity(props.row, 1)"
                :disable="!authStore.canWrite"
              >
                <q-tooltip>Increase quantity by 1</q-tooltip>
              </q-btn>

              <q-btn
                size="xs"
                color="blue"
                icon="tune"
                round
                @click.stop="openBulkAdjustDialog(props.row)"
                :disable="!authStore.canWrite"
              >
                <q-tooltip>Bulk adjust quantity</q-tooltip>
              </q-btn>
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-chip
              :label="formatStatus(props.value)"
              :color="getStatusColor(props.value)"
              text-color="white"
              dense
            />
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <div class="row q-gutter-xs no-wrap">
              <q-btn
                size="sm"
                color="primary"
                icon="edit"
                round
                @click.stop="openEditDialog(props.row)"
                :disable="!authStore.canWrite"
              >
                <q-tooltip>Edit SKU</q-tooltip>
              </q-btn>

              <q-btn
                size="sm"
                color="green"
                icon="attach_money"
                round
                @click.stop="openAddCostDialog(props.row)"
                :disable="!authStore.canWrite"
              >
                <q-tooltip>Add Cost</q-tooltip>
              </q-btn>

              <q-btn
                size="sm"
                color="negative"
                icon="delete"
                round
                @click.stop="confirmDelete(props.row)"
                :disable="!authStore.canWrite"
              >
                <q-tooltip>Delete SKU</q-tooltip>
              </q-btn>
            </div>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Create/Edit Dialog -->
    <SKUFormDialog
      v-model="showFormDialog"
      :sku="selectedSKU"
      @saved="onSKUSaved"
    />

    <!-- Add Cost Dialog -->
    <AddCostDialog
      v-model="showAddCostDialog"
      :sku="selectedSKU"
      @saved="onCostAdded"
    />

    <!-- Batch Scan Dialog -->
    <BatchScanDialog
      v-model="showBatchScanDialog"
      @processed="onBatchProcessed"
    />

    <!-- Export Dialog -->
    <ExportDialog v-model="showExportDialog" export-type="skus" />
  </div>
</template>

<style scoped>
/* Glass card styling */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
}

/* Action buttons */
.action-btn {
  border-radius: 12px;
  padding: 8px 16px;
  font-weight: 600;
  min-width: 100px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.stat-card {
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

/* Mobile Responsiveness - Comprehensive */
@media (max-width: 768px) {
  /* Page Layout */
  .q-pa-md {
    padding: 0.75rem !important;
  }
  
  /* Glass Cards Mobile */
  .glass-card {
    margin-bottom: 1rem;
    padding: 1rem !important;
    border-radius: 12px;
  }
  
  .glass-card .row.items-center {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 1rem;
  }
  
  .glass-card .q-gutter-md > * {
    margin: 0.5rem 0 !important;
  }
  
  /* Page Header */
  .glass-card h4 {
    font-size: 1.5rem !important;
    margin-bottom: 0.5rem !important;
  }
  
  .glass-card p {
    font-size: 0.875rem !important;
  }
  
  /* Filter Section */
  .q-card .row.q-col-gutter-md {
    margin: -0.25rem !important;
  }
  
  .q-card .row.q-col-gutter-md > div {
    padding: 0.25rem !important;
  }
  
  .q-card .col-xs-12 {
    width: 100% !important;
    margin-bottom: 0.5rem;
  }
  
  .q-input, .q-select {
    font-size: 1rem;
  }
  
  .q-field__label {
    font-size: 0.875rem;
  }
  
  /* Filter Buttons */
  .col-xs-12.col-sm-6.col-md-3:last-child {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .col-xs-12.col-sm-6.col-md-3:last-child .q-btn {
    width: 100%;
    margin: 0 !important;
    margin-bottom: 0.5rem !important;
  }
  
  /* Action Buttons Section */
  .glass-card .row.items-center.justify-between {
    flex-direction: column;
    align-items: stretch !important;
    gap: 1rem;
  }
  
  .glass-card .col-auto {
    width: 100% !important;
  }
  
  .glass-card .col-auto:first-child {
    text-align: left;
  }
  
  .glass-card .col-auto:last-child {
    text-align: center;
  }
  
  .action-btn {
    width: 100% !important;
    margin-bottom: 0.5rem !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
    min-width: auto !important;
  }
  
  .row.q-gutter-sm {
    flex-direction: column !important;
    gap: 0.5rem !important;
  }
  
  .row.q-gutter-sm > * {
    margin: 0 !important;
  }
  
  /* Products Without SKUs Section */
  .q-card .row.items-center.q-mb-md {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 1rem;
  }
  
  .text-h6 {
    font-size: 1.125rem !important;
  }
  
  /* Table Improvements */
  .q-table {
    font-size: 0.875rem;
  }
  
  .q-table__container {
    max-height: 70vh;
  }
  
  .q-table .q-table__top {
    padding: 0.75rem !important;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .q-table .text-h6 {
    font-size: 1rem !important;
    margin-bottom: 0.5rem;
  }
  
  .q-table .text-caption {
    font-size: 0.75rem !important;
  }
  
  /* Table Header Actions */
  .q-table .row.q-gutter-sm {
    width: 100% !important;
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 0.5rem !important;
  }
  
  .q-table .row.q-gutter-sm .q-btn {
    flex: 1 !important;
    min-width: auto !important;
    font-size: 0.8rem !important;
    padding: 0.5rem 0.75rem !important;
  }
  
  /* Table Cells */
  .q-td {
    padding: 0.5rem 0.25rem !important;
    font-size: 0.8rem !important;
    min-width: auto !important;
  }
  
  .q-th {
    padding: 0.75rem 0.25rem !important;
    font-size: 0.75rem !important;
    font-weight: 600;
  }
  
  /* Table Row Actions - Better Organization */
  .q-td .row.q-gutter-xs {
    gap: 0.25rem !important;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .q-td .row.q-gutter-xs .q-btn {
    margin: 0 !important;
    width: 32px !important;
    height: 32px !important;
    min-width: auto !important;
    border-radius: 6px !important;
  }
  
  /* Quantity Controls - Cleaner Layout */
  .q-td .row.q-gutter-xs.no-wrap.items-center.justify-center {
    flex-wrap: nowrap !important;
    gap: 0.375rem !important;
    padding: 0.5rem 0.25rem;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
    margin: 0.25rem 0;
  }
  
  .q-td .row.q-gutter-xs.no-wrap.items-center.justify-center .q-btn {
    width: 28px !important;
    height: 28px !important;
    font-size: 0.8rem !important;
    border-radius: 4px !important;
  }
  
  .q-td .text-body2 {
    font-size: 0.9rem !important;
    min-width: 32px !important;
    text-align: center;
    font-weight: 700;
    color: #1976d2;
    background: rgba(25, 118, 210, 0.1);
    border-radius: 4px;
    padding: 0.125rem 0.25rem;
  }
  
  /* Chips */
  .q-chip {
    font-size: 0.7rem !important;
    padding: 0.125rem 0.5rem !important;
    height: auto !important;
    min-height: 24px !important;
  }
  
  .q-chip .q-icon {
    font-size: 0.8rem !important;
  }
  
  /* Table Content Responsive */
  .q-table .text-weight-medium {
    font-size: 0.8rem !important;
    line-height: 1.2;
  }
  
  .q-table .text-caption {
    font-size: 0.7rem !important;
    line-height: 1.1;
  }
  
  /* Hide less important columns on mobile */
  .q-table th:nth-child(3),
  .q-table td:nth-child(3) {
    display: none; /* Hide barcode column */
  }
  
  .q-table th:nth-child(6),
  .q-table td:nth-child(6) {
    display: none; /* Hide total quantity column */
  }
  
  /* Keep only essential columns visible */
  .q-table th:nth-child(1),
  .q-table td:nth-child(1) {
    min-width: 100px; /* SKU Code */
  }
  
  .q-table th:nth-child(2),
  .q-table td:nth-child(2) {
    min-width: 80px; /* Category */
  }
  
  .q-table th:nth-child(4),
  .q-table td:nth-child(4) {
    min-width: 80px; /* Stock Status */
  }
  
  .q-table th:nth-child(7),
  .q-table td:nth-child(7) {
    min-width: 100px; /* Quick Adjust */
  }
  
  .q-table th:nth-child(9),
  .q-table td:nth-child(9) {
    min-width: 90px; /* Actions */
  }
  
  /* Products without SKUs table */
  .products-without-skus-table .q-table__container {
    max-height: 40vh;
  }
  
  .products-without-skus-table .q-td {
    padding: 0.5rem 0.25rem !important;
  }
  
  .products-without-skus-table .text-weight-medium {
    font-size: 0.8rem !important;
    line-height: 1.2;
  }
  
  .products-without-skus-table .text-caption {
    font-size: 0.7rem !important;
  }
  
  .products-without-skus-table .q-btn {
    padding: 0.375rem 0.75rem !important;
    font-size: 0.75rem !important;
  }
  
  /* Pagination */
  .q-table .q-table__bottom {
    padding: 0.5rem !important;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .q-pagination {
    font-size: 0.8rem !important;
  }
  
  .q-pagination .q-btn {
    min-width: 32px !important;
    height: 32px !important;
    font-size: 0.8rem !important;
  }
  
  /* Loading States */
  .q-inner-loading {
    background: rgba(255, 255, 255, 0.9) !important;
  }
  
  .q-spinner {
    width: 40px !important;
    height: 40px !important;
  }
  
  /* No Data Messages */
  .full-width.row.flex-center {
    padding: 2rem 1rem !important;
  }
  
  .full-width.row.flex-center .q-icon {
    font-size: 1.5rem !important;
  }
  
  .full-width.row.flex-center span {
    font-size: 0.875rem !important;
    text-align: center;
  }
  
  /* Stats Carousel - handled by component */
  
  /* Dialog Improvements */
  .q-dialog__inner {
    padding: 0.5rem !important;
  }
  
  .q-card {
    margin: 0.5rem !important;
  }
  
  /* Selection indicators */
  .q-table .q-checkbox {
    transform: scale(0.9);
  }
  
  /* Toolbar spacing */
  .q-toolbar {
    padding: 0.5rem !important;
    min-height: auto !important;
  }
  
  /* Card sections */
  .q-card__section {
    padding: 1rem !important;
  }
  
  /* Icons in table cells */
  .q-td .q-icon {
    font-size: 1rem !important;
  }
  
  /* Tooltips */
  .q-tooltip {
    font-size: 0.75rem !important;
    padding: 0.25rem 0.5rem !important;
  }
  
  /* Status indicators */
  .q-badge {
    font-size: 0.7rem !important;
    padding: 0.125rem 0.375rem !important;
  }
  
  /* Form elements in dialogs */
  .q-dialog .q-field {
    margin-bottom: 1rem !important;
  }
  
  .q-dialog .q-btn {
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
  }
}

/* Mobile SKU Card Layout Styles */
.mobile-sku-cards {
  /* Container styles handled by q-pa-md */
}

.mobile-sku-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.mobile-sku-card:hover {
  transform: translateY(-2px);
}

.sku-mobile-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  overflow: hidden;
}

.sku-mobile-card:hover {
  border-color: rgba(25, 118, 210, 0.3);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.sku-mobile-card.selected {
  border-color: #1976d2;
  background: rgba(25, 118, 210, 0.05);
  transform: translateY(-1px);
}

.sku-card-header {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 1rem !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.sku-main-info {
  flex: 1;
  min-width: 0;
}

.sku-main-info .text-body1 {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #1a202c;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.selection-checkbox {
  flex-shrink: 0;
}

.sku-card-details {
  padding: 1rem !important;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.25rem;
}

.detail-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a202c;
  display: flex;
  align-items: center;
}

.sku-card-actions {
  background: rgba(248, 250, 252, 0.5);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding: 1rem !important;
}

.quantity-controls-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.current-quantity {
  font-size: 1rem;
  font-weight: 700;
  color: #1976d2;
  background: rgba(25, 118, 210, 0.1);
  border-radius: 6px;
  padding: 0.25rem 0.75rem;
  min-width: 40px;
  text-align: center;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.action-buttons-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-buttons-mobile .q-btn {
  min-width: 44px !important;
  height: 44px !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.action-buttons-mobile .q-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.quantity-controls-mobile .q-btn {
  min-width: 36px !important;
  height: 36px !important;
  border-radius: 6px !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.quantity-controls-mobile .q-btn:hover {
  transform: scale(1.05);
}

/* Mobile Card Details Responsive Spacing */
@media (max-width: 768px) {
  .sku-card-header {
    padding: 0.75rem !important;
  }
  
  .sku-card-details {
    padding: 0.75rem !important;
  }
  
  .sku-card-actions {
    padding: 0.75rem !important;
  }
  
  .sku-main-info .text-body1 {
    font-size: 1rem;
  }
  
  .detail-value {
    font-size: 0.85rem;
  }
  
  .quantity-controls-mobile {
    padding: 0.375rem;
    gap: 0.375rem;
  }
  
  .current-quantity {
    font-size: 0.9rem;
    padding: 0.125rem 0.5rem;
    min-width: 36px;
  }
  
  .action-buttons-mobile .q-btn {
    min-width: 40px !important;
    height: 40px !important;
  }
  
  .quantity-controls-mobile .q-btn {
    min-width: 32px !important;
    height: 32px !important;
  }
  
  /* Adjust grid spacing on mobile */
  .sku-card-details .row.q-col-gutter-sm {
    margin: -0.25rem !important;
  }
  
  .sku-card-details .row.q-col-gutter-sm > div {
    padding: 0.25rem !important;
  }
  
  .sku-card-actions .row.q-col-gutter-xs {
    margin: -0.125rem !important;
  }
  
  .sku-card-actions .row.q-col-gutter-xs > div {
    padding: 0.125rem !important;
  }

  /* Better chip sizing for mobile */
  .sku-mobile-card .q-chip {
    font-size: 0.7rem !important;
    padding: 0.125rem 0.5rem !important;
    height: 20px !important;
    line-height: 1.2;
  }
  
  /* Loading and empty states */
  .mobile-sku-cards .text-center.q-py-xl {
    padding: 3rem 1rem !important;
  }
  
  .mobile-sku-cards .text-h6 {
    font-size: 1.125rem !important;
  }
  
  .mobile-sku-cards .text-body1,
  .mobile-sku-cards .text-body2 {
    font-size: 0.875rem !important;
  }
  
  /* MODAL & DIALOG RESPONSIVE FIXES */
  
  /* Global Dialog Improvements */
  .q-dialog__inner {
    padding: 0.5rem !important;
  }
  
  /* All Dialog Cards Mobile */
  .q-dialog .q-card {
    width: 100% !important;
    max-width: 100% !important;
    min-width: auto !important;
    height: auto !important;
    max-height: 95vh !important;
    margin: 0 !important;
    border-radius: 16px !important;
  }
  
  /* Override specific dialog inline styles */
  .q-card[style*="min-width: 700px"],
  .q-card[style*="min-width: 400px"],
  .q-card[style*="min-width: 900px"] {
    min-width: auto !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  
  /* Dialog Headers */
  .q-dialog .q-card__section {
    padding: 1rem !important;
  }
  
  .q-dialog .text-h6 {
    font-size: 1.125rem !important;
  }
  
  /* Form Improvements */
  .q-dialog .q-form .row.q-col-gutter-md {
    margin: -0.5rem !important;
  }
  
  .q-dialog .q-form .row.q-col-gutter-md > div {
    padding: 0.5rem !important;
  }
  
  .q-dialog .q-form .row.q-col-gutter-sm {
    margin: -0.25rem !important;
  }
  
  .q-dialog .q-form .row.q-col-gutter-sm > div {
    padding: 0.25rem !important;
  }
  
  /* All columns full width on mobile */
  .q-dialog .col-12.col-sm-6,
  .q-dialog .col-sm-6,
  .q-dialog .col-md-6 {
    width: 100% !important;
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  
  /* Form Fields */
  .q-dialog .q-field {
    margin-bottom: 1rem !important;
  }
  
  .q-dialog .q-input,
  .q-dialog .q-select {
    font-size: 1rem !important;
  }
  
  .q-dialog .q-field__label {
    font-size: 0.875rem !important;
  }
  
  .q-dialog .q-field__control {
    min-height: 48px !important;
  }
  
  /* Form Buttons */
  .q-dialog .q-card-actions {
    padding: 1rem !important;
    flex-wrap: wrap !important;
    gap: 0.75rem !important;
  }
  
  .q-dialog .q-card-actions .q-btn {
    flex: 1 !important;
    min-width: auto !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
  }
  
  /* Cancel buttons smaller */
  .q-dialog .q-card-actions .q-btn[color="grey-7"],
  .q-dialog .q-card-actions .q-btn.q-btn--flat {
    flex: 0 0 auto !important;
    min-width: 100px !important;
  }
  
  /* Inline button rows */
  .q-dialog .row .col-auto .q-btn {
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
    min-width: auto !important;
  }
  
  /* Generate button full width on mobile */
  .q-dialog .row.q-col-gutter-sm .col-auto {
    width: 100% !important;
    flex: 0 0 100% !important;
    margin-top: 0.5rem !important;
  }
  
  .q-dialog .row.q-col-gutter-sm .col-auto .q-btn {
    width: 100% !important;
  }
  
  /* Checkbox and Radio Groups */
  .q-dialog .q-checkbox,
  .q-dialog .q-radio {
    font-size: 0.875rem !important;
  }
  
  .q-dialog .q-option-group {
    flex-direction: column !important;
    align-items: flex-start !important;
  }
  
  .q-dialog .q-option-group .q-radio {
    margin-bottom: 0.5rem !important;
  }
  
  /* Textarea */
  .q-dialog .q-input[type="textarea"] .q-field__control {
    min-height: 120px !important;
  }
  
  /* Number inputs */
  .q-dialog .q-input[type="number"] .q-field__control {
    min-height: 48px !important;
  }
  
  /* Select dropdowns */
  .q-dialog .q-select .q-field__control {
    min-height: 48px !important;
  }
  
  /* Chips in dialogs */
  .q-dialog .q-chip {
    font-size: 0.75rem !important;
    padding: 0.25rem 0.5rem !important;
    margin: 0.125rem !important;
  }
  
  /* Loading states */
  .q-dialog .q-btn .q-spinner {
    width: 16px !important;
    height: 16px !important;
  }
  
  /* Separators */
  .q-dialog .q-separator {
    margin: 0.5rem 0 !important;
  }
  
  /* Text content */
  .q-dialog .text-caption {
    font-size: 0.75rem !important;
    line-height: 1.3 !important;
  }
  
  .q-dialog .text-subtitle2 {
    font-size: 0.875rem !important;
    margin-bottom: 0.75rem !important;
  }
  
  /* Icons in dialogs */
  .q-dialog .q-icon {
    font-size: 1.25rem !important;
  }
  
  /* BATCH SCAN DIALOG SPECIFIC FIXES */
  
  /* Maximized dialogs */
  .q-dialog--maximized .q-card {
    width: 100% !important;
    height: 100% !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
  }
  
  /* Batch scan layout stacking */
  .q-dialog--maximized .row.q-col-gutter-md > .col-12.col-md-4,
  .q-dialog--maximized .row.q-col-gutter-md > .col-12.col-md-8 {
    width: 100% !important;
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  
  /* Batch scan cards */
  .q-dialog .q-card.flat.bordered {
    border-radius: 8px !important;
    margin-bottom: 1rem !important;
  }
  
  /* Batch scan table */
  .q-dialog .q-table {
    font-size: 0.875rem !important;
  }
  
  .q-dialog .q-table .q-td {
    padding: 0.5rem 0.25rem !important;
    font-size: 0.8rem !important;
  }
  
  .q-dialog .q-table .q-th {
    padding: 0.75rem 0.25rem !important;
    font-size: 0.75rem !important;
  }
  
  /* Batch scan action buttons */
  .q-dialog .q-btn-dropdown {
    font-size: 0.875rem !important;
  }
  
  /* Stats chips in batch scan */
  .q-dialog .q-chip[color="blue"],
  .q-dialog .q-chip[color="green"],
  .q-dialog .q-chip[color="red"] {
    margin: 0.25rem 0.25rem 0.25rem 0 !important;
    font-size: 0.7rem !important;
  }
  
  /* Input with append buttons */
  .q-dialog .q-field--with-bottom {
    padding-bottom: 0 !important;
  }
  
  .q-dialog .q-input .q-field__append {
    padding-left: 0.5rem !important;
  }
  
  .q-dialog .q-input .q-field__append .q-btn {
    min-width: 40px !important;
    width: 40px !important;
    height: 40px !important;
  }
  
  /* Full width buttons in cards */
  .q-dialog .q-card-section .q-btn.full-width {
    width: 100% !important;
    margin-top: 0.75rem !important;
    padding: 0.75rem !important;
  }
  
  /* EXPORT DIALOG & OTHER SMALL DIALOGS */
  
  /* Keep smaller dialogs reasonably sized */
  .q-dialog .q-card[style*="min-width: 400px"] {
    min-width: auto !important;
    width: calc(100vw - 2rem) !important;
    max-width: 500px !important;
  }
  
  /* Validation Messages */
  .q-dialog .q-field__messages {
    font-size: 0.75rem !important;
    padding: 0.25rem 0 !important;
  }
  
  /* Hint Text */
  .q-dialog .q-field__bottom {
    font-size: 0.75rem !important;
  }
  
  /* Close button */
  .q-dialog .q-btn[icon="close"] {
    width: 40px !important;
    height: 40px !important;
  }
  
  /* Focus states */
  .q-dialog .q-field--focused .q-field__control {
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2) !important;
  }
  
  /* Error states */
  .q-dialog .q-field--error .q-field__control {
    border-color: #f44336 !important;
  }
  
  /* Success states */
  .q-dialog .q-field--success .q-field__control {
    border-color: #4caf50 !important;
  }
  
  /* Disabled states */
  .q-dialog .q-field--disabled {
    opacity: 0.6 !important;
  }
  
  /* Product type specific sections */
  .q-dialog .text-primary {
    color: #1976d2 !important;
  }
  
  /* Bundle/Kit toggles */
  .q-dialog .q-checkbox__label {
    font-size: 0.875rem !important;
    line-height: 1.4 !important;
  }
  
  /* Spacing fixes for complex forms */
  .q-dialog .col-12:not(:last-child) {
    margin-bottom: 0.5rem !important;
  }
}
</style>
