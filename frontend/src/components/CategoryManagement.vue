<template>
  <div class="category-management q-pa-lg">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 q-my-none text-grey-8">Category Management</h4>
        <p class="text-body2 text-grey-6 q-mt-sm">
          Manage product and tool categories
        </p>
      </div>
      <div class="row q-gutter-sm">
        <q-btn
          color="secondary"
          icon="refresh"
          :label="$q.screen.gt.xs ? 'Refresh' : ''"
          @click="loadCategories"
          :loading="categoryStore.isLoading"
          outline
          :size="$q.screen.lt.sm ? 'sm' : 'md'"
        />
        <q-btn
          color="positive"
          icon="add"
          :label="$q.screen.gt.xs ? 'Add Category' : ''"
          @click="showAddDialog = true"
          :size="$q.screen.lt.sm ? 'sm' : 'md'"
        />
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="q-mb-lg">
      <StatsCarousel :stats="statsData" :is-loading="categoryStore.isLoading" />
    </div>

    <!-- Filters -->
    <q-card class="glass-card q-mb-lg">
      <q-card-section>
        <div class="row q-gutter-sm items-end">
          <div class="col-12 col-sm-6 col-md-4">
            <q-input
              v-model="searchQuery"
              label="Search categories..."
              dense
              outlined
              clearable
              debounce="300"
              :loading="categoryStore.isLoading"
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>
          <div class="col-6 col-sm-3 col-md-3">
            <q-select
              v-model="typeFilter"
              :options="typeFilterOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              label="Type"
              dense
              outlined
              clearable
            />
          </div>
          <div class="col-6 col-sm-3 col-md-3">
            <q-select
              v-model="statusFilter"
              :options="statusFilterOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              label="Status"
              dense
              outlined
              clearable
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Categories Table -->
    <q-card class="glass-card">
      <q-table
        :rows="categories"
        :columns="tableColumns"
        :loading="categoryStore.isLoading"
        :pagination="tablePagination"
        row-key="_id"
        flat
        bordered
        class="categories-table"
      >
        <!-- Type column -->
        <template v-slot:body-cell-type="props">
          <q-td :props="props">
            <q-chip
              :color="props.row.type === 'tool' ? 'warning' : 'info'"
              text-color="white"
              dense
              :label="props.row.type"
              :icon="props.row.type === 'tool' ? 'build' : 'inventory_2'"
            />
          </q-td>
        </template>
        
        <!-- Status column -->
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-chip
              :color="props.row.status === 'active' ? 'positive' : 'grey'"
              text-color="white"
              dense
              :label="props.row.status"
              :icon="props.row.status === 'active' ? 'check' : 'block'"
            />
          </q-td>
        </template>
        
        <!-- Actions column -->
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn-group flat>
              <q-btn
                flat
                dense
                color="primary"
                icon="edit"
                @click="editCategory(props.row)"
                :loading="categoryStore.isUpdating"
              >
                <q-tooltip>Edit Category</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                color="negative"
                icon="delete"
                @click="confirmDelete(props.row)"
                :loading="categoryStore.isDeleting"
              >
                <q-tooltip>Delete Category</q-tooltip>
              </q-btn>
            </q-btn-group>
          </q-td>
        </template>
        
        <!-- No data template -->
        <template v-slot:no-data="{ message }">
          <div class="full-width row flex-center text-grey q-gutter-sm q-pa-lg">
            <q-icon size="2em" name="category" />
            <span class="text-body1">{{ message || 'No categories found' }}</span>
          </div>
        </template>
        
        <!-- Loading template -->
        <template v-slot:loading>
          <q-inner-loading showing color="primary" />
        </template>
        
        <!-- Grid item template for mobile -->
        <template v-slot:item="props">
          <div class="q-pa-xs col-xs-12 col-sm-6 col-md-4">
            <q-card class="glass-card" flat bordered>
              <q-card-section>
                <div class="row items-center justify-between q-mb-sm">
                  <div class="text-h6">{{ props.row.name }}</div>
                  <q-chip
                    :color="props.row.status === 'active' ? 'positive' : 'grey'"
                    text-color="white"
                    dense
                    :label="props.row.status"
                    :icon="props.row.status === 'active' ? 'check' : 'block'"
                  />
                </div>
                
                <div class="row items-center q-mb-sm">
                  <q-chip
                    :color="props.row.type === 'tool' ? 'warning' : 'info'"
                    text-color="white"
                    dense
                    :label="props.row.type"
                    :icon="props.row.type === 'tool' ? 'build' : 'inventory_2'"
                    class="q-mr-sm"
                  />
                  <div class="text-caption text-grey-6">Sort: {{ props.row.sort_order }}</div>
                </div>
                
                <div v-if="props.row.description" class="text-body2 text-grey-7 q-mb-sm">
                  {{ props.row.description }}
                </div>
              </q-card-section>
              
              <q-card-actions align="right">
                <q-btn
                  flat
                  dense
                  color="primary"
                  icon="edit"
                  label="Edit"
                  @click="editCategory(props.row)"
                  :loading="categoryStore.isUpdating"
                />
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="delete"
                  label="Delete"
                  @click="confirmDelete(props.row)"
                  :loading="categoryStore.isDeleting"
                />
              </q-card-actions>
            </q-card>
          </div>
        </template>
      </q-table>
    </q-card>

    <!-- Add Category Dialog -->
    <q-dialog v-model="showAddDialog" class="category-dialog">
      <CategoryForm
        mode="create"
        @submit="handleCategoryCreated"
        @cancel="showAddDialog = false"
      />
    </q-dialog>

    <!-- Edit Category Dialog -->
    <q-dialog v-model="showEditDialog" class="category-dialog">
      <CategoryForm
        mode="edit"
        :category="selectedCategory"
        @submit="handleCategoryUpdated"
        @cancel="showEditDialog = false"
      />
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-avatar icon="delete" color="negative" text-color="white" />
          <span class="q-ml-sm">
            Are you sure you want to delete the category 
            <strong>{{ selectedCategory?.name }}</strong>?
          </span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showDeleteDialog = false" />
          <q-btn 
            flat 
            label="Delete" 
            color="negative" 
            @click="handleDelete"
            :loading="categoryStore.isDeleting"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Error Notification -->
    <q-banner v-if="categoryStore.error" class="bg-negative text-white q-ma-md">
      <template v-slot:avatar>
        <q-icon name="error" />
      </template>
      {{ categoryStore.error }}
      <template v-slot:action>
        <q-btn 
          flat 
          color="white" 
          label="Dismiss" 
          @click="categoryStore.clearError()"
        />
      </template>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useCategoryStore } from '@/stores/category'
