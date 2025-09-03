<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toolsApi } from '@/utils/api'
import type { Tag } from '@/types'
import { useQuasar } from 'quasar'

interface Props {
  modelValue: boolean
  loans: Tag[]
  preselectLoanId?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'checked-in': [tag: Tag]
}>()

const $q = useQuasar()

const showDialog = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const search = ref('')
const selectedLoanId = ref<string>('')
const notes = ref('')
const condition = ref<'functional' | 'needs_maintenance' | 'broken'>('functional')

// Selected instances for return
const selectedInstances = ref<Set<string>>(new Set())

const isSubmitting = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

const filteredLoans = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return props.loans
  return props.loans.filter(l =>
    l.customer_name?.toLowerCase().includes(term) ||
    l.project_name?.toLowerCase().includes(term) ||
    l.sku_items?.some(si => typeof si.sku_id === 'object' && si.sku_id.name?.toLowerCase().includes(term))
  )
})

const selectedLoan = computed(() => props.loans.find(l => l._id === selectedLoanId.value) || null)

watch(showDialog, (open) => {
  if (open) {
    if (props.preselectLoanId) {
      selectedLoanId.value = props.preselectLoanId
    }
  } else {
    // reset form when closing
    selectedLoanId.value = ''
    notes.value = ''
    condition.value = 'functional'
    error.value = null
    selectedInstances.value.clear()
  }
})

// Watch for loan selection changes to select all instances by default
watch(selectedLoanId, (loanId) => {
  console.log('🔍 selectedLoanId changed:', loanId)
  selectedInstances.value.clear()
  
  if (loanId) {
    const loan = props.loans.find(l => l._id === loanId)
    console.log('📦 Found loan:', loan)
    if (loan) {
      console.log('📋 Processing sku_items:', loan.sku_items)
      // Select all instances by default
      loan.sku_items?.forEach((it: any) => {
        const instanceIds = it.selected_instance_ids || []
        console.log(`🔧 Adding instances for ${it.sku_id.name || 'Tool'}:`, instanceIds)
        instanceIds.forEach((id: string) => {
          selectedInstances.value.add(id.toString())
        })
      })
      console.log('✅ Selected instances:', Array.from(selectedInstances.value))
    }
  }
}, { immediate: true })

const canSubmit = computed(() => {
  if (!selectedLoanId.value || isSubmitting.value) return false
  return selectedInstances.value.size > 0
})

