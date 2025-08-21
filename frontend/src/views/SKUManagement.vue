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
              <div class="text-h6">{{ skuStore.skuStats.understocked }}</div>
              <div class="text-subtitle2 text-grey-7">Understocked</div>
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
              v-model="skuStore.filters.product_type"
              label="Product Type"
              outlined
              dense
              clearable
              :options="productTypeOptions"
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

    <!-- SKU Table -->
    <q-card>
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
        @row-click="openEditDialog"
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

        <template v-slot:body-cell-product_type="props">
          <q-td :props="props">
            <q-chip
              :label="formatProductType(props.value)"
              :color="getProductTypeColor(props.value)"
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
            <stock-status-chip
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
    <sku-form-dialog
      v-model="showFormDialog"
      :sku="selectedSKU"
      @saved="onSKUSaved"
    />

    <!-- Add Cost Dialog -->
    <add-cost-dialog
      v-model="showAddCostDialog"
      :sku="selectedSKU"
      @saved="onCostAdded"
    />

    <!-- Batch Scan Dialog -->
    <batch-scan-dialog
      v-model="showBatchScanDialog"
      @processed="onBatchProcessed"
    />

    <!-- Export Dialog -->
    <export-dialog
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
import { PRODUCT_TYPES, type SKU } from '@/types'
import StockStatusChip from '@/components/StockStatusChip.vue'
import SKUFormDialog from '@/components/SKUFormDialog.vue'
import AddCostDialog from '@/components/AddCostDialog.vue'
import BatchScanDialog from '@/components/BatchScanDialog.vue'
import ExportDialog from '@/components/ExportDialog.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const skuStore = useSKUStore()

// State
const selectedSKUs = ref<SKU[]>([])
const selectedSKU = ref<SKU | null>(null)
const showFormDialog = ref(false)
const showAddCostDialog = ref(false)
const showBatchScanDialog = ref(false)
const showExportDialog = ref(false)

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
    name: 'product_type',
    label: 'Product Type',
    field: 'product_type',
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

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
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

const refreshData = () => {
  skuStore.fetchSKUs()
}

const applyFilters = () => {
  skuStore.updateFilters(skuStore.filters)
}

const clearFilters = () => {
  skuStore.clearFilters()
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
  selectedSKU.value = null
  showFormDialog.value = true
}

const openEditDialog = (sku: SKU) => {
  selectedSKU.value = sku
  showFormDialog.value = true
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
const onSKUSaved = () => {
  showFormDialog.value = false
  selectedSKU.value = null
  refreshData()
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

// Lifecycle
onMounted(() => {
  refreshData()
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
