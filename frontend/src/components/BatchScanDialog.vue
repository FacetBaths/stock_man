<template>
  <q-dialog v-model="show" persistent maximized>
    <q-card>
      <q-card-section class="row items-center">
        <div class="text-h6">Batch Barcode Scanner</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="text-center q-pa-xl">
          <q-icon name="qr_code_scanner" size="120px" color="grey-5" />
          <div class="text-h6 q-mt-md">Batch Scan Coming Soon</div>
          <div class="text-body2 text-grey-6">
            This feature will allow you to scan multiple barcodes and process them as a batch.
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
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'processed': []
}>()

const props = defineProps<Props>()

// State
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const close = () => {
  show.value = false
}
</script>
