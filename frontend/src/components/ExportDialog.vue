<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="download" class="q-mr-sm" />
          Export {{ exportTypeLabel }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form @submit="onExport" class="q-gutter-md">
          <!-- Export Format -->
          <div>
            <div class="text-subtitle2 q-mb-sm">Export Format</div>
            <q-btn-toggle
              v-model="form.format"
              :options="formatOptions"
              color="primary"
              glossy
            />
          </div>

          <!-- Date Range (if applicable) -->
          <div v-if="showDateRange">
            <div class="text-subtitle2 q-mb-sm">Date Range</div>
            <div class="row q-col-gutter-md">
              <div class="col">
                <q-input
                  v-model="form.dateFrom"
                  label="From Date"
                  outlined
                  dense
                  type="date"
                />
              </div>
              <div class="col">
                <q-input
                  v-model="form.dateTo"
                  label="To Date"
                  outlined
                  dense
                  type="date"
                />
              </div>
            </div>
          </div>

          <!-- Field Selection -->
          <div>
            <div class="text-subtitle2 q-mb-sm">Select Fields to Export</div>
            <div class="row q-col-gutter-sm">
              <div class="col-12">
                <q-btn
                  flat
                  color="primary"
                  label="Select All"
                  @click="selectAllFields"
                  class="q-mr-sm"
                />
                <q-btn
                  flat
                  color="grey-7"
                  label="Deselect All"
                  @click="deselectAllFields"
                />
              </div>
            </div>
            <div class="row q-col-gutter-sm q-mt-sm">
              <div
                v-for="field in availableFields"
                :key="field.value"
                class="col-12 col-sm-6 col-md-4"
              >
                <q-checkbox
                  v-model="form.selectedFields"
                  :val="field.value"
                  :label="field.label"
                  dense
                />
              </div>
            </div>
          </div>

          <!-- Filters -->
          <q-expansion-item label="Advanced Filters" icon="filter_list">
            <!-- Product Type Filter -->
            <div class="q-pa-md">
              <q-select
                v-model="form.filters.productTypes"
                label="Product Types"
                outlined
                dense
                multiple
                :options="productTypeOptions"
                emit-value
                map-options
                use-chips
                clearable
              />

              <!-- Status Filter -->
              <q-select
                v-model="form.filters.statuses"
                label="Status"
                outlined
                dense
                multiple
                :options="statusOptions"
                emit-value
                map-options
                use-chips
                clearable
                class="q-mt-md"
              />

              <!-- Stock Level Filter -->
              <q-select
                v-model="form.filters.stockLevels"
                label="Stock Levels"
                outlined
                dense
                multiple
                :options="stockLevelOptions"
                emit-value
                map-options
                use-chips
                clearable
                class="q-mt-md"
              />

              <!-- Barcode Filter -->
              <q-checkbox
                v-model="form.filters.withBarcodeOnly"
                label="Only SKUs with barcodes"
                class="q-mt-md"
              />

              <!-- Cost Range -->
              <div class="q-mt-md">
                <div class="text-body2 q-mb-sm">Cost Range</div>
                <div class="row q-col-gutter-sm">
                  <div class="col">
                    <q-input
                      v-model.number="form.filters.costMin"
                      label="Min Cost"
                      outlined
                      dense
                      type="number"
                      step="0.01"
                      min="0"
                      prefix="$"
                    />
                  </div>
                  <div class="col">
                    <q-input
                      v-model.number="form.filters.costMax"
                      label="Max Cost"
                      outlined
                      dense
                      type="number"
                      step="0.01"
                      min="0"
                      prefix="$"
                    />
                  </div>
                </div>
              </div>
            </div>
          </q-expansion-item>

          <!-- Preview -->
          <div v-if="previewData.length > 0">
            <div class="text-subtitle2 q-mb-sm">
              Preview (First {{ Math.min(previewData.length, 5) }} rows)
            </div>
            <q-markup-table dense bordered>
              <thead>
                <tr>
                  <th v-for="field in selectedFieldsForDisplay" :key="field.value">
                    {{ field.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in previewData.slice(0, 5)" :key="index">
                  <td v-for="field in selectedFieldsForDisplay" :key="field.value">
                    {{ getFieldValue(row, field.value) }}
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
            <div class="text-caption text-grey-6 q-mt-sm">
              Total records to export: {{ previewData.length }}
            </div>
          </div>

          <!-- Actions -->
          <div class="row q-gutter-sm justify-between">
            <q-btn
              color="blue"
              label="Preview"
              icon="preview"
              @click="generatePreview"
              :loading="loadingPreview"
              :disable="form.selectedFields.length === 0"
            />
            <div class="row q-gutter-sm">
              <q-btn
                label="Cancel"
                color="grey-7"
                flat
                @click="onCancel"
              />
              <q-btn
                :label="`Export ${form.format.toUpperCase()}`"
                color="primary"
                type="submit"
                :loading="exporting"
                :disable="form.selectedFields.length === 0"
              />
            </div>
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useSKUStore } from '@/stores/sku'
import { PRODUCT_TYPES, type SKU } from '@/types'

interface Props {
  modelValue: boolean
  exportType?: 'skus' | 'inventory' | 'reorder' | 'cost_analysis'
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const props = withDefaults(defineProps<Props>(), {
  exportType: 'skus'
})

const $q = useQuasar()
const skuStore = useSKUStore()

// State
const showDialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const exporting = ref(false)
const loadingPreview = ref(false)
const previewData = ref<any[]>([])

// Form state
const defaultForm = () => ({
  format: 'csv',
  dateFrom: '',
  dateTo: '',
  selectedFields: [] as string[],
  filters: {
    productTypes: [] as string[],
    statuses: [] as string[],
    stockLevels: [] as string[],
    withBarcodeOnly: false,
    costMin: null as number | null,
    costMax: null as number | null
  }
})

const form = ref(defaultForm())

// Computed
const exportTypeLabel = computed(() => {
  const labels = {
    skus: 'SKU Data',
    inventory: 'Inventory Report',
    reorder: 'Reorder Report',
    cost_analysis: 'Cost Analysis'
  }
  return labels[props.exportType] || 'Data'
})

const showDateRange = computed(() => {
  return props.exportType === 'cost_analysis'
})

const selectedFieldsForDisplay = computed(() => {
  return availableFields.value.filter(field => 
    form.value.selectedFields.includes(field.value)
  )
})

// Options
const formatOptions = [
  { label: 'CSV', value: 'csv' },
  { label: 'Excel', value: 'excel' }
]

const productTypeOptions = PRODUCT_TYPES.map(type => ({
  label: type.label,
  value: type.value
}))

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Discontinued', value: 'discontinued' }
]

const stockLevelOptions = [
  { label: 'Understocked', value: 'understocked' },
  { label: 'Adequate', value: 'adequate' },
  { label: 'Overstocked', value: 'overstocked' }
]

// Available fields based on export type
const availableFields = computed(() => {
  const baseFields = [
    { label: 'SKU Code', value: 'sku_code' },
    { label: 'Product Type', value: 'product_type' },
    { label: 'Barcode', value: 'barcode' },
    { label: 'Current Cost', value: 'current_cost' },
    { label: 'Status', value: 'status' },
    { label: 'Description', value: 'description' },
    { label: 'Notes', value: 'notes' },
    { label: 'Created Date', value: 'created_at' },
    { label: 'Updated Date', value: 'updated_at' }
  ]

  const inventoryFields = [
    { label: 'Total Quantity', value: 'total_quantity' },
    { label: 'Stock Status', value: 'stock_status' },
    { label: 'Understocked Threshold', value: 'understocked_threshold' },
    { label: 'Overstocked Threshold', value: 'overstocked_threshold' },
    { label: 'Total Value', value: 'total_value' }
  ]

  const costFields = [
    { label: 'Cost History Count', value: 'cost_history_count' },
    { label: 'First Cost', value: 'first_cost' },
    { label: 'Last Cost Change', value: 'last_cost_change' },
    { label: 'Cost Change %', value: 'cost_change_percent' }
  ]

  switch (props.exportType) {
    case 'inventory':
      return [...baseFields, ...inventoryFields]
    case 'reorder':
      return [
        ...baseFields,
        ...inventoryFields.filter(f => 
          ['total_quantity', 'stock_status', 'understocked_threshold'].includes(f.value)
        )
      ]
    case 'cost_analysis':
      return [...baseFields, ...costFields]
    default:
      return baseFields
  }
})

// Methods
const selectAllFields = () => {
  form.value.selectedFields = availableFields.value.map(f => f.value)
}

const deselectAllFields = () => {
  form.value.selectedFields = []
}

const getFieldValue = (item: any, fieldName: string) => {
  switch (fieldName) {
    case 'product_type':
      const productType = PRODUCT_TYPES.find(t => t.value === item.product_type)
      return productType?.label || item.product_type
    case 'current_cost':
    case 'total_value':
    case 'first_cost':
      return item[fieldName] ? `$${item[fieldName].toFixed(2)}` : '-'
    case 'stock_status':
      return item.stock_status?.charAt(0).toUpperCase() + item.stock_status?.slice(1) || '-'
    case 'created_at':
    case 'updated_at':
    case 'last_cost_change':
      return item[fieldName] ? new Date(item[fieldName]).toLocaleDateString() : '-'
    case 'cost_change_percent':
      return item[fieldName] ? `${item[fieldName]}%` : '-'
    default:
      return item[fieldName] || '-'
  }
}

const generatePreview = async () => {
  try {
    loadingPreview.value = true
    
    // Get filtered data based on export type and filters
    const data = await getExportData()
    previewData.value = data
    
    $q.notify({
      type: 'positive',
      message: `Generated preview with ${data.length} records`
    })
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to generate preview'
    })
  } finally {
    loadingPreview.value = false
  }
}

