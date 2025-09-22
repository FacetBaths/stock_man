<template>
  <q-dialog
    v-model="showDialog"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card>
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="qr_code_scanner" class="q-mr-sm" />
          Batch Barcode Scanner
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <div class="row q-col-gutter-md">
          <!-- Scanner Input Section -->
          <div class="col-12 col-md-4">
            <q-card flat bordered class="section-card">
              <q-card-section>
                <div class="text-h6 q-mb-md">Scanner Input</div>

                <!-- Barcode Input -->
                <q-input
                  v-model="currentBarcode"
                  label="Scan or Enter Barcode"
                  outlined
                  dense
                  autofocus
                  @keyup.enter="addBarcode"
                  ref="barcodeInput"
                >
                  <template v-slot:append>
                    <q-btn
                      icon="add"
                      color="primary"
                      round
                      dense
                      @click="addBarcode"
                      :disable="!currentBarcode.trim()"
                    />
                  </template>
                </q-input>
              </q-card-section>
              <q-card-section class="flex justify-around">
                <q-btn
                  color="secondary"
                  label="Clear All"
                  icon="clear_all"
                  @click="clearAllScans"
                  :disable="scannedItems.length === 0"
                  class="q-mr-sm"
                />
                <q-btn
                  color="positive"
                  label="Process All"
                  icon="check_circle"
                  @click="processAllScans"
                  :disable="scannedItems.length === 0"
                  :loading="processing"
                />
              </q-card-section>
              <q-card-section class="flex justify-around">
                <!-- Stats -->
                <div class="q-mt-md">
                  <q-chip
                    :label="`${scannedItems.length} scanned`"
                    color="blue"
                    text-color="white"
                    icon="qr_code"
                  />
                  <q-chip
                    :label="`${foundSKUs} found`"
                    color="green"
                    text-color="white"
                    icon="check_circle"
                  />
                  <q-chip
                    :label="`${notFoundSKUs} not found`"
                    color="red"
                    text-color="white"
                    icon="error"
                  />
                </div>
              </q-card-section>
            </q-card>

            <!-- Tag Management -->
            <q-card flat bordered class="q-mt-md section-card">
              <q-card-section>
                <div class="text-h6 q-mb-md">Tag Assignment</div>

                <q-input
                  v-model="tagName"
                  label="Tag Name"
                  outlined
                  dense
                  hint="Assign a tag to all scanned SKUs"
                />

                <q-btn
                  color="purple"
                  label="Create Tag & Assign"
                  icon="local_offer"
                  @click="createAndAssignTag"
                  :disable="!tagName.trim() || foundSKUs === 0"
                  :loading="creatingTag"
                  class="q-mt-sm full-width"
                />
              </q-card-section>
            </q-card>
          </div>

          <!-- Scanned Items List -->
          <div class="col-12 col-md-8">
            <q-card flat bordered class="section-card">
              <q-card-section>
                <div class="row items-center q-mb-md">
                  <div class="text-h6">Scanned Items ({{ scannedItems.length }})</div>
                  <q-space />
                  <q-btn-dropdown
                    color="primary"
                    label="Actions"
                    icon="more_vert"
                    :disable="scannedItems.length === 0"
                  >
                    <q-list>
                      <q-item clickable v-close-popup @click="exportScanResults">
                        <q-item-section avatar>
                          <q-icon name="download" />
                        </q-item-section>
                        <q-item-section>Export Results</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="retryNotFound">
                        <q-item-section avatar>
                          <q-icon name="refresh" />
                        </q-item-section>
                        <q-item-section>Retry Not Found</q-item-section>
                      </q-item>
                    </q-list>
                  </q-btn-dropdown>
                </div>

                <q-table
                  :rows="scannedItems"
                  :columns="scanColumns"
                  row-key="barcode"
                  :pagination="{ rowsPerPage: 20 }"
                  :loading="processing"
                  binary-state-sort
                  dense
                >
                  <template v-slot:no-data>
                    <div class="full-width row flex-center text-grey-6 q-gutter-sm q-pa-lg">
                      <q-icon size="2em" name="qr_code_scanner" />
                      <span>Start scanning barcodes to see results here</span>
                    </div>
                  </template>

                  <template v-slot:body-cell-status="props">
                    <q-td :props="props">
                      <q-chip
                        :label="getStatusLabel(props.row.status)"
                        :color="getStatusColor(props.row.status)"
                        text-color="white"
                        dense
                      />
                    </q-td>
                  </template>

                  <template v-slot:body-cell-sku_info="props">
                    <q-td :props="props">
                      <div v-if="props.row.sku">
                        <div class="text-weight-medium">{{ props.row.sku.sku_code }}</div>
                        <div class="text-caption text-grey-6">
                          {{ formatProductType(props.row.sku.product_type) }}
                        </div>
                      </div>
                      <div v-else class="text-grey-6">-</div>
                    </q-td>
                  </template>

                  <template v-slot:body-cell-actions="props">
                    <q-td :props="props">
                      <div class="row q-gutter-xs no-wrap">
                        <q-btn
                          v-if="props.row.status === 'not_found'"
                          size="sm"
                          color="primary"
                          icon="add"
                          round
                          @click="createSKUForBarcode(props.row)"
                        >
                          <q-tooltip>Create SKU for this barcode</q-tooltip>
                        </q-btn>
                        
                        <q-btn
                          v-if="props.row.status === 'found'"
                          size="sm"
                          color="blue"
                          icon="visibility"
                          round
                          @click="viewSKU(props.row.sku)"
                        >
                          <q-tooltip>View SKU details</q-tooltip>
                        </q-btn>

                        <q-btn
                          size="sm"
                          color="negative"
                          icon="delete"
                          round
                          @click="removeScan(props.row)"
                        >
                          <q-tooltip>Remove from scan list</q-tooltip>
                        </q-btn>
                      </div>
                    </q-td>
                  </template>
                </q-table>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Create SKU Dialog -->
    <SKUFormDialog
      v-model="showCreateSKUDialog"
      :barcode="selectedScanItem?.barcode"
      @saved="onSKUCreated"
    />
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useSKUStore } from '@/stores/sku'
import { useTagStore } from '@/stores/tag'
import { PRODUCT_TYPES, type SKU } from '@/types'
import { barcodeApi, instancesApi } from '@/utils/api'
import SKUFormDialog from './SKUFormDialog.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  processed: []
}>()

