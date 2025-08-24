<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 800px; max-width: 1000px">
      <q-card-section class="row items-center">
        <div class="text-h6">
          <q-icon name="inventory_2" class="q-mr-sm" />
          Bundle Expansion: {{ bundle?.sku.sku_code }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-card-section v-if="loading" class="text-center">
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-body1 q-mt-md">Loading bundle details...</div>
      </q-card-section>

      <q-card-section v-else-if="error" class="text-center">
        <q-icon name="error" size="48px" color="negative" />
        <div class="text-h6 q-mt-md text-negative">{{ error }}</div>
        <q-btn color="primary" label="Retry" @click="loadBundleExpansion" class="q-mt-md" />
      </q-card-section>

      <q-card-section v-else-if="bundle">
        <!-- Bundle Summary -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 text-weight-medium">Bundle Information</div>
                <div class="q-mt-sm">
                  <div><strong>SKU Code:</strong> {{ bundle.sku.sku_code }}</div>
                  <div><strong>Name:</strong> {{ bundle.sku.name || 'Bundle SKU' }}</div>
                  <div><strong>Description:</strong> {{ bundle.sku.description || 'N/A' }}</div>
                  <div><strong>Is Bundle:</strong> 
                    <q-chip :color="bundle.is_bundle ? 'positive' : 'negative'" 
                            :text-color="'white'" size="sm">
                      {{ bundle.is_bundle ? 'Yes' : 'No' }}
                    </q-chip>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
          
          <div class="col-12 col-md-6">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 text-weight-medium">Bundle Availability</div>
                <div class="q-mt-sm">
                  <div class="text-h4 text-primary">{{ bundle.available_sets }}</div>
                  <div class="text-body2 text-grey-7">Complete sets available</div>
                  <div class="q-mt-sm">
                    <div><strong>Components:</strong> {{ bundle.components?.length || 0 }}</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Bundle Components -->
        <div v-if="bundle.components && bundle.components.length > 0">
          <div class="text-h6 q-mb-md">Bundle Components</div>
          
          <q-table
            :rows="bundle.components"
            :columns="componentColumns"
            row-key="sku.sku_code"
            flat
            bordered
            :pagination="{ rowsPerPage: 10 }"
            class="bundle-components-table"
          >
            <template v-slot:body-cell-sku="props">
              <q-td :props="props">
                <div class="text-weight-medium">{{ props.row.sku.sku_code }}</div>
                <div class="text-caption text-grey-6">{{ props.row.sku.name || 'Unnamed SKU' }}</div>
              </q-td>
            </template>

            <template v-slot:body-cell-required_quantity="props">
              <q-td :props="props">
                <q-chip color="info" text-color="white" size="sm">
                  {{ props.row.quantity }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-available_sets="props">
              <q-td :props="props">
                <q-chip :color="getAvailabilityColor(props.row.available_sets)" 
                        text-color="white" size="sm">
                  {{ props.row.available_sets }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props">
                <q-chip :color="getStatusColor(props.row)" 
                        text-color="white" size="sm">
                  {{ getStatusText(props.row) }}
                </q-chip>
              </q-td>
            </template>
          </q-table>
        </div>

        <!-- No Components Message -->
        <div v-else class="text-center q-pa-xl">
          <q-icon name="inventory" size="64px" color="grey-5" />
          <div class="text-h6 text-grey-6 q-mt-md">No Components Defined</div>
          <div class="text-body2 text-grey-6">This bundle doesn't have any components configured.</div>
        </div>

        <!-- Availability Analysis -->
        <div v-if="bundle.components && bundle.components.length > 0" class="q-mt-lg">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-md">Availability Analysis</div>
              
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-4">
                  <div class="text-center">
                    <div class="text-h4 text-positive">{{ bundle.available_sets }}</div>
                    <div class="text-body2">Complete Sets</div>
                  </div>
                </div>
                
                <div class="col-12 col-sm-4">
                  <div class="text-center">
                    <div class="text-h4 text-info">{{ limitingComponent?.sku.sku_code || 'N/A' }}</div>
                    <div class="text-body2">Limiting Component</div>
                  </div>
                </div>
                
                <div class="col-12 col-sm-4">
                  <div class="text-center">
                    <div class="text-h4 text-warning">{{ limitingComponent?.available_sets || 0 }}</div>
                    <div class="text-body2">Sets from Limiting</div>
                  </div>
                </div>
              </div>

              <!-- Recommendations -->
              <div class="q-mt-md" v-if="limitingComponent && bundle.available_sets < 10">
                <q-banner rounded class="bg-orange-1 text-orange-9">
                  <template v-slot:avatar>
                    <q-icon name="lightbulb" />
                  </template>
                  <div class="text-weight-medium">Recommendation</div>
                  <div class="q-mt-sm">
                    To increase bundle availability, consider restocking 
                    <strong>{{ limitingComponent.sku.sku_code }}</strong> 
                    (limiting component with only {{ limitingComponent.available_sets }} sets available).
                  </div>
                </q-banner>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Close" color="primary" @click="close" />
        <q-btn 
          v-if="bundle && canEdit"
          color="primary" 
          label="Edit Bundle" 
          icon="edit"
          @click="editBundle" 
        />
        <q-btn 
          v-if="bundle && bundle.available_sets > 0"
          color="positive" 
          label="Create Items" 
          icon="add_box"
          @click="createBundleItems"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { skuApi } from '@/utils/api'

interface Props {
  modelValue: boolean
  skuCode?: string
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'edit-bundle': [skuCode: string]
  'create-items': [bundleData: any]
}>()

const $q = useQuasar()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const bundle = ref<any>(null)

// Computed
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const limitingComponent = computed(() => {
  if (!bundle.value?.components) return null
  return bundle.value.components.reduce((min: any, component: any) => 
    !min || component.available_sets < min.available_sets ? component : min, null)
})

// Table columns
const componentColumns = [
  {
    name: 'sku',
    label: 'Component SKU',
    field: 'sku',
    align: 'left',
    sortable: true
  },
  {
    name: 'required_quantity',
    label: 'Required Qty',
    field: 'quantity',
    align: 'center',
    sortable: true
  },
  {
    name: 'available_sets',
    label: 'Available Sets',
    field: 'available_sets',
    align: 'center',
    sortable: true
  },
  {
    name: 'status',
    label: 'Status',
    field: '',
    align: 'center'
  }
]

// Methods
const loadBundleExpansion = async () => {
  if (!props.skuCode) return
  
  try {
    loading.value = true
    error.value = null
    
    const response = await skuApi.expandBundle(props.skuCode)
    bundle.value = response
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Failed to load bundle expansion'
    console.error('Bundle expansion error:', err)
  } finally {
    loading.value = false
  }
}

const getAvailabilityColor = (availableSets: number) => {
  if (availableSets === 0) return 'negative'
  if (availableSets < 5) return 'warning'
  return 'positive'
}

const getStatusColor = (component: any) => {
  if (component.available_sets === 0) return 'negative'
  if (component.available_sets < 5) return 'warning'
  return 'positive'
}

const getStatusText = (component: any) => {
  if (component.available_sets === 0) return 'Out of Stock'
  if (component.available_sets < 5) return 'Low Stock'
  return 'In Stock'
}

const close = () => {
  show.value = false
}

const editBundle = () => {
  if (bundle.value?.sku.sku_code) {
    emit('edit-bundle', bundle.value.sku.sku_code)
    close()
  }
}

const createBundleItems = () => {
  if (!bundle.value || bundle.value.available_sets === 0) {
    $q.notify({
      type: 'warning',
      message: 'No complete bundle sets available to create'
    })
    return
  }

  // Ask user how many sets to create
  $q.dialog({
    title: 'Create Bundle Items',
    message: `How many complete sets would you like to create? (Max: ${bundle.value.available_sets})`,
    prompt: {
      model: '1',
      type: 'number',
      min: 1,
      max: bundle.value.available_sets
    },
    cancel: true,
    persistent: true
  }).onOk((quantity: string) => {
    const qty = parseInt(quantity)
    if (qty > 0 && qty <= bundle.value.available_sets) {
      emit('create-items', {
        bundle: bundle.value,
        quantity: qty
      })
      close()
    } else {
      $q.notify({
        type: 'warning',
        message: 'Invalid quantity specified'
      })
    }
  })
}

// Watchers
watch(() => props.skuCode, (newSkuCode) => {
  if (newSkuCode && props.modelValue) {
    loadBundleExpansion()
  }
})

watch(() => props.modelValue, (newValue) => {
  if (newValue && props.skuCode) {
    loadBundleExpansion()
  }
})
</script>

<style scoped>
.bundle-components-table {
  background: transparent;
}

.bundle-components-table :deep(.q-table__top) {
  background: rgba(255, 255, 255, 0.05);
}

.bundle-components-table :deep(.q-table thead th) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(33, 37, 41, 0.9);
  font-weight: 600;
}

.bundle-components-table :deep(.q-table tbody td) {
  background: rgba(255, 255, 255, 0.02);
  color: rgba(33, 37, 41, 0.85);
}

.bundle-components-table :deep(.q-table tbody tr:hover) {
  background: rgba(255, 255, 255, 0.08);
}
</style>
