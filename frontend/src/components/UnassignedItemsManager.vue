<template>
  <div class="unassigned-items-manager">
    <!-- Header with Stats -->
    <div class="stats-header q-pa-md glass-header">
      <div class="row q-gutter-md items-center">
        <div class="col-auto">
          <q-icon name="assignment" size="md" color="warning" />
        </div>
        <div class="col">
          <div class="text-h6">Unassigned Items</div>
          <div class="text-body2 text-grey-7">
            {{ stats.summary?.total_unassigned || 0 }} items need SKU assignments
            <span v-if="stats.summary?.assignment_percentage">
              ({{ stats.summary.assignment_percentage }}% of items are assigned)
            </span>
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            @click="refreshData"
            :loading="loading"
            color="primary"
            outline
            icon="refresh"
            label="Refresh"
          />
        </div>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div v-if="stats.location_distribution" class="q-pa-md">
      <div class="row q-gutter-md">
        <div
          v-for="location in stats.location_distribution.slice(0, 4)"
          :key="location._id"
          class="col"
        >
          <q-card class="stats-card glass-card">
            <q-card-section class="text-center">
              <div class="text-h4 text-primary">{{ location.count }}</div>
              <div class="text-body2 text-grey-7">{{ location._id || 'Unknown' }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Filters and Controls -->
    <div class="controls-section q-pa-md">
      <div class="row q-gutter-md items-center">
        <div class="col-md-3">
          <q-select
            v-model="filters.location"
            :options="locationOptions"
            label="Filter by Location"
            outlined
            dense
            emit-value
            map-options
            clearable
            @update:model-value="loadItems"
          />
        </div>
        <div class="col-md-3">
          <q-select
            v-model="filters.sort_by"
            :options="sortOptions"
            label="Sort by"
            outlined
            dense
            emit-value
            map-options
            @update:model-value="loadItems"
          />
        </div>
        <div class="col-md-2">
          <q-select
            v-model="filters.sort_order"
            :options="[
              { label: 'Newest First', value: 'desc' },
              { label: 'Oldest First', value: 'asc' }
            ]"
            outlined
            dense
            emit-value
            map-options
            @update:model-value="loadItems"
          />
        </div>
        <div class="col">
          <q-btn
            v-if="selectedItems.length > 0"
            @click="showBulkAssignDialog = true"
            color="positive"
            :label="`Assign ${selectedItems.length} Items`"
            icon="assignment_turned_in"
          />
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="q-pa-md">
      <q-table
        :rows="items"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        @request="onRequest"
        selection="multiple"
        v-model:selected="selectedItems"
        row-key="_id"
        class="glass-table"
      >
        <template v-slot:body-cell-serial_number="props">
          <q-td :props="props">
            <div class="text-weight-bold">{{ props.value }}</div>
          </q-td>
        </template>

        <template v-slot:body-cell-location="props">
          <q-td :props="props">
            <q-chip
              :label="props.value || 'Unknown'"
              color="grey-5"
              text-color="dark"
              size="sm"
              icon="place"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-purchase_cost="props">
          <q-td :props="props">
            <div class="text-weight-medium">
              {{ formatCurrency(props.value) }}
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-createdAt="props">
          <q-td :props="props">
            <div class="text-caption">
              {{ formatDate(props.value) }}
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              @click="assignSingleItem(props.row)"
              size="sm"
              color="primary"
              outline
              icon="assignment"
              label="Assign SKU"
            />
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- Single Item Assignment Dialog -->
    <q-dialog v-model="showAssignDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Assign SKU to Item</div>
          <div v-if="selectedForAssignment" class="text-body2 text-grey-7">
            Item: {{ selectedForAssignment.serial_number }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="assignmentForm.sku_id"
            :options="skuOptions"
            label="Select SKU"
            outlined
            use-input
            input-debounce="300"
            @filter="filterSKUs"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            :loading="loadingSKUs"
          >
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey">
                  No SKUs found
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input
            v-model="assignmentForm.notes"
            label="Assignment Notes (optional)"
            outlined
            class="q-mt-md"
            type="textarea"
            rows="2"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn
            @click="submitAssignment"
            label="Assign SKU"
            color="primary"
            :loading="submitting"
            :disable="!assignmentForm.sku_id"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Bulk Assignment Dialog -->
    <q-dialog v-model="showBulkAssignDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Bulk Assign SKUs</div>
          <div class="text-body2 text-grey-7">
            Assigning SKUs to {{ selectedItems.length }} items
          </div>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="bulkAssignmentForm.sku_id"
            :options="skuOptions"
            label="Select SKU for all items"
            outlined
            use-input
            input-debounce="300"
            @filter="filterSKUs"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            :loading="loadingSKUs"
          />

          <q-input
            v-model="bulkAssignmentForm.notes"
            label="Assignment Notes (optional)"
            outlined
            class="q-mt-md"
            type="textarea"
            rows="2"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn
            @click="submitBulkAssignment"
            label="Assign to All"
            color="primary"
            :loading="submitting"
            :disable="!bulkAssignmentForm.sku_id"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { api } from '@/services/api'

const $q = useQuasar()

// Reactive data
const items = ref([])
const stats = ref({})
const selectedItems = ref([])
const loading = ref(false)
const loadingSKUs = ref(false)
const submitting = ref(false)

// Dialog states
const showAssignDialog = ref(false)
const showBulkAssignDialog = ref(false)
const selectedForAssignment = ref(null)

// Forms
const assignmentForm = ref({
  sku_id: null,
  notes: ''
})

const bulkAssignmentForm = ref({
  sku_id: null,
  notes: ''
})

// Filters and pagination
const filters = ref({
  location: null,
  sort_by: 'createdAt',
  sort_order: 'desc'
})

const pagination = ref({
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0
})

// SKU options for dropdowns
const skuOptions = ref([])
const allSKUs = ref([])

// Table columns
const columns = [
  {
    name: 'serial_number',
    label: 'Serial Number',
    field: 'serial_number',
    align: 'left',
    sortable: true
  },
  {
    name: 'location',
    label: 'Location',
    field: 'location',
    align: 'center',
    sortable: true
  },
  {
    name: 'purchase_cost',
    label: 'Cost',
    field: 'purchase_cost',
    align: 'right',
    sortable: true
  },
  {
    name: 'createdAt',
    label: 'Date Added',
    field: 'createdAt',
    align: 'center',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    field: '',
    align: 'center'
  }
]

// Computed options
const locationOptions = computed(() => {
  const locations = stats.value.location_distribution || []
  return [
    { label: 'All Locations', value: null },
    ...locations.map(loc => ({ 
      label: `${loc._id || 'Unknown'} (${loc.count})`, 
      value: loc._id 
    }))
  ]
})

const sortOptions = [
  { label: 'Date Added', value: 'createdAt' },
  { label: 'Serial Number', value: 'serial_number' },
  { label: 'Location', value: 'location' },
  { label: 'Cost', value: 'purchase_cost' }
]

// Methods
const refreshData = async () => {
  await Promise.all([loadStats(), loadItems()])
}

const loadStats = async () => {
  try {
    const response = await api.get('/unassigned-items/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Failed to load stats:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load statistics'
    })
  }
}

