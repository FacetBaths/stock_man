<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { useCategoryStore } from '@/stores/category'
import { PRODUCT_TYPES } from '@/types'
import { skuApi } from '@/utils/api'
import InventoryTable from '@/components/InventoryTable.vue'
import AddStockModal from '@/components/AddStockModal.vue'
import AddToolModal from '@/components/AddToolModal.vue'
import EditItemModal from '@/components/EditItemModal.vue'
import QuickScanModal from '@/components/QuickScanModal.vue'
import type { Inventory } from '@/types'

const route = useRoute()

const authStore = useAuthStore()
const inventoryStore = useInventoryStore()
const categoryStore = useCategoryStore()

const activeTab = ref('all')
const searchQuery = ref('')
const showInStockOnly = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showQuickScanModal = ref(false)
const itemToEdit = ref<any | null>(null)

// Since this page is only accessed from Tools dashboard, always show tool categories
const availableTabs = computed(() => {
  const toolCategories = categoryStore.categories
    .filter(cat => cat.type === 'tool' && cat.status === 'active')
    .map(cat => ({ value: cat._id, label: cat.name }))
  
  return [{ value: 'all', label: 'All Tools' }, ...toolCategories]
})

// Since this page is tools-only, filter to show only tools and apply search/category filters
const filteredItems = computed(() => {
  // Use inventory data from backend (Inventory model records)
  let items = inventoryStore.inventory || []
  
  console.log('🔧 [Debug] Raw inventory items:', items.length)
  if (items.length > 0) {
    console.log('🔧 [Debug] Sample item:', items[0])
  }

  // STEP 1: Filter to only tool categories (since this is a tools-only page)
  const toolCategoryIds = categoryStore.categories
    .filter(cat => cat.type === 'tool' && cat.status === 'active')
    .map(cat => cat._id)
  
  console.log('🔧 [Debug] Tool category IDs:', toolCategoryIds)
  
  items = items.filter(item => {
    // Check if this inventory item's category is a tool category
    const isToolCategory = toolCategoryIds.includes(item.category?._id) || 
                         toolCategoryIds.includes(item.sku?.category_id)
    if (isToolCategory) {
      console.log('🔧 [Debug] Found tool:', item.sku?.name, 'category:', item.category?.name)
    }
    return isToolCategory
  })
  
  console.log('🔧 [Debug] After tool filter:', items.length)

  // STEP 2: Apply search filter (global search within tools)
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase().trim()
    console.log('🔍 [Debug] Applying search filter:', search)
    
    items = items.filter(item => {
      // Search through SKU fields (populated from backend)
      if (item.sku) {
        const sku = item.sku
        if (sku.sku_code?.toLowerCase().includes(search) || 
            sku.name?.toLowerCase().includes(search) ||
            sku.barcode?.toLowerCase().includes(search) ||
            sku.brand?.toLowerCase().includes(search) ||
            sku.model?.toLowerCase().includes(search) ||
            sku.description?.toLowerCase().includes(search)) {
          return true
        }
      }
      
      // Search through category name
      if (item.category?.name?.toLowerCase().includes(search)) {
        return true
      }
      
      return false
    })
    
    console.log('🔍 [Debug] After search filter:', items.length)
  }

  // STEP 3: Apply category tab filter (specific tool category)
  if (!searchQuery.value.trim() && activeTab.value !== 'all') {
    console.log('🏷️ [Debug] Applying category tab filter:', activeTab.value)
    
    items = items.filter(item => {
      // Filter by category ID (from Inventory → SKU → Category relationship)
      if (item.sku?.category_id === activeTab.value) {
        return true
      }
      // If category is populated object
      if (item.category?._id === activeTab.value) {
        return true
      }
      return false
    })
    
    console.log('🏷️ [Debug] After category filter:', items.length)
  }

  // STEP 4: Apply stock filter
  if (showInStockOnly.value) {
    items = items.filter(item => {
      // Check available_quantity from Inventory model
      return item.available_quantity > 0
    })
    
    console.log('📦 [Debug] After stock filter:', items.length)
  }

  console.log('✅ [Debug] Final filtered items:', items.length)
  return items
})

