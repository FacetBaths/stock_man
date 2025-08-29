<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useInventoryStore } from "@/stores/inventory";
import { useCategoryStore } from "@/stores/category";
import InventoryTable from "@/components/InventoryTable.vue";
import AddItemModal from "@/components/AddItemModal.vue";
import EditItemModal from "@/components/EditItemModal.vue";
import QuickScanModal from "@/components/QuickScanModal.vue";
import type { Inventory } from "@/types";

const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const categoryStore = useCategoryStore();

// Updated for new inventory system
const activeFilter = ref("all");
const selectedCategory = ref("");
const searchQuery = ref("");
const showLowStockOnly = ref(false);

// Debug reactive changes (uncomment for debugging)
// watch(
//   selectedCategory,
//   (newVal, oldVal) => {
//     console.log(
//       "🔄 [Dashboard] selectedCategory changed from:",
//       oldVal,
//       "to:",
//       newVal
//     );
//     console.trace("selectedCategory change stack trace:");
//     console.log({ selectedCategory: selectedCategory.value });
//   },
//   { immediate: true }
// );
const showAddModal = ref(false);
const showEditModal = ref(false);
const showQuickScanModal = ref(false);
const itemToEdit = ref<any | null>(null);

// Available filters for the new inventory system
const availableFilters = computed(() => [
  { value: "all", label: "All Items" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "needs_reorder", label: "Need Reorder" },
  { value: "overstock", label: "Overstock" },
]);

// Helper function to convert to title case
const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// Available categories for filtering
const availableCategories = computed(() => {
  // Uncomment for debugging category loading:
  // console.log("🎯 [Dashboard] availableCategories computed triggered");
  
  const categories = [{ _id: "", name: "All Categories" }];
  if (categoryStore.categories && categoryStore.categories.length > 0) {
    // Handle both old and new category structures with title case formatting
    const mappedCategories = categoryStore.categories.map((cat) => {
      const rawName = cat.name || cat.displayName || "Unnamed Category";
      return {
        _id: cat._id || cat.id,
        name: toTitleCase(rawName),
      };
    });
    categories.push(...mappedCategories);
  }
  return categories;
});

// Use direct store stats instead of computed to avoid reactive loops
// The store already provides computed stats that are safer
const dashboardStats = computed(() => {
  // Use the store's built-in stats if available, otherwise provide defaults
  return (
    inventoryStore.inventoryStats || {
      totalSKUs: 0,
      totalItems: 0,
      inStock: 0,
      totalValue: 0,
      lowStock: 0,
      outOfStock: 0,
      needReorder: 0,
      overstock: 0,
    }
  );
});

// Template ref to access InventoryTable component
const inventoryTableRef = ref<InstanceType<typeof InventoryTable> | null>(null);

// Function to get current filters for refresh calls
const getCurrentFilters = () => {
  const filters: any = {};

  // Apply search filter
  if (searchQuery.value.trim()) {
    filters.search = searchQuery.value.trim();
  }

  // Apply category filter - explicitly set to undefined when clearing
  if (selectedCategory.value && selectedCategory.value !== "") {
    filters.category_id = selectedCategory.value;
  } else {
    // Explicitly set to undefined to signal the store to remove this filter
    filters.category_id = undefined;
  }

  // Apply status filter
  if (activeFilter.value !== "all") {
    filters.status = activeFilter.value;
  } else if (showLowStockOnly.value) {
    filters.status = "low_stock";
  }

  return {
    ...filters,
    sort_by: "sku_code",
    sort_order: "asc",
  };
};

const handleFilterClick = (filter: string) => {
  activeFilter.value = filter;
  // Use nextTick to ensure filters are updated before calling refresh
  nextTick(() => {
    const filters = getCurrentFilters();
    inventoryTableRef.value?.refreshInventory(filters);
  });
};

