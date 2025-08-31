<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useToolsStore, type ToolInventoryItem, type ToolUpdateData } from '@/stores/tools'
import { useCategoryStore } from '@/stores/category'
import { formatCategoryName } from '@/utils/formatting'

interface Props {
  modelValue: boolean
  tool: ToolInventoryItem | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const $q = useQuasar()
const authStore = useAuthStore()
const toolsStore = useToolsStore()
const categoryStore = useCategoryStore()

const isUpdating = ref(false)
const error = ref<string | null>(null)

// Dialog visibility
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Form data for tool editing
const formData = ref<ToolUpdateData>({
  name: '',
  description: '',
  brand: '',
  model: '',
  details: {
    tool_type: '',
    manufacturer: '',
    serial_number: '',
    voltage: '',
    features: [],
    specifications: {},
    product_line: '',
    color_name: '',
    dimensions: '',
    finish: '',
    weight: 0
  },
  unit_cost: 0
})

// Check if user can edit cost information
const canEditCost = computed(() =>
  authStore.user?.role === 'admin' || authStore.user?.role === 'warehouse_manager'
)

// UI helper for editing features as comma-separated string
const featuresInput = ref('')

// Watch features array to update the input string
watch(() => formData.value.details.features, (newVal) => {
  if (Array.isArray(newVal)) {
    featuresInput.value = newVal.join(', ')
  }
}, { immediate: true })

// Watch features input string to update the array
watch(featuresInput, (newVal) => {
  if (typeof newVal === 'string') {
    formData.value.details.features = newVal
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0)
  }
})

// Get tool type options from database categories
const toolTypeOptions = computed(() => {
  return categoryStore.categories
    .filter(cat => cat.type === 'tool' && cat.status === 'active')
    .map(cat => formatCategoryName(cat.name || cat.displayName || 'Unnamed'))
    .sort()
})

// Voltage options (for autocomplete)
const voltageOptions = [
  'N/A',
  '12V',
  '18V',
  '20V',
  '24V',
  '36V',
  '40V',
  '60V',
  '110V',
  '220V',
  '240V',
  'Battery'
]

const initializeForm = () => {
  console.log('🔧 EditToolModal: Initializing form with tool:', props.tool)

  if (!props.tool) {
    console.log('🔧 EditToolModal: No tool provided, skipping form initialization')
    return
  }

  const tool = props.tool

  // Initialize form with tool data
  formData.value = {
    name: tool.name || '',
    description: tool.description || '',
    brand: tool.brand || '',
    model: tool.model || '',
    details: {
      tool_type: tool.details.tool_type || '',
      manufacturer: tool.details.manufacturer || '',
      serial_number: tool.details.serial_number || '',
      voltage: tool.details.voltage || '',
      features: tool.details.features || [],
      specifications: tool.details.specifications || {},
      product_line: tool.details.product_line || '',
      color_name: tool.details.color_name || '',
      dimensions: tool.details.dimensions || '',
      finish: tool.details.finish || '',
      weight: tool.details.weight || 0
    },
    unit_cost: tool.unit_cost || 0
  }

  // Initialize features input string
  featuresInput.value = (tool.details.features || []).join(', ')

  console.log('✅ EditToolModal: Form initialized with data:', formData.value)
}

const handleSubmit = async () => {
  try {
    isUpdating.value = true
    error.value = null

    if (!props.tool) {
      error.value = 'No tool selected for editing'
      return
    }

    console.log('🔧 EditToolModal: Submitting tool update:', {
      toolId: props.tool._id,
      formData: formData.value
    })

    // Update the tool using the tools store
    await toolsStore.updateTool(props.tool._id, formData.value)

    console.log('✅ Tool updated successfully')
    emit('success')
    showDialog.value = false

  } catch (err: any) {
    console.error('❌ Update tool error:', err)

    let errorMessage = 'Failed to update tool'
    if (err.message) {
      errorMessage = err.message
    }

    error.value = errorMessage
  } finally {
    isUpdating.value = false
  }
}

