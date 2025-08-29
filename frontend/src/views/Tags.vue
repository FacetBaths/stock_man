<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTagStore } from '@/stores/tag'
import { useCategoryStore } from '@/stores/category'
import { tagApi } from '@/utils/api'
import type { Tag } from '@/types'
import { TAG_TYPES } from '@/types'
import CreateTagModal from '@/components/CreateTagModal.vue'
import EditTagModal from '@/components/EditTagModal.vue'
import FulfillTagsDialog from '@/components/FulfillTagsDialog.vue'
import { useQuasar } from 'quasar'

const authStore = useAuthStore()
const tagStore = useTagStore()
const categoryStore = useCategoryStore()
const $q = useQuasar()

// Local state for modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const tagToEdit = ref<Tag | null>(null)
const showFulfillDialog = ref(false)
const selectedTags = ref<Tag[]>([])

// Store state computed properties
const error = computed(() => tagStore.error)
const isLoading = computed(() => tagStore.isLoading)
const stats = computed(() => tagStore.tagStats)

// Filters - sync with store filters
const statusFilter = computed({
  get: () => tagStore.filters.status || 'active',
  set: (value) => {
    tagStore.updateFilters({ status: value === 'all' ? '' : value })
  }
})

const tagTypeFilter = computed({
  get: () => tagStore.filters.tag_type || 'all',
  set: (value) => {
    tagStore.updateFilters({ tag_type: value === 'all' ? '' : value })
  }
})

const customerFilter = computed({
  get: () => tagStore.filters.customer_name || '',
  set: (value) => {
    tagStore.updateFilters({ customer_name: value.trim() })
  }
})

// Use store computed properties  
const filteredTags = computed(() => tagStore.tags)

const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find(t => t.value === tagType)
  return type?.color || '#6c757d'
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'positive'
    case 'fulfilled': return 'info'
    case 'cancelled': return 'negative'
    default: return 'grey'
  }
}

// Updated methods to use store
const loadTags = async () => {
  await tagStore.fetchTags()
}

const loadStats = async () => {
  await tagStore.fetchStats()
}

const handleEditTag = async (tag: Tag) => {
  try {
    console.log('Opening edit modal for tag:', tag)
    
    // Fetch the tag with populated items to ensure we have all the details
    const fullTag = await tagStore.fetchTag(tag._id, true)
    
    console.log('Full tag data received:', fullTag)
    
    // Validate that we have the tag data
    if (!fullTag) {
      throw new Error('Tag data not found')
    }
    
    tagToEdit.value = fullTag
    showEditModal.value = true
  } catch (err: any) {
    console.error('Edit tag error:', err)
    $q.notify({
      type: 'negative', 
      message: `Failed to load tag details: ${err.message}`,
      timeout: 3000
    })
    
    // Fallback: Use the existing tag data if fetch fails
    if (tag && tag._id) {
      console.log('Using fallback tag data:', tag)
      tagToEdit.value = tag
      showEditModal.value = true
    }
  }
}

const handleCreateSuccess = async () => {
  showCreateModal.value = false
  await Promise.all([loadTags(), loadStats()])
}

const handleEditSuccess = async () => {
  showEditModal.value = false
  tagToEdit.value = null
  await Promise.all([loadTags(), loadStats()])
}

const handleDeleteTag = async (tag: Tag) => {
  if (confirm(`Are you sure you want to delete tag for ${tag.customer_name}?`)) {
    try {
      await tagStore.deleteTag(tag._id)
      await Promise.all([loadTags(), loadStats()])
    } catch (err: any) {
      tagStore.error = err.message || 'Failed to delete tag'
    }
  }
}

const clearError = () => {
  tagStore.clearError()
}

// Fulfill Tags workflow
const handleFulfillTags = () => {
  showFulfillDialog.value = true
}

