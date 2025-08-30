<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToolsStore, type ToolInventoryItem } from '@/stores/tools'

interface Props {
  canWrite: boolean
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const toolsStore = useToolsStore()

const emit = defineEmits<{
  edit: [tool: ToolInventoryItem]
}>()

// Component state
const showConditionDialog = ref(false)
const selectedTool = ref<ToolInventoryItem | null>(null)

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

// Use tools from store with local filtering
const filteredTools = computed(() => toolsStore.filteredTools)

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
    'fastener': 'brown',
    'electrical': 'purple',
    'plumbing': 'blue',
    'pneumatic': 'cyan',
    'hydraulic': 'amber'
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

// Handle condition status click to show details
const handleConditionClick = (tool: ToolInventoryItem) => {
  selectedTool.value = tool
  showConditionDialog.value = true
}
</script>

<template>
  <div class="tools-table-container">
    <!-- Loading state -->
    <div v-if="toolsStore.loading" class="loading-container">
      <q-spinner-hourglass size="50px" color="primary" />
      <div class="q-mt-md text-body1">Loading tools inventory...</div>
    </div>

    <!-- No tools banner -->
    <q-banner v-else-if="filteredTools.length === 0" class="no-tools-banner" rounded>
      <template v-slot:avatar>
        <q-icon name="build" color="grey-6" />
      </template>
      No tools found matching your criteria.
    </q-banner>
    
    <div v-else>
      <!-- Header Section -->
      <div class="table-header glass-header q-pa-md q-mb-sm">
        <div class="header-row">
          <div class="header-section tool-details-header">
            <q-icon name="build" class="q-mr-xs" />
            Tool Details
          </div>
          <div class="header-section sku-header">
            <q-icon name="qr_code" class="q-mr-xs" />
            SKU
          </div>
          <div class="header-section specifications-header">
            <q-icon name="settings" class="q-mr-xs" />
            Specifications
          </div>
          <div class="header-section quantity-header">
            <q-icon name="inventory" class="q-mr-xs" />
            Quantity
          </div>
          <div class="header-section condition-header">
            <q-icon name="assignment_turned_in" class="q-mr-xs" />
            Condition
          </div>
          <div v-if="canViewCost" class="header-section cost-header">
            <q-icon name="attach_money" class="q-mr-xs" />
            Cost
          </div>
          <div v-if="canWrite" class="header-section actions-header">
            <q-icon name="settings" class="q-mr-xs" />
            Actions
          </div>
        </div>
      </div>
      
      <!-- Tools List -->
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
              <div v-if="tool.details.tool_type" class="tool-type-banner" :class="`type-banner-${getToolTypeColor(tool.details.tool_type)}`">
                {{ tool.details.tool_type.toUpperCase() }}
              </div>
              <div class="tool-title">
                {{ tool.name }}
              </div>
              <div class="tool-brand-model">
                <span v-if="tool.brand" class="brand">{{ tool.brand }}</span>
                <span v-if="tool.model" class="model">{{ tool.model }}</span>
              </div>
              <div v-if="tool.details.manufacturer" class="manufacturer">
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
              <div v-if="tool.details.serial_number" class="serial-number">
                <q-icon name="tag" size="xs" class="q-mr-xs" />
                <span class="serial-text">{{ tool.details.serial_number }}</span>
              </div>
            </div>