const submitCheckIn = async () => {
  if (!selectedLoan.value) return
  try {
    isSubmitting.value = true
    error.value = null

    console.log('🚀 Starting submitCheckIn')
    console.log('📋 Selected instances:', Array.from(selectedInstances.value))
    console.log('📋 Selected loan sku_items:', selectedLoan.value.sku_items)

    // Build partial return payload by grouping selected instances by SKU
    const skuGroups = new Map<string, string[]>()
    
    // Group selected instances by their SKU
    selectedLoan.value.sku_items?.forEach((it: any) => {
      const skuId = (typeof it.sku_id === 'object' ? it.sku_id._id : it.sku_id) as string
      const instanceIds = (it.selected_instance_ids || []).map((id: any) => id.toString())
      
      // Filter to only include selected instances
      const selectedForThisSku = instanceIds.filter(id => selectedInstances.value.has(id))
      
      if (selectedForThisSku.length > 0) {
        skuGroups.set(skuId, selectedForThisSku)
      }
    })

    // Convert to items array
    const items = Array.from(skuGroups.entries()).map(([sku_id, instance_ids]) => ({
      sku_id,
      instance_ids
    }))

    console.log('📦 Final items payload:', items)

    const resp = await toolsApi.partialReturnTools(selectedLoan.value._id, {
      items,
      return_notes: notes.value || undefined,
      returned_condition: condition.value
    })

    $q.notify({ type: 'positive', message: 'Tools checked in successfully' })

    emit('checked-in', selectedLoan.value)
    showDialog.value = false
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || 'Failed to check in tools'
    $q.notify({ type: 'negative', message: error.value })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <q-dialog v-model="showDialog">
    <q-card style="min-width: 760px; max-width: 900px;">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6">
          <q-icon name="assignment_return" class="q-mr-sm" />
          Check In Tools
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="showDialog = false" />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="q-gutter-md">
          <div class="text-body2 text-grey-7">Select an active check-out to process its return.</div>

          <div class="row q-col-gutter-sm items-center">
            <div class="col-8">
              <q-input v-model="search" dense outlined placeholder="Search by installer, project, or tool" clearable>
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-4">
              <q-select
                v-model="selectedLoanId"
                :options="filteredLoans.map(l => ({ label: `${l.customer_name}${l.project_name ? ' • ' + l.project_name : ''}`, value: l._id }))"
                dense outlined emit-value map-options
                placeholder="Select a check-out"
              />
            </div>
          </div>

          <q-card v-if="selectedLoan" flat bordered class="q-pa-md">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-sm">Check-out Details</div>
                <div class="text-body2"><strong>Installer:</strong> {{ selectedLoan.customer_name }}</div>
                <div v-if="selectedLoan.project_name" class="text-body2"><strong>Project:</strong> {{ selectedLoan.project_name }}</div>
                <div v-if="selectedLoan.due_date" class="text-body2"><strong>Due:</strong> {{ new Date(selectedLoan.due_date).toLocaleDateString() }}</div>
              </div>
              <div class="col-12">
                <div class="text-subtitle2 q-mb-sm">Select Tools to Return</div>
                <div v-if="selectedLoan.sku_items?.length" class="q-gutter-sm">
                  <div v-for="(it, skuIdx) in selectedLoan.sku_items" :key="skuIdx" class="q-mb-md">
                    <div class="text-body2 text-weight-medium q-mb-xs">
                      {{ typeof it.sku_id === 'object' ? it.sku_id.name : 'Tool' }}
                      <span class="text-caption text-grey-7">
                        ({{ (it.selected_instance_ids || []).length }} in this checkout)
                      </span>
                    </div>
                    <div class="q-ml-md">
                      <div v-for="(instanceId, instIdx) in (it.selected_instance_ids || [])" :key="instIdx" class="row items-center q-py-xs">
                        <q-checkbox
                          :model-value="selectedInstances.has(instanceId.toString())"
                          @update:model-value="(checked) => {
                            const id = instanceId.toString();
                            if (checked) {
                              selectedInstances.add(id);
                            } else {
                              selectedInstances.delete(id);
                            }
                          }"
                          :disable="isSubmitting"
                          dense
                        />
                        <span class="q-ml-sm text-body2">
                          {{ typeof it.sku_id === 'object' ? it.sku_id.name : 'Tool' }} #{{ instIdx + 1 }}
                        </span>
                      </div>
                      
                      <!-- Select All / Deselect All buttons for this SKU -->
                      <div class="row q-gutter-xs q-mt-xs">
                        <q-btn 
                          size="xs" 
                          flat 
                          dense 
                          color="primary" 
                          label="Select All"
                          @click="() => {
                            (it.selected_instance_ids || []).forEach(id => {
                              selectedInstances.add(id.toString());
                            });
                          }"
                          :disable="isSubmitting"
                        />
                        <q-btn 
                          size="xs" 
                          flat 
                          dense 
                          color="grey" 
                          label="Deselect All"
                          @click="() => {
                            (it.selected_instance_ids || []).forEach(id => {
                              selectedInstances.delete(id.toString());
                            });
                          }"
                          :disable="isSubmitting"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-caption text-grey-7">No items found on this check-out.</div>
              </div>
            </div>
          </q-card>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-select
                v-model="condition"
                :options="[
                  { label: 'Functional', value: 'functional' },
                  { label: 'Needs maintenance', value: 'needs_maintenance' },
                  { label: 'Broken', value: 'broken' }
                ]"
                label="Returned condition"
                dense outlined emit-value map-options
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="notes" type="textarea" rows="2" dense outlined label="Return notes (optional)" />
            </div>
          </div>

          <div v-if="error" class="q-mt-sm">
            <q-banner class="bg-red text-white"><q-icon name="error" class="q-mr-sm" />{{ error }}</q-banner>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="showDialog = false" :disable="isSubmitting" />
        <q-btn color="positive" label="Check In" :disable="!canSubmit" :loading="isSubmitting" @click="submitCheckIn" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