const handleTabClick = (tab: string) => {
  activeTab.value = tab
}

const handleSearch = () => {
  loadItems()
}

const handleInStockToggle = () => {
  loadItems()
}

// Load all inventory data - filtering is done client-side for tools
const loadInventory = async () => {
  try {
    // Load all inventory data - include tools for tools inventory
    const params: any = {
      status: showInStockOnly.value ? 'available' : 'all',
      include_tools: 'true' // Include tools in inventory fetch
    }
    
    // Only add search if there's an actual user search query
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    
    console.log('🔄 [Debug] Loading inventory with params:', params)
    
    await inventoryStore.fetchInventory(params)
    console.log('✅ [Debug] Inventory loaded, total items:', inventoryStore.inventory?.length || 0)
  } catch (error) {
    console.error('❌ [Debug] Error loading inventory:', error)
    throw error
  }
}

// Alias for backward compatibility
const loadItems = loadInventory

const handleAddItem = () => {
  showAddModal.value = true
}

const handleQuickScan = () => {
  showQuickScanModal.value = true
}

const handleEditItem = (item: any) => {
  console.log('🔧 [Inventory] Editing tool:', item)
  // For tools, we want to edit the SKU information, not individual instances
  // Transform the inventory item to match what EditToolModal expects
  const toolToEdit = {
    _id: item.sku?._id || item.sku_id,
    sku_code: item.sku?.sku_code || item.sku_code,
    category_id: item.sku?.category_id || item.category?._id,
    name: item.sku?.name,
    description: item.sku?.description,
    brand: item.sku?.brand,
    model: item.sku?.model,
    unit_cost: item.sku?.unit_cost || item.average_cost,
    barcode: item.sku?.barcode,
    details: item.sku?.details || {},
    // Include inventory summary for context
    inventory: {
      total_quantity: item.total_quantity,
      available_quantity: item.available_quantity,
      reserved_quantity: item.reserved_quantity,
      broken_quantity: item.broken_quantity,
      loaned_quantity: item.loaned_quantity
    }
  }
  itemToEdit.value = toolToEdit
  showEditModal.value = true
}

const handleDeleteItem = async (item: any) => {
  const toolName = item.sku?.name || 'this tool'
  const skuCode = item.sku?.sku_code || 'Unknown SKU'
  const totalQuantity = item.total_quantity || 0
  
  const confirmed = confirm(
    `⚠️ WARNING: Are you sure you want to DELETE "${toolName}" (${skuCode})?\n\n` +
    `This will permanently remove:\n` +
    `• The tool SKU and all its data\n` +
    `• All ${totalQuantity} stock instances\n` +
    `• Any associated history\n\n` +
    `This action CANNOT be undone!`
  )
  
  if (confirmed) {
    try {
      console.log('🗑️ [Inventory] Deleting tool SKU:', item.sku?._id)
      
      // Delete the SKU (this should cascade delete instances)
      await skuApi.deleteSKU(item.sku?._id || item.sku_id)
      
      console.log('✅ [Inventory] Tool deleted successfully')
      
      // Refresh inventory and stats
      await Promise.all([
        loadItems(),
        inventoryStore.fetchStats()
      ])
      
      // Show success message
      // You might want to add a toast notification here
      console.log(`🎉 [Inventory] "${toolName}" has been deleted`)
      
    } catch (error) {
      console.error('❌ [Inventory] Delete tool error:', error)
      
      // Show error message
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error'
      alert(`Failed to delete tool: ${errorMsg}`)
    }
  }
}

