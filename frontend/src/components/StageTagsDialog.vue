<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="stage-tags-card stage-tags-responsive">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="local_shipping" class="text-amber-8 q-mr-sm" size="sm" />
        <div class="text-h6">
          Stage Tag - Step {{ currentStep }} of 3
        </div>
        <q-space />
        <!-- Step Indicator -->
        <div class="step-indicator q-mr-md">
          <q-chip 
            v-for="step in 3" 
            :key="step"
            :color="step <= currentStep ? 'amber-8' : 'grey-4'"
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
        <!-- Step 1: Select Tag -->
        <div v-if="currentStep === 1">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 1: Select the tag you want to stage for loading.
          </p>

          <!-- Customer Filter -->
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
            <q-spinner-dots size="lg" color="amber-8" />
            <div class="text-body2 q-mt-sm">Loading tags...</div>
          </div>

          <!-- Tags Selection -->
          <div v-else-if="filteredTags.length > 0" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">
              Select Tag to Stage ({{ filteredTags.length }} available)
            </div>
            <q-list bordered class="rounded-borders" style="max-height: 400px; overflow-y: auto;">
              <q-item 
                v-for="tag in filteredTags" 
                :key="tag._id" 
                dense 
                clickable 
                @click="selectTag(tag)" 
                :class="{ 'bg-amber-1': selectedTag?._id === tag._id }"
              >
                <q-item-section side>
                  <q-radio
                    v-model="selectedTag"
                    :val="tag"
                    :disable="processing"
                    color="amber-8"
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
                    <!-- Show staging progress if partially staged -->
                    <q-chip
                      v-if="tag.staging_progress && tag.staging_progress.percentage > 0 && tag.staging_progress.percentage < 100"
                      color="amber"
                      text-color="white"
                      size="sm"
                      class="q-ml-sm"
                    >
                      {{ tag.staging_progress.percentage }}% staged
                    </q-chip>
                    <span v-if="tag.project_name" class="text-grey-6 q-ml-sm">
                      - {{ tag.project_name }}
                    </span>
                  </q-item-label>
                  <q-item-label caption>
                    <div v-for="skuItem in tag.sku_items" :key="getSkuItemKey(skuItem)" class="q-mb-xs">
                      <strong>{{ getSkuCode(skuItem) }}</strong>
                      <span v-if="getSkuDescription(skuItem)" class="text-grey-7">
                        - {{ getSkuDescription(skuItem) }}
                      </span>
                      <span class="text-primary q-ml-sm">
                        Qty: {{ skuItem.selected_instance_ids ? skuItem.selected_instance_ids.length : 0 }}
                      </span>
                    </div>
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
                No active tags available for staging.
              </template>
            </q-banner>
          </div>
        </div>

        <!-- Step 2: Staging Checklist -->
        <div v-else-if="currentStep === 2 && selectedTag">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 2: Verify each item is loaded. Scan barcodes or check items off manually.
          </p>

          <!-- Selected Tag Info -->
          <q-banner class="bg-amber-1 text-amber-10 q-mb-md">
            <div class="text-weight-medium">
              Staging: {{ selectedTag.customer_name }}
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

          <!-- Barcode Scanner -->
          <div class="q-mb-md">
            <q-input
              v-model="scannedBarcode"
              label="Scan Barcode to verify item"
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
                  color="amber-8"
                  icon="check"
                  size="sm"
                  round
                  flat
                />
              </template>
            </q-input>
            <div v-if="scanMessage" class="q-mt-xs text-caption" :class="scanMessageColor">
              {{ scanMessage }}
            </div>
          </div>

          <!-- Overall Progress -->
          <div class="q-mb-md">
            <div class="row items-center q-mb-xs">
              <div class="text-subtitle2">Staging Progress</div>
              <q-space />
              <div class="text-weight-bold" :class="allItemsStaged ? 'text-positive' : 'text-amber-8'">
                {{ stagedCount }} / {{ totalCount }} items
              </div>
            </div>
            <q-linear-progress
              :value="totalCount > 0 ? stagedCount / totalCount : 0"
              :color="allItemsStaged ? 'positive' : 'amber'"
              size="12px"
              rounded
              class="q-mb-md"
            />
          </div>

          <!-- SKU Item Checklist -->
          <div class="text-subtitle2 q-mb-sm">
            Item Checklist
          </div>
          <q-list bordered class="rounded-borders q-mb-md">
            <q-item v-for="(item, index) in checklistItems" :key="index" dense>
              <q-item-section>
                <q-item-label :class="{ 'text-grey-5': item.staged_qty >= item.instance_count }">
                  <strong>{{ item.sku_code }}</strong>
                  <span v-if="item.name" class="text-grey-7 q-ml-sm">
                    - {{ item.name }}
                  </span>
                </q-item-label>
                <q-item-label caption>
                  {{ item.staged_qty }} of {{ item.instance_count }} verified
                </q-item-label>
                <!-- Per-item progress bar -->
                <q-linear-progress
                  :value="item.instance_count > 0 ? item.staged_qty / item.instance_count : 0"
                  :color="item.staged_qty >= item.instance_count ? 'positive' : 'amber'"
                  size="6px"
                  rounded
                  class="q-mt-xs"
                />
              </q-item-section>
              <q-item-section side style="min-width: 140px;">
                <div class="row items-center no-wrap q-gutter-xs">
                  <q-btn
                    icon="remove"
                    size="xs"
                    round
                    flat
                    dense
                    :disable="processing || item.staged_qty <= 0"
                    @click="item.staged_qty = Math.max(0, item.staged_qty - 1)"
                  />
                  <q-input
                    v-model.number="item.staged_qty"
                    type="number"
                    :min="0"
                    :max="item.instance_count"
                    dense
                    filled
                    :disable="processing"
                    style="width: 55px;"
                    input-class="text-center"
                    @update:model-value="(val) => item.staged_qty = Math.min(Math.max(0, Number(val) || 0), item.instance_count)"
                  />
                  <q-btn
                    icon="add"
                    size="xs"
                    round
                    flat
                    dense
                    :disable="processing || item.staged_qty >= item.instance_count"
                    @click="item.staged_qty = Math.min(item.instance_count, item.staged_qty + 1)"
                  />
                </div>
              </q-item-section>
              <q-item-section side>
                <q-icon 
                  :name="item.staged_qty >= item.instance_count ? 'check_circle' : (item.staged_qty > 0 ? 'timelapse' : 'radio_button_unchecked')" 
                  :color="item.staged_qty >= item.instance_count ? 'positive' : (item.staged_qty > 0 ? 'amber' : 'grey-4')"
                  size="sm"
                />
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Stage All shortcut -->
          <div class="row justify-end q-mb-md">
            <q-btn
              v-if="!allItemsStaged"
              flat
              color="amber-8"
              label="Check All"
              icon="done_all"
              size="sm"
              @click="stageAllItems"
              :disable="processing"
            />
            <q-btn
              v-else
              flat
              color="grey"
              label="Uncheck All"
              icon="remove_done"
              size="sm"
              @click="unstageAllItems"
              :disable="processing"
            />
          </div>
        </div>

        <!-- Step 3: Confirmation -->
        <div v-else-if="currentStep === 3 && selectedTag">
          <p class="text-body2 text-grey-7 q-mb-md">
            Step 3: Review and confirm staging.
          </p>

          <!-- Tag Summary -->
          <q-banner class="bg-amber-1 text-amber-10 q-mb-md">
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

          <!-- Items Summary -->
          <div class="text-subtitle2 q-mb-sm">
            Staging Summary
          </div>
          <q-list bordered class="rounded-borders q-mb-md">
            <q-item v-for="item in checklistItems" :key="item.sku_id" dense>
              <q-item-section side>
                <q-icon 
                  :name="item.staged_qty >= item.instance_count ? 'check_circle' : (item.staged_qty > 0 ? 'timelapse' : 'radio_button_unchecked')" 
                  :color="item.staged_qty >= item.instance_count ? 'positive' : (item.staged_qty > 0 ? 'amber' : 'grey-4')"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ item.sku_code }}</strong>
                  <span v-if="item.name" class="text-grey-7 q-ml-sm">
                    - {{ item.name }}
                  </span>
                </q-item-label>
                <q-item-label caption>
                  {{ item.staged_qty }} of {{ item.instance_count }} verified
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip 
                  :color="item.staged_qty >= item.instance_count ? 'positive' : (item.staged_qty > 0 ? 'amber' : 'grey')" 
                  text-color="white" 
                  size="sm"
                >
                  {{ item.staged_qty }}/{{ item.instance_count }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>

          <q-banner v-if="allItemsStaged" class="bg-green-1 text-green-8 q-mb-md">
            <q-icon name="check_circle" class="q-mr-sm" />
            All {{ totalCount }} items verified and ready for pickup. Tag will be marked as <strong>Staged</strong>.
          </q-banner>
          <q-banner v-else-if="anyChangesThisSession" class="bg-amber-1 text-amber-10 q-mb-md">
            <q-icon name="timelapse" class="q-mr-sm" />
            Partial staging: {{ stagedCount }}/{{ totalCount }} items verified. Progress will be saved — tag stays <strong>Active</strong> until all items are verified.
          </q-banner>
        </div>

        <!-- Results Display -->
        <div v-if="results" class="q-mb-md">
          <q-banner class="bg-green-1 text-green-8 q-mb-sm">
            <div class="text-subtitle2">{{ allItemsStaged ? 'Staging Complete' : 'Partial Staging Saved' }}</div>
            <div class="text-body2 q-mt-sm">
              <template v-if="allItemsStaged">
                ✅ Tag marked as staged. Items are ready for installer pickup.
              </template>
              <template v-else>
                ✅ Progress saved ({{ stagedCount }}/{{ totalCount }}). You can resume staging later.
              </template>
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
          color="amber-8"
          text-color="white"
          @click="nextStep"
          :disable="!canProceedToNextStep || processing"
        />
        
        <q-btn
          v-if="currentStep === 3"
          :label="processing ? 'Saving...' : (allItemsStaged ? 'Complete Staging' : 'Save Changes')"
          :color="allItemsStaged ? 'positive' : 'amber-8'"
          text-color="white"
          @click="submitStaging"
          :disable="!anyChangesThisSession || processing"
          :loading="processing"
          :icon="allItemsStaged ? 'local_shipping' : 'save'"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { tagApi } from '@/utils/api'
import { TAG_TYPES } from '@/types'
import type { Tag } from '@/types'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  success: [tag: Tag]
}>()