            <!-- Specifications Section -->
            <div class="item-section specifications-section">
              <div v-if="tool.details.voltage" class="voltage">
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
              <div v-if="tool.details.features && tool.details.features.length > 0" class="features">
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
                  :label="`${tool.total_quantity} Total`"
                  class="total-quantity-badge"
                />
                <div v-if="tool.total_quantity > 0" class="quantity-breakdown">
                  <div class="breakdown-text">
                    {{ tool.available_quantity }} Available
                    <span v-if="tool.loaned_quantity > 0"> • {{ tool.loaned_quantity }} Loaned</span>
                    <span v-if="tool.reserved_quantity > 0"> • {{ tool.reserved_quantity }} Reserved</span>
                    <span v-if="tool.broken_quantity > 0"> • {{ tool.broken_quantity }} Maintenance</span>
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
                :label="toolsStore.getConditionStatus(tool).replace('_', ' ').toUpperCase()"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Condition Details Dialog -->
    <q-dialog v-model="showConditionDialog" persistent>
      <q-card class="condition-dialog" style="min-width: 500px">
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
              {{ selectedTool.brand }} {{ selectedTool.model }} ({{ selectedTool.sku_code }})
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
                <div class="text-h6 text-positive">{{ selectedTool.available_quantity }}</div>
              </div>
              <div class="col" v-if="selectedTool.loaned_quantity > 0">
                <div class="text-body2 text-grey-7">Loaned Out</div>
                <div class="text-h6 text-purple">{{ selectedTool.loaned_quantity }}</div>
              </div>
              <div class="col" v-if="selectedTool.reserved_quantity > 0">
                <div class="text-body2 text-grey-7">Reserved</div>
                <div class="text-h6 text-info">{{ selectedTool.reserved_quantity }}</div>
              </div>
              <div class="col" v-if="selectedTool.broken_quantity > 0">
                <div class="text-body2 text-grey-7">Maintenance</div>
                <div class="text-h6 text-negative">{{ selectedTool.broken_quantity }}</div>
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
                  <strong>Type:</strong> {{ selectedTool.details.tool_type || 'Not specified' }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.manufacturer">
                <div class="text-body2">
                  <strong>Manufacturer:</strong> {{ selectedTool.details.manufacturer }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.serial_number">
                <div class="text-body2">
                  <strong>Serial Number:</strong> {{ selectedTool.details.serial_number }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.voltage">
                <div class="text-body2">
                  <strong>Voltage:</strong> {{ getVoltageDisplay(selectedTool.details.voltage) }}
                </div>
              </div>
              <div class="col-12" v-if="selectedTool.details.features && selectedTool.details.features.length > 0">
                <div class="text-body2">
                  <strong>Features:</strong> {{ selectedTool.details.features.join(', ') }}
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

/* Header Section */
.table-header {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  margin-bottom: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 10px;
}

.header-section {
  color: rgba(33, 37, 41, 0.8);
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 80px;
}

.tool-details-header {
  flex: 1 1 auto;
  justify-content: flex-start;
  max-width: 300px;
}

.specifications-header {
  flex: 1 1 auto;
  max-width: 200px;
}

/* Tool Item Styling */
.tools-list {
  background: transparent;
}

.tool-item {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 12px;
  transition: all 0.3s ease;
  padding: 16px;
}

.tool-item:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 10px;
}

.item-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 80px;
  padding: 0 8px;
}

.tool-details-section {
  flex: 1 1 auto;
  max-width: 300px;
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
  font-weight: 600;
  font-size: 16px;
  color: rgba(33, 37, 41, 0.9);
  margin-bottom: 4px;
  line-height: 1.2;
}

.tool-brand-model {
  font-size: 14px;
  color: rgba(33, 37, 41, 0.7);
  margin-bottom: 4px;
}

.brand {
  font-weight: 500;
}

.model {
  margin-left: 6px;
  font-style: italic;
}

.manufacturer {
  font-size: 12px;
  color: rgba(33, 37, 41, 0.6);
  display: flex;
  align-items: center;
}

/* SKU Section */
.sku-chip {
  margin-bottom: 6px;
}

.serial-number {
  font-size: 11px;
  color: rgba(33, 37, 41, 0.6);
  display: flex;
  align-items: center;
}

.serial-text {
  font-family: monospace;
  font-weight: 500;
}

/* Specifications */
.voltage-chip {
  margin-bottom: 6px;
}

.features {
  font-size: 11px;
  color: rgba(33, 37, 41, 0.7);
}

.features-text {
  display: flex;
  align-items: center;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Quantity Section */
.quantity-display {
  text-align: center;
}

.total-quantity-badge {
  margin-bottom: 6px;
}

.quantity-breakdown {
  font-size: 11px;
  color: rgba(33, 37, 41, 0.6);
  line-height: 1.3;
  text-align: center;
}

/* Condition Section */
.condition-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.condition-chip:hover {
  transform: scale(1.05);
}

/* Cost Section */
.cost-section {
  text-align: center;
}

.cost-label {
  font-weight: 600;
  font-size: 16px;
  color: rgba(33, 37, 41, 0.9);
  margin-bottom: 4px;
}

.total-value-label {
  font-size: 12px;
  color: rgba(33, 37, 41, 0.6);
}

/* Actions Section */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: scale(1.1);
}

/* Dialog Styling */
.condition-dialog {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
}

.condition-summary, .tool-details {
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
}

@media (max-width: 768px) {
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
}
</style>
