<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" v-if="show">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="close"></div>
      
      <!-- This element is to trick the browser into centering the modal contents. -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      
      <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
        <div class="sm:flex sm:items-start">
          <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
              Mark Products as Used
            </h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Select specific tags to mark as used and reduce inventory quantities.
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
              @change="loadTags"
            >
              <option value="">Select a customer...</option>
              <option v-for="customer in customers" :key="customer.name" :value="customer.name">
                {{ customer.name }} ({{ customer.tag_count }} tags)
              </option>
            </select>
          </div>

          <!-- Tags Selection -->
          <div v-if="selectedCustomer && tags.length > 0" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Select Tags to Mark as Used
            </label>
            <div class="max-h-64 overflow-y-auto border border-gray-300 rounded-md">
              <div v-for="tag in tags" :key="tag._id" 
                   class="flex items-center px-3 py-2 border-b border-gray-200 last:border-b-0">
                <input
                  :id="tag._id"
                  type="checkbox"
                  v-model="selectedTags"
                  :value="tag._id"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  :disabled="processing"
                >
                <label :for="tag._id" class="ml-3 flex-1 cursor-pointer">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900">
                        Tag #{{ tag._id.slice(-8) }}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2"
                              :class="getTagTypeClass(tag.tag_type)">
                          {{ tag.tag_type }}
                        </span>
                      </div>
                      <div class="text-sm text-gray-600 mt-1">
                        <div v-for="skuItem in tag.sku_items" :key="skuItem.sku_id._id" class="mb-1">
                          <span class="font-medium">{{ skuItem.sku_id.sku_code }}</span>
                          - Qty: {{ skuItem.remaining_quantity || skuItem.quantity }} / {{ skuItem.quantity }}
                          <span v-if="skuItem.sku_id.is_bundle" class="text-blue-600 text-xs">(Bundle)</span>
                        </div>
                      </div>
                      <div v-if="tag.notes" class="text-xs text-gray-500 mt-1">
                        {{ tag.notes }}
                      </div>
                    </div>
                    <div class="text-right text-xs text-gray-500">
                      <div>Created: {{ formatDate(tag.createdAt) }}</div>
                      <div v-if="tag.due_date">Due: {{ formatDate(tag.due_date) }}</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- No Tags Message -->
          <div v-if="selectedCustomer && tags.length === 0 && !loadingTags" class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p class="text-sm text-yellow-800">No active tags found for this customer.</p>
          </div>

          <!-- Loading Tags -->
          <div v-if="loadingTags" class="mb-4 p-3 bg-gray-50 rounded-md">
            <p class="text-sm text-gray-600">Loading tags...</p>
          </div>

          <!-- Selection Summary -->
          <div v-if="selectedTags.length > 0" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p class="text-sm text-blue-800">
              {{ selectedTags.length }} tag{{ selectedTags.length === 1 ? '' : 's' }} selected for completion
            </p>
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
              placeholder="Add any notes about why these products were marked as used..."
              :disabled="processing"
            ></textarea>
          </div>

          <!-- Results Display -->
          <div v-if="results" class="mb-4 p-3 bg-gray-50 rounded-md">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Results</h4>
            <div class="text-sm text-gray-600 space-y-1">
              <p>✅ {{ results.fulfilled?.length || 0 }} tags marked as used</p>
              <p v-if="results.failed?.length" class="text-red-600">
                ❌ {{ results.failed.length }} failed
              </p>
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
            @click="markAsUsed"
            :disabled="selectedTags.length === 0 || processing"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="processing" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ processing ? 'Processing...' : `Mark ${selectedTags.length} Tag${selectedTags.length === 1 ? '' : 's'} as Used` }}
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
import { ref, watch, nextTick } from 'vue'
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

interface Tag {
  _id: string
  customer_name: string
  tag_type: string
  status: string
  notes: string
  createdAt: string
  due_date?: string
  sku_items: Array<{
    sku_id: {
      _id: string
      sku_code: string
      is_bundle: boolean
    }
    quantity: number
    remaining_quantity?: number
  }>
}

interface Results {
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
const selectedTags = ref<string[]>([])
const tags = ref<Tag[]>([])
const customers = ref<Customer[]>([])
const notes = ref('')
const processing = ref(false)
const loadingTags = ref(false)
const results = ref<Results | null>(null)
const error = ref('')

// Load customers when dialog opens
watch(() => props.show, (show) => {
  if (show) {
    reset()
    loadCustomers()
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

async function loadTags() {
  if (!selectedCustomer.value) {
    tags.value = []
    return
  }
  
  loadingTags.value = true
  error.value = ''
  
  try {
    const response = await api.get('/api/tags', {
      params: {
        customer_name: selectedCustomer.value,
        status: 'active',
        limit: 100
      }
    })
    tags.value = response.data.tags
  } catch (err) {
    console.error('Failed to load tags:', err)
    error.value = 'Failed to load tags for customer'
  } finally {
    loadingTags.value = false
  }
}

async function markAsUsed() {
  if (selectedTags.value.length === 0) return
  
  processing.value = true
  error.value = ''
  
  try {
    const response = await api.post('/api/tags/mark-used', {
      tag_ids: selectedTags.value,
      notes: notes.value
    })
    
    results.value = response.data.results
    emit('success', response.data)
    
  } catch (err: any) {
    console.error('Mark used error:', err)
    error.value = err.response?.data?.message || 'Failed to mark tags as used'
  } finally {
    processing.value = false
  }
}

function getTagTypeClass(tagType: string) {
  const classes = {
    stock: 'bg-green-100 text-green-800',
    reserved: 'bg-blue-100 text-blue-800',
    broken: 'bg-red-100 text-red-800',
    imperfect: 'bg-yellow-100 text-yellow-800',
    expected: 'bg-purple-100 text-purple-800',
    partial_shipment: 'bg-indigo-100 text-indigo-800',
    backorder: 'bg-gray-100 text-gray-800'
  }
  return classes[tagType as keyof typeof classes] || classes.stock
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

function reset() {
  selectedCustomer.value = ''
  selectedTags.value = []
  tags.value = []
  notes.value = ''
  processing.value = false
  loadingTags.value = false
  results.value = null
  error.value = ''
}

function close() {
  emit('close')
}
</script>
