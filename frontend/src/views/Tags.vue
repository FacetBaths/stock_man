<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTagStore } from '@/stores/tag'
import { useCategoryStore } from '@/stores/category'
import { tagApi } from '@/utils/api'
import type { Tag, Item } from '@/types'
import { TAG_TYPES } from '@/types'
import CreateTagModalNew from '@/components/CreateTagModalNew.vue'
import EditTagModal from '@/components/EditTagModal.vue'
import SendForInstallDialog from '@/components/SendForInstallDialog.vue'
import ProductUsedDialog from '@/components/ProductUsedDialog.vue'
import { useQuasar } from 'quasar'

const authStore = useAuthStore()
const tagStore = useTagStore()
const categoryStore = useCategoryStore()
const $q = useQuasar()

// Local state for modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const tagToEdit = ref<Tag | null>(null)
const showSendForInstallDialog = ref(false)
const showProductUsedDialog = ref(false)
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
    // Fetch the tag with populated items to ensure we have all the details
    const fullTag = await tagStore.fetchTag(tag._id, true)
    tagToEdit.value = fullTag
    showEditModal.value = true
  } catch (err: any) {
    $q.notify({
      type: 'negative', 
      message: `Failed to load tag details: ${err.message}`,
      timeout: 3000
    })
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

// Send for Install workflow
const handleSendForInstall = () => {
  showSendForInstallDialog.value = true
}

// Product Used workflow  
const handleProductUsed = () => {
  showProductUsedDialog.value = true
}

// Handle dialog success events
const handleDialogSuccess = async (results: any) => {
  $q.notify({
    type: 'positive',
    message: results.message || 'Operation completed successfully',
    timeout: 5000
  })
  
  await loadTags()
  await loadStats()
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const getItemsDisplay = (items: any[]) => {
  if (!items || items.length === 0) return 'No items'
  
  return items.map(tagItem => {
    // Handle populated vs unpopulated item references
    const item = typeof tagItem.item_id === 'object' ? tagItem.item_id : null
    if (!item) return `Item ${tagItem.item_id} (${tagItem.remaining_quantity || tagItem.quantity})`
    
    const sku = typeof item.sku_id === 'object' ? item.sku_id : null
    if (!sku) return `Unknown SKU (${tagItem.remaining_quantity || tagItem.quantity})`
    
    const quantity = tagItem.remaining_quantity || tagItem.quantity
    let displayName = sku.sku_code || 'Unknown SKU'
    
    // Add product details if available
    if (sku.details) {
      const details = sku.details
      if (details.product_line && details.color_name) {
        displayName += ` (${details.product_line} - ${details.color_name})`
      } else if (sku.name) {
        displayName += ` (${sku.name})`
      } else if (details.brand) {
        displayName += ` (${details.brand})`
      }
    }
    
    return `${displayName} (${quantity})`
  }).join(', ')
}

const getTotalQuantity = (items: any[]) => {
  if (!items) return 0
  return items.reduce((sum, item) => sum + (item.remaining_quantity || item.quantity), 0)
}

onMounted(async () => {
  await Promise.all([loadTags(), loadStats()])
})

const tableColumns = [
  {
    name: 'items',
    label: 'Items',
    field: 'items',
    format: (items: any[]) => getItemsDisplay(items),
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
    field: 'items',
    format: (items: any[]) => getTotalQuantity(items),
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
              <!-- Send for Install -->
              <q-btn
                @click="handleSendForInstall"
                color="orange"
                icon="local_shipping"
                label="Send for Install"
                class="add-btn"
                no-caps
              >
                <q-tooltip>Batch scan and send tagged materials for installation</q-tooltip>
              </q-btn>
              
              <!-- Product Used -->
              <q-btn
                @click="handleProductUsed"
                color="deep-orange"
                icon="done_all"
                label="Product Used"
                class="add-btn"
                no-caps
              >
                <q-tooltip>Mark tagged products as used/consumed</q-tooltip>
              </q-btn>
              
              <!-- Create Tag -->
              <q-btn
                @click="showCreateModal = true"
                color="positive"
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

      <!-- Tags Table -->
      <div v-else class="table-container glass-card" data-aos="fade-up" data-aos-delay="300">
        <q-table
          :rows="filteredTags"
          :columns="tableColumns"
          row-key="_id"
          flat
          :rows-per-page-options="[25, 50, 100]"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template v-slot:body-cell-items="props">
            <q-td :props="props" style="max-width: 400px">
              <div class="items-display">
                <div v-if="props.row.items && props.row.items.length > 0" class="q-gutter-xs">
                  <div v-for="(tagItem, index) in props.row.items" :key="index" class="item-chip">
                    <q-chip 
                      size="sm" 
                      color="blue-grey-2" 
                      text-color="dark"
                      dense
                      class="q-mb-xs"
                    >
                      <span class="text-weight-medium">
                        <template v-if="typeof tagItem.item_id === 'object' && tagItem.item_id?.sku_id">
                          {{ tagItem.item_id.sku_id.sku_code || 'Unknown SKU' }}
                        </template>
                        <template v-else>
                          Item {{ tagItem.item_id }}
                        </template>
                      </span>
                      <span v-if="typeof tagItem.item_id === 'object' && tagItem.item_id?.sku_id?.details" class="q-ml-xs text-caption">
                        (<template v-if="tagItem.item_id.sku_id.details.product_line && tagItem.item_id.sku_id.details.color_name">
                          {{ tagItem.item_id.sku_id.details.product_line }} - {{ tagItem.item_id.sku_id.details.color_name }}
                        </template>
                        <template v-else-if="tagItem.item_id.sku_id.name">
                          {{ tagItem.item_id.sku_id.name }}
                        </template>
                        <template v-else-if="tagItem.item_id.sku_id.details.brand">
                          {{ tagItem.item_id.sku_id.details.brand }}
                        </template>)
                      </span>
                      <q-badge color="primary" floating transparent>
                        {{ tagItem.remaining_quantity || tagItem.quantity }}
                      </q-badge>
                    </q-chip>
                  </div>
                </div>
                <div v-else class="text-grey-6 text-caption">
                  No items
                </div>
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-type="props">
            <q-td :props="props">
              <q-chip 
                :style="{ backgroundColor: getTagTypeColor(props.value), color: 'white' }"
                size="sm"
                class="text-weight-medium text-capitalize"
              >
                {{ props.value }}
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip 
                :color="getStatusColor(props.value)"
                text-color="white"
                size="sm"
                class="text-weight-medium text-capitalize"
              >
                {{ props.value }}
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <div class="row q-gutter-xs justify-center">
                <q-btn
                  v-if="authStore.canWrite"
                  @click="handleEditTag(props.row)"
                  color="primary"
                  icon="edit"
                  size="sm"
                  round
                  flat
                >
                  <q-tooltip>Edit Tag</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="authStore.canWrite"
                  @click="handleDeleteTag(props.row)"
                  color="negative"
                  icon="delete"
                  size="sm"
                  round
                  flat
                >
                  <q-tooltip>Delete Tag</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template v-slot:no-data>
            <div class="text-center q-pa-lg">
              <q-icon name="local_offer" size="48px" class="text-grey-6 q-mb-md" />
              <div class="text-h6 text-grey-8">No tags found</div>
              <div class="text-body2 text-grey-6">
                Create tags to track inventory for customers and projects
              </div>
            </div>
          </template>
        </q-table>
      </div>
    </div>

    <!-- Tag Management Modals -->
    <CreateTagModalNew
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

    <!-- Fulfillment Dialog Components -->
    <SendForInstallDialog
      :show="showSendForInstallDialog"
      @close="showSendForInstallDialog = false"
      @success="handleDialogSuccess"
    />

    <ProductUsedDialog
      :show="showProductUsedDialog"
      :preselected-customer="customerFilter.trim() || undefined"
      @close="showProductUsedDialog = false"
      @success="handleDialogSuccess"
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

/* Table Container */
.table-container {
  border-radius: 20px;
  overflow: hidden;
  padding: 0;
}

.table-container :deep(.q-table) {
  background: transparent;
  border-radius: 20px;
}

.table-container :deep(.q-table thead th) {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(33, 37, 41, 0.9);
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.table-container :deep(.q-table tbody td) {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(33, 37, 41, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.table-container :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.opacity-80 {
  opacity: 0.8;
}

/* SKU Items Display */
.sku-items-display {
  max-width: 400px;
}

.sku-item-chip {
  display: inline-block;
  margin-right: 4px;
  margin-bottom: 4px;
}

.sku-item-chip .q-chip {
  position: relative;
  padding-right: 24px;
}

.sku-item-chip .q-badge {
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  top: -6px;
  right: -6px;
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