const $q = useQuasar()
const skuStore = useSKUStore()
const tagStore = useTagStore()

// State
const showDialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const currentBarcode = ref('')
const tagName = ref('')
const processing = ref(false)
const creatingTag = ref(false)
const barcodeInput = ref()
const showCreateSKUDialog = ref(false)
const selectedScanItem = ref<ScanItem | null>(null)

interface ScanItem {
  barcode: string
  status: 'pending' | 'found' | 'not_found' | 'error'
  sku?: SKU
  error?: string
  timestamp: Date
}

const scannedItems = ref<ScanItem[]>([])

// Computed
const foundSKUs = computed(() => 
  scannedItems.value.filter(item => item.status === 'found').length
)

const notFoundSKUs = computed(() =>
  scannedItems.value.filter(item => item.status === 'not_found').length
)

// Table columns
const scanColumns = [
  {
    name: 'barcode',
    label: 'Barcode',
    field: 'barcode',
    align: 'left',
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
    name: 'sku_info',
    label: 'SKU Info',
    field: 'sku',
    align: 'left',
    sortable: false
  },
  {
    name: 'timestamp',
    label: 'Scanned At',
    field: 'timestamp',
    align: 'left',
    sortable: true,
    format: (val: Date) => val.toLocaleTimeString()
  },
  {
    name: 'actions',
    label: 'Actions',
    field: '',
    align: 'center',
    sortable: false
  }
]

// Methods
const addBarcode = async () => {
  const barcode = currentBarcode.value.trim()
  if (!barcode) return

  // Check if already scanned
  if (scannedItems.value.some(item => item.barcode === barcode)) {
    $q.notify({
      type: 'warning',
      message: 'Barcode already scanned'
    })
    currentBarcode.value = ''
    focusInput()
    return
  }

  // Add as pending
  const scanItem: ScanItem = {
    barcode,
    status: 'pending',
    timestamp: new Date()
  }

  scannedItems.value.unshift(scanItem)
  currentBarcode.value = ''
  
  // Look up SKU
  await lookupSKU(scanItem)
  focusInput()
}

const lookupSKU = async (scanItem: ScanItem) => {
  try {
    // Use the existing batch scan API that we know works
    const response = await barcodeApi.batchScan({ barcodes: [scanItem.barcode] })
    const foundItem = response.found?.find((item: any) => item.barcode === scanItem.barcode)
    
    if (foundItem?.sku) {
      scanItem.sku = foundItem.sku
      scanItem.status = 'found'
    } else {
      scanItem.status = 'not_found'
    }
  } catch (error: any) {
    console.error('Error looking up barcode:', error)
    scanItem.status = 'error'
    scanItem.error = error.message || 'Failed to lookup barcode'
  }
}

