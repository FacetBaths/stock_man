<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="send-install-card" style="min-width: 500px; max-width: 600px;">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="local_shipping" class="text-orange q-mr-sm" size="sm" />
        <div class="text-h6">Send For Install</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <p class="text-body2 text-grey-7 q-mb-md">
          Scan barcodes to partially fulfill tags or complete all tags for a customer.
        </p>

        <!-- Customer Selection -->
        <q-select
          v-model="selectedCustomer"
          :options="customerOptions"
          label="Customer"
          filled
          :disable="processing"
          class="q-mb-md"
        />

        <!-- Scanning Mode Selection -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Mode</div>
          <q-radio
            v-model="mode"
            val="scan"
            label="Scan individual items"
            class="q-mr-md"
          />
          <q-radio
            v-model="mode"
            val="complete"
            label="Complete all tags"
          />
        </div>

        <!-- Barcode Scanning Section -->
        <div v-if="mode === 'scan'" class="q-mb-md">
          <q-input
            v-model="currentBarcode"
            label="Scan Barcode"
            filled
            :disable="processing || !selectedCustomer"
            @keydown.enter="addBarcode"
            ref="barcodeInput"
          >
            <template v-slot:append>
              <q-btn
                @click="addBarcode"
                :disable="!currentBarcode.trim() || processing"
                color="primary"
                icon="add"
                size="sm"
                round
                flat
              />
            </template>
          </q-input>

          <!-- Scanned Barcodes List -->
          <div v-if="scannedBarcodes.length > 0" class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">
              Scanned Items ({{ scannedBarcodes.length }})
            </div>
            <q-list bordered class="rounded-borders" style="max-height: 150px; overflow-y: auto;">
              <q-item v-for="(barcode, index) in scannedBarcodes" :key="index" dense>
                <q-item-section>
                  <q-item-label class="text-body2">{{ barcode }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    @click="removeBarcode(index)"
                    color="negative"
                    icon="remove"
                    size="sm"
                    round
                    flat
                    :disable="processing"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </div>
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
        />

        <!-- Results Display -->
        <div v-if="results" class="q-mb-md">
          <q-banner class="bg-grey-2 q-mb-sm">
            <div class="text-subtitle2">Results</div>
            <div class="text-body2 q-mt-sm">
              <div v-if="mode === 'scan'">
                <div>✅ {{ results.fulfilled_items?.length || 0 }} items fulfilled</div>
                <div v-if="results.partially_fulfilled_tags?.length">
                  🔄 {{ results.partially_fulfilled_tags.length }} tags partially fulfilled
                </div>
                <div v-if="results.fully_fulfilled_tags?.length">
                  ✅ {{ results.fully_fulfilled_tags.length }} tags completed
                </div>
                <div v-if="results.failed_scans?.length" class="text-negative">
                  ❌ {{ results.failed_scans.length }} failed scans
                </div>
              </div>
              <div v-else>
                <div>✅ {{ results.fulfilled?.length || 0 }} tags completed</div>
                <div v-if="results.failed?.length" class="text-negative">
                  ❌ {{ results.failed.length }} failed
                </div>
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
          :label="processing ? 'Processing...' : (mode === 'scan' ? 'Process Scans' : 'Complete All Tags')"
          color="positive"
          @click="processFulfillment"
          :disable="!canProcess || processing"
          :loading="processing"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { tagApi } from '@/utils/api'

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

const showDialog = ref(false)
const selectedCustomer = ref('')
const mode = ref<'scan' | 'complete'>('scan')
const currentBarcode = ref('')
const scannedBarcodes = ref<string[]>([])
const notes = ref('')
const processing = ref(false)
const results = ref<Results | null>(null)
const error = ref('')
const customers = ref<Customer[]>([])
const barcodeInput = ref()

const customerOptions = computed(() => 
  customers.value.map(c => ({
    label: `${c.name} (${c.tag_count} tags)`,
    value: c.name
  }))
)

const canProcess = computed(() => {
  if (!selectedCustomer.value) return false
  if (mode.value === 'scan') {
    return scannedBarcodes.value.length > 0
  }
  return true
})

// Sync show prop with internal dialog state
watch(() => props.show, (show) => {
  showDialog.value = show
  if (show) {
    reset()
    loadCustomers()
    nextTick(() => {
      barcodeInput.value?.focus()
    })
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
    const response = await tagApi.getCustomers()
    customers.value = response.customers
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
      // Use the existing sendForInstall method with barcodes
      response = await tagApi.sendForInstall({
        customer_name: selectedCustomer.value,
        scanned_barcodes: scannedBarcodes.value,
        notes: notes.value
      })
    } else {
      // Use the existing sendForInstall method without barcodes (complete all tags)
      response = await tagApi.sendForInstall({
        customer_name: selectedCustomer.value,
        notes: notes.value
      })
    }
    
    results.value = response.results
    emit('success', response)
    
  } catch (err: any) {
    console.error('Fulfillment error:', err)
    error.value = err.response?.data?.message || err.message || 'Failed to process fulfillment'
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
  showDialog.value = false
}
</script>

<style scoped>
.send-install-card {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
