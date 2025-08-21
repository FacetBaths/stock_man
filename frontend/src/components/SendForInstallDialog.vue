<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" v-if="show">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="close"></div>
      
      <!-- This element is to trick the browser into centering the modal contents. -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      
      <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
        <div class="sm:flex sm:items-start">
          <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
              Send For Install
            </h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Scan barcodes to partially fulfill tags or complete all tags for a customer.
              </p>
            </div>
          </div>
        </div>
        
        <div class="mt-5">
          <!-- Customer Selection -->
          <div class="mb-4">
            <label for="customer" class="block text-sm font-medium text-gray-700 mb-1">
              Customer
            </label>
            <select 
              id="customer" 
              v-model="selectedCustomer"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              :disabled="processing"
            >
              <option value="">Select a customer...</option>
              <option v-for="customer in customers" :key="customer.name" :value="customer.name">
                {{ customer.name }} ({{ customer.tag_count }} tags)
              </option>
            </select>
          </div>

          <!-- Scanning Mode Selection -->
          <div class="mb-4">
            <div class="flex items-center space-x-4">
              <label class="flex items-center">
                <input
                  type="radio"
                  name="mode"
                  value="scan"
                  v-model="mode"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                >
                <span class="ml-2 block text-sm text-gray-900">Scan individual items</span>
              </label>
              <label class="flex items-center">
                <input
                  type="radio"
                  name="mode"
                  value="complete"
                  v-model="mode"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                >
                <span class="ml-2 block text-sm text-gray-900">Complete all tags</span>
              </label>
            </div>
          </div>

          <!-- Barcode Scanning Section (for scan mode) -->
          <div v-if="mode === 'scan'" class="mb-4">
            <label for="barcode" class="block text-sm font-medium text-gray-700 mb-1">
              Scan Barcode
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                type="text"
                id="barcode"
                ref="barcodeInput"
                v-model="currentBarcode"
                @keydown.enter="addBarcode"
                placeholder="Scan or enter barcode"
                class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                :disabled="processing || !selectedCustomer"
              >
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  @click="addBarcode"
                  :disabled="!currentBarcode.trim() || processing"
                  class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
            
            <!-- Scanned Barcodes List -->
            <div v-if="scannedBarcodes.length > 0" class="mt-3">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Scanned Items ({{ scannedBarcodes.length }})
              </label>
              <div class="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                <div v-for="(barcode, index) in scannedBarcodes" :key="index" 
                     class="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0">
                  <span class="text-sm text-gray-900">{{ barcode }}</span>
                  <button
                    @click="removeBarcode(index)"
                    class="text-red-600 hover:text-red-800 text-sm"
                    :disabled="processing"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="mb-4">
            <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              v-model="notes"
              rows="2"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Add any notes about this fulfillment..."
              :disabled="processing"
            ></textarea>
          </div>

          <!-- Results Display -->
          <div v-if="results" class="mb-4 p-3 bg-gray-50 rounded-md">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Results</h4>
            <div class="text-sm text-gray-600 space-y-1">
              <div v-if="mode === 'scan'">
                <p>✅ {{ results.fulfilled_items?.length || 0 }} items fulfilled</p>
                <p v-if="results.partially_fulfilled_tags?.length">
                  🔄 {{ results.partially_fulfilled_tags.length }} tags partially fulfilled
                </p>
                <p v-if="results.fully_fulfilled_tags?.length">
                  ✅ {{ results.fully_fulfilled_tags.length }} tags completed
                </p>
                <p v-if="results.failed_scans?.length" class="text-red-600">
                  ❌ {{ results.failed_scans.length }} failed scans
                </p>
              </div>
              <div v-else>
                <p>✅ {{ results.fulfilled?.length || 0 }} tags completed</p>
                <p v-if="results.failed?.length" class="text-red-600">
                  ❌ {{ results.failed.length }} failed
                </p>
              </div>
              <p>📦 {{ results.inventory_reduced?.length || 0 }} inventory items updated</p>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-600">{{ error }}</p>
          </div>
        </div>

        <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            @click="processFulfillment"
            :disabled="!canProcess || processing"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="processing" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ processing ? 'Processing...' : (mode === 'scan' ? 'Process Scans' : 'Complete All Tags') }}
          </button>
          <button
            type="button"
            @click="close"
            :disabled="processing"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            {{ results ? 'Close' : 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { api } from '@/utils/api'

interface Props {
  show: boolean
}

interface Customer {
  name: string
  tag_count: number
  total_sku_items: number
  tag_types: string[]
}

interface Results {
  fulfilled_items?: any[]
  partially_fulfilled_tags?: any[]
  fully_fulfilled_tags?: any[]
  failed_scans?: any[]
  fulfilled?: any[]
  failed?: any[]
  inventory_reduced?: any[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  success: [results: any]
}>()

const selectedCustomer = ref('')
const mode = ref<'scan' | 'complete'>('scan')
const currentBarcode = ref('')
const scannedBarcodes = ref<string[]>([])
const notes = ref('')
const processing = ref(false)
const results = ref<Results | null>(null)
const error = ref('')
const customers = ref<Customer[]>([])
const barcodeInput = ref<HTMLInputElement>()

const canProcess = computed(() => {
  if (!selectedCustomer.value) return false
  if (mode.value === 'scan') {
    return scannedBarcodes.value.length > 0
  }
  return true
})

// Load customers when dialog opens
watch(() => props.show, (show) => {
  if (show) {
    reset()
    loadCustomers()
    nextTick(() => {
      barcodeInput.value?.focus()
    })
  }
})

async function loadCustomers() {
  try {
    const response = await api.get('/api/tags/customers')
    customers.value = response.data.customers
  } catch (err) {
    console.error('Failed to load customers:', err)
    error.value = 'Failed to load customers'
  }
}

function addBarcode() {
  const barcode = currentBarcode.value.trim()
  if (barcode && !scannedBarcodes.value.includes(barcode)) {
    scannedBarcodes.value.push(barcode)
    currentBarcode.value = ''
    nextTick(() => {
      barcodeInput.value?.focus()
    })
  }
}

function removeBarcode(index: number) {
  scannedBarcodes.value.splice(index, 1)
}

async function processFulfillment() {
  if (!selectedCustomer.value) return
  
  processing.value = true
  error.value = ''
  
  try {
    let response
    
    if (mode.value === 'scan') {
      // Use the barcode-based partial fulfillment endpoint
      response = await api.post('/api/tags/scan-fulfill', {
        customer_name: selectedCustomer.value,
        scanned_barcodes: scannedBarcodes.value,
        notes: notes.value
      })
    } else {
      // Use the complete fulfillment endpoint
      response = await api.post('/api/tags/send-for-install', {
        customer_name: selectedCustomer.value,
        notes: notes.value
      })
    }
    
    results.value = response.data.results
    emit('success', response.data)
    
  } catch (err: any) {
    console.error('Fulfillment error:', err)
    error.value = err.response?.data?.message || 'Failed to process fulfillment'
  } finally {
    processing.value = false
  }
}

function reset() {
  selectedCustomer.value = ''
  mode.value = 'scan'
  currentBarcode.value = ''
  scannedBarcodes.value = []
  notes.value = ''
  processing.value = false
  results.value = null
  error.value = ''
}

function close() {
  emit('close')
}
</script>
