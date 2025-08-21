<template>
  <q-chip
    :label="displayText"
    :color="statusConfig.color"
    :icon="statusConfig.icon"
    text-color="white"
    dense
    class="stock-status-chip"
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

<style scoped>
.stock-status-chip {
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.stock-status-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
</style>