import CategoryForm from './CategoryForm.vue'
import StatsCarousel from './StatsCarousel.vue'
import type { Category } from '@/types'

// Composables
const $q = useQuasar()
const categoryStore = useCategoryStore()

// State
const searchQuery = ref('')
const typeFilter = ref<string | null>(null)
const statusFilter = ref<string | null>(null)
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedCategory = ref<Category | null>(null)

// Filter options
const typeFilterOptions = [
  { label: 'Product Categories', value: 'product' },
  { label: 'Tool Categories', value: 'tool' }
]

const statusFilterOptions = [
  { label: 'Active Only', value: 'active' },
  { label: 'Inactive Only', value: 'inactive' }
]

// Table pagination
const tablePagination = ref({
  sortBy: 'sort_order',
  descending: false,
  page: 1,
  rowsPerPage: 20
})

// Stats data for carousel
const statsData = computed(() => [
  {
    value: categoryStore.categoryStats.total,
    label: 'Total Categories',
    icon: 'category',
    iconColor: 'primary',
    valueClass: 'text-primary'
  },
  {
    value: categoryStore.categoryStats.active,
    label: 'Active Categories', 
    icon: 'check_circle',
    iconColor: 'positive',
    valueClass: 'text-positive'
  },
  {
    value: categoryStore.categoryStats.products,
    label: 'Product Categories',
    icon: 'inventory_2', 
    iconColor: 'info',
    valueClass: 'text-info'
  },
  {
    value: categoryStore.categoryStats.tools,
    label: 'Tool Categories',
    icon: 'build',
    iconColor: 'warning', 
    valueClass: 'text-warning'
  }
])

