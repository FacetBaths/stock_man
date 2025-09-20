<template>
  <q-dialog 
    v-model="show" 
    persistent 
    :maximized="$q.screen.lt.sm"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card style="min-width: 600px; max-width: 800px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="bug_report" color="orange" class="q-mr-sm" />
          Report a Bug
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-form @submit="onSubmit" class="q-gutter-md">
        <q-card-section>
          <!-- Auto-captured context info -->
          <q-expansion-item
            icon="info"
            label="Context Information"
            class="q-mb-md"
          >
            <div class="q-pa-md bg-grey-1 rounded-borders">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-7">Page</div>
                  <div class="text-body2">{{ context.page }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-7">Route</div>
                  <div class="text-body2">{{ context.route }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-7">User Role</div>
                  <div class="text-body2">{{ context.userRole }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-7">Browser</div>
                  <div class="text-body2">{{ context.browser }}</div>
                </div>
              </div>
            </div>
          </q-expansion-item>

          <!-- Bug Title -->
          <q-input
            v-model="form.title"
            label="Bug Title *"
            outlined
            :rules="[val => !!val || 'Title is required']"
            hint="Brief summary of the issue"
            counter
            maxlength="100"
          />

          <!-- Severity -->
          <q-select
            v-model="form.severity"
            label="Severity *"
            outlined
            :options="severityOptions"
            emit-value
            map-options
            :rules="[val => !!val || 'Severity is required']"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar>
                  <q-icon 
                    :name="getSeverityIcon(scope.opt.value)" 
                    :color="getSeverityColor(scope.opt.value)" 
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template v-slot:selected>
              <div class="row items-center">
                <q-icon 
                  :name="getSeverityIcon(form.severity)" 
                  :color="getSeverityColor(form.severity)"
                  class="q-mr-sm" 
                />
                {{ severityOptions.find(opt => opt.value === form.severity)?.label }}
              </div>
            </template>
          </q-select>

          <!-- Description -->
          <q-input
            v-model="form.description"
            label="Description *"
            type="textarea"
            outlined
            rows="4"
            :rules="[val => !!val || 'Description is required']"
            hint="What exactly is wrong? What did you expect to happen?"
            counter
            maxlength="1000"
          />

          <!-- Steps to Reproduce -->
          <q-input
            v-model="form.stepsToReproduce"
            label="Steps to Reproduce"
            type="textarea"
            outlined
            rows="3"
            hint="Step-by-step instructions to reproduce the bug"
            counter
            maxlength="500"
          />

          <!-- Screenshot Section -->
          <div class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Screenshots (Optional)</div>
            <div class="row q-col-gutter-sm">
              <div class="col-auto">
                <q-btn
                  @click="captureScreenshot"
                  color="blue"
                  icon="screenshot"
                  label="Capture Screen"
                  :loading="isCapturingScreenshot"
                  outline
                />
              </div>
              <div class="col-auto" v-if="form.screenshots.length > 0">
                <q-chip
                  :label="`${form.screenshots.length} screenshot(s)`"
                  color="green"
                  text-color="white"
                  icon="image"
                  removable
                  @remove="form.screenshots = []"
                />
              </div>
            </div>

            <!-- Screenshot previews -->
            <div v-if="form.screenshots.length > 0" class="q-mt-sm">
              <div class="row q-col-gutter-sm">
                <div 
                  v-for="(screenshot, index) in form.screenshots" 
                  :key="index"
                  class="col-12 col-sm-6 col-md-4"
                >
                  <q-img
                    :src="screenshot"
                    style="height: 120px"
                    class="rounded-borders cursor-pointer"
                    @click="viewScreenshot(screenshot)"
                  >
                    <div class="absolute-top-right q-pa-xs">
                      <q-btn
                        size="sm"
                        round
                        dense
                        color="negative"
                        icon="close"
                        @click.stop="removeScreenshot(index)"
                      />
                    </div>
                  </q-img>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn 
            type="submit" 
            unelevated 
            label="Report Bug" 
            color="orange" 
            icon="bug_report"
            :loading="submitting"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>

  <!-- Screenshot viewer -->
  <q-dialog v-model="showScreenshotViewer">
    <q-card>
      <q-img :src="selectedScreenshot" />
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useBugReport, type BugReport } from '@/composables/useBugReport'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submitted': [report: BugReport]
}>()

const $q = useQuasar()
const { createReport, captureScreenshot, isCapturingScreenshot, getCurrentContext } = useBugReport()

const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const form = ref({
  title: '',
  description: '',
  stepsToReproduce: '',
  severity: 'Medium' as 'Critical' | 'High' | 'Medium' | 'Low',
  screenshots: [] as string[]
})

const context = ref({
  page: '',
  route: '',
  userRole: '',
  browser: ''
})

const submitting = ref(false)
const showScreenshotViewer = ref(false)
const selectedScreenshot = ref('')

const severityOptions = [
  { label: 'Critical - App unusable/crashes', value: 'Critical' },
  { label: 'High - Major feature broken', value: 'High' },
  { label: 'Medium - Moderate impact', value: 'Medium' },
  { label: 'Low - Minor issue/cosmetic', value: 'Low' }
]

const getSeverityIcon = (severity: string) => {
  const icons = {
    Critical: 'error',
    High: 'warning',
    Medium: 'info',
    Low: 'help'
  }
  return icons[severity as keyof typeof icons] || 'help'
}

const getSeverityColor = (severity: string) => {
  const colors = {
    Critical: 'red',
    High: 'orange',
    Medium: 'blue',
    Low: 'grey'
  }
  return colors[severity as keyof typeof colors] || 'grey'
}

const resetForm = () => {
  form.value = {
    title: '',
    description: '',
    stepsToReproduce: '',
    severity: 'Medium',
    screenshots: []
  }
}

const captureScreenshotHandler = async () => {
  try {
    const screenshot = await captureScreenshot()
    if (screenshot) {
      form.value.screenshots.push(screenshot)
      $q.notify({
        type: 'positive',
        message: 'Screenshot captured successfully',
        timeout: 2000
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to capture screenshot',
      timeout: 3000
    })
  }
}

const removeScreenshot = (index: number) => {
  form.value.screenshots.splice(index, 1)
}

const viewScreenshot = (screenshot: string) => {
  selectedScreenshot.value = screenshot
  showScreenshotViewer.value = true
}

const onSubmit = async () => {
  try {
    submitting.value = true
    
    const report = await createReport({
      title: form.value.title,
      description: form.value.description,
      stepsToReproduce: form.value.stepsToReproduce,
      severity: form.value.severity,
      screenshots: form.value.screenshots
    })

    $q.notify({
      type: 'positive',
      message: 'Bug report created successfully!',
      caption: 'Report saved locally for export later',
      timeout: 4000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          round: true,
          handler: () => {}
        }
      ]
    })

    emit('submitted', report)
    resetForm()
    show.value = false
    
  } catch (error) {
    console.error('Failed to create bug report:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create bug report',
      timeout: 3000
    })
  } finally {
    submitting.value = false
  }
}

// Load context when modal opens
const updateContext = () => {
  context.value = getCurrentContext()
}

onMounted(() => {
  updateContext()
})

// Update context when modal opens
const onShow = () => {
  updateContext()
}

// Watch for modal open
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    onShow()
  }
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

/* Ensure screenshots are properly sized */
.q-img {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .q-card {
    margin: 0;
    min-width: 100vw;
    min-height: 100vh;
  }
}
</style>