<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { QTableColumn } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import type { InstanceLocation } from '@/types'

const props = defineProps<{ skuId: string; disabled?: boolean }>()
const emit = defineEmits<{ saved: []; 'saving-change': [saving: boolean] }>()
const authStore = useAuthStore()
const inventoryStore = useInventoryStore()

interface LocationRow extends InstanceLocation {
  draftLocation: string
  savedLocation: string
}

const rows = ref<LocationRow[]>([])
const loading = ref(false)
const savingId = ref<string | null>(null)
const error = ref('')
const message = ref('')
let requestId = 0

const columns: QTableColumn[] = [
  { name: 'instance', label: 'Instance', field: '_id', align: 'left' },
  { name: 'acquired', label: 'Acquired', field: 'acquisition_date', align: 'left',
    format: value => value ? new Date(value).toLocaleDateString() : 'Unknown' },
  { name: 'assignment', label: 'Assignment', field: row =>
    typeof row.tag_id === 'object' && row.tag_id
      ? `${row.tag_id.customer_name} (${row.tag_id.tag_type})`
      : row.tag_id ? 'Tagged' : 'Available', align: 'left' },
  { name: 'location', label: 'Location', field: 'draftLocation', align: 'left' },
  { name: 'actions', label: '', field: '_id', align: 'right' }
]

const loadInstances = async () => {
  const request = ++requestId
  rows.value = []
  error.value = ''
  message.value = ''
  savingId.value = null
  loading.value = false
  if (!props.skuId) return
  loading.value = true
  try {
    const instances = await inventoryStore.fetchInstanceLocations(props.skuId)
    if (request !== requestId) return
    rows.value = instances.map(instance => ({
      ...instance,
      savedLocation: instance.location || '',
      draftLocation: instance.location || ''
    }))
  } catch (err: any) {
    if (request === requestId) error.value = err.response?.data?.message || 'Failed to load instances'
  } finally {
    if (request === requestId) loading.value = false
  }
}

const canSave = (row: LocationRow) =>
  authStore.canWrite && !props.disabled && !loading.value && !savingId.value &&
  row.draftLocation.trim() !== row.savedLocation

const saveLocation = async (row: LocationRow) => {
  if (!canSave(row)) return
  const request = requestId
  const location = row.draftLocation.trim()
  savingId.value = row._id
  emit('saving-change', true)
  error.value = ''
  message.value = ''
  try {
    // Only this instance is changed; SKU fields and sibling instances are untouched.
    const response = await inventoryStore.updateInstance(row._id, { location })
    if (request !== requestId) return
    row.savedLocation = response.instance.location || ''
    row.draftLocation = row.savedLocation
    message.value = 'Instance location saved.'
    emit('saved')
  } catch (err: any) {
    if (request === requestId) error.value = err.response?.data?.message || 'Failed to save instance location'
  } finally {
    if (request === requestId) {
      savingId.value = null
      emit('saving-change', false)
    }
  }
}

watch(() => props.skuId, loadInstances, { immediate: true })
onBeforeUnmount(() => { requestId++ })
</script>

<template>
  <q-card flat bordered class="q-pa-md">
    <q-item-label class="text-subtitle2 q-mb-xs">Instance Locations</q-item-label>
    <q-item-label caption class="q-mb-md">
      Each row is one physical item. Save its location separately; changes take effect immediately
      and are not undone by Cancel. Update SKU saves product details only.
    </q-item-label>
    <q-banner v-if="error" dense class="bg-red-1 text-negative q-mb-sm">
      {{ error }}
      <template #action>
        <q-btn v-if="!rows.length" type="button" flat label="Retry" :disable="loading" @click="loadInstances" />
      </template>
    </q-banner>
    <q-banner v-if="message" dense class="bg-green-1 text-positive q-mb-sm">{{ message }}</q-banner>
    <q-table
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :pagination="{ rowsPerPage: 5 }"
      :rows-per-page-options="[5, 10, 25, 50]"
      row-key="_id"
      flat
      dense
      wrap-cells
      no-data-label="No physical instances to edit. Add stock first."
    >
      <template #body-cell-instance="cell">
        <q-td :props="cell">
          {{ cell.row._id.slice(-8) }}
          <q-tooltip>Instance ID: {{ cell.row._id }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-location="cell">
        <q-td :props="cell" style="min-width: 160px">
          <q-input
            v-model="cell.row.draftLocation"
            label="Location"
            :aria-label="`Location for instance ${cell.row._id}`"
            :disable="!authStore.canWrite || disabled || !!savingId"
            outlined
            dense
            @keydown.enter.prevent.stop="saveLocation(cell.row)"
          />
        </q-td>
      </template>
      <template #body-cell-actions="cell">
        <q-td :props="cell">
          <q-btn
            type="button"
            label="Save location"
            color="primary"
            size="sm"
            :disable="!canSave(cell.row)"
            :loading="savingId === cell.row._id"
            @click="saveLocation(cell.row)"
          />
        </q-td>
      </template>
    </q-table>
  </q-card>
</template>