const handleSearch = () => {
  // Add a small delay to ensure all reactive updates are complete
  setTimeout(() => {
    // Uncomment for debugging search/filter behavior:
    // console.log("🔍 [Dashboard] handleSearch executing, selectedCategory.value:", selectedCategory.value);
    const filters = getCurrentFilters();
    // console.log("🔍 [Dashboard] handleSearch filters:", filters);
    inventoryTableRef.value?.refreshInventory(filters);
  }, 10);
};

const handleLowStockToggle = () => {
  nextTick(() => {
    const filters = getCurrentFilters();
    inventoryTableRef.value?.refreshInventory(filters);
  });
};

const handleAddItem = () => {
  showAddModal.value = true;
};

const handleQuickScan = () => {
  showQuickScanModal.value = true;
};

// Updated for new inventory structure
const handleEditItem = (inventoryItem: any) => {
  // Pass the inventory item directly to the EditItemModal
  // The modal will handle the new structure properly
  if (inventoryItem.sku_id) {
    console.log("Opening edit modal for inventory item:", inventoryItem);
    itemToEdit.value = inventoryItem;
    showEditModal.value = true;
  } else {
    console.log("Cannot edit inventory item without SKU data:", inventoryItem);
  }
};

const handleDeleteItem = async (inventoryItem: any) => {
  if (
    confirm(
      `Are you sure you want to delete inventory for ${
        inventoryItem.sku?.name || inventoryItem.sku?.sku_code
      }?`
    )
  ) {
    try {
      // In the new structure, we don't delete inventory records directly
      // We might remove stock or deactivate the SKU instead
      console.log("Delete inventory item:", inventoryItem);
      // TODO: Implement appropriate action (remove all stock, deactivate SKU, etc.)
    } catch (error) {
      console.error("Delete error:", error);
    }
  }
};

const handleAddSuccess = () => {
  showAddModal.value = false;
};

const handleEditSuccess = () => {
  showEditModal.value = false;
  itemToEdit.value = null;
};

const handleQuickScanSuccess = () => {
  showQuickScanModal.value = false;
  // Reload inventory data after batch processing using manual refresh
  inventoryTableRef.value?.refreshInventory(getCurrentFilters());
  inventoryStore.fetchStats();
};

const handleLogout = async () => {
  await authStore.logout();
};

const getRoleColor = (role?: string) => {
  switch (role) {
    case "admin":
      return "deep-purple";
    case "warehouse_manager":
      return "primary";
    case "sales_rep":
      return "teal";
    default:
      return "grey";
  }
};

const formatLastUpdated = (dateString?: string) => {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
};

