<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="fulfill-tags-card fulfill-tags-responsive">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="done_all" class="text-positive q-mr-sm" size="sm" />
        <div class="text-h6">
          Fulfill Tags - Step {{ currentStep }} of 3
        </div>
        <q-space />
        <!-- Step Indicator -->
        <div class="step-indicator q-mr-md">
          <q-chip 
            v-for="step in 3" 
            :key="step"
            :color="step <= currentStep ? 'positive' : 'grey-4'"
            :text-color="step <= currentStep ? 'white' : 'grey-7'"
            size="sm"
            class="q-mx-xs"
          >
            {{ step }}
          </q-chip>
        </div>
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Step 1: Select Tags -->
        <div v-if="currentStep === 1">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 1: Select the tag you want to fulfill from the list below.
          </p>

          <!-- Customer Filter (Optional) -->
          <q-input
            v-model="customerFilter"
            label="Filter by Customer (Optional)"
            filled
            clearable
            :disable="processing"
            class="q-mb-md"
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>

          <!-- Loading Tags -->
          <div v-if="loadingTags" class="q-mb-md text-center">
            <q-spinner-dots size="lg" color="primary" />
            <div class="text-body2 q-mt-sm">Loading tags...</div>
          </div>

          <!-- Tags Selection -->
          <div v-else-if="filteredTags.length > 0" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">
              Select Tag to Fulfill ({{ filteredTags.length }} available)
            </div>
            <q-list bordered class="rounded-borders" style="max-height: 400px; overflow-y: auto;">
              <q-item v-for="tag in filteredTags" :key="tag._id" dense clickable @click="selectTag(tag)" :class="{ 'bg-blue-1': selectedTag?._id === tag._id }">
                <q-item-section side>
                  <q-radio
                    v-model="selectedTag"
                    :val="tag"
                    :disable="processing"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    <strong>{{ tag.customer_name }}</strong>
                    <q-chip
                      :color="getTagTypeColor(tag.tag_type)"
                      text-color="white"
                      size="sm"
                      class="q-ml-sm"
                    >
                      {{ tag.tag_type }}
                    </q-chip>
                    <span v-if="tag.project_name" class="text-grey-6 q-ml-sm">
                      - {{ tag.project_name }}
                    </span>
                  </q-item-label>
                  <q-item-label caption>
                    <div v-for="skuItem in tag.sku_items" :key="skuItem.sku_id._id" class="q-mb-xs">
                      <strong>{{ skuItem.sku_id.sku_code }}</strong>
                      <span v-if="skuItem.sku_id.description" class="text-grey-7">
                        - {{ skuItem.sku_id.description }}
                      </span>
                      <span class="text-primary q-ml-sm">
                        Qty: {{ skuItem.selected_instance_ids ? skuItem.selected_instance_ids.length : 0 }}
                      </span>
                    </div>
                  </q-item-label>
                  <q-item-label v-if="tag.notes" caption class="text-grey-6 q-mt-xs">
                    Notes: {{ tag.notes }}
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
          <div v-else-if="!loadingTags" class="q-mb-md">
            <q-banner class="bg-yellow-1 text-orange-8">
              <template v-if="customerFilter">
                No active tags found for customer "{{ customerFilter }}".
              </template>
              <template v-else>
                No active tags available for fulfillment.
              </template>
            </q-banner>
          </div>
        </div>

        <!-- Step 2: Select Items and Quantities -->
        <div v-else-if="currentStep === 2 && selectedTag">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 2: Select which SKU items to fulfill and specify quantities. You can scan barcodes or manually adjust quantities.
          </p>

          <!-- Selected Tag Info -->
          <q-banner class="bg-blue-1 text-blue-8 q-mb-md">
            <div class="text-weight-medium">
              Fulfilling: {{ selectedTag.customer_name }}
              <q-chip
                :color="getTagTypeColor(selectedTag.tag_type)"
                text-color="white"
                size="sm"
                class="q-ml-sm"
              >
                {{ selectedTag.tag_type }}
              </q-chip>
            </div>
            <div class="text-body2" v-if="selectedTag.project_name">
              Project: {{ selectedTag.project_name }}
            </div>
          </q-banner>

          <!-- Barcode Scanner (Optional) -->
          <div class="q-mb-md">
            <q-input
              v-model="scannedBarcode"
              label="Scan Barcode (Optional)"
              filled
              :disable="processing"
              @keydown.enter="processScan"
              ref="barcodeInput"
            >
              <template v-slot:prepend>
                <q-icon name="qr_code_scanner" />
              </template>
              <template v-slot:append>
                <q-btn
                  @click="processScan"
                  :disable="!scannedBarcode.trim() || processing"
                  color="primary"
                  icon="add"
                  size="sm"
                  round
                  flat
                />
              </template>
            </q-input>
          </div>

          <!-- SKU Items for Fulfillment -->
          <div class="text-subtitle2 q-mb-sm">
            SKU Items in this Tag
          </div>
          <q-list bordered class="rounded-borders q-mb-md">
            <q-item v-for="(skuItem, index) in fulfillmentItems" :key="index" dense>
              <q-item-section side>
                <q-checkbox
                  v-model="skuItem.selected"
                  :disable="processing"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ skuItem.sku_code }}</strong>
                  <span v-if="skuItem.description" class="text-grey-7 q-ml-sm">
                    - {{ skuItem.description }}
                  </span>
                </q-item-label>
                <q-item-label caption>
                  Available: {{ skuItem.available_quantity }}
                </q-item-label>
              </q-item-section>
              <q-item-section side style="min-width: 120px;">
                <q-input
                  v-model.number="skuItem.fulfill_quantity"
                  type="number"
                  :min="0"
                  :max="skuItem.available_quantity"
                  dense
                  filled
                  :disable="!skuItem.selected || processing"
                  label="Qty"
                  style="width: 80px;"
                />
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Fulfillment Summary -->
          <div v-if="selectedFulfillmentItems.length > 0" class="q-mb-md">
            <q-banner class="bg-green-1 text-green-8">
              <div class="text-weight-medium">
                {{ selectedFulfillmentItems.length }} SKU item{{ selectedFulfillmentItems.length === 1 ? '' : 's' }} selected
              </div>
              <div class="text-body2 q-mt-xs">
                Total quantity: {{ totalFulfillQuantity }}
              </div>
            </q-banner>
          </div>
        </div>

        <!-- Step 3: Confirmation -->
        <div v-else-if="currentStep === 3 && selectedTag">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 3: Review and confirm the fulfillment details below.
          </p>

          <!-- Tag Summary -->
          <q-banner class="bg-blue-1 text-blue-8 q-mb-md">
            <div class="text-weight-medium">
              Tag: {{ selectedTag.customer_name }}
              <q-chip
                :color="getTagTypeColor(selectedTag.tag_type)"
                text-color="white"
                size="sm"
                class="q-ml-sm"
              >
                {{ selectedTag.tag_type }}
              </q-chip>
            </div>
            <div class="text-body2" v-if="selectedTag.project_name">
              Project: {{ selectedTag.project_name }}
            </div>
          </q-banner>

          <!-- Items to Fulfill -->
          <div class="text-subtitle2 q-mb-sm">
            Items to Fulfill
          </div>
          <q-list bordered class="rounded-borders q-mb-md">
            <q-item v-for="item in selectedFulfillmentItems" :key="item.sku_id" dense>
              <q-item-section>
                <q-item-label>
                  <strong>{{ item.sku_code }}</strong>
                  <span v-if="item.description" class="text-grey-7 q-ml-sm">
                    - {{ item.description }}
                  </span>
                </q-item-label>
                <q-item-label caption>
                  Fulfilling {{ item.fulfill_quantity }} of {{ item.available_quantity }} available
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip color="positive" text-color="white" size="sm">
                  {{ item.fulfill_quantity }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Notes (Step 3 only) -->
        <div v-if="currentStep === 3">
          <q-input
            v-model="notes"
            label="Fulfillment Notes (Optional)"
            type="textarea"
            rows="2"
            filled
            :disable="processing"
            class="q-mb-md"
            placeholder="Add notes about this fulfillment..."
          />
        </div>

        <!-- Results Display -->
        <div v-if="results" class="q-mb-md">
          <q-banner class="bg-green-1 text-green-8 q-mb-sm">
            <div class="text-subtitle2">Fulfillment Results</div>
            <div class="text-body2 q-mt-sm">
              <div v-if="results.fulfilled_tags?.length">
                ✅ {{ results.fulfilled_tags.length }} tags fulfilled successfully
              </div>
              <div v-if="results.updated_inventory?.length">
                📦 {{ results.updated_inventory.length }} inventory records updated
              </div>
              <div v-if="results.instances_deleted">
                🗑️ {{ results.instances_deleted }} inventory instances removed
              </div>
              <div v-if="results.failed_tags?.length" class="text-negative">
                ❌ {{ results.failed_tags.length }} tags failed to fulfill
              </div>
            </div>
          </q-banner>
          
          <!-- Failed Tags Details -->
          <div v-if="results.failed_tags?.length" class="q-mt-sm">
            <q-banner class="bg-red-1 text-red-8">
              <div class="text-subtitle2">Failed Tags:</div>
              <div v-for="failure in results.failed_tags" :key="failure.tag_id" class="text-body2">
                • {{ failure.customer_name }}: {{ failure.error }}
              </div>
            </q-banner>
          </div>
        </div>

        <!-- Error Display -->
        <q-banner v-if="error" class="bg-negative text-white q-mb-md">
          {{ error }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="close" :disable="processing" />
        
        <!-- Step Navigation -->
        <q-btn 
          v-if="currentStep > 1"
          flat 
          label="Back" 
          @click="previousStep" 
          :disable="processing" 
        />
        
        <q-btn
          v-if="currentStep < 3"
          :label="getNextButtonLabel()"
          color="primary"
          @click="nextStep"
          :disable="!canProceedToNextStep || processing"
        />
        
        <q-btn
          v-if="currentStep === 3"
          :label="processing ? 'Fulfilling...' : 'Complete Fulfillment'"
          color="positive"
          @click="fulfillTags"
          :disable="selectedFulfillmentItems.length === 0 || processing"
          :loading="processing"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { tagApi } from '@/utils/api'
import { TAG_TYPES } from '@/types'

interface Props {
  show: boolean
}

interface Tag {
  _id: string
  customer_name: string
  project_name?: string
  tag_type: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  status: string
  notes?: string
  createdAt: string
  due_date?: string
  sku_items: Array<{
    sku_id: {
      _id: string
      sku_code: string
      description?: string
    }
    selected_instance_ids: string[]
    selection_method: 'auto' | 'manual' | 'fifo' | 'cost_based'
    notes?: string
  }>
}

interface FulfillmentResults {
  fulfilled_tags?: Array<{
    tag_id: string
    customer_name: string
  }>
  failed_tags?: Array<{
    tag_id: string
    customer_name: string
    error: string
  }>
  updated_inventory?: Array<{
    sku_id: string
    sku_code: string
    quantity_reduced: number
  }>
  instances_deleted?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  success: [results: FulfillmentResults]
}>()

const showDialog = ref(false)
const currentStep = ref(1)
const tags = ref<Tag[]>([])
const selectedTag = ref<Tag | null>(null)
const customerFilter = ref('')
const notes = ref('')
const processing = ref(false)
const loadingTags = ref(false)
const results = ref<FulfillmentResults | null>(null)
const error = ref('')
const scannedBarcode = ref('')
const barcodeInput = ref()

// Step 2: Fulfillment items with quantities
interface FulfillmentItem {
  sku_id: string
  sku_code: string
  description?: string
  available_quantity: number
  fulfill_quantity: number
  selected: boolean
}

const fulfillmentItems = ref<FulfillmentItem[]>([])

// Computed properties
const filteredTags = computed(() => {
  if (!customerFilter.value.trim()) return tags.value
  
  const filter = customerFilter.value.toLowerCase().trim()
  return tags.value.filter(tag => 
    tag.customer_name.toLowerCase().includes(filter) ||
    (tag.project_name && tag.project_name.toLowerCase().includes(filter))
  )
})

const selectedFulfillmentItems = computed(() => {
  return fulfillmentItems.value.filter(item => item.selected && item.fulfill_quantity > 0)
})

const totalFulfillQuantity = computed(() => {
  return selectedFulfillmentItems.value.reduce((total, item) => total + item.fulfill_quantity, 0)
})

const canProceedToNextStep = computed(() => {
  switch (currentStep.value) {
    case 1:
      return selectedTag.value !== null
    case 2:
      return selectedFulfillmentItems.value.length > 0
    case 3:
      return selectedFulfillmentItems.value.length > 0
    default:
      return false
  }
})

// Methods
const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find(t => t.value === tagType)
  return type?.color || '#6c757d'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const loadActiveTags = async () => {
  try {
    loadingTags.value = true
    error.value = ''
    
    // Get all active tags with populated SKU items
    const response = await tagApi.getTags({
      status: 'active',
      include_items: true,
      sort_by: 'customer_name',
      sort_order: 'asc'
    })
    
    tags.value = response.tags || []
  } catch (err: any) {
    console.error('Failed to load tags:', err)
    error.value = err.response?.data?.message || 'Failed to load tags'
  } finally {
    loadingTags.value = false
  }
}

// Step methods
const selectTag = (tag: Tag) => {
  selectedTag.value = tag
  initializeFulfillmentItems()
}

const initializeFulfillmentItems = () => {
  if (!selectedTag.value) {
    return
  }
  
  if (!selectedTag.value.sku_items || selectedTag.value.sku_items.length === 0) {
    fulfillmentItems.value = []
    return
  }
  
  console.log('🔄 FulfillTagsDialog: Initializing fulfillment items for tag:', selectedTag.value)
  
  fulfillmentItems.value = selectedTag.value.sku_items.map((skuItem) => {
    // Handle both populated and non-populated sku_id
    const skuId = typeof skuItem.sku_id === 'object' ? skuItem.sku_id._id : skuItem.sku_id
    const skuCode = typeof skuItem.sku_id === 'object' ? skuItem.sku_id.sku_code : 'Unknown'
    const description = typeof skuItem.sku_id === 'object' ? skuItem.sku_id.description : undefined
    
    // INSTANCE-BASED ARCHITECTURE: Use selected_instance_ids.length as single source of truth
    const availableQuantity = skuItem.selected_instance_ids ? skuItem.selected_instance_ids.length : 0
    
    console.log(`📊 SKU ${skuCode}: selected_instance_ids=${skuItem.selected_instance_ids?.length || 0}, available=${availableQuantity}`)
    
    return {
      sku_id: skuId,
      sku_code: skuCode,
      description: description,
      available_quantity: availableQuantity,
      fulfill_quantity: availableQuantity, // Default to fulfill all available
      selected: true // Default to selected
    }
  })
  
  console.log('✅ FulfillTagsDialog: Fulfillment items initialized:', fulfillmentItems.value)
}

const nextStep = () => {
  if (canProceedToNextStep.value && currentStep.value < 3) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const getNextButtonLabel = () => {
  switch (currentStep.value) {
    case 1:
      return 'Select Items'
    case 2:
      return 'Review & Confirm'
    default:
      return 'Next'
  }
}

const processScan = async () => {
  if (!scannedBarcode.value.trim()) return
  
  // Find matching SKU item by barcode or SKU code
  const matchingItem = fulfillmentItems.value.find(item => 
    item.sku_code === scannedBarcode.value.trim()
  )
  
  if (matchingItem) {
    matchingItem.selected = true
    if (matchingItem.fulfill_quantity === 0) {
      matchingItem.fulfill_quantity = 1
    }
    scannedBarcode.value = ''
  } else {
    error.value = `No matching SKU found for barcode: ${scannedBarcode.value}`
    setTimeout(() => {
      error.value = ''
    }, 3000)
  }
}

const fulfillTags = async () => {
  if (!selectedTag.value || selectedFulfillmentItems.value.length === 0) return
  
  try {
    processing.value = true
    error.value = ''
    results.value = null
    
    const fulfillmentResults: FulfillmentResults = {
      fulfilled_tags: [],
      failed_tags: [],
      updated_inventory: [],
      instances_deleted: 0
    }
    
    try {
      // Prepare fulfillment items for API call
      const fulfillmentItemsForApi = selectedFulfillmentItems.value.map(item => ({
        item_id: item.sku_id, // This might need adjustment based on actual API
        quantity_fulfilled: item.fulfill_quantity
      }))
      
      // Call the partial fulfill API endpoint
      await tagApi.fulfillTag(selectedTag.value._id, fulfillmentItemsForApi)
      
      fulfillmentResults.fulfilled_tags?.push({
        tag_id: selectedTag.value._id,
        customer_name: selectedTag.value.customer_name
      })
      
      // Count instances that will be deleted
      const instanceCount = selectedFulfillmentItems.value.reduce((sum, item) => sum + item.fulfill_quantity, 0)
      fulfillmentResults.instances_deleted = instanceCount
      
      // Track inventory updates
      selectedFulfillmentItems.value.forEach(item => {
        fulfillmentResults.updated_inventory?.push({
          sku_id: item.sku_id,
          sku_code: item.sku_code,
          quantity_reduced: item.fulfill_quantity
        })
      })
      
    } catch (tagError: any) {
      fulfillmentResults.failed_tags?.push({
        tag_id: selectedTag.value._id,
        customer_name: selectedTag.value.customer_name,
        error: tagError.response?.data?.message || tagError.message || 'Unknown error'
      })
    }
    
    results.value = fulfillmentResults
    
    // If successful, refresh tags and close after showing results
    if (!fulfillmentResults.failed_tags?.length) {
      await loadActiveTags()
      setTimeout(() => {
        emit('success', fulfillmentResults)
        close()
      }, 2000) // Show results for 2 seconds before closing
    }
    
  } catch (err: any) {
    console.error('Fulfillment error:', err)
    error.value = err.response?.data?.message || err.message || 'Failed to fulfill tags'
  } finally {
    processing.value = false
  }
}

const close = () => {
  showDialog.value = false
  // Reset form
  currentStep.value = 1
  selectedTag.value = null
  fulfillmentItems.value = []
  customerFilter.value = ''
  notes.value = ''
  scannedBarcode.value = ''
  results.value = null
  error.value = ''
  emit('close')
}

// Watchers
watch(() => props.show, (newValue) => {
  showDialog.value = newValue
  if (newValue) {
    currentStep.value = 1
    selectedTag.value = null
    fulfillmentItems.value = []
    loadActiveTags()
  }
})

watch(showDialog, (newValue) => {
  if (!newValue && props.show) {
    emit('close')
  }
})

onMounted(() => {
  if (props.show) {
    showDialog.value = true
    loadActiveTags()
  }
})
</script>

<style scoped>
.fulfill-tags-card {
  max-height: 90vh;
  overflow-y: auto;
}

.fulfill-tags-responsive {
  width: 100%;
  min-width: 320px;
  max-width: min(1000px, 95vw);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .fulfill-tags-responsive {
    max-width: 98vw;
    margin: 8px;
  }
  
  .fulfill-tags-card {
    max-height: 95vh;
  }
  
  /* Adjust step indicator for mobile */
  .step-indicator {
    display: none;
  }
  
  /* Make sure inputs don't overflow */
  .q-input {
    min-width: 0;
  }
  
  /* Adjust card sections padding on mobile */
  .q-card-section {
    padding: 12px;
  }
  
  /* Make sure list items wrap properly */
  .q-item {
    flex-wrap: wrap;
  }
  
  /* Ensure quantity input doesn't break layout on mobile */
  .q-item-section[style*="min-width: 120px"] {
    min-width: 80px !important;
  }
}

@media (max-width: 480px) {
  .fulfill-tags-responsive {
    max-width: 100vw;
    margin: 4px;
  }
  
  .q-card-section {
    padding: 8px;
  }
  
  /* Hide project name on very small screens to save space */
  .text-body2 {
    font-size: 0.8rem;
  }
  
  /* Make chips smaller on mobile */
  .q-chip {
    font-size: 0.7rem;
  }
}

.q-item-section {
  min-width: 0; /* Allow text wrapping */
}

.q-item-label {
  word-break: break-word;
}
</style>