const handleAddSuccess = () => {
  showAddModal.value = false
  console.log('🎉 [Inventory] Tool added successfully, refreshing inventory...')
  
  // Refresh both inventory and stats after adding
  Promise.all([
    loadItems(),
    inventoryStore.fetchStats()
  ]).then(() => {
    console.log('✅ [Inventory] Inventory refreshed after tool addition')
    console.log('📊 [Inventory] Current inventory items:', inventoryStore.inventory?.length || 0)
    console.log('📊 [Inventory] Current stats:', inventoryStore.stats)
  }).catch(error => {
    console.error('❌ [Inventory] Error refreshing after tool addition:', error)
  })
}

const handleEditSuccess = () => {
  showEditModal.value = false
  itemToEdit.value = null
  loadItems() // Refresh after edit
}

const handleQuickScanSuccess = () => {
  showQuickScanModal.value = false
  loadItems() // Refresh after batch processing
}

// Initialize filters from route query parameters (tools-only page)
const initializeFromRoute = () => {
  console.log('🔧 [Debug] Initializing tools inventory page')
  
  // Handle search parameter from Tools dashboard
  if (route.query.search) {
    searchQuery.value = route.query.search as string
    console.log('🔍 [Debug] Search query from route:', searchQuery.value)
  }
  
  // Handle category filter from Tools dashboard
  if (route.query.category_id) {
    activeTab.value = route.query.category_id as string
    console.log('🏷️ [Debug] Category filter from route:', activeTab.value)
  } else {
    // Default to showing all tools
    activeTab.value = 'all'
  }
  
  console.log('🔧 [Debug] Tools inventory page initialized')
}

onMounted(async () => {
  // Initialize filters from route first
  initializeFromRoute()
  
  await Promise.all([
    categoryStore.fetchCategories(), // Load categories for filtering
    loadItems(),
    inventoryStore.fetchStats()
  ])
})

// Computed filters for table - prevents infinite loop by ensuring object reference stability
const tableFilters = computed(() => ({
  search: searchQuery.value,
  status: showInStockOnly.value ? 'available' : 'all',
  sort_by: 'sku_code',
  sort_order: 'asc' as const
}))

// Watch for filter changes
watch([searchQuery, showInStockOnly], () => {
  // Debounce search
  if (searchQuery.value.trim()) {
    setTimeout(handleSearch, 300)
  } else {
    loadItems()
  }
}, { deep: true })
</script>