const formatTotalValue = (value?: number) => {
  if (!value || value === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const canViewCost = computed(
  () =>
    authStore.hasPermission("view_cost") ||
    authStore.hasRole(["admin", "warehouse_manager"])
);

onMounted(async () => {
  // Uncomment for debugging component lifecycle:
  // console.log("🚀 [Dashboard] onMounted called");

  try {
    await categoryStore.fetchCategories();
    
    if (!categoryStore.categories || categoryStore.categories.length === 0) {
      console.warn(
        "⚠️ [Dashboard] No categories found in database. Categories may need to be seeded."
      );
    }
  } catch (error) {
    console.error("❌ [Dashboard] Failed to load categories:", error);
  }

  // Fetch stats and initial inventory data for better UX
  await inventoryStore.fetchStats();

  // Auto-load initial inventory data (always load on mount)
  setTimeout(() => {
    console.log('[Dashboard] Auto-loading inventory data. Current inventory length:', inventoryStore.inventory.length)
    if (inventoryTableRef.value) {
      console.log('[Dashboard] Triggering inventory refresh with filters:', getCurrentFilters())
      inventoryTableRef.value.refreshInventory(getCurrentFilters());
    } else {
      console.warn('[Dashboard] inventoryTableRef not ready, retrying in 200ms')
      setTimeout(() => {
        if (inventoryTableRef.value) {
          inventoryTableRef.value.refreshInventory(getCurrentFilters());
        }
      }, 200);
    }
  }, 100);
});

// Remove this watch - InventoryTable handles its own filter changes
// The watch was causing infinite loops by triggering loadInventory
// which updates the store, which triggers computed properties, which re-triggers the watch
</script>

<template>
  <q-page class="dashboard-page">
    <div class="container q-pa-md">
      <!-- Welcome Section -->
      <div
        class="welcome-section glass-card q-pa-md q-mb-md"
        data-aos="fade-up"
      >
        <div class="row items-center">
          <div class="col-auto q-mr-md">
            <img
              src="@/assets/images/Logo_V2_Gradient7_CTC.png"
              alt="Facet Renovations Logo"
              class="logo-image"
            />
          </div>
          <div class="col">
            <h1 class="text-h5 text-dark q-mb-xs">
              <q-icon name="dashboard" class="q-mr-sm" />
              Stock Manager Dashboard
            </h1>
            <p class="text-body2 text-dark">
              Welcome back, {{ authStore.user?.username }}!
            </p>
          </div>
          <div class="col-auto">
            <q-chip
              :color="getRoleColor(authStore.user?.role)"
              text-color="white"
              icon="verified_user"
              class="text-weight-bold"
            >
              {{ authStore.user?.role.replace("_", " ").toUpperCase() }}
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <div
        class="stats-section q-mb-lg"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div class="stats-cards-container">
          <!-- Total SKUs Card -->
          <q-card class="glass-card stat-card text-center">
            <q-card-section class="q-pa-md">
              <q-icon name="qr_code" class="text-h4 text-primary q-mb-xs" />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.totalSKUs }}
              </div>
              <div class="text-body2 text-dark opacity-80">SKUs Managed</div>
            </q-card-section>
          </q-card>

          <!-- Total Items Card -->
          <q-card class="glass-card stat-card text-center">
            <q-card-section class="q-pa-md">
              <q-icon name="inventory" class="text-h4 text-info q-mb-xs" />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.totalItems }}
              </div>
              <div class="text-body2 text-dark opacity-80">Total Items</div>
            </q-card-section>
          </q-card>

          <!-- In Stock Card -->
          <q-card class="glass-card stat-card text-center">
            <q-card-section class="q-pa-md">
              <q-icon
                name="check_circle"
                class="text-h4 text-positive q-mb-xs"
              />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.inStock }}
              </div>
              <div class="text-body2 text-dark opacity-80">SKUs In Stock</div>
            </q-card-section>
          </q-card>

          <!-- Total Value Card (only for admin/warehouse_manager) -->
          <q-card
            v-if="canViewCost"
            class="glass-card stat-card text-center total-value-card"
          >
            <q-card-section class="q-pa-md">
              <q-icon name="attach_money" class="text-h4 text-accent q-mb-xs" />
              <div class="text-h4 text-dark text-weight-bold">
                {{ formatTotalValue(dashboardStats.totalValue) }}
              </div>
              <div class="text-body2 text-dark opacity-80">Total Value</div>
            </q-card-section>
          </q-card>

          <!-- Low Stock Card -->
          <q-card class="glass-card stat-card text-center warning-card">
            <q-card-section class="q-pa-md">
              <q-icon name="warning" class="text-h4 text-warning q-mb-xs" />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.lowStock }}
              </div>
              <div class="text-body2 text-dark opacity-80">Low Stock</div>
            </q-card-section>
          </q-card>

          <!-- Out of Stock Card -->
          <q-card class="glass-card stat-card text-center negative-card">
            <q-card-section class="q-pa-md">
              <q-icon name="error" class="text-h4 text-negative q-mb-xs" />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.outOfStock }}
              </div>
              <div class="text-body2 text-dark opacity-80">Out of Stock</div>
            </q-card-section>
          </q-card>

          <!-- Need Reorder Card -->
          <q-card class="glass-card stat-card text-center reorder-card">
            <q-card-section class="q-pa-md">
              <q-icon
                name="shopping_cart"
                class="text-h4 text-orange q-mb-xs"
              />
              <div class="text-h4 text-dark text-weight-bold">
                {{ dashboardStats.needReorder }}
              </div>
              <div class="text-body2 text-dark opacity-80">Need Reorder</div>
            </q-card-section>
          </q-card>

          <!-- Last Updated Card -->
          <q-card class="glass-card stat-card text-center">
            <q-card-section class="q-pa-md">
              <q-icon name="schedule" class="text-h4 text-grey-6 q-mb-xs" />
              <div class="text-h6 text-dark text-weight-bold">
                {{ formatLastUpdated(inventoryStore.stats?.lastUpdated) }}
              </div>
              <div class="text-body2 text-dark opacity-80">Last Updated</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Controls -->
      <div
        class="controls-section glass-card q-pa-md q-mb-md"
        data-aos="fade-up"
        data-aos-delay="200"
      >
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="row q-gutter-md items-center">
              <!-- Search -->
              <div class="col-auto">
                <q-input
                  v-model="searchQuery"
                  @update:model-value="handleSearch"
                  filled
                  placeholder="Search inventory (SKU, name, description)..."
                  class="search-input"
                  style="min-width: 300px;"
                  debounce="500"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" class="text-dark" />
                  </template>
                </q-input>
              </div>

              <!-- Category Filter -->
              <div class="col-auto">
                <q-select
                  v-model="selectedCategory"
                  @update:model-value="handleSearch"
                  :options="availableCategories"
                  option-value="_id"
                  option-label="name"
                  emit-value
                  map-options
                  filled
                  label="Category"
                  class="category-select"
                  style="min-width: 180px;"
                >
                  <template v-slot:prepend>
                    <q-icon name="category" class="text-dark" />
                  </template>
                </q-select>
              </div>

              <!-- Low Stock Filter -->
              <div class="col-auto">
                <q-checkbox
                  v-model="showLowStockOnly"
                  @update:model-value="handleLowStockToggle"
                  label="Low Stock Only"
                  class="text-dark"
                  color="warning"
                />
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="col-auto">
            <div class="row q-gutter-sm">
              <q-btn
                @click="
                  () => inventoryTableRef?.refreshInventory(getCurrentFilters())
                "
                :loading="inventoryStore.isLoading"
                color="primary"
                icon="refresh"
                label="Refresh Data"
                class="action-btn"
                no-caps
              />
              <q-btn
                v-if="authStore.canWrite"
                @click="handleQuickScan"
                color="purple"
                icon="qr_code_scanner"
                label="Scan Items"
                class="action-btn"
                no-caps
              />
              <q-btn
                v-if="authStore.canWrite"
                @click="handleAddItem"
                :loading="inventoryStore.isCreating"
                color="positive"
                icon="add"
                label="Add Item"
                class="action-btn"
                no-caps
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div
        class="tabs-section glass-card q-mb-lg"
        data-aos="fade-up"
        data-aos-delay="300"
      >
        <q-tabs
          v-model="activeFilter"
          @update:model-value="handleFilterClick"
          class="custom-tabs"
          indicator-color="primary"
          align="left"
        >
          <q-tab
            v-for="filter in availableFilters"
            :key="filter.value"
            :name="filter.value"
            :label="filter.label"
            class="tab-item"
          >
            <q-badge
              v-if="
                filter.value !== 'all' &&
                dashboardStats[filter.value.replace('_', '')] > 0
              "
              :color="
                filter.value === 'out_of_stock'
                  ? 'negative'
                  : filter.value === 'low_stock'
                  ? 'warning'
                  : 'primary'
              "
              floating
              rounded
            >
              {{ dashboardStats[filter.value.replace("_", "")] || 0 }}
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
      <div
        v-if="inventoryStore.isLoading"
        class="loading-container glass-card q-pa-xl text-center"
      >
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-h6 text-dark q-mt-md">Loading inventory...</div>
      </div>

      <!-- Inventory Table -->
      <div
        v-else
        class="table-container glass-card"
        data-aos="fade-up"
        data-aos-delay="400"
      >
        <InventoryTable
          ref="inventoryTableRef"
          :can-write="authStore.canWrite"
          :filters="{ sort_by: 'sku_code', sort_order: 'asc' }"
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
      v-model="showEditModal"
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
.dashboard-page {
  min-height: 100vh;
}

