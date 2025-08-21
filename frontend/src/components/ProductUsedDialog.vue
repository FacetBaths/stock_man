<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="product-used-card" style="min-width: 600px; max-width: 800px;">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="done_all" class="text-deep-orange q-mr-sm" size="sm" />
        <div class="text-h6">Mark Products as Used</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <p class="text-body2 text-grey-7 q-mb-md">
          Select specific tags to mark as used and reduce inventory quantities.
        </p>

        <!-- Customer Selection -->
        <q-select
          v-model="selectedCustomer"
          :options="customerOptions"
          label="Customer"
          filled
          :disable="processing"
          @update:model-value="loadTags"
          class="q-mb-md"
        />

        <!-- Tags Selection -->
        <div v-if="selectedCustomer && tags.length > 0" class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">
            Select Tags to Mark as Used
          </div>
          <q-list bordered class="rounded-borders" style="max-height: 300px; overflow-y: auto;">
            <q-item v-for="tag in tags" :key="tag._id" dense>
              <q-item-section side>
                <q-checkbox
                  v-model="selectedTags"
                  :val="tag._id"
                  :disable="processing"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  Tag #{{ tag._id.slice(-8) }}
                  <q-chip
                    :color="getTagTypeColor(tag.tag_type)"
                    text-color="white"
                    size="sm"
                    class="q-ml-sm"
                  >
                    {{ tag.tag_type }}
                  </q-chip>
                </q-item-label>
                <q-item-label caption>
                  <div v-for="skuItem in tag.sku_items" :key="skuItem.sku_id._id" class="q-mb-xs">
                    <strong>{{ skuItem.sku_id.sku_code }}</strong>
                    - Qty: {{ skuItem.remaining_quantity || skuItem.quantity }} / {{ skuItem.quantity }}
                    <q-chip v-if="skuItem.sku_id.is_bundle" color="blue" text-color="white" size="xs" class="q-ml-xs">
                      Bundle
                    </q-chip>
                  </div>
                </q-item-label>
                <q-item-label v-if="tag.notes" caption class="text-grey-6">
                  {{ tag.notes }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>
                  Created: {{ formatDate(tag.createdAt) }}
                </q-item-label>
                <q-item-label v-if="tag.due_date" caption>
                  Due: {{ formatDate(tag.due_date) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- No Tags Message -->
        <div v-if="selectedCustomer && tags.length === 0 && !loadingTags" class="q-mb-md">
          <q-banner class="bg-yellow-1 text-orange-8">
            No active tags found for this customer.
          </q-banner>
        </div>

        <!-- Loading Tags -->
        <div v-if="loadingTags" class="q-mb-md text-center">
          <q-spinner-dots size="lg" color="primary" />
          <div class="text-body2 q-mt-sm">Loading tags...</div>
        </div>

        <!-- Selection Summary -->
        <div v-if="selectedTags.length > 0" class="q-mb-md">
          <q-banner class="bg-blue-1 text-blue-8">
            {{ selectedTags.length }} tag{{ selectedTags.length === 1 ? '' : 's' }} selected for completion
          </q-banner>
        </div>

        <!-- Notes -->
        <q-input
          v-model="notes"
          label="Notes (optional)"
          type="textarea"
          rows="2"
          filled
          :disable="processing"
          class="q-mb-md"
          placeholder="Add any notes about why these products were marked as used..."
        />

        <!-- Results Display -->
        <div v-if="results" class="q-mb-md">
          <q-banner class="bg-grey-2 q-mb-sm">
            <div class="text-subtitle2">Results</div>
            <div class="text-body2 q-mt-sm">
              <div>✅ {{ results.fulfilled?.length || 0 }} tags marked as used</div>
              <div v-if="results.failed?.length" class="text-negative">
                ❌ {{ results.failed.length }} failed
              </div>
              <div>📦 {{ results.inventory_reduced?.length || 0 }} inventory items updated</div>
            </div>
          </q-banner>
        </div>

        <!-- Error Display -->
        <q-banner v-if="error" class="bg-negative text-white q-mb-md">
          {{ error }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="close" :disable="processing" />
        <q-btn
          :label="`Mark ${selectedTags.length} Tag${selectedTags.length === 1 ? '' : 's'} as Used`"
          color="positive"
          @click="markAsUsed"
          :disable="selectedTags.length === 0 || processing"
          :loading="processing"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api from '@/utils/api'

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

const showDialog = ref(false)
const selectedCustomer = ref('')
const selectedTags = ref<string[]>([])
const tags = ref<Tag[]>([])
const customers = ref<Customer[]>([])
const notes = ref('')
const processing = ref(false)
const loadingTags = ref(false)
const results = ref<Results | null>(null)
const error = ref('')

const customerOptions = computed(() => 
  customers.value.map(c => ({
    label: `${c.name} (${c.tag_count} tags)`,
    value: c.name
  }))
)

// Sync show prop with internal dialog state
watch(() => props.show, (show) => {
  showDialog.value = show
  if (show) {
    reset()
    loadCustomers()
  }
})

// Close dialog when internal state changes
watch(showDialog, (show) => {
  if (!show) {
    emit('close')
  }
})

async function loadCustomers() {
  try {
    const response = await api.get('/tags/customers')
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
    const response = await api.get('/tags', {
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
    const response = await api.post('/tags/mark-used', {
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

function getTagTypeColor(tagType: string) {
  const colors = {
    stock: 'positive',
    reserved: 'info',
    broken: 'negative',
    imperfect: 'warning',
    expected: 'purple',
    partial_shipment: 'indigo',
    backorder: 'grey'
  }
  return colors[tagType as keyof typeof colors] || 'positive'
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
  showDialog.value = false
}
</script>

<style scoped>
.product-used-card {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
