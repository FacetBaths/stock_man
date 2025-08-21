<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { tagApi } from '@/utils/api'
import type { Tag, Item } from '@/types'
import { TAG_TYPES } from '@/types'
import CreateTagModalNew from '@/components/CreateTagModalNew.vue'
import EditTagModal from '@/components/EditTagModal.vue'
import { useQuasar } from 'quasar'

const authStore = useAuthStore()
const $q = useQuasar()

const tags = ref<Tag[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const tagToEdit = ref<Tag | null>(null)
const showSendForInstallDialog = ref(false)
const showProductUsedDialog = ref(false)
const selectedTags = ref<Tag[]>([])
const customers = ref<Array<{
  name: string
  tag_count: number
  total_quantity: number
  tag_types: string[]
}>>([])

// Stats
const stats = ref<{
  totalActiveTags: number
  uniqueCustomers: number
  byTagType: Array<{ _id: string; count: number; totalQuantity: number }>
} | null>(null)

// Filters
const statusFilter = ref('active')
const tagTypeFilter = ref('all')
const customerFilter = ref('')

const filteredTags = computed(() => {
  let filtered = tags.value

  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(tag => tag.status === statusFilter.value)
  }

  if (tagTypeFilter.value !== 'all') {
    filtered = filtered.filter(tag => tag.tag_type === tagTypeFilter.value)
  }

  if (customerFilter.value.trim()) {
    const search = customerFilter.value.toLowerCase().trim()
    filtered = filtered.filter(tag => 
      tag.customer_name.toLowerCase().includes(search)
    )
  }

  return filtered
})

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

const loadTags = async () => {
  try {
    isLoading.value = true
    error.value = null
    const response = await tagApi.getTags({
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      tag_type: tagTypeFilter.value === 'all' ? undefined : tagTypeFilter.value,
      customer_name: customerFilter.value.trim() || undefined
    })
    tags.value = response.tags
  } catch (err: any) {
    error.value = err.message || 'Failed to load tags'
    console.error('Load tags error:', err)
  } finally {
    isLoading.value = false
  }
}

const loadStats = async () => {
  try {
    const response = await tagApi.getStats()
    stats.value = response
  } catch (err: any) {
    console.error('Load stats error:', err)
  }
}

const handleEditTag = (tag: Tag) => {
  tagToEdit.value = tag
  showEditModal.value = true
}

const handleCreateSuccess = async () => {
  showCreateModal.value = false
  await loadTags()
  await loadStats()
}

const handleEditSuccess = async () => {
  showEditModal.value = false
  tagToEdit.value = null
  await loadTags()
  await loadStats()
}

const handleDeleteTag = async (tag: Tag) => {
  if (confirm(`Are you sure you want to delete tag for ${tag.customer_name}?`)) {
    try {
      await tagApi.deleteTag(tag._id)
      await loadTags()
      await loadStats()
    } catch (err: any) {
      error.value = err.message || 'Failed to delete tag'
    }
  }
}

const clearError = () => {
  error.value = null
}

// Load customers for Send for Install
const loadCustomers = async () => {
  try {
    const response = await tagApi.getCustomers()
    customers.value = response.customers
  } catch (err: any) {
    console.error('Load customers error:', err)
  }
}

// Send for Install workflow
const handleSendForInstall = async () => {
  await loadCustomers()
  
  if (customers.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No customers with active tags found'
    })
    return
  }
  
  // Show customer selection dialog
  $q.dialog({
    title: 'Send for Install',
    message: 'Select customer to send materials for installation:',
    options: {
      type: 'radio',
      model: '',
      items: customers.value.map(c => ({
        label: `${c.name} (${c.tag_count} tags, ${c.total_quantity} items)`,
        value: c.name,
        color: 'primary'
      }))
    },
    cancel: true,
    persistent: false
  }).onOk(async (customerName: string) => {
    if (!customerName) return
    
    // Ask for confirmation and optional notes
    $q.dialog({
      title: 'Confirm Send for Install',
      message: `Send all tagged items for ${customerName} for installation?\n\nThis will:\n• Mark all active tags as fulfilled\n• Reduce inventory quantities\n• Cannot be undone`,
      prompt: {
        model: '',
        isValid: () => true,
        type: 'text',
        label: 'Notes (optional)'
      },
      cancel: true,
      persistent: false
    }).onOk(async (notes: string) => {
      try {
        const response = await tagApi.sendForInstall({
          customer_name: customerName,
          notes: notes || undefined
        })
        
        $q.notify({
          type: 'positive',
          message: response.message,
          timeout: 5000
        })
        
        // Show detailed results
        if (response.results.fulfilled.length > 0 || response.results.failed.length > 0) {
          const resultMessage = [
            `✅ ${response.results.fulfilled.length} tags fulfilled`,
            response.results.failed.length > 0 ? `❌ ${response.results.failed.length} failed` : '',
            `📦 ${response.results.inventory_reduced.length} inventory items reduced`
          ].filter(Boolean).join('\n')
          
          $q.dialog({
            title: 'Send for Install Results',
            message: resultMessage,
            html: true
          })
        }
        
        await loadTags()
        await loadStats()
      } catch (err: any) {
        $q.notify({
          type: 'negative',
          message: err.response?.data?.message || err.message || 'Failed to send for install'
        })
      }
    })
  })
}