const getExportData = async () => {
  // This would call the appropriate store method or API endpoint
  // For now, using SKU store data as example
  let data = [...skuStore.skus]

  // Apply filters
  if (form.value.filters.productTypes.length > 0) {
    data = data.filter(item => 
      form.value.filters.productTypes.includes(item.product_type)
    )
  }

  if (form.value.filters.statuses.length > 0) {
    data = data.filter(item => 
      form.value.filters.statuses.includes(item.status)
    )
  }

  if (form.value.filters.withBarcodeOnly) {
    data = data.filter(item => !!item.barcode)
  }

  if (form.value.filters.costMin !== null) {
    data = data.filter(item => item.current_cost >= form.value.filters.costMin!)
  }

  if (form.value.filters.costMax !== null) {
    data = data.filter(item => item.current_cost <= form.value.filters.costMax!)
  }

  // Add computed fields based on export type
  return data.map(item => {
    const exportItem = { ...item }
    
    if (props.exportType === 'inventory') {
      exportItem.total_quantity = item.totalQuantity || 0
      exportItem.stock_status = item.stockStatus
      exportItem.understocked_threshold = item.stock_thresholds?.understocked || 0
      exportItem.overstocked_threshold = item.stock_thresholds?.overstocked || 0
      exportItem.total_value = (item.totalQuantity || 0) * item.current_cost
    }
    
    if (props.exportType === 'cost_analysis') {
      exportItem.cost_history_count = item.cost_history?.length || 0
      exportItem.first_cost = item.cost_history?.[0]?.cost || item.current_cost
      exportItem.last_cost_change = item.cost_history?.[item.cost_history.length - 1]?.date
      
      if (item.cost_history && item.cost_history.length > 1) {
        const first = item.cost_history[0].cost
        const current = item.current_cost
        exportItem.cost_change_percent = ((current - first) / first * 100).toFixed(2)
      }
    }
    
    return exportItem
  })
}