const tableColumns = [
  {
    name: 'name',
    required: true,
    label: 'Name',
    align: 'left',
    field: 'name',
    sortable: true
  },
  {
    name: 'type',
    label: 'Type',
    align: 'center',
    field: 'type',
    sortable: true
  },
  {
    name: 'description',
    label: 'Description',
    align: 'left',
    field: 'description',
    sortable: false
  },
  {
    name: 'status',
    label: 'Status',
    align: 'center',
    field: 'status',
    sortable: true
  },
  {
    name: 'sort_order',
    label: 'Sort Order',
    align: 'center',
    field: 'sort_order',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    sortable: false
  }
]

// Computed
const categories = computed(() => {
  console.log('🔍 [CategoryManagement] Computing categories...')
  console.log('📦 [CategoryManagement] Raw store categories:', categoryStore.categories)
  console.log('📊 [CategoryManagement] Store categories count:', categoryStore.categories.length)
  console.log('🔍 [CategoryManagement] Current filters:', {
    searchQuery: searchQuery.value,
    typeFilter: typeFilter.value,
    statusFilter: statusFilter.value
  })
  
  let filtered = [...categoryStore.categories]
  console.log('📋 [CategoryManagement] Initial filtered count:', filtered.length)
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(cat =>
      cat.name.toLowerCase().includes(search) ||
      cat.description?.toLowerCase().includes(search)
    )
    console.log('🔎 [CategoryManagement] After search filter:', filtered.length)
  }
  
  // Apply type filter
  if (typeFilter.value) {
    filtered = filtered.filter(cat => cat.type === typeFilter.value)
    console.log('🏷️ [CategoryManagement] After type filter:', filtered.length)
  }
  
  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(cat => cat.status === statusFilter.value)
    console.log('📊 [CategoryManagement] After status filter:', filtered.length)
  }
  
  // Sort by sort_order then name
  const sorted = filtered.sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }
    return a.name.localeCompare(b.name)
  })
  
  console.log('✅ [CategoryManagement] Final categories for display:', sorted)
  console.log('📊 [CategoryManagement] Final count:', sorted.length)
  
  return sorted
})

// Methods
const loadCategories = async () => {
  try {
    console.log('🔄 [CategoryManagement] loadCategories called')
    console.log('📊 [CategoryManagement] Store state before fetch:', {
      categoriesCount: categoryStore.categories.length,
      isLoading: categoryStore.isLoading,
      error: categoryStore.error
    })
    
    await categoryStore.fetchCategories({ 
      active_only: false,
      include_children: true
    })
    
    console.log('✅ [CategoryManagement] loadCategories completed')
    console.log('📊 [CategoryManagement] Store state after fetch:', {
      categoriesCount: categoryStore.categories.length,
      isLoading: categoryStore.isLoading,
      error: categoryStore.error
    })
  } catch (error) {
    console.error('❌ [CategoryManagement] loadCategories error:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load categories',
      timeout: 3000
    })
  }
}

const handleSearch = () => {
  // Search is reactive via computed property
}

const handleTypeFilter = () => {
  // Filter is reactive via computed property
}

const handleStatusFilter = () => {
  // Filter is reactive via computed property
}

const editCategory = (category: Category) => {
  selectedCategory.value = category
  showEditDialog.value = true
}

const confirmDelete = (category: Category) => {
  selectedCategory.value = category
  showDeleteDialog.value = true
}

const handleCategoryCreated = async (category: Category) => {
  showAddDialog.value = false
  
  $q.notify({
    type: 'positive',
    message: `Category "${category.name}" created successfully`,
    timeout: 3000
  })
  
  // Refresh the list to show the new category
  await loadCategories()
}

const handleCategoryUpdated = async (category: Category) => {
  showEditDialog.value = false
  selectedCategory.value = null
  
  $q.notify({
    type: 'positive',
    message: `Category "${category.name}" updated successfully`,
    timeout: 3000
  })
  
  // Refresh the list to show updates
  await loadCategories()
}

