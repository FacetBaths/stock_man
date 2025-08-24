<template>
  <div class="q-pa-md">
    <!-- Header -->
    <div class="row q-mb-md">
      <div class="col">
        <div class="text-h4 text-weight-bold">
          <q-icon name="qr_code" class="q-mr-sm" />
          SKU Management
        </div>
        <div class="text-subtitle2 text-grey-7">
          Manage product SKUs, barcodes, and stock levels
        </div>
      </div>
      <div class="col-auto">
        <q-btn-group>
          <q-btn
            color="primary"
            label="Add SKU"
            icon="add"
            @click="openCreateDialog"
            :disable="!authStore.canWrite"
          />
          <q-btn
            color="secondary"
            label="Batch Scan"
            icon="qr_code_scanner"
            @click="openBatchScanDialog"
            :disable="!authStore.canWrite"
          />
          <q-btn
            color="accent"
            label="Export"
            icon="download"
            @click="openExportDialog"
          />
        </q-btn-group>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-xs-12 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-h6">{{ skuStore.skuStats.total }}</div>
              <div class="text-subtitle2 text-grey-7">Total SKUs</div>
            </div>
            <div class="col-auto">
              <q-icon name="inventory" size="md" color="blue" />
            </div>
          </q-card-section>
        </q-card>
      </div>
      
      <div class="col-xs-12 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-h6">{{ skuStore.skuStats.withBarcodes }}</div>
              <div class="text-subtitle2 text-grey-7">With Barcodes</div>
            </div>
            <div class="col-auto">
              <q-icon name="qr_code" size="md" color="green" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-xs-12 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-h6">{{ skuStore.skuStats.lowStock }}</div>
              <div class="text-subtitle2 text-grey-7">Low Stock</div>
            </div>
            <div class="col-auto">
              <q-icon name="warning" size="md" color="red" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-xs-12 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-h6">${{ formatCurrency(skuStore.skuStats.totalValue) }}</div>
              <div class="text-subtitle2 text-grey-7">Total Value</div>
            </div>
            <div class="col-auto">
              <q-icon name="attach_money" size="md" color="green" />
            </div>
          </q-card-section>
        </q-card>
      </div>
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
              These products existed before SKU implementation and need SKUs assigned
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              color="orange"
              label="Bulk Create SKUs"
              icon="batch_prediction"
              @click="openBulkCreateDialog"
              :disable="!authStore.canWrite || selectedProductsWithoutSKUs.length === 0"
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
            <div class="full-width row flex-center text-positive q-gutter-sm q-pa-lg">
              <q-icon size="2em" name="check_circle" />
              <span>All products have SKUs assigned!</span>
            </div>
          </template>

          <template v-slot:body-cell-product_info="props">
            <q-td :props="props">
              <div class="text-weight-medium">{{ getProductDisplayName(props.row) }}</div>
              <div class="text-caption text-grey-6">{{ formatProductType(props.row.product_type) }}</div>
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
          {{ skuStore.skus.length }} SKU{{ skuStore.skus.length !== 1 ? 's' : '' }} loaded
        </div>
      </q-card-section>
      
      <q-table
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
            <span>{{ filter ? 'No matching SKUs found' : message }}</span>
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
            <div v-if="props.row.is_auto_generated" class="text-caption text-grey-6">
              <q-icon name="auto_mode" size="xs" /> Auto-generated
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-category="props">
          <q-td :props="props">
            <q-chip
              :label="getCategoryName(props.value)"
              :color="getCategoryColor(props.value)"
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
              :status="props.row.stockStatus"
              :quantity="props.row.totalQuantity"
              :thresholds="props.row.stock_thresholds"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-current_cost="props">
          <q-td :props="props">
            <div class="text-weight-medium">${{ formatCurrency(props.value) }}</div>
            <div v-if="props.row.cost_history?.length > 1" class="text-caption text-grey-6">
              {{ props.row.cost_history.length }} price changes
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-totalQuantity="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.value || 0 }}</div>
            <div v-if="props.row.itemCount" class="text-caption text-grey-6">
              {{ props.row.itemCount }} item{{ props.row.itemCount !== 1 ? 's' : '' }}
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
    <ExportDialog
      v-model="showExportDialog"
      export-type="skus"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useSKUStore } from '@/stores/sku'
import { useCategoryStore } from '@/stores/category'
import { useInventoryStore } from '@/stores/inventory'
import { inventoryApi } from '@/utils/api'
import { PRODUCT_TYPES, type SKU, type Item } from '@/types'
import StockStatusChip from '@/components/StockStatusChip.vue'
import SKUFormDialog from '@/components/SKUFormDialog.vue'
import AddCostDialog from '@/components/AddCostDialog.vue'
import BatchScanDialog from '@/components/BatchScanDialog.vue'
import ExportDialog from '@/components/ExportDialog.vue'

const $q = useQuasar()
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
const productsWithoutSKUs = ref<Item[]>([])
const selectedProductsWithoutSKUs = ref<Item[]>([])
const loadingProductsWithoutSKUs = ref(false)
const productForSKUCreation = ref<Item | null>(null)

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
    field: 'current_cost',
    align: 'right',
    sortable: true
  },
  {
    name: 'totalQuantity',
    label: 'Total Quantity',
    field: 'totalQuantity',
    align: 'right',
    sortable: true
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

// Options
const productTypeOptions = PRODUCT_TYPES.map(type => ({
  label: type.label,
  value: type.value
}))

const categoryOptions = computed(() => {
  return categoryStore.categories.map(category => ({
    label: category.name,
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

const getProductTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    wall: 'blue',
    toilet: 'green',
    base: 'orange',
    tub: 'cyan',
    vanity: 'purple',
    shower_door: 'teal',
    raw_material: 'brown',
    accessory: 'pink',
    miscellaneous: 'grey'
  }
  return colors[type] || 'grey'
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'green',
    inactive: 'orange',
    discontinued: 'red'
  }
  return colors[status] || 'grey'
}

const getCategoryName = (categoryId: string) => {
  if (!categoryId) return 'Uncategorized'
  const category = categoryStore.categories.find(c => c._id === categoryId)
  return category ? category.name : 'Unknown Category'
}

const getCategoryColor = (categoryId: string) => {
  if (!categoryId) return 'grey'
  const colors: string[] = ['blue', 'green', 'orange', 'cyan', 'purple', 'teal', 'brown', 'pink', 'indigo', 'deep-purple']
  // Use category ID to generate consistent color
  const index = categoryId ? categoryId.charCodeAt(categoryId.length - 1) % colors.length : 0
  return colors[index]
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
    productsWithoutSKUs.value = response.items.filter(item => !item.sku_id)
  } catch (error) {
    console.error('Error loading products without SKUs:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load products without SKUs'
    })
  } finally {
    loadingProductsWithoutSKUs.value = false
  }
}

const getProductDisplayName = (item: Item) => {
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

const openCreateSKUForProduct = (item: Item) => {
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

          // Generate SKU code
          const skuCode = await skuStore.generateSKUCode({
            product_type: item.product_type,
            product_details: productDetailsId
          })

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

// Lifecycle
onMounted(async () => {
  await Promise.all([
    categoryStore.fetchCategories(),
    refreshData(),
    loadProductsWithoutSKUs()
  ])
})
</script>

<style scoped>
.stat-card {
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}
</style>