const focusInput = async () => {
  await nextTick()
  barcodeInput.value?.focus()
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Searching...',
    found: 'Found',
    not_found: 'Not Found',
    error: 'Error'
  }
  return labels[status] || status
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'blue',
    found: 'green',
    not_found: 'red',
    error: 'orange'
  }
  return colors[status] || 'grey'
}

const formatProductType = (type: string) => {
  const found = PRODUCT_TYPES.find(t => t.value === type)
  return found ? found.label : type
}

const clearAllScans = () => {
  $q.dialog({
    title: 'Clear All Scans',
    message: 'Are you sure you want to clear all scanned items?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    scannedItems.value = []
    focusInput()
  })
}

const processAllScans = async () => {
  try {
    processing.value = true
    
    const foundItems = scannedItems.value.filter(item => item.status === 'found')
    
    if (foundItems.length === 0) {
      $q.notify({
        type: 'warning',
        message: 'No SKUs found to process'
      })
      return
    }

    // Group found items by SKU and aggregate quantities
    const skuGroups: Record<string, { sku: SKU, quantity: number, barcodes: string[] }> = {}
    
    foundItems.forEach(item => {
      if (item.sku) {
        const skuId = item.sku._id
        if (!skuGroups[skuId]) {
          skuGroups[skuId] = {
            sku: item.sku,
            quantity: 0,
            barcodes: []
          }
        }
        skuGroups[skuId].quantity += 1
        skuGroups[skuId].barcodes.push(item.barcode)
      }
    })

    let processedCount = 0
    let failedCount = 0
    const results: any[] = []

    // Process each SKU group separately using instancesApi
    for (const [skuId, group] of Object.entries(skuGroups)) {
      try {
        const stockData = {
          sku_id: skuId,
          quantity: group.quantity,
          acquisition_cost: group.sku.unit_cost || 0,
          location: 'HQ',
          supplier: '',
          reference_number: `Batch scan: ${group.barcodes.join(', ')}`,
          notes: `Added from batch scan - Barcodes: ${group.barcodes.join(', ')}`
        }

        const result = await instancesApi.addStock(stockData)
        results.push({ sku: group.sku, success: true, result })
        processedCount += 1
      } catch (error: any) {
        console.error(`Failed to add stock for SKU ${group.sku.sku_code}:`, error)
        results.push({ sku: group.sku, success: false, error: error.message })
        failedCount += 1
      }
    }

    // Show success/failure notification
    if (failedCount === 0) {
      $q.notify({
        type: 'positive',
        message: `Successfully processed ${processedCount} SKUs from batch scan`,
        timeout: 5000
      })
    } else {
      $q.notify({
        type: 'warning',
        message: `Processed ${processedCount} SKUs successfully, ${failedCount} failed`,
        timeout: 5000
      })
    }

    // Log detailed results for debugging
    console.log('Batch scan processing results:', results)

    emit('processed')
  } catch (error: any) {
    console.error('Error processing scans:', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to process batch scan items'
    })
  } finally {
    processing.value = false
  }
}

const createAndAssignTag = async () => {
  const foundItems = scannedItems.value.filter(item => item.status === 'found')
  
  if (foundItems.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No found SKUs to assign tag to'
    })
    return
  }

  try {
    creatingTag.value = true
    
    // Create tag
    const tag = await tagStore.createTag({
      name: tagName.value.trim(),
      type: 'batch_scan',
      description: `Batch scan tag created on ${new Date().toLocaleDateString()}`
    })

    // Assign SKUs to tag
    const skuIds = foundItems.map(item => item.sku!._id)
    await tagStore.assignSKUsToTag(tag._id, skuIds)

    $q.notify({
      type: 'positive',
      message: `Created tag "${tagName.value}" and assigned ${skuIds.length} SKUs`
    })

    tagName.value = ''
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to create tag'
    })
  } finally {
    creatingTag.value = false
  }
}

