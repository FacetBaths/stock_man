<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryLocationSummary } from '@/types'

const props = defineProps<{
  locations?: InventoryLocationSummary[]
  totalQuantity: number
}>()

const entries = computed(() => {
  if (props.totalQuantity === 0) return [{ label: 'No stock', quantity: null }]
  if (!props.locations?.length) return [{ label: 'Location unavailable', quantity: null }]
  return props.locations.map(entry => ({
    label: entry.location?.trim() || 'No location',
    quantity: entry.quantity
  }))
})
</script>

<template>
  <q-list dense class="inventory-locations">
    <q-item v-for="(entry, index) in entries" :key="index" dense class="q-pa-none location-entry">
      <q-item-section side class="q-pr-xs">
        <q-icon name="place" size="xs" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ entry.label }}<template v-if="entry.quantity !== null"> ({{ entry.quantity }})</template>
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-tooltip>Locations of individual instances, including available and tagged stock</q-tooltip>
  </q-list>
</template>

<style scoped>
.inventory-locations {
  font-size: inherit;
  color: inherit;
}

.location-entry {
  min-height: 20px;
  overflow-wrap: anywhere;
}
</style>