const showDialog = ref(false)
const currentStep = ref(1)
const tags = ref<Tag[]>([])
const selectedTag = ref<Tag | null>(null)
const customerFilter = ref('')
const processing = ref(false)
const loadingTags = ref(false)
const results = ref<any>(null)
const error = ref('')
const scannedBarcode = ref('')
const scanMessage = ref('')
const scanMessageColor = ref('text-positive')
const barcodeInput = ref()

// Checklist items
interface ChecklistItem {
  sku_id: string
  sku_code: string
  name?: string
  instance_ids: string[]
  instance_count: number
  staged_qty: number       // how many the user has verified so far
  already_staged: number   // how many were already staged before this session
}

const checklistItems = ref<ChecklistItem[]>([])

// Computed
const filteredTags = computed(() => {
  if (!customerFilter.value.trim()) return tags.value
  const filter = customerFilter.value.toLowerCase().trim()
  return tags.value.filter(tag => 
    tag.customer_name.toLowerCase().includes(filter) ||
    (tag.project_name && tag.project_name.toLowerCase().includes(filter))
  )
})

const stagedChecklistItems = computed(() => 
  checklistItems.value.filter(item => item.staged_qty > 0)
)

const stagedCount = computed(() => 
  checklistItems.value.reduce((sum, item) => sum + item.staged_qty, 0)
)