.container {
  width: 95%;
  margin: 0 2.5%;
  max-width: none;
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
  transform: translateY(-5px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Welcome Section */
.welcome-section {
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 12px 40px rgba(103, 126, 234, 0.2);
  }
}

/* Logo */
.logo-image {
  height: 60px;
  width: auto;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  transition: all 0.3s ease;
}

.logo-image:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
}

/* Stats Cards Container */
.stats-cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-evenly;
}

.stats-cards-container > * {
  flex: 1;
  min-width: 200px;
  max-width: 280px;
}

/* Stats Cards */
.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
  transform: scale(1.02);
}

/* Total Value Card Special Styling */
.total-value-card {
  background: linear-gradient(
    135deg,
    rgba(255, 193, 7, 0.15),
    rgba(255, 152, 0, 0.15)
  );
  border: 2px solid rgba(255, 193, 7, 0.3);
}

.total-value-card:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 193, 7, 0.25),
    rgba(255, 152, 0, 0.25)
  );
  border-color: rgba(255, 193, 7, 0.5);
  box-shadow: 0 12px 40px rgba(255, 193, 7, 0.2);
}

/* Reserved Card Special Styling */
.reserved-card {
  background: linear-gradient(
    135deg,
    rgba(0, 123, 255, 0.15),
    rgba(0, 86, 179, 0.15)
  );
  border: 2px solid rgba(0, 123, 255, 0.3);
}