const onExport = async () => {
  try {
    exporting.value = true
    
    const data = await getExportData()
    
    if (data.length === 0) {
      $q.notify({
        type: 'warning',
        message: 'No data to export with current filters'
      })
      return
    }

    // Generate export file
    if (form.value.format === 'csv') {
      downloadCSV(data)
    } else if (form.value.format === 'excel') {
      // For now, just generate CSV - Excel support would require additional library
      downloadCSV(data)
      $q.notify({
        type: 'info',
        message: 'Excel format not yet implemented, downloaded as CSV instead'
      })
    }

    $q.notify({
      type: 'positive',
      message: `Exported ${data.length} records successfully`
    })

    showDialog.value = false
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Export failed'
    })
  } finally {
    exporting.value = false
  }
}

const downloadCSV = (data: any[]) => {
  // Generate CSV header
  const headers = form.value.selectedFields.map(fieldValue => {
    const field = availableFields.value.find(f => f.value === fieldValue)
    return field?.label || fieldValue
  })

  // Generate CSV rows
  const rows = data.map(item => 
    form.value.selectedFields.map(fieldValue => {
      const value = getFieldValue(item, fieldValue)
      // Escape quotes and wrap in quotes if contains comma
      return typeof value === 'string' && (value.includes(',') || value.includes('"'))
        ? `"${value.replace(/"/g, '""')}"` 
        : value
    })
  )

  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `${props.exportType}-export-${timestamp}.csv`
  
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const onCancel = () => {
  showDialog.value = false
}

const resetForm = () => {
  form.value = defaultForm()
  previewData.value = []
}

// Watchers
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    resetForm()
    // Auto-select common fields
    const commonFields = ['sku_code', 'product_type', 'current_cost', 'status']
    form.value.selectedFields = availableFields.value
      .filter(f => commonFields.includes(f.value))
      .map(f => f.value)
      
    // Set default date range for cost analysis
    if (props.exportType === 'cost_analysis') {
      const today = new Date()
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      form.value.dateFrom = thirtyDaysAgo.toISOString().split('T')[0]
      form.value.dateTo = today.toISOString().split('T')[0]
    }
  }
})
</script>

