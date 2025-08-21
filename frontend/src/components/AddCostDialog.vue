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