// Handle fulfill dialog success
const handleFulfillSuccess = async (results: any) => {
  const fulfilledCount = results.fulfilled_tags?.length || 0
  const failedCount = results.failed_tags?.length || 0
  
  if (fulfilledCount > 0) {
    $q.notify({
      type: 'positive',
      message: `Successfully fulfilled ${fulfilledCount} tag${fulfilledCount === 1 ? '' : 's'}`,
      timeout: 5000
    })
  }
  
  if (failedCount > 0) {
    $q.notify({
      type: 'warning',
      message: `${failedCount} tag${failedCount === 1 ? '' : 's'} failed to fulfill`,
      timeout: 5000
    })
  }
  
  await loadTags()
  await loadStats()
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const getItemsDisplay = (skuItems: any[]) => {
  console.log('📋 [Tags] getItemsDisplay called with:', skuItems)
  
  if (!skuItems || skuItems.length === 0) {
    console.log('❌ [Tags] No sku_items found')
    return 'No items'
  }
  
  return skuItems.map(tagItem => {
    console.log('🔄 [Tags] Processing tagItem:', tagItem)
    
    // INSTANCE-BASED ARCHITECTURE: Handle sku_items with direct sku_id reference or populated SKU data
    const sku = tagItem.sku_details || tagItem.sku_id || null
    
    // Use selected_instance_ids.length as single source of truth
    const quantity = tagItem.selected_instance_ids ? tagItem.selected_instance_ids.length : 0
    
    if (!sku) {
      console.log('⚠️ [Tags] No SKU data found for item')
      return `SKU ${tagItem.sku_id} (${quantity})`
    }
    
    let displayName = sku.sku_code || 'Unknown SKU'
    
    // Add description if available
    if (sku.description && sku.description.trim()) {
      displayName = `${sku.sku_code} - ${sku.description}`
    } else if (sku.name) {
      displayName = `${sku.sku_code} - ${sku.name}`
    }
    
    const result = `${displayName} (${quantity})`
    console.log('✅ [Tags] Item display result:', result)
    return result
  }).join(', ')
}

const getTotalQuantity = (items: any[]) => {
  if (!items) return 0
  return items.reduce((sum, item) => {
    // INSTANCE-BASED ARCHITECTURE: Use selected_instance_ids.length as single source of truth
    const quantity = item.selected_instance_ids ? item.selected_instance_ids.length : 0
    return sum + quantity
  }, 0)
}

onMounted(async () => {
  await Promise.all([loadTags(), loadStats()])
})

const tableColumns = [
  {
    name: 'items',
    label: 'Items',
    field: 'sku_items',  // Changed from 'items' to 'sku_items'
    format: (skuItems: any[]) => getItemsDisplay(skuItems),
    align: 'left',
    sortable: false
  },
  {
    name: 'customer',
    label: 'Customer',
    field: 'customer_name',
    align: 'left',
    sortable: true
  },
  {
    name: 'type',
    label: 'Type',
    field: 'tag_type',
    align: 'center',
    sortable: true
  },
  {
    name: 'quantity',
    label: 'Total Quantity',
    field: 'sku_items',  // Changed from 'items' to 'sku_items'
    format: (skuItems: any[]) => getTotalQuantity(skuItems),
    align: 'center',
    sortable: false
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center',
    sortable: true
  },
  {
    name: 'created',
    label: 'Created',
    field: 'createdAt',
    format: (date: string) => formatDate(date),
    align: 'center',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center'
  }
]
</script>

<template>
  <q-page class="tags-page">
    <div class="container q-pa-md">
      <!-- Page Header -->
      <div class="page-header glass-card q-pa-md q-mb-md" data-aos="fade-up">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <h1 class="text-h4 text-dark q-mb-xs">
              <q-icon name="local_offer" class="q-mr-sm" />
              Tag Management
            </h1>
            <p class="text-body2 text-dark opacity-80">
              Track and manage inventory tags for customers, projects, and reservations
            </p>
          </div>
          <div class="col-auto" v-if="stats">
            <div class="row q-gutter-md">
              <q-chip color="primary" text-color="white" icon="local_offer">
                {{ stats.active }} Active Tags
              </q-chip>
              <q-chip color="positive" text-color="white" icon="people">
                {{ stats.uniqueCustomers }} Customers
              </q-chip>
            </div>
          </div>
        </div>
      </div>

      <!-- Tag Type Stats -->
      <div v-if="stats?.byType" class="stats-section q-mb-lg" data-aos="fade-up" data-aos-delay="100">
        <div class="row q-gutter-md">
          <div v-for="(count, tagType) in stats.byType" :key="tagType" class="col">
            <q-card class="glass-card stat-card text-center" v-if="count > 0">
              <q-card-section class="q-pa-md">
                <q-icon name="label" class="text-h4 q-mb-xs" :style="{ color: getTagTypeColor(tagType) }" />
                <div class="text-h6 text-dark text-weight-bold">{{ count }}</div>
                <div class="text-body2 text-dark opacity-80 text-capitalize">{{ tagType }} Tags</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section glass-card q-pa-md q-mb-md" data-aos="fade-up" data-aos-delay="200">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="row q-gutter-md items-center">
              <!-- Customer Search -->
              <div class="col-auto">
                <q-input
                  v-model="customerFilter"
                  @update:model-value="loadTags"
                  filled
                  placeholder="Search by customer..."
                  class="search-input"
                  style="min-width: 250px"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" class="text-dark" />
                  </template>
                </q-input>
              </div>
              
              <!-- Status Filter -->
              <div class="col-auto">
                <q-select
                  v-model="statusFilter"
                  @update:model-value="loadTags"
                  filled
                  :options="[
                    { label: 'All Status', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Fulfilled', value: 'fulfilled' },
                    { label: 'Cancelled', value: 'cancelled' }
                  ]"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  class="filter-select"
                  style="min-width: 140px"
                />
              </div>

              <!-- Tag Type Filter -->
              <div class="col-auto">
                <q-select
                  v-model="tagTypeFilter"
                  @update:model-value="loadTags"
                  filled
                  :options="[
                    { label: 'All Types', value: 'all' },
                    ...TAG_TYPES.map(t => ({ label: t.label, value: t.value }))
                  ]"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  class="filter-select"
                  style="min-width: 140px"
                />
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="col-auto" v-if="authStore.canWrite">
            <div class="row q-gutter-sm">
              <!-- Fulfill Tags -->
              <q-btn
                @click="handleFulfillTags"
                color="positive"
                icon="done_all"
                label="Fulfill Tags"
                class="add-btn"
                no-caps
              >
                <q-tooltip>Select and fulfill active tags</q-tooltip>
              </q-btn>
              
              <!-- Create Tag -->
              <q-btn
                @click="showCreateModal = true"
                color="primary"
                icon="add"
                label="Create Tag"
                class="add-btn"
                no-caps
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <q-banner
        v-if="error"
        class="bg-negative text-white q-mb-lg"
        dense
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ error }}
        <template v-slot:action>
          <q-btn
            flat
            color="white"
            label="Dismiss"
            @click="clearError"
          />
        </template>
      </q-banner>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container glass-card q-pa-xl text-center">
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-h6 text-dark q-mt-md">Loading tags...</div>
      </div>

      <!-- Tags List -->
      <div v-else class="tags-list-container glass-card" data-aos="fade-up" data-aos-delay="300">
        <div v-if="filteredTags.length === 0" class="text-center q-pa-xl">
          <q-icon name="local_offer" size="48px" class="text-grey-6 q-mb-md" />
          <div class="text-h6 text-grey-8">No tags found</div>
          <div class="text-body2 text-grey-6">
            Create tags to track inventory for customers and projects
          </div>
        </div>

        <div v-else>
          <!-- Column Headers -->
          <div class="tags-header row items-center q-pa-md">
            <div class="col-3 text-weight-bold text-body1 text-dark">
              <q-icon name="person" class="q-mr-xs" size="sm" />
              Customer
            </div>
            <div class="col-2 text-weight-bold text-body1 text-dark text-center">
              <q-icon name="label" class="q-mr-xs" size="sm" />
              Type
            </div>
            <div class="col-2 text-weight-bold text-body1 text-dark text-center">
              <q-icon name="inventory_2" class="q-mr-xs" size="sm" />
              Items
            </div>
            <div class="col-2 text-weight-bold text-body1 text-dark text-center">
              <q-icon name="info" class="q-mr-xs" size="sm" />
              Status
            </div>
            <div class="col-2 text-weight-bold text-body1 text-dark text-center">
              <q-icon name="schedule" class="q-mr-xs" size="sm" />
              Created
            </div>
            <div class="col-1 text-weight-bold text-body1 text-dark text-center">
              <q-icon name="settings" class="q-mr-xs" size="sm" />
              Actions
            </div>
          </div>

          <q-separator />

          <q-list separator>
            <q-expansion-item
              v-for="tag in filteredTags"
              :key="tag._id"
              class="tag-expansion-item"
              header-class="tag-header"
              expand-separator
              :default-opened="false"
            >
              <template v-slot:header>
                <div class="full-width row items-center no-wrap">
                  <!-- Customer Name -->
                  <div class="col-3 text-weight-bold text-subtitle1 text-dark ellipsis">
                    {{ tag.customer_name }}
                  </div>
                  
                  <!-- Tag Type -->
                  <div class="col-2 text-center">
                    <q-chip 
                      :style="{ backgroundColor: getTagTypeColor(tag.tag_type), color: 'white' }"
                      size="sm"
                      class="text-weight-medium text-capitalize"
                    >
                      {{ tag.tag_type }}
                    </q-chip>
                  </div>
                  
                  <!-- Total Quantity -->
                  <div class="col-2 text-center">
                    <q-chip color="info" text-color="white" size="sm">
                      {{ getTotalQuantity(tag.sku_items) }}
                    </q-chip>
                  </div>
                  
                  <!-- Status -->
                  <div class="col-2 text-center">
                    <q-chip 
                      :color="getStatusColor(tag.status)"
                      text-color="white"
                      size="sm"
                      class="text-weight-medium text-capitalize"
                    >
                      {{ tag.status }}
                    </q-chip>
                  </div>
                  
                  <!-- Created Date -->
                  <div class="col-2 text-center text-body2 text-grey-8">
                    {{ formatDate(tag.createdAt) }}
                  </div>
                  
                  <!-- Actions -->
                  <div class="col-1 text-center">
                    <div class="row no-wrap items-center justify-center q-gutter-xs">
                      <q-btn
                        v-if="authStore.canWrite"
                        @click.stop="handleEditTag(tag)"
                        color="primary"
                        icon="edit"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Edit Tag</q-tooltip>
                      </q-btn>
                      <q-btn
                        v-if="authStore.canWrite"
                        @click.stop="handleDeleteTag(tag)"
                        color="negative"
                        icon="delete"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Delete Tag</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </div>
              </template>
            
            <!-- Expanded Content - Items List -->
            <div class="tag-items-container q-pa-md">
              <div class="text-h6 text-dark q-mb-md">
                <q-icon name="inventory_2" class="q-mr-sm" />
                Tagged Items
              </div>
              
              <div v-if="tag.sku_items && tag.sku_items.length > 0" class="items-scroll-area">
                <q-list dense separator>
                  <q-item
                    v-for="(skuItem, index) in tag.sku_items"
                    :key="index"
                    class="item-detail"
                  >
                    <q-item-section avatar>
                      <q-icon name="inventory" color="primary" />
                    </q-item-section>
                    
                    <q-item-section>
                      <q-item-label class="text-weight-bold">
                        <span class="sku-code">
                          <template v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.sku_code">
                            {{ skuItem.sku_id.sku_code || 'Unknown SKU' }}
                          </template>
                          <template v-else>
                            SKU {{ skuItem.sku_id }}
                          </template>
                        </span>
                        <span 
                          v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.name" 
                          class="q-ml-sm text-grey-8 sku-name"
                        >
                          | {{ skuItem.sku_id.name }}
                        </span>
                      </q-item-label>
                      <q-item-label 
                        v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.description" 
                        caption 
                        class="text-grey-6 item-description"
                      >
                        {{ skuItem.sku_id.description }}
                      </q-item-label>
                    </q-item-section>
                    
                    <q-item-section side>
                      <q-badge 
                        color="primary" 
                        :label="skuItem.selected_instance_ids ? skuItem.selected_instance_ids.length : (skuItem.remaining_quantity || skuItem.quantity)"
                        class="quantity-badge"
                      />
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              
              <div v-else class="no-items-message text-center q-pa-md">
                <q-icon name="inventory_2" size="32px" class="text-grey-5 q-mb-sm" />
                <div class="text-body2 text-grey-6">No items in this tag</div>
              </div>
            </div>
            </q-expansion-item>
          </q-list>
        </div>
      </div>
    </div>

    <!-- Tag Management Modals -->
    <CreateTagModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @success="handleCreateSuccess"
    />

    <EditTagModal
      v-if="showEditModal && tagToEdit"
      :tag="tagToEdit"
      @close="showEditModal = false"
      @success="handleEditSuccess"
    />

    <!-- Fulfill Tags Dialog -->
    <FulfillTagsDialog
      :show="showFulfillDialog"
      @close="showFulfillDialog = false"
      @success="handleFulfillSuccess"
    />
  </q-page>
