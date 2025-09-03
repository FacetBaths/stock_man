<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center">
        <div class="text-h6">Add Cost to SKU</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-form @submit="onSubmit">
        <q-card-section>
          <div v-if="sku" class="q-mb-md">
            <div class="text-weight-medium">{{ sku.sku_code }}</div>
            <div class="text-caption text-grey-6">Current Cost: ${{ formatCurrency(sku.current_cost) }}</div>
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-12">
              <q-input
                v-model.number="form.cost"
                label="New Cost *"
                outlined
                dense
                type="number"
                step="0.01"
                min="0"
                prefix="$"
                :rules="[val => val >= 0 || 'Cost must be non-negative']"
              />
            </div>

            <div class="col-12">
              <q-input
                v-model="form.notes"
                label="Notes"
                outlined
                dense
                type="textarea"
                rows="3"
                placeholder="Reason for cost change..."
              />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right">
          <q-btn flat color="grey-7" @click="close">Cancel</q-btn>
          <q-btn 
            color="primary" 
            type="submit"
            :loading="saving"
          >
            Add Cost
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useSKUStore } from '@/stores/sku'
import type { SKU } from '@/types'

interface Props {
  modelValue: boolean
  sku?: SKU | null
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const props = defineProps<Props>()

const $q = useQuasar()
const skuStore = useSKUStore()

// State
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const saving = ref(false)

const form = ref({
  cost: 0,
  notes: ''
})

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const resetForm = () => {
  form.value = {
    cost: props.sku?.current_cost || 0,
    notes: ''
  }
}

const onSubmit = async () => {
  if (!props.sku) return

  try {
    saving.value = true
    await skuStore.addCost(props.sku._id, form.value)
    emit('saved')
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to add cost'
    })
  } finally {
    saving.value = false
  }
}

const close = () => {
  show.value = false
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    resetForm()
  }
})
</script>

<style scoped>
/* Mobile Responsive Dialog Fixes */
@media (max-width: 768px) {
  /* Dialog Card Mobile Overrides */
  .q-card {
    width: calc(100vw - 2rem) !important;
    max-width: 100vw !important;
    min-width: auto !important;
    height: auto !important;
    max-height: 95vh !important;
    margin: 0 !important;
    border-radius: 16px !important;
  }
  
  /* Dialog Header */
  .q-card__section {
    padding: 1rem !important;
  }
  
  .text-h6 {
    font-size: 1.125rem !important;
  }
  
  /* Form Layout */
  .row.q-col-gutter-md {
    margin: -0.5rem !important;
  }
  
  .row.q-col-gutter-md > div {
    padding: 0.5rem !important;
  }
  
  /* Form Fields */
  .q-field {
    margin-bottom: 1rem !important;
  }
  
  .q-input {
    font-size: 1rem !important;
  }
  
  .q-field__label {
    font-size: 0.875rem !important;
  }
  
  .q-field__control {
    min-height: 48px !important;
  }
  
  /* Form Buttons */
  .q-card-actions {
    padding: 1rem !important;
    flex-wrap: wrap !important;
    gap: 0.75rem !important;
  }
  
  .q-card-actions .q-btn {
    flex: 1 !important;
    min-width: auto !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
  }
  
  /* Cancel buttons smaller */
  .q-card-actions .q-btn.q-btn--flat {
    flex: 0 0 auto !important;
    min-width: 100px !important;
  }
  
  /* Textarea specific */
  .q-input[type="textarea"] .q-field__control {
    min-height: 120px !important;
  }
  
  /* Number inputs */
  .q-input[type="number"] .q-field__control {
    min-height: 48px !important;
  }
  
  /* Text content */
  .text-caption {
    font-size: 0.75rem !important;
    line-height: 1.3 !important;
  }
  
  .text-weight-medium {
    font-size: 0.875rem !important;
  }
  
  /* Close button */
  .q-btn[icon="close"] {
    width: 40px !important;
    height: 40px !important;
  }
}
</style>