<style scoped>
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
  
  /* Form Layout */
  .q-form.q-gutter-md {
    gap: 1rem !important;
  }
  
  .row.q-col-gutter-md {
    margin: -0.5rem !important;
  }
  
  .row.q-col-gutter-md > div {
    padding: 0.5rem !important;
  }
  
  .row.q-col-gutter-sm {
    margin: -0.25rem !important;
  }
  
  .row.q-col-gutter-sm > div {
    padding: 0.25rem !important;
  }
  
  /* All columns full width on mobile */
  .col-12.col-sm-6.col-md-4,
  .col.col-sm-6,
  .col {
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
  
  /* Button Toggle */
  .q-btn-toggle {
    width: 100% !important;
  }
  
  .q-btn-toggle .q-btn {
    flex: 1 !important;
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
  .q-card-actions .q-btn.q-btn--flat {
    flex: 0 0 auto !important;
    min-width: 100px !important;
  }
  
  /* Checkboxes */
  .q-checkbox {
    font-size: 0.875rem !important;
    margin-bottom: 0.5rem !important;
  }
  
  .q-checkbox__label {
    font-size: 0.875rem !important;
  }
  
  /* Select dropdowns */
  .q-select .q-field__control {
    min-height: 48px !important;
  }
  
  /* Expansion item */
  .q-expansion-item {
    margin-bottom: 1rem !important;
  }
  
  .q-expansion-item .q-pa-md {
    padding: 0.75rem !important;
  }
  
  /* Date inputs */
  .q-input[type="date"] .q-field__control {
    min-height: 48px !important;
  }
  
  /* Number inputs */
  .q-input[type="number"] .q-field__control {
    min-height: 48px !important;
  }
  
  /* Preview table */
  .q-markup-table {
    font-size: 0.8rem !important;
  }
  
  .q-markup-table th,
  .q-markup-table td {
    padding: 0.5rem 0.25rem !important;
  }
  
  /* Text content */
  .text-caption {
    font-size: 0.75rem !important;
    line-height: 1.3 !important;
  }
  
  .text-subtitle2 {
    font-size: 0.875rem !important;
    margin-bottom: 0.5rem !important;
  }
  
  .text-body2 {
    font-size: 0.875rem !important;
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
  
  /* Chips in multi-select */
  .q-chip {
    font-size: 0.75rem !important;
    margin: 0.125rem !important;
  }
}
</style>

<style scoped>
.q-dialog .q-card {
  max-height: 90vh;
  overflow-y: auto;
}
</style>