.reserved-card:hover {
  background: linear-gradient(
    135deg,
    rgba(0, 123, 255, 0.25),
    rgba(0, 86, 179, 0.25)
  );
  border-color: rgba(0, 123, 255, 0.5);
  box-shadow: 0 12px 40px rgba(0, 123, 255, 0.2);
}

/* Imperfect Card Special Styling */
.imperfect-card {
  background: linear-gradient(
    135deg,
    rgba(255, 193, 7, 0.15),
    rgba(255, 152, 0, 0.15)
  );
  border: 2px solid rgba(255, 152, 0, 0.3);
}

.imperfect-card:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 193, 7, 0.25),
    rgba(255, 152, 0, 0.25)
  );
  border-color: rgba(255, 152, 0, 0.5);
  box-shadow: 0 12px 40px rgba(255, 152, 0, 0.2);
}

/* Broken Card Special Styling */
.broken-card {
  background: linear-gradient(
    135deg,
    rgba(220, 53, 69, 0.15),
    rgba(176, 42, 55, 0.15)
  );
  border: 2px solid rgba(220, 53, 69, 0.3);
}

.broken-card:hover {
  background: linear-gradient(
    135deg,
    rgba(220, 53, 69, 0.25),
    rgba(176, 42, 55, 0.25)
  );
  border-color: rgba(220, 53, 69, 0.5);
  box-shadow: 0 12px 40px rgba(220, 53, 69, 0.2);
}

/* SKU Card Special Styling */
.sku-card {
  background: linear-gradient(
    135deg,
    rgba(0, 150, 136, 0.15),
    rgba(0, 121, 107, 0.15)
  );
  border: 2px solid rgba(0, 150, 136, 0.3);
}

.sku-card:hover {
  background: linear-gradient(
    135deg,
    rgba(0, 150, 136, 0.25),
    rgba(0, 121, 107, 0.25)
  );
  border-color: rgba(0, 150, 136, 0.5);
  box-shadow: 0 12px 40px rgba(0, 150, 136, 0.2);
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

.custom-tabs :deep(.q-tabs__content) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
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

.table-container :deep(.q-table__top) {
  background: rgba(255, 255, 255, 0.05);
  padding: 16px 20px;
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

/* Opacity classes */
.opacity-80 {
  opacity: 0.8;
}

/* Responsive adjustments */
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