const retryNotFound = async () => {
  const notFoundItems = scannedItems.value.filter(item => item.status === 'not_found')
  
  if (notFoundItems.length === 0) {
    $q.notify({
      type: 'info',
      message: 'No items to retry'
    })
    return
  }

  try {
    processing.value = true
    
    for (const item of notFoundItems) {
      item.status = 'pending'
      await lookupSKU(item)
    }

    $q.notify({
      type: 'positive',
      message: `Retried ${notFoundItems.length} items`
    })
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to retry items'
    })
  } finally {
    processing.value = false
  }
}

const createSKUForBarcode = (scanItem: ScanItem) => {
  console.log('createSKUForBarcode called with:', scanItem)
  selectedScanItem.value = scanItem
  console.log('selectedScanItem set to:', selectedScanItem.value)
  showCreateSKUDialog.value = true
  console.log('showCreateSKUDialog set to:', showCreateSKUDialog.value)
}

const viewSKU = (sku: SKU) => {
  // Could open a detailed view dialog or navigate to SKU details
  $q.notify({
    type: 'info',
    message: `Viewing SKU: ${sku.sku_code}`
  })
}

const removeScan = (scanItem: ScanItem) => {
  const index = scannedItems.value.findIndex(item => item.barcode === scanItem.barcode)
  if (index >= 0) {
    scannedItems.value.splice(index, 1)
  }
}