const handleDelete = async () => {
  if (!selectedCategory.value) return
  
  try {
    console.log('🗑️ Attempting to delete category:', selectedCategory.value._id, selectedCategory.value.name)
    
    await categoryStore.deleteCategory(selectedCategory.value._id)
    
    $q.notify({
      type: 'positive',
      message: `Category "${selectedCategory.value.name}" deleted successfully`,
      timeout: 3000
    })
    
    showDeleteDialog.value = false
    selectedCategory.value = null
    
    // Refresh the list
    await loadCategories()
  } catch (error: any) {
    console.error('❌ Delete category error:', error)
    console.error('❌ Error response:', error.response?.data)
    
    let errorMessage = 'Failed to delete category'
    if (error.response?.status === 500) {
      errorMessage = 'Server error: Cannot delete category. It may be in use by SKUs or have other dependencies.'
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    $q.notify({
      type: 'negative',
      message: errorMessage,
      timeout: 7000,
      actions: [{ label: 'Dismiss', color: 'white' }]
    })
    
    // Close dialog even on error
    showDeleteDialog.value = false
    selectedCategory.value = null
  }
}

// Lifecycle
onMounted(() => {
  loadCategories()
})

// Watch for store errors to show notifications
watch(() => categoryStore.error, (error) => {
  if (error) {
    $q.notify({
      type: 'negative',
      message: error,
      timeout: 5000,
      actions: [
        { label: 'Dismiss', color: 'white', handler: () => categoryStore.clearError() }
      ]
    })
  }
})
</script>

<style scoped>
.category-management {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.category-management .category-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background: var(--q-surface);
}

.category-management .category-stats {
  flex-shrink: 0;
}

.category-management .category-stats .stat-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.category-management .category-stats .stat-card:hover {
  border-color: var(--q-primary);
  transition: border-color 0.2s ease;
}

.category-management .category-filters {
  flex-shrink: 0;
}

.category-management .category-filters .filter-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.category-management .category-tree {
  flex: 1;
  overflow: hidden;
}

.category-management .category-tree .tree-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.category-management .category-tree .tree-card .q-card-section {
  flex: 1;
  overflow-y: auto;
}

.category-list .category-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.category-list .category-item:last-child {
  border-bottom: none;
}

.category-list .category-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.category-list .category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  min-height: 72px;
}

.category-list .category-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-right: 16px;
}

.category-list .category-main {
  display: flex;
  align-items: flex-start;
}

.category-list .category-icon {
  margin-top: 2px;
}

.category-list .category-name {
  font-size: 1rem;
  line-height: 1.4;
}

.category-list .category-description {
  margin-top: 4px;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.category-list .category-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.category-list .category-actions {
  display: flex;
  gap: 4px;
}

/* Mobile adjustments */
@media (max-width: 599px) {
  .category-management .category-header .row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .category-management .category-header .row .col-auto {
    align-self: stretch;
  }
  
  .category-management .category-header .row .col-auto .q-btn {
    width: 100%;
  }
  
  .category-management .category-stats .row .col-12 {
    margin-bottom: 8px;
  }
  
  .category-management .category-stats .row .col-12:last-child {
    margin-bottom: 0;
  }
  
  .category-management .category-filters .row .col-12 {
    margin-bottom: 8px;
  }
  
  .category-management .category-filters .row .col-12:last-child {
    margin-bottom: 0;
  }
  
  .category-management .category-list .category-row {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
  }
  
  .category-management .category-list .category-info {
    margin-right: 0;
    margin-bottom: 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .category-management .category-list .category-main {
    align-items: flex-start;
  }
  
  .category-management .category-list .category-meta {
    align-items: flex-start;
    flex-direction: row;
    justify-content: flex-start;
  }
  
  .category-management .category-list .category-actions {
    align-self: center;
  }
  
  .category-management .category-list .category-description {
    max-width: none;
  }
}

/* Dark mode adjustments */
body.body--dark .category-management .category-header,
body.body--dark .category-management .stat-card,
body.body--dark .category-management .filter-card,
body.body--dark .category-management .tree-card {
  border-color: rgba(255, 255, 255, 0.12);
}

body.body--dark .category-management .category-list .category-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

body.body--dark .category-management .category-list .category-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.category-dialog) .q-dialog__inner {
  padding: 16px;
}
</style>