</template>

<style scoped>
.tags-page {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Glassmorphism Cards */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.2));
}

/* Stats Cards */
.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
  transform: scale(1.02);
}

/* Controls Section */
.search-input, .filter-select {
  border-radius: 15px;
}

.search-input :deep(.q-field__control),
.filter-select :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
}

.search-input :deep(.q-field__native),
.filter-select :deep(.q-field__native) {
  color: #333;
}

.search-input :deep(.q-field__native)::placeholder {
  color: rgba(0, 0, 0, 0.6);
}

.add-btn {
  border-radius: 15px;
  padding: 8px 24px;
  font-weight: 600;
  text-transform: none;
}

/* Loading Container */
.loading-container {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Tags List Container */
.tags-list-container {
  border-radius: 20px;
  overflow: hidden;
  padding: 0;
}

/* Column Headers */
.tags-header {
  background: rgba(255, 255, 255, 0.15);
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  margin: 0;
  padding: 16px 20px !important;
}

.tags-header .col-1,
.tags-header .col-2,
.tags-header .col-3 {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.tags-header .text-center {
  justify-content: center;
}

/* Expansion Items */
.tag-expansion-item {
  background: transparent;
}

.tag-expansion-item :deep(.q-item) {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.tag-expansion-item :deep(.q-item:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.tag-header {
  padding: 16px 20px !important;
  min-height: 64px;
}

.tag-header .col-1,
.tag-header .col-2,
.tag-header .col-3 {
  display: flex;
  align-items: center;
}

.tag-header .text-center {
  justify-content: center;
}

/* Tag Items Container */
.tag-items-container {
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.items-scroll-area {
  max-height: 300px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 8px;
}

.items-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.items-scroll-area::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.items-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.items-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Item Details */
.item-detail {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.item-detail:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.item-detail :deep(.q-item__section) {
  color: rgba(33, 37, 41, 0.9);
}

.quantity-badge {
  font-size: 11px;
  font-weight: 600;
}

/* SKU Item Layout */
.sku-code {
  color: rgba(33, 37, 41, 0.95);
  font-weight: 700;
}

.sku-name {
  font-weight: 500;
  font-size: 0.9em;
}

.item-description {
  margin-top: 2px;
  font-size: 0.85em;
  line-height: 1.3;
  max-width: 400px;
  word-wrap: break-word;
}

.no-items-message {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
}

.opacity-80 {
  opacity: 0.8;
}

/* Responsive Design for Lists */
@media (max-width: 1024px) {
  .tags-header,
  .tag-header {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px;
  }
  
  .tags-header > div,
  .tag-header > div {
    width: 100% !important;
    flex: none !important;
    justify-content: flex-start !important;
  }
  
  .tags-header .text-center,
  .tag-header .text-center {
    justify-content: flex-start !important;
  }
}

@media (max-width: 768px) {
  .tags-header {
    display: none;
  }
  
  .items-scroll-area {
    max-height: 200px;
  }
  
  .tag-header {
    padding: 12px 16px !important;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }
  
  .glass-card {
    border-radius: 15px;
    margin-bottom: 1rem;
  }
  
  .search-input {
    min-width: 200px !important;
  }
}
</style>