const exportScanResults = () => {
  const results = scannedItems.value.map(item => ({
    barcode: item.barcode,
    status: item.status,
    sku_code: item.sku?.sku_code || '',
    product_type: item.sku?.product_type || '',
    scanned_at: item.timestamp.toISOString(),
    error: item.error || ''
  }))

  const csv = [
    'Barcode,Status,SKU Code,Product Type,Scanned At,Error',
    ...results.map(row => 
      `"${row.barcode}","${row.status}","${row.sku_code}","${row.product_type}","${row.scanned_at}","${row.error}"`
    )
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `batch-scan-results-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const onSKUCreated = async () => {
  showCreateSKUDialog.value = false
  
  if (selectedScanItem.value) {
    // Retry lookup for the newly created SKU
    await lookupSKU(selectedScanItem.value)
    selectedScanItem.value = null
  }
}

const resetDialog = () => {
  scannedItems.value = []
  currentBarcode.value = ''
  tagName.value = ''
  processing.value = false
  creatingTag.value = false
}

// Watch for dialog open/close to reset state
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    resetDialog()
    nextTick(() => focusInput())
  }
})
</script>

<style scoped>
/* Mobile Responsive Dialog Fixes - Targeting section-card structure */
@media (max-width: 768px) {
  /* Maximized dialogs - Full screen */
  .q-dialog--maximized .q-card {
    width: 100% !important;
    height: 100% !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
  }
  
  /* Compact Header */
  .q-card__section {
    padding: 0.5rem !important;
  }
  
  .text-h6 {
    font-size: 0.9rem !important;
  }
  
  /* MAIN LAYOUT - Stack vertically with minimal gaps */
  .row.q-col-gutter-md {
    margin: -0.25rem !important;
  }
  
  .row.q-col-gutter-md > div {
    padding: 0.25rem !important;
  }
  
  /* Layout stacking - Scanner section first, table second */
  .row.q-col-gutter-md > .col-12.col-md-4,
  .row.q-col-gutter-md > .col-12.col-md-8 {
    width: 100% !important;
    flex: 0 0 auto !important;
    max-width: 100% !important;
  }
  
  /* Scanner input section should be compact at top */
  .row.q-col-gutter-md > .col-12.col-md-4 {
    order: 1;
    flex: 0 0 auto !important;
  }
  
  /* Table section should only grow if needed */
  .row.q-col-gutter-md > .col-12.col-md-8 {
    order: 2;
    flex: 0 1 auto !important;
  }
  
  /* TARGET SECTION CARDS - Much more compact and natural height */
  .section-card {
    border-radius: 6px !important;
    margin-bottom: 0.5rem !important;
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
  }
  
  .section-card .q-card-section {
    padding: 0.5rem !important;
    height: auto !important;
    min-height: auto !important;
    flex: none !important;
  }
  
  .section-card .text-h6 {
    font-size: 0.8rem !important;
    margin-bottom: 0.5rem !important;
    font-weight: 600;
  }
  
  /* Form Fields - Compact */
  .section-card .q-field {
    margin-bottom: 0.5rem !important;
  }
  
  .section-card .q-input {
    font-size: 0.9rem !important;
  }
  
  .section-card .q-field__label {
    font-size: 0.75rem !important;
  }
  
  .section-card .q-field__control {
    min-height: 40px !important;
  }
  
  /* Input with append buttons - make compact */
  .section-card .q-input .q-field__append {
    padding-left: 0.25rem !important;
  }
  
  .section-card .q-input .q-field__append .q-btn {
    min-width: 32px !important;
    width: 32px !important;
    height: 32px !important;
  }
  
  /* SECTION-SPECIFIC BUTTON FIXES */
  /* Button sections with flex justify-around */
  .section-card .q-card-section.flex.justify-around {
    padding: 0.25rem 0.5rem !important;
    gap: 0.5rem !important;
  }
  
  .section-card .q-card-section.flex.justify-around .q-btn {
    flex: 1 !important;
    padding: 0.375rem 0.5rem !important;
    font-size: 0.75rem !important;
    min-width: auto !important;
  }
  
  /* Remove problematic margins on buttons */
  .section-card .q-btn.q-mr-sm {
    margin-right: 0 !important;
  }
  
  /* Stats chips - make more compact and organized */
  .section-card .q-mt-md {
    margin-top: 0.25rem !important;
  }
  
  .section-card .q-chip {
    font-size: 0.65rem !important;
    margin: 0.125rem !important;
    padding: 0.125rem 0.375rem !important;
    height: auto !important;
    min-height: 20px !important;
  }
  
  /* Full width buttons in section cards */
  .section-card .q-btn.full-width {
    width: 100% !important;
    margin-top: 0.5rem !important;
    padding: 0.375rem !important;
    font-size: 0.75rem !important;
  }
  
  /* TABLE SECTION - Natural sizing, no forced height */
  .section-card:has(.q-table) {
    /* Let it size naturally to content */
  }
  
  .section-card:has(.q-table) .q-card-section {
    /* No forced flexing - let content determine size */
  }
  
  /* Table header - compact */
  .section-card .row.items-center.q-mb-md {
    margin-bottom: 0.25rem !important;
    flex-wrap: wrap !important;
    gap: 0.25rem !important;
  }
  
  /* Button dropdown in table */
  .section-card .q-btn-dropdown {
    font-size: 0.7rem !important;
    padding: 0.25rem 0.5rem !important;
  }
  
  /* Table itself */
  .section-card .q-table {
    font-size: 0.7rem !important;
    flex: 1 !important;
  }
  
  .section-card .q-table .q-td {
    padding: 0.25rem 0.125rem !important;
    font-size: 0.65rem !important;
  }
  
  .section-card .q-table .q-th {
    padding: 0.375rem 0.125rem !important;
    font-size: 0.65rem !important;
    font-weight: 600;
  }
  
  /* Table action buttons */
  .section-card .q-table .q-btn {
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
  }
  
  /* Text content */
  .section-card .text-caption {
    font-size: 0.65rem !important;
    line-height: 1.1 !important;
  }
  
  /* Loading states */
  .section-card .q-spinner {
    width: 12px !important;
    height: 12px !important;
  }
  
  /* No data state */
  .section-card .full-width.row.flex-center {
    padding: 0.75rem !important;
  }
  
  .section-card .full-width.row.flex-center .q-icon {
    font-size: 1.5rem !important;
  }
  
  .section-card .full-width.row.flex-center span {
    font-size: 0.75rem !important;
  }
  
  /* Close button in header */
  .q-btn[icon="close"] {
    width: 32px !important;
    height: 32px !important;
  }
}
</style>

<style scoped>
.q-dialog .q-card {
  /* Remove min-height that forces tall cards */
}

/* Force refresh - additional mobile specificity */
@media screen and (max-width: 768px) {
  /* Force compact layout with higher specificity */
  .q-dialog__inner .q-card .q-card__section {
    padding: 0.75rem !important;
  }
  
  .q-dialog__inner .q-card .q-btn {
    padding: 0.5rem 0.75rem !important;
    font-size: 0.8rem !important;
  }
  
  .q-dialog__inner .q-card .q-mr-sm {
    margin-right: 0 !important;
    margin-bottom: 0.5rem !important;
  }
  
  .q-dialog__inner .q-card .q-mt-md {
    margin-top: 0.5rem !important;
    display: flex !important;
    gap: 0.5rem !important;
  }
  
  /* Button chaos fix with higher specificity */
  .q-dialog__inner .q-card .q-card__section .q-btn:not(.full-width) {
    flex: 1 !important;
    min-width: auto !important;
    margin: 0 !important;
  }
}
</style>
