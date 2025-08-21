<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import { PRODUCT_TYPES } from '@/types'
import InventoryTable from '@/components/InventoryTable.vue'
import AddItemModal from '@/components/AddItemModal.vue'
import EditItemModal from '@/components/EditItemModal.vue'
import type { Item } from '@/types'

const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

const activeTab = ref('all')
const searchQuery = ref('')
const showInStockOnly = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const itemToEdit = ref<Item | null>(null)

const availableTabs = computed(() => {
  const tabs = [{ value: 'all', label: 'All Items' }, ...PRODUCT_TYPES]
  return tabs
})

const filteredItems = computed(() => {
  let items = inventoryStore.items

  // Apply search filter first (global search)
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase().trim()
    items = items.filter(item => {
      const details = item.product_details as any
      
      // Check SKU code and barcode first
      if (item.sku_code?.toLowerCase().includes(search) || item.barcode?.toLowerCase().includes(search)) {
        return true
      }
      
      if (item.product_type === 'wall') {
        return (
          details.product_line?.toLowerCase().includes(search) ||
          details.color_name?.toLowerCase().includes(search) ||
          details.dimensions?.toLowerCase().includes(search) ||
          details.finish?.toLowerCase().includes(search)
        )
      } else {
        return (
          details.name?.toLowerCase().includes(search) ||
          details.brand?.toLowerCase().includes(search) ||
          details.model?.toLowerCase().includes(search) ||
          details.color?.toLowerCase().includes(search) ||
          details.dimensions?.toLowerCase().includes(search) ||
          details.finish?.toLowerCase().includes(search) ||
          details.description?.toLowerCase().includes(search)
        )
      }
    })
  }

  // Then apply tab filter (unless searching, which overrides tabs)
  if (!searchQuery.value.trim() && activeTab.value !== 'all') {
    items = items.filter(item => item.product_type === activeTab.value)
  }

  // Apply stock filter
  if (showInStockOnly.value) {
    items = items.filter(item => item.quantity > 0)
  }

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

const loadItems = async () => {
  await inventoryStore.loadItems({
    in_stock_only: showInStockOnly.value
  })
}

const handleAddItem = () => {
  showAddModal.value = true
}

const handleEditItem = (item: Item) => {
  itemToEdit.value = item
  showEditModal.value = true
}

const handleDeleteItem = async (item: Item) => {
  if (confirm(`Are you sure you want to delete this ${item.product_type} item?`)) {
    try {
      await inventoryStore.deleteItem(item._id)
    } catch (error) {
      console.error('Delete error:', error)
    }
  }
}

const handleAddSuccess = () => {
  showAddModal.value = false
}

const handleEditSuccess = () => {
  showEditModal.value = false
  itemToEdit.value = null
}

onMounted(async () => {
  await loadItems()
  await inventoryStore.loadStats()
})

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
            </h1>
            <p class="text-body2 text-dark opacity-80">
              Manage your stock items, quantities, and product details
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

          <!-- Add Item Button -->
          <div class="col-auto" v-if="authStore.canWrite">
            <q-btn
              @click="handleAddItem"
              :loading="inventoryStore.isCreating"
              color="positive"
              icon="add"
              label="Add Item"
              class="add-btn"
              no-caps
            />
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
              v-if="inventoryStore.itemsByType[tab.value]"
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
          :items="filteredItems"
          :can-write="authStore.canWrite"
          @edit="handleEditItem"
          @delete="handleDeleteItem"
        />
      </div>
    </div>

    <!-- Modals -->
    <AddItemModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @success="handleAddSuccess"
    />

    <EditItemModal
      v-if="showEditModal && itemToEdit"
      :item="itemToEdit"
      @close="showEditModal = false"
      @success="handleEditSuccess"
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

.add-btn {
  border-radius: 15px;
  padding: 8px 24px;
  font-weight: 600;
  text-transform: none;
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
