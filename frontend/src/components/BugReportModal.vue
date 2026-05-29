<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { bugReportApi } from '@/utils/api'
import { BUG_REPORT_TYPES, BUG_REPORT_AREAS } from '@/types'

const emit = defineEmits<{
  close: []
}>()

const $q = useQuasar()
const isSubmitting = ref(false)

const form = ref({
  type: 'bug' as 'bug' | 'feature_request',
  area: '' as string,
  description: ''
})

const handleSubmit = async () => {
  if (!form.value.area) {
    $q.notify({ type: 'warning', message: 'Please select an area' })
    return
  }

  try {
    isSubmitting.value = true
    await bugReportApi.createReport({
      type: form.value.type,
      area: form.value.area,
      description: form.value.description
    })

    $q.notify({ type: 'positive', message: 'Report submitted — thank you!' })
    emit('close')
  } catch (err: any) {
    $q.notify({ type: 'negative', message: err.response?.data?.message || 'Failed to submit report' })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <q-dialog :model-value="true" @update:model-value="emit('close')" persistent>
    <q-card style="min-width: 420px; max-width: 520px;">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="bug_report" size="sm" color="negative" class="q-mr-sm" />
        <div class="text-h6">Submit a Report</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="emit('close')" />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <!-- Type -->
        <q-btn-toggle
          v-model="form.type"
          spread
          no-caps
          rounded
          toggle-color="primary"
          :options="BUG_REPORT_TYPES.map(t => ({ label: t.label, value: t.value, icon: t.icon }))"
        />

        <!-- Area -->
        <q-select
          v-model="form.area"
          :options="BUG_REPORT_AREAS.map(a => ({ label: a.label, value: a.value }))"
          emit-value
          map-options
          filled
          label="What area is affected? *"
          :rules="[v => !!v || 'Required']"
        />

        <!-- Description -->
        <q-input
          v-model="form.description"
          filled
          type="textarea"
          rows="3"
          label="Description (optional)"
          placeholder="Describe what happened or what you'd like to see..."
          maxlength="2000"
          counter
        />
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md q-pt-none">
        <q-btn flat label="Cancel" @click="emit('close')" />
        <q-btn
          color="primary"
          label="Submit"
          icon="send"
          :loading="isSubmitting"
          @click="handleSubmit"
          no-caps
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