// Product Used workflow
const handleProductUsed = () => {
  const activeTags = filteredTags.value.filter(tag => tag.status === 'active')
  
  if (activeTags.length === 0) {
    $q.notify({
      type: 'warning', 
      message: 'No active tags available to mark as used'
    })
    return
  }
  
  // Show tag selection dialog
  const tagOptions = activeTags.map(tag => ({
    label: `${tag.customer_name} - ${getItemName(tag.item_id)} (${tag.quantity} items)`,
    value: tag._id
  }))
  
  $q.dialog({
    title: 'Product Used',
    message: 'Select tags to mark as used:',
    options: {
      type: 'checkbox',
      model: [],
      items: tagOptions
    },
    cancel: true,
    persistent: false
  }).onOk(async (tagIds: string[]) => {
    if (!tagIds || tagIds.length === 0) return
    
    // Ask for confirmation and optional notes
    $q.dialog({
      title: 'Confirm Product Used',
      message: `Mark ${tagIds.length} tag(s) as used?\n\nThis will:\n• Mark selected tags as fulfilled\n• Reduce inventory quantities\n• Cannot be undone`,
      prompt: {
        model: '',
        isValid: () => true,
        type: 'text',
        label: 'Notes (optional)'
      },
      cancel: true,
      persistent: false
    }).onOk(async (notes: string) => {
      try {
        const response = await tagApi.markUsed({
          tag_ids: tagIds,
          notes: notes || undefined
        })
        
        $q.notify({
          type: 'positive',
          message: response.message,
          timeout: 5000
        })
        
        // Show detailed results
        if (response.results.fulfilled.length > 0 || response.results.failed.length > 0) {
          const resultMessage = [
            `✅ ${response.results.fulfilled.length} tags marked as used`,
            response.results.failed.length > 0 ? `❌ ${response.results.failed.length} failed` : '',
            `📦 ${response.results.inventory_reduced.length} inventory items reduced`
          ].filter(Boolean).join('\n')
          
          $q.dialog({
            title: 'Product Used Results',
            message: resultMessage,
            html: true
          })
        }
        
        await loadTags()
        await loadStats()
      } catch (err: any) {
        $q.notify({
          type: 'negative',
          message: err.response?.data?.message || err.message || 'Failed to mark products as used'
        })
      }
    })
  })
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const getItemName = (item: Item | string) => {
  if (typeof item === 'string') return 'Unknown Item'
  
  const details = item.product_details as any
  if (item.product_type === 'wall') {
    return `${details.product_line} - ${details.color_name}`
  }
  return details.name || details.brand || 'Unknown'
}

onMounted(async () => {
  await Promise.all([loadTags(), loadStats()])
})

const tableColumns = [
  {
    name: 'item',
    label: 'Item',
    field: 'item_id',
    format: (item: Item | string) => getItemName(item),
    align: 'left',
    sortable: true
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
    label: 'Quantity',
    field: 'quantity',
    align: 'center',
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
                {{ stats.totalActiveTags }} Active Tags
              </q-chip>
              <q-chip color="positive" text-color="white" icon="people">
                {{ stats.uniqueCustomers }} Customers
              </q-chip>
            </div>
          </div>
        </div>
      </div>

      <!-- Tag Type Stats -->
      <div v-if="stats?.byTagType?.length" class="stats-section q-mb-lg" data-aos="fade-up" data-aos-delay="100">
        <div class="row q-gutter-md">
          <div v-for="stat in stats.byTagType" :key="stat._id" class="col">
            <q-card class="glass-card stat-card text-center">
              <q-card-section class="q-pa-md">
                <q-icon name="label" class="text-h4 q-mb-xs" :style="{ color: getTagTypeColor(stat._id) }" />
                <div class="text-h6 text-dark text-weight-bold">{{ stat.count }}</div>
                <div class="text-body2 text-dark opacity-80 text-capitalize">{{ stat._id }} Tags</div>
                <div class="text-caption text-dark opacity-60">{{ stat.totalQuantity }} items</div>
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