const totalCount = computed(() => 
  checklistItems.value.reduce((sum, item) => sum + item.instance_count, 0)
)

const allItemsStaged = computed(() => 
  checklistItems.value.length > 0 && checklistItems.value.every(item => item.staged_qty >= item.instance_count)
)

const anyChangesThisSession = computed(() => 
  checklistItems.value.some(item => item.staged_qty !== item.already_staged)
)

const canProceedToNextStep = computed(() => {
  switch (currentStep.value) {
    case 1: return selectedTag.value !== null
    case 2: return anyChangesThisSession.value
    case 3: return anyChangesThisSession.value
    default: return false
  }
})

// Helpers
const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find(t => t.value === tagType)
  return type?.color || '#6c757d'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const getSkuItemKey = (skuItem: any) => {
  return typeof skuItem.sku_id === 'object' ? skuItem.sku_id._id : skuItem.sku_id
}

const getSkuCode = (skuItem: any) => {
  return typeof skuItem.sku_id === 'object' ? skuItem.sku_id.sku_code : 'Unknown'
}

const getSkuDescription = (skuItem: any) => {
  if (typeof skuItem.sku_id === 'object') {
    return skuItem.sku_id.description || skuItem.sku_id.name || ''
  }
  return ''
}

// Load active tags (not yet staged)
const loadActiveTags = async () => {
  try {
    loadingTags.value = true
    error.value = ''
    
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

// Tag selection
const selectTag = (tag: Tag) => {
  selectedTag.value = tag
  initializeChecklist()
}

const initializeChecklist = () => {
  if (!selectedTag.value?.sku_items?.length) {
    checklistItems.value = []
    return
  }

  checklistItems.value = selectedTag.value.sku_items.map(skuItem => {
    const skuId = typeof skuItem.sku_id === 'object' ? skuItem.sku_id._id : skuItem.sku_id
    const skuCode = typeof skuItem.sku_id === 'object' ? skuItem.sku_id.sku_code : 'Unknown'
    const name = typeof skuItem.sku_id === 'object' ? (skuItem.sku_id.name || skuItem.sku_id.description || '') : ''
    const instanceIds = skuItem.selected_instance_ids || []
    
    // How many were already staged before this session
    const alreadyStaged = Math.min(skuItem.staged_instance_ids?.length || 0, instanceIds.length)

    return {
      sku_id: skuId,
      sku_code: skuCode,
      name,
      instance_ids: instanceIds,
      instance_count: instanceIds.length,
      staged_qty: alreadyStaged,
      already_staged: alreadyStaged
    }
  })
}

// Barcode scanning — each scan increments the staged_qty by 1
const processScan = () => {
  if (!scannedBarcode.value.trim()) return
  
  const code = scannedBarcode.value.trim()
  const matchingItem = checklistItems.value.find(item => 
    item.sku_code.toLowerCase() === code.toLowerCase()
  )
  
  if (matchingItem) {
    if (matchingItem.staged_qty >= matchingItem.instance_count) {
      scanMessage.value = `${matchingItem.sku_code} already fully verified (${matchingItem.instance_count}/${matchingItem.instance_count}) ✓`
      scanMessageColor.value = 'text-grey-6'
    } else {
      matchingItem.staged_qty++
      scanMessage.value = `✓ ${matchingItem.sku_code} — ${matchingItem.staged_qty}/${matchingItem.instance_count} verified`
      scanMessageColor.value = matchingItem.staged_qty >= matchingItem.instance_count ? 'text-positive' : 'text-amber-8'
    }
  } else {
    scanMessage.value = `No matching SKU found for "${code}"`
    scanMessageColor.value = 'text-negative'
  }
  
  scannedBarcode.value = ''
  setTimeout(() => { scanMessage.value = '' }, 3000)
  barcodeInput.value?.focus()
}

const stageAllItems = () => {
  checklistItems.value.forEach(item => { item.staged_qty = item.instance_count })
}

const unstageAllItems = () => {
  checklistItems.value.forEach(item => { item.staged_qty = item.already_staged })
}

// Navigation
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
    case 1: return 'Start Checklist'
    case 2: return allItemsStaged.value ? 'Review & Confirm' : 'Save Changes'
    default: return 'Next'
  }
}