<template>
  <q-page class="inventory-page">
    <div class="container q-pa-md">
      <!-- Page Header -->
      <div class="page-header glass-card q-pa-md q-mb-md" data-aos="fade-up">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <h1 class="text-h4 text-dark q-mb-xs">
              <q-icon name="inventory_2" class="q-mr-sm" />
              Inventory Management
              <q-chip 
                color="primary"
                text-color="white"
                size="sm"
                class="q-ml-md"
              >
                <q-icon name="build" size="14px" class="q-mr-xs" />
                Tools Only
              </q-chip>
            </h1>
            <p class="text-body2 text-dark opacity-80">
              Manage your tools inventory, quantities, and tool details
            </p>
          </div>
          <div class="col-auto" v-if="inventoryStore.stats">
            <div class="row q-gutter-md">
              <q-chip color="primary" text-color="white" icon="inventory">
                {{ inventoryStore.stats.totalItems }} Total Items
              </q-chip>
              <q-chip color="positive" text-color="white" icon="check_circle">
                {{ inventoryStore.stats.totalInStock }} In Stock
              </q-chip>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section glass-card q-pa-md q-mb-md" data-aos="fade-up" data-aos-delay="100">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="row q-gutter-md items-center">
              <!-- Search -->
              <div class="col-auto">
                <q-input
                  v-model="searchQuery"
                  filled
                  placeholder="Search inventory (SKU, barcode, product name)..."
                  class="search-input"
                  style="min-width: 300px"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" class="text-dark" />
                  </template>
                </q-input>
              </div>
              
              <!-- In Stock Filter -->
              <div class="col-auto">
                <q-checkbox
                  v-model="showInStockOnly"
                  @update:model-value="handleInStockToggle"
                  label="In Stock Only"
                  class="text-dark"
                  color="primary"
                />
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="col-auto" v-if="authStore.canWrite">
            <div class="row q-gutter-sm">
              <q-btn
                @click="handleQuickScan"
                color="purple"
                icon="qr_code_scanner"
                label="Scan Items"
                class="action-btn"
                no-caps
              />
              <q-btn
                @click="handleAddItem"
                :loading="inventoryStore.isCreating"
                color="positive"
                icon="build"
                label="Add Tool"
                class="action-btn"
                no-caps
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Product Type Tabs -->
      <div class="tabs-section glass-card q-mb-lg" data-aos="fade-up" data-aos-delay="200">
        <q-tabs
          v-model="activeTab"
          @update:model-value="handleTabClick"
          class="custom-tabs"
          indicator-color="primary"
          align="left"
        >
          <q-tab
            v-for="tab in availableTabs"
            :key="tab.value"
            :name="tab.value"
            :label="tab.label"
            class="tab-item"
          >
            <q-badge
              v-if="inventoryStore.itemsByType && inventoryStore.itemsByType[tab.value]"
              color="primary"
              floating
              rounded
            >
              {{ inventoryStore.itemsByType[tab.value]?.length || 0 }}
            </q-badge>
          </q-tab>
        </q-tabs>
      </div>

      <!-- Error Display -->
      <q-banner
        v-if="inventoryStore.error"
        class="bg-negative text-white q-mb-lg"
        dense
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ inventoryStore.error }}
        <template v-slot:action>
          <q-btn
            flat
            color="white"
            label="Dismiss"
            @click="inventoryStore.clearError"
          />
        </template>
      </q-banner>

      <!-- Loading State -->
      <div v-if="inventoryStore.isLoading" class="loading-container glass-card q-pa-xl text-center">
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-h6 text-dark q-mt-md">Loading inventory...</div>
      </div>

      <!-- Inventory Table -->
      <div v-else class="table-container glass-card" data-aos="fade-up" data-aos-delay="300">
        <InventoryTable
          :can-write="authStore.canWrite"
          :items="filteredItems"
          :filters="tableFilters"
          @edit="handleEditItem"
          @delete="handleDeleteItem"
        />
      </div>
    </div>

    <!-- Modals -->
    <!-- Always use AddToolModal since this is a tools-only page -->
    <AddToolModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @success="handleAddSuccess"
    />

    <EditItemModal
      v-model="showEditModal"
      v-if="itemToEdit"
      :item="itemToEdit"
      @success="handleEditSuccess"
    />

    <QuickScanModal
      v-if="showQuickScanModal"
      @close="showQuickScanModal = false"
      @success="handleQuickScanSuccess"
    />
  </q-page>
</template>

<style scoped>
.inventory-page {
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

/* Controls Section */
.search-input {
  border-radius: 15px;
}

.search-input :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
}

.search-input :deep(.q-field__native) {
  color: #333;
}

.search-input :deep(.q-field__native)::placeholder {
  color: rgba(0, 0, 0, 0.6);
}

.action-btn {
  border-radius: 15px;
  padding: 8px 16px;
  font-weight: 600;
  text-transform: none;
  min-width: 120px;
}

/* Tabs Section */
.tabs-section {
  overflow: hidden;
}

.custom-tabs {
  background: transparent;
}

.custom-tabs :deep(.q-tab) {
  color: rgba(33, 37, 41, 0.8);
  font-weight: 500;
  text-transform: none;
  border-radius: 10px 10px 0 0;
  transition: all 0.3s ease;
}

.custom-tabs :deep(.q-tab--active) {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(33, 37, 41, 0.95);
  font-weight: 600;
}

.custom-tabs :deep(.q-tab:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(33, 37, 41, 0.9);
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
    min-width: 250px !important;
  }
}
</style>
