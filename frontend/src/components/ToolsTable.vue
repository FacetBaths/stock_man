<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToolsStore, type ToolInventoryItem } from '@/stores/tools'
import { capitalizeWords } from '../utils/formatting'

interface Props {
  canWrite: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const toolsStore = useToolsStore()

const emit = defineEmits<{
  edit: [tool: ToolInventoryItem]
  delete: [tool: ToolInventoryItem]
}>()

// Component state
const showConditionDialog = ref(false)
const selectedTool = ref<ToolInventoryItem | null>(null)

// Search and filtering state
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedCondition = ref('')
const selectedType = ref('')
const sortBy = ref('name')
const sortDescending = ref(false)

// Show/hide states for filter dropdowns
const showCategoryFilter = ref(false)
const showTypeFilter = ref(false)
const showConditionFilter = ref(false)
const showSortFilter = ref(false)

// Load tools inventory on component mount
onMounted(async () => {
  console.log('ToolsTable: Component mounted, fetching tools inventory...')
  try {
    await toolsStore.fetchToolsInventory()
    console.log('✅ Tools inventory fetched successfully')
  } catch (error) {
    console.error('❌ Failed to fetch tools inventory:', error)
  }
})

// Get unique filter options from tools data
const categoryOptions = computed(() => {
  if (!Array.isArray(toolsStore.toolsInventory)) return ['']
  const categories = toolsStore.toolsInventory.map(tool => tool.category?.name).filter(Boolean)
  return ['', ...new Set(categories)].sort()
})

const typeOptions = computed(() => {
  if (!Array.isArray(toolsStore.toolsInventory)) return ['']
  const types = toolsStore.toolsInventory.map(tool => tool.details?.tool_type).filter(Boolean)
  return ['', ...new Set(types)].sort()
})

const conditionOptions = ['', 'available', 'loaned', 'maintenance', 'mixed']

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'SKU Code', value: 'sku_code' },
  { label: 'Brand', value: 'brand' },
  { label: 'Total Quantity', value: 'total_quantity' },
  { label: 'Available Quantity', value: 'available_quantity' },
  { label: 'Cost', value: 'unit_cost' }
]

// Apply local filtering and searching
const filteredTools = computed(() => {
  // Safety check - ensure tools is an array
  if (!Array.isArray(toolsStore.toolsInventory)) {
    return []
  }
  
  let filtered = [...toolsStore.toolsInventory]
  
  // Apply search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(tool => 
      tool.name.toLowerCase().includes(query) ||
      tool.sku_code.toLowerCase().includes(query) ||
      tool.brand?.toLowerCase().includes(query) ||
      tool.model?.toLowerCase().includes(query) ||
      tool.details?.manufacturer?.toLowerCase().includes(query) ||
      tool.details?.serial_number?.toLowerCase().includes(query) ||
      tool.category?.name.toLowerCase().includes(query)
    )
  }
  
  // Apply category filter
  if (selectedCategory.value) {
    filtered = filtered.filter(tool => tool.category?.name === selectedCategory.value)
  }
  
  // Apply type filter
  if (selectedType.value) {
    filtered = filtered.filter(tool => tool.details?.tool_type === selectedType.value)
  }
  
  // Apply condition filter
  if (selectedCondition.value) {
    filtered = filtered.filter(tool => {
      const status = toolsStore.getConditionStatus(tool)
      return status === selectedCondition.value
    })
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    let aVal = a[sortBy.value as keyof ToolInventoryItem]
    let bVal = b[sortBy.value as keyof ToolInventoryItem]
    
    // Handle nested properties
    if (sortBy.value.includes('.')) {
      const keys = sortBy.value.split('.')
      aVal = keys.reduce((obj, key) => obj?.[key], a)
      bVal = keys.reduce((obj, key) => obj?.[key], b)
    }
    
    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = ''
    if (bVal === null || bVal === undefined) bVal = ''
    
    // Convert to comparable values
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    let result = 0
    if (aVal < bVal) result = -1
    else if (aVal > bVal) result = 1
    
    return sortDescending.value ? -result : result
  })
  
  return filtered
})

