<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 500px">
      <q-card-section class="row items-center">
        <div class="text-h6">Export {{ exportTypeLabel }}</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="text-center q-pa-lg">
          <q-icon name="download" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md">Export Coming Soon</div>
          <div class="text-body2 text-grey-6">
            This feature will allow you to export your {{ exportTypeLabel.toLowerCase() }} data to CSV format.
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn color="primary" @click="close">Close</q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  exportType?: string
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const props = withDefaults(defineProps<Props>(), {
  exportType: 'data'
})

// State
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const exportTypeLabel = computed(() => {
  switch (props.exportType) {
    case 'skus': return 'SKUs'
    case 'inventory': return 'Inventory'
    case 'tags': return 'Tags'
    default: return 'Data'
  }
})

const close = () => {
  show.value = false
}
</script>
