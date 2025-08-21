<template>
  <q-chip
    :label="displayText"
    :color="statusConfig.color"
    :icon="statusConfig.icon"
    text-color="white"
    dense
  >
    <q-tooltip v-if="thresholds">
      Understocked: ≤{{ thresholds.understocked }}<br>
      Overstocked: ≥{{ thresholds.overstocked }}<br>
      Current: {{ quantity }}
    </q-tooltip>
  </q-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StockStatus, StockThresholds } from '@/types'
import { STOCK_STATUS_CONFIG } from '@/types'

interface Props {
  status?: StockStatus
  quantity?: number
  thresholds?: StockThresholds
}

const props = withDefaults(defineProps<Props>(), {
  status: 'adequate',
  quantity: 0
})

const statusConfig = computed(() => {
  return STOCK_STATUS_CONFIG[props.status] || STOCK_STATUS_CONFIG.adequate
})

const displayText = computed(() => {
  return `${statusConfig.value.label} (${props.quantity})`
})
</script>