// Clear all filters
const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedCondition.value = ''
  selectedType.value = ''
  sortBy.value = 'name'
  sortDescending.value = false
  // Close all filter dropdowns
  showCategoryFilter.value = false
  showTypeFilter.value = false
  showConditionFilter.value = false
  showSortFilter.value = false
}

// Helper functions
const formatCost = (cost?: number) => {
  if (cost === undefined || cost === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cost)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const getConditionColor = (tool: ToolInventoryItem) => {
  const status = toolsStore.getConditionStatus(tool)
  switch (status) {
    case 'available':
      return 'positive'
    case 'loaned':
      return 'purple'
    case 'maintenance':
      return 'negative'
    case 'mixed':
      return 'warning'
    default:
      return 'grey'
  }
}

const getConditionIcon = (tool: ToolInventoryItem) => {
  const status = toolsStore.getConditionStatus(tool)
  switch (status) {
    case 'available':
      return 'check_circle'
    case 'loaned':
      return 'person'
    case 'maintenance':
      return 'build'
    case 'mixed':
      return 'info'
    default:
      return 'help'
  }
}

const getToolTypeColor = (toolType: string) => {
  const colorMap: { [key: string]: string } = {
    'power tool': 'primary',
    'hand tool': 'positive',
    'measuring tool': 'info',
    'safety equipment': 'warning',
    'cutting tool': 'deep-orange',
    'general': 'brown',
    'electrical': 'purple',
    'plumbing': 'blue',
    'stand or clamp': 'cyan',
    'finishing tool': 'amber'
  }
  return colorMap[toolType?.toLowerCase()] || 'grey'
}

const formatFeatures = (features: string[]) => {
  if (!features || features.length === 0) return 'No features listed'
  if (features.length <= 2) return features.join(', ')
  return `${features.slice(0, 2).join(', ')} +${features.length - 2} more`
}

const getVoltageDisplay = (voltage?: string) => {
  if (!voltage) return 'N/A'
  if (voltage === '0V' || voltage === '0' || voltage === 'N/A') return 'Manual/Battery'
  return voltage
}

// Check if user can view cost information
const canViewCost = computed(() =>
  authStore.hasPermission('view_cost') || authStore.hasRole(['admin', 'warehouse_manager'])
)

// Check if user can delete tools
const canDelete = computed(() =>
  authStore.hasPermission('delete_item') || authStore.hasRole(['admin', 'warehouse_manager'])
)

// Handle condition status click to show details
const handleConditionClick = (tool: ToolInventoryItem) => {
  selectedTool.value = tool
  showConditionDialog.value = true
}
</script>

<template>
  <div class="tools-table-container">
    <!-- Section Header -->
    <div class="section-header q-mb-lg">
      <div class="row items-center">
        <q-icon
          name="inventory"
          size="32px"
          class="text-primary q-mr-md"
        />
        <div>
          <h5 class="text-h5 q-ma-none text-weight-bold">
            Tool Inventory
          </h5>
          <p class="text-body2 q-ma-none text-grey-7">
            Manage and track all your tools with real-time inventory status
          </p>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="toolsStore.loading" class="loading-container">
      <q-spinner-hourglass size="50px" color="primary" />
      <div class="q-mt-md text-body1">Loading tools inventory...</div>
    </div>

    <!-- Search and Filter Controls (always show when not loading) -->
    <div v-if="!toolsStore.loading" class="search-filter-section glass-card q-pa-md q-mb-md">
      <div class="row q-gutter-md responsive-filters">
        <!-- Search Input -->
        <div class="col-12 col-md-4">
          <q-input
            v-model="searchQuery"
            placeholder="Search tools..."
            outlined
            dense
            clearable
            class="search-input"
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
        
        <!-- Category Filter -->
        <div class="col-auto">
          <q-btn
            @click="showCategoryFilter = !showCategoryFilter"
            :color="selectedCategory ? 'primary' : 'grey-7'"
            :label="selectedCategory ? capitalizeWords(selectedCategory) : 'Category'"
            flat
            icon="category"
            class="filter-btn"
            size="sm"
          >
            <q-menu v-model="showCategoryFilter" anchor="bottom left" self="top left">
              <q-list style="min-width: 180px">
                <q-item
                  v-for="cat in categoryOptions"
                  :key="cat"
                  clickable
                  @click="selectedCategory = cat; showCategoryFilter = false"
                  :active="selectedCategory === cat"
                >
                  <q-item-section>
                    {{ cat ? capitalizeWords(cat) : 'All Categories' }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        
        <!-- Type Filter -->
        <div class="col-auto">
          <q-btn
            @click="showTypeFilter = !showTypeFilter"
            :color="selectedType ? 'primary' : 'grey-7'"
            :label="selectedType || 'Type'"
            flat
            icon="build"
            class="filter-btn"
            size="sm"
          >
            <q-menu v-model="showTypeFilter" anchor="bottom left" self="top left">
              <q-list style="min-width: 180px">
                <q-item
                  v-for="type in typeOptions"
                  :key="type"
                  clickable
                  @click="selectedType = type; showTypeFilter = false"
                  :active="selectedType === type"
                >
                  <q-item-section>
                    {{ type || 'All Types' }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        
        <!-- Condition Filter -->
        <div class="col-auto">
          <q-btn
            @click="showConditionFilter = !showConditionFilter"
            :color="selectedCondition ? 'primary' : 'grey-7'"
            :label="selectedCondition ? selectedCondition.charAt(0).toUpperCase() + selectedCondition.slice(1) : 'Condition'"
            flat
            icon="assignment_turned_in"
            class="filter-btn"
            size="sm"
          >
            <q-menu v-model="showConditionFilter" anchor="bottom left" self="top left">
              <q-list style="min-width: 180px">
                <q-item
                  v-for="cond in conditionOptions"
                  :key="cond"
                  clickable
                  @click="selectedCondition = cond; showConditionFilter = false"
                  :active="selectedCondition === cond"
                >
                  <q-item-section>
                    {{ cond ? cond.charAt(0).toUpperCase() + cond.slice(1) : 'All Conditions' }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        
        <!-- Sort Options -->
        <div class="col-auto">
          <q-btn
            @click="showSortFilter = !showSortFilter"
            :color="sortBy !== 'name' || sortDescending ? 'primary' : 'grey-7'"
            :label="sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort'"
            flat
            :icon="sortDescending ? 'arrow_downward' : 'arrow_upward'"
            class="filter-btn"
            size="sm"
          >
            <q-menu v-model="showSortFilter" anchor="bottom left" self="top left">
              <q-list style="min-width: 200px">
                <q-item-label header>Sort By</q-item-label>
                <q-item
                  v-for="option in sortOptions"
                  :key="option.value"
                  clickable
                  @click="sortBy = option.value; showSortFilter = false"
                  :active="sortBy === option.value"
                >
                  <q-item-section>
                    {{ option.label }}
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item-label header>Order</q-item-label>
                <q-item
                  clickable
                  @click="sortDescending = false; showSortFilter = false"
                  :active="!sortDescending"
                >
                  <q-item-section avatar>
                    <q-icon name="arrow_upward" />
                  </q-item-section>
                  <q-item-section>Ascending</q-item-section>
                </q-item>
                <q-item
                  clickable
                  @click="sortDescending = true; showSortFilter = false"
                  :active="sortDescending"
                >
                  <q-item-section avatar>
                    <q-icon name="arrow_downward" />
                  </q-item-section>
                  <q-item-section>Descending</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>
      
      <!-- Filter Actions -->
      <div class="row q-mt-md justify-between items-center">
        <div class="text-body2 text-grey-7">
          Showing {{ filteredTools.length }} of {{ Array.isArray(toolsStore.toolsInventory) ? toolsStore.toolsInventory.length : 0 }} tools
        </div>
        <q-btn
          @click="clearFilters"
          color="primary"
          outline
          size="sm"
          icon="clear_all"
          label="Clear Filters"
        />
      </div>
    </div>

    <!-- No tools banner -->
    <q-banner
      v-if="!toolsStore.loading && filteredTools.length === 0"
      class="no-tools-banner"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="build" color="grey-6" />
      </template>
      No tools found matching your criteria.
    </q-banner>

    <!-- Tools List -->
    <div v-if="!toolsStore.loading && filteredTools.length > 0">
      <!-- Tools Cards -->
      <div class="tools-cards-container">

        <!-- Individual Tool Cards -->
        <div class="tools-list">
          <div
            v-for="tool in filteredTools"
            :key="tool._id"
            class="tool-item"
            @click="canWrite ? emit('edit', tool) : null"
            :style="{ cursor: canWrite ? 'pointer' : 'default' }"
          >
          <div class="item-row">
            <!-- Tool Details Section -->
            <div class="item-section tool-details-section">
              <div
                v-if="tool.details && tool.details.tool_type"
                class="tool-type-banner"
                :class="`type-banner-${getToolTypeColor(
                  tool.details.tool_type
                )}`"
              >
                {{ tool.details.tool_type.toUpperCase() }}
              </div>
              <div class="tool-title">
                {{ tool.name }}
              </div>
              <div class="tool-brand-model">
                <span v-if="tool.brand" class="brand">{{ tool.brand }}</span>
                <span v-if="tool.model" class="model">{{ tool.model }}</span>
              </div>
              <div v-if="tool.details && tool.details.manufacturer" class="manufacturer">
                <q-icon name="business" size="xs" class="q-mr-xs" />
                {{ tool.details.manufacturer }}
              </div>
            </div>

            <!-- SKU Section -->
            <div class="item-section sku-section">
              <q-chip
                color="primary"
                text-color="white"
                size="sm"
                :label="tool.sku_code"
                class="sku-chip"
                icon="qr_code"
              >
                <q-tooltip>SKU Code</q-tooltip>
              </q-chip>
              <div v-if="tool.details && tool.details.serial_number" class="serial-number">
                <q-icon name="tag" size="xs" class="q-mr-xs" />
                <span class="serial-text">{{
                  tool.details.serial_number
                }}</span>
              </div>
            </div>

            <!-- Specifications Section -->
            <div class="item-section specifications-section">
              <div v-if="tool.details && tool.details.voltage" class="voltage">
                <q-chip
                  :color="tool.details.voltage === 'N/A' ? 'grey' : 'amber'"
                  text-color="white"
                  size="sm"
                  :label="getVoltageDisplay(tool.details.voltage)"
                  icon="flash_on"
                  class="voltage-chip"
                >
                  <q-tooltip>Operating Voltage</q-tooltip>
                </q-chip>
              </div>
              <div
                v-if="tool.details && tool.details.features && tool.details.features.length > 0"
                class="features"
              >
                <div class="features-text">
                  <q-icon name="stars" size="xs" class="q-mr-xs" />
                  {{ formatFeatures(tool.details.features) }}
                </div>
              </div>
            </div>

            <!-- Quantity Section -->
            <div class="item-section quantity-section">
              <div class="quantity-display">
                <q-badge
                  :color="tool.total_quantity > 0 ? 'primary' : 'negative'"
                  :label="`  ${tool.available_quantity} Available`"
                  class="total-quantity-badge"
                />
                <div v-if="tool.total_quantity > 0" class="quantity-breakdown">
                  <div class="breakdown-text">
                    {{ tool.total_quantity }} Total
                    <span v-if="tool.loaned_quantity > 0">
                      • {{ tool.loaned_quantity }} Loaned</span
                    >
                    <span v-if="tool.reserved_quantity > 0">
                      • {{ tool.reserved_quantity }} Reserved</span
                    >
                    <span v-if="tool.broken_quantity > 0">
                      • {{ tool.broken_quantity }} Maintenance</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Condition Status Section -->
            <div class="item-section condition-section">
              <q-chip
                :color="getConditionColor(tool)"
                text-color="white"
                size="sm"
                :icon="getConditionIcon(tool)"
                :label="
                  toolsStore
                    .getConditionStatus(tool)
                    .replace('_', ' ')
                    .toUpperCase()
                "
                class="condition-chip clickable"
                clickable
                @click.stop="handleConditionClick(tool)"
              >
                <q-tooltip>Click to view condition details</q-tooltip>
              </q-chip>
            </div>

            <!-- Cost Section (if user can view cost) -->
            <div v-if="canViewCost" class="item-section cost-section">
              <div class="cost-label">{{ formatCost(tool.unit_cost) }}</div>
              <div class="total-value-label">
                Total: {{ formatCost(tool.unit_cost * tool.total_quantity) }}
              </div>
            </div>

            <!-- Actions Section -->
            <div v-if="canWrite" class="item-section actions-section">
              <div class="action-buttons">
                <q-btn
                  @click.stop="emit('edit', tool)"
                  color="primary"
                  icon="edit"
                  size="sm"
                  round
                  flat
                  class="action-btn"
                >
                  <q-tooltip>Edit tool</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="canDelete"
                  @click.stop="emit('delete', tool)"
                  color="negative"
                  icon="delete"
                  size="sm"
                  round
                  flat
                  class="action-btn"
                >
                  <q-tooltip>Delete tool</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Condition Details Dialog -->
    <q-dialog v-model="showConditionDialog" persistent>
      <q-card class="condition-dialog" style="min-width: 500px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Tool Condition Details</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="selectedTool">
          <!-- Tool Summary -->
          <div class="q-mb-md">
            <div class="text-subtitle1 text-weight-bold">
              {{ selectedTool.name }}
            </div>
            <div class="text-body2 text-grey-7">
              {{ selectedTool.brand }} {{ selectedTool.model }} ({{
                selectedTool.sku_code
              }})
            </div>
          </div>

          <!-- Condition Summary -->
          <div class="condition-summary q-mb-md">
            <q-separator class="q-mb-md" />
            <div class="text-subtitle2 q-mb-md">Inventory Status:</div>
            <div class="row q-gutter-md">
              <div class="col">
                <div class="text-body2 text-grey-7">Total Quantity</div>
                <div class="text-h6">{{ selectedTool.total_quantity }}</div>
              </div>
              <div class="col">
                <div class="text-body2 text-grey-7">Available</div>
                <div class="text-h6 text-positive">
                  {{ selectedTool.available_quantity }}
                </div>
              </div>
              <div class="col" v-if="selectedTool.loaned_quantity > 0">
                <div class="text-body2 text-grey-7">Checked Out</div>
                <div class="text-h6 text-purple">
                  {{ selectedTool.loaned_quantity }}
                </div>
              </div>
              <div class="col" v-if="selectedTool.reserved_quantity > 0">
                <div class="text-body2 text-grey-7">Reserved</div>
                <div class="text-h6 text-info">
                  {{ selectedTool.reserved_quantity }}
                </div>
              </div>
              <div class="col" v-if="selectedTool.broken_quantity > 0">
                <div class="text-body2 text-grey-7">Maintenance</div>
                <div class="text-h6 text-negative">
                  {{ selectedTool.broken_quantity }}
                </div>
              </div>
            </div>
          </div>

          <!-- Tool Details -->
          <div class="tool-details q-mb-md">
            <q-separator class="q-mb-md" />
            <div class="text-subtitle2 q-mb-md">Tool Information:</div>
            <div class="row q-gutter-md">
              <div class="col-12">
                <div class="text-body2">
                  <strong>Type:</strong>
                  {{ selectedTool.details.tool_type || "Not specified" }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.manufacturer">
                <div class="text-body2">
                  <strong>Manufacturer:</strong>
                  {{ selectedTool.details.manufacturer }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.serial_number">
                <div class="text-body2">
                  <strong>Serial Number:</strong>
                  {{ selectedTool.details.serial_number }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.voltage">
                <div class="text-body2">
                  <strong>Voltage:</strong>
                  {{ getVoltageDisplay(selectedTool.details.voltage) }}
                </div>
              </div>
              <div
                class="col-12"
                v-if="
                  selectedTool.details.features &&
                  selectedTool.details.features.length > 0
                "
              >
                <div class="text-body2">
                  <strong>Features:</strong>
                  {{ selectedTool.details.features.join(", ") }}
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
/* Container Styling */
.tools-table-container {
  background: transparent;
  border-radius: 20px;
  overflow: hidden;
  width: 100%;
}

/* Section Header */
.section-header h5 {
  color: rgba(33, 37, 41, 0.9);
}

.section-header p {
  color: rgba(33, 37, 41, 0.7);
}

/* Search Input */
.search-input {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgba(33, 37, 41, 0.7);
}

/* No Tools Banner */
.no-tools-banner {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(33, 37, 41, 0.7);
}

/* Search and Filter Section */
.search-filter-section {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  margin-bottom: 16px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Filter Button Styling */
.filter-btn {
  min-width: 80px;
  text-transform: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

/* Tools Cards Container */
.tools-cards-container {
  background: transparent;
}

/* Tools List Container */
.tools-list {
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-item {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 16px;
  transition: all 0.3s ease;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.tool-item:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 20px;
}

.item-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 100px;
  padding: 0 12px;
}

.tool-details-section {
  flex: 1 1 auto;
  max-width: 320px;
  padding-right: 16px;
}

.specifications-section {
  flex: 1 1 auto;
  max-width: 200px;
}

/* Tool Details */
.tool-type-banner {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 10px;
  color: white;
  margin-bottom: 8px;
  display: inline-block;
  background: var(--q-primary);
}

.tool-title {
  font-weight: 700;
  font-size: 18px;
  color: rgba(33, 37, 41, 0.95);
  margin-bottom: 6px;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.tool-brand-model {
  font-size: 15px;
  color: rgba(33, 37, 41, 0.75);
  margin-bottom: 8px;
  font-weight: 500;
}

.brand {
  font-weight: 500;
}

.model {
  margin-left: 6px;
  font-style: italic;
}

.manufacturer {
  font-size: 13px;
  color: rgba(33, 37, 41, 0.65);
  display: flex;
  align-items: center;
  margin-top: 2px;
}

/* SKU Section */
.sku-section {
  text-align: center;
}

.sku-chip {
  margin-bottom: 8px;
  font-weight: 600;
}

.serial-number {
  font-size: 12px;
  color: rgba(33, 37, 41, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.serial-text {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-weight: 500;
  font-size: 11px;
}

/* Specifications */
.specifications-section {
  text-align: center;
}

.voltage-chip {
  margin-bottom: 8px;
  font-weight: 600;
}

.features {
  font-size: 12px;
  color: rgba(33, 37, 41, 0.7);
}

.features-text {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* Quantity Section */
.quantity-display {
  text-align: center;
}

.total-quantity-badge {
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
}

.quantity-breakdown {
  font-size: 12px;
  color: rgba(33, 37, 41, 0.65);
  line-height: 1.4;
  text-align: center;
}

/* Condition Section */
.condition-section {
  text-align: center;
}

.condition-chip {
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.condition-chip:hover {
  transform: scale(1.05);
}

/* Cost Section */
.cost-section {
  text-align: center;
}

.cost-label {
  font-weight: 700;
  font-size: 18px;
  color: rgba(33, 37, 41, 0.95);
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}

.total-value-label {
  font-size: 13px;
  color: rgba(33, 37, 41, 0.65);
  font-weight: 500;
}

/* Actions Section */
.actions-section {
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.action-btn {
  transition: all 0.2s ease;
  padding: 8px;
}

.action-btn:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Dialog Styling */
.condition-dialog {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
}

.condition-summary,
.tool-details {
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Responsive Design */
@media (max-width: 1200px) {
  .header-section,
  .item-section {
    min-width: 60px;
  }

  .tool-details-section {
    max-width: 250px;
  }

  .specifications-section {
    max-width: 150px;
  }
  
  .filter-btn {
    min-width: 70px;
    padding: 6px 10px;
    font-size: 12px;
  }
}

@media (max-width: 768px) {
  .responsive-filters {
    flex-direction: column !important;
    gap: 8px !important;
  }
  
  .responsive-filters > div {
    width: 100% !important;
  }
  
  .filter-btn {
    width: 100%;
    justify-content: space-between;
    min-width: auto;
  }
  
  .header-row,
  .item-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-section,
  .item-section {
    flex: 1 1 auto;
    min-width: 120px;
  }

  .tool-item {
    padding: 12px;
  }
  
  .search-filter-section {
    padding: 12px !important;
  }
}
</style>