const handleClose = () => {
  showDialog.value = false
}

const onValidationError = () => {
  $q.notify({
    type: 'negative',
    message: 'Please correct the form errors'
  })
}

// Weight validation
const validateWeight = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val
  return !isNaN(num) && num >= 0 || 'Weight must be a positive number'
}

// Cost validation
const validateCost = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val
  return !isNaN(num) && num >= 0 || 'Cost must be a positive number'
}

// Watch for dialog opening and tool changes
watch(() => props.modelValue, (newValue) => {
  if (newValue && props.tool) {
    console.log('🎯 EditToolModal: Dialog opened, initializing form')
    initializeForm()
  }
})

watch(() => props.tool, (newTool) => {
  if (newTool && props.modelValue) {
    console.log('🎯 EditToolModal: Tool changed, reinitializing form')
    initializeForm()
  }
}, { deep: true })

onMounted(async () => {
  console.log('EditToolModal mounted with tool:', props.tool)
  
  // Load categories for tool type options
  try {
    await categoryStore.fetchCategories()
  } catch (error) {
    console.error('Failed to load categories for tool types:', error)
  }
  
  if (props.tool && props.modelValue) {
    initializeForm()
  }
})
</script>

<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 700px; max-width: 900px;">
      <q-card-section class="row items-center">
        <div class="text-h6">
          <q-icon name="build" class="q-mr-sm" />
          Edit Tool
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" />
      </q-card-section>

      <q-separator />

      <q-form @submit="handleSubmit" @validation-error="onValidationError">
        <q-card-section class="scroll" style="max-height: 70vh;">
          <!-- Error Display -->
          <div v-if="error" class="q-mb-md">
            <q-banner class="text-white bg-red">
              <q-icon name="error" class="q-mr-sm" />
              {{ error }}
            </q-banner>
          </div>

          <!-- Tool Information Card -->
          <div v-if="tool" class="q-mb-lg">
            <q-card flat bordered class="q-pa-md bg-grey-1">
              <div class="text-subtitle2 text-weight-medium q-mb-sm">
                <q-icon name="build" class="q-mr-xs" />
                Current Tool Information
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-6">SKU Code</div>
                  <q-chip
                    :label="tool.sku_code"
                    color="primary"
                    text-color="white"
                    icon="qr_code"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-6">Total Quantity</div>
                  <div class="text-body1 text-weight-medium">
                    {{ tool.total_quantity }} ({{ tool.available_quantity }}
                    available)
                  </div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-6">Category</div>
                  <div class="text-body1">{{ tool.category.name }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-6">Condition Status</div>
                  <q-chip
                    :color="
                      toolsStore.getConditionStatus(tool) === 'available'
                        ? 'positive'
                        : toolsStore.getConditionStatus(tool) === 'loaned'
                        ? 'purple'
                        : toolsStore.getConditionStatus(tool) === 'maintenance'
                        ? 'negative'
                        : 'warning'
                    "
                    text-color="white"
                    size="sm"
                    :label="toolsStore.getConditionDisplay(tool)"
                  />
                </div>
              </div>
            </q-card>
          </div>

          <div class="row q-col-gutter-md">
            <!-- Basic Information Section -->
            <div class="col-12">
              <div class="text-subtitle2 text-weight-medium q-mb-md">
                <q-icon name="info" class="q-mr-xs" />
                Basic Information
              </div>
            </div>

            <!-- Tool Name -->
            <div class="col-12">
              <q-input
                v-model="formData.name"
                label="Tool Name *"
                outlined
                dense
                :rules="[(val: string) => !!val || 'Tool name is required']"
                placeholder="e.g., Cordless Drill"
              />
            </div>

            <!-- Description -->
            <div class="col-12">
              <q-input
                v-model="formData.description"
                label="Description"
                outlined
                dense
                type="textarea"
                rows="2"
                placeholder="Detailed tool description..."
              />
            </div>

            <!-- Brand and Model -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.brand"
                label="Brand"
                outlined
                dense
                placeholder="e.g., Milwaukee, DeWalt, Makita"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.model"
                label="Model"
                outlined
                dense
                placeholder="Model number or name"
              />
            </div>

            <!-- Tool Specifications Section -->
            <div class="col-12 q-mt-md">
              <div class="text-subtitle2 text-weight-medium q-mb-md">
                <q-icon name="settings" class="q-mr-xs" />
                Tool Specifications
              </div>
            </div>

            <!-- Tool Type -->
            <div class="col-12 col-sm-6">
              <q-select
                v-model="formData.details.tool_type"
                :options="toolTypeOptions"
                label="Tool Type"
                outlined
                dense
                use-input
                input-debounce="0"
                new-value-mode="add-unique"
                hint="Select or type tool type"
                hide-hint
              >
                <template v-slot:no-option>
                  <q-item>
                    <q-item-section class="text-grey">
                      Type to add custom tool type
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Manufacturer -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.manufacturer"
                label="Manufacturer"
                outlined
                dense
                placeholder="Manufacturing company"
              />
            </div>

            <!-- Serial Number and Voltage -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model="formData.details.serial_number"
                label="Serial Number"
                outlined
                dense
                placeholder="Serial/identification number"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-select
                v-model="formData.details.voltage"
                :options="voltageOptions"
                label="Voltage"
                outlined
                dense
                use-input
                input-debounce="0"
                new-value-mode="add-unique"
                hint="Select or type voltage"
                hide-hint
              >
                <template v-slot:no-option>
                  <q-item>
                    <q-item-section class="text-grey">
                      Type to add custom voltage
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Features -->
            <div class="col-12">
              <q-input
                v-model="featuresInput"
                label="Features"
                outlined
                dense
                placeholder="Enter features separated by commas (e.g., LED Light, Belt Clip, Variable Speed)"
                hint="Separate multiple features with commas"
              />
            </div>

            <!-- Weight -->
            <div class="col-12 col-sm-6">
              <q-input
                v-model.number="formData.details.weight"
                label="Weight (lbs)"
                outlined
                dense
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                :rules="[validateWeight]"
              />
            </div>

            <!-- Cost Information Section -->
            <div v-if="canEditCost" class="col-12 q-mt-md">
              <div class="text-subtitle2 text-weight-medium q-mb-md">
                <q-icon name="attach_money" class="q-mr-xs" />
                Cost Information
              </div>
            </div>

            <!-- Unit Cost -->
            <div v-if="canEditCost" class="col-12 col-sm-6">
              <q-input
                v-model.number="formData.unit_cost"
                label="Unit Cost ($)"
                outlined
                dense
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                prefix="$"
                :rules="[validateCost]"
              />
            </div>

            <!-- Cost Display for Non-Admin Users -->
            <div v-else class="col-12">
              <q-card flat bordered class="q-pa-md bg-grey-2">
                <div class="text-body2 text-grey-7">
                  <q-icon name="info" class="q-mr-xs" />
                  Cost information is restricted to administrators and warehouse
                  managers.
                </div>
              </q-card>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            label="Cancel"
            @click="handleClose"
            :disable="isUpdating"
          />
          <q-btn
            type="submit"
            label="Update Tool"
            color="primary"
            :loading="isUpdating"
            :disable="!tool"
          >
            <template v-slot:loading>
              <q-spinner-hourglass class="on-left" />
              Updating...
            </template>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.q-card {
  max-height: 90vh;
}

.scroll {
  overflow-y: auto;
}

/* Tool information card styling */
.bg-grey-1 {
  background: rgba(0, 0, 0, 0.02);
}

.bg-grey-2 {
  background: rgba(0, 0, 0, 0.05);
}

/* Section headers */
.text-subtitle2 {
  border-bottom: 2px solid var(--q-primary);
  padding-bottom: 4px;
  margin-bottom: 16px !important;
}

/* Form field styling */
.q-field {
  margin-bottom: 8px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .q-card {
    min-width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
  }
}
</style>