const loadItems = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      ...filters.value
    }
    
    const response = await api.get('/unassigned-items', { params })
    items.value = response.data.items
    pagination.value.rowsNumber = response.data.pagination.total_items
  } catch (error) {
    console.error('Failed to load items:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load items'
    })
  } finally {
    loading.value = false
  }
}

const onRequest = (props) => {
  pagination.value = props.pagination
  loadItems()
}

const loadSKUs = async () => {
  if (allSKUs.value.length > 0) return
  
  loadingSKUs.value = true
  try {
    const response = await api.get('/skus')
    allSKUs.value = response.data.skus || []
    skuOptions.value = allSKUs.value.map(sku => ({
      label: `${sku.sku_code} - ${sku.name || sku.description}`,
      value: sku._id
    }))
  } catch (error) {
    console.error('Failed to load SKUs:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load SKUs'
    })
  } finally {
    loadingSKUs.value = false
  }
}

const filterSKUs = (val, update) => {
  update(() => {
    if (val === '') {
      skuOptions.value = allSKUs.value.map(sku => ({
        label: `${sku.sku_code} - ${sku.name || sku.description}`,
        value: sku._id
      }))
    } else {
      const needle = val.toLowerCase()
      skuOptions.value = allSKUs.value
        .filter(sku => 
          sku.sku_code.toLowerCase().includes(needle) ||
          (sku.name && sku.name.toLowerCase().includes(needle)) ||
          (sku.description && sku.description.toLowerCase().includes(needle))
        )
        .map(sku => ({
          label: `${sku.sku_code} - ${sku.name || sku.description}`,
          value: sku._id
        }))
    }
  })
}

const assignSingleItem = (item) => {
  selectedForAssignment.value = item
  assignmentForm.value = { sku_id: null, notes: '' }
  showAssignDialog.value = true
  loadSKUs()
}

const submitAssignment = async () => {
  if (!selectedForAssignment.value || !assignmentForm.value.sku_id) return
  
  submitting.value = true
  try {
    await api.post('/unassigned-items/assign', {
      item_ids: [selectedForAssignment.value._id],
      sku_id: assignmentForm.value.sku_id,
      notes: assignmentForm.value.notes
    })
    
    $q.notify({
      type: 'positive',
      message: 'SKU assigned successfully'
    })
    
    showAssignDialog.value = false
    refreshData()
  } catch (error) {
    console.error('Assignment failed:', error)
    $q.notify({
      type: 'negative',
      message: 'Assignment failed: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    submitting.value = false
  }
}

const submitBulkAssignment = async () => {
  if (selectedItems.value.length === 0 || !bulkAssignmentForm.value.sku_id) return
  
  submitting.value = true
  try {
    await api.post('/unassigned-items/assign', {
      item_ids: selectedItems.value.map(item => item._id),
      sku_id: bulkAssignmentForm.value.sku_id,
      notes: bulkAssignmentForm.value.notes
    })
    
    $q.notify({
      type: 'positive',
      message: `Successfully assigned SKUs to ${selectedItems.value.length} items`
    })
    
    showBulkAssignDialog.value = false
    selectedItems.value = []
    refreshData()
  } catch (error) {
    console.error('Bulk assignment failed:', error)
    $q.notify({
      type: 'negative',
      message: 'Bulk assignment failed: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    submitting.value = false
  }
}

// Utility functions
const formatCurrency = (value) => {
  if (!value) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.unassigned-items-manager {
  max-width: 100%;
}

.stats-header {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.stats-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stats-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.glass-table {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.controls-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin: 0 16px;
}
</style>