// Submit staging — supports increases, decreases, and full unstage
const submitStaging = async () => {
  if (!selectedTag.value || !anyChangesThisSession.value) return
  
  try {
    processing.value = true
    error.value = ''
    results.value = null

    // Items that need unstaging (reduced below what was already staged)
    const itemsToUnstage = checklistItems.value
      .filter(item => item.staged_qty < item.already_staged)
      .map(item => ({
        sku_id: item.sku_id,
        // Remove instance_ids that are no longer staged
        instance_ids: item.instance_ids.slice(item.staged_qty, item.already_staged)
      }))

    // Items that need staging (increased above what was already staged)
    const itemsToStage = checklistItems.value
      .filter(item => item.staged_qty > item.already_staged)
      .map(item => ({
        sku_id: item.sku_id,
        instance_ids: item.instance_ids.slice(0, item.staged_qty)
      }))

    let response: any = null

    // Process unstages first
    if (itemsToUnstage.length > 0) {
      response = await tagApi.unstageTag(selectedTag.value._id, {
        unstage_items: itemsToUnstage
      })
    }

    // Then process stages
    if (itemsToStage.length > 0) {
      response = await tagApi.stageTag(selectedTag.value._id, {
        staging_items: itemsToStage,
        stage_all: allItemsStaged.value
      })
    }

    results.value = response

    setTimeout(() => {
      emit('success', response?.tag)
      close()
    }, 1500)

  } catch (err: any) {
    console.error('Staging error:', err)
    error.value = err.response?.data?.message || err.message || 'Failed to save staging changes'
  } finally {
    processing.value = false
  }
}

const close = () => {
  showDialog.value = false
  currentStep.value = 1
  selectedTag.value = null
  checklistItems.value = []
  customerFilter.value = ''
  scannedBarcode.value = ''
  scanMessage.value = ''
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
    checklistItems.value = []
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
.stage-tags-card {
  max-height: 90vh;
  overflow-y: auto;
}

.stage-tags-responsive {
  width: 100%;
  min-width: 320px;
  max-width: min(1000px, 95vw);
}

.text-strike {
  text-decoration: line-through;
}

@media (max-width: 768px) {
  .stage-tags-responsive {
    max-width: 98vw;
    margin: 8px;
  }
  
  .stage-tags-card {
    max-height: 95vh;
  }
  
  .step-indicator {
    display: none;
  }
  
  .q-card-section {
    padding: 12px;
  }
  
  .q-item {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .stage-tags-responsive {
    max-width: 100vw;
    margin: 4px;
  }
  
  .q-card-section {
    padding: 8px;
  }
}

.q-item-section {
  min-width: 0;
}

.q-item-label {
  word-break: break-word;
}
</style>
