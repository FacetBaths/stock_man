<template>
  <div class="bug-report-fab">
    <!-- Floating Action Button -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn
        fab
        icon="bug_report"
        color="orange"
        @click="toggleModal"
        :class="{ 'fab-pulsing': hasUnresolvedReports }"
      >
        <q-tooltip anchor="center left" self="center right" :offset="[10, 0]">
          Report a Bug
          <div v-if="reportCount > 0" class="text-caption">
            {{ reportCount }} report{{ reportCount !== 1 ? 's' : '' }} saved locally
          </div>
        </q-tooltip>
        
        <!-- Badge for report count -->
        <q-badge 
          v-if="reportCount > 0" 
          floating 
          color="red" 
          :label="reportCount"
        />
      </q-btn>
      
      <!-- Quick actions mini FABs -->
      <q-btn
        v-if="showQuickActions"
        fab-mini
        icon="list"
        color="blue"
        class="q-ml-sm"
        @click="toggleReportsList"
        style="margin-bottom: 60px;"
      >
        <q-tooltip>View Reports ({{ reportCount }})</q-tooltip>
      </q-btn>
      
      <q-btn
        v-if="showQuickActions && reportCount > 0"
        fab-mini
        icon="download"
        color="green"
        class="q-ml-sm"
        @click="showExportMenu = !showExportMenu"
        style="margin-bottom: 120px;"
      >
        <q-tooltip>Export Reports</q-tooltip>
      </q-btn>
    </q-page-sticky>

    <!-- Export menu -->
    <q-menu
      v-model="showExportMenu"
      anchor="center left"
      self="center right"
      :offset="[10, 0]"
    >
      <q-list>
        <q-item clickable v-close-popup @click="exportToJSON">
          <q-item-section avatar>
            <q-icon name="code" color="blue" />
          </q-item-section>
          <q-item-section>Export as JSON</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="exportToCSV">
          <q-item-section avatar>
            <q-icon name="table_chart" color="green" />
          </q-item-section>
          <q-item-section>Export as CSV</q-item-section>
        </q-item>
      </q-list>
    </q-menu>

    <!-- Bug Report Modal -->
    <BugReportModal
      v-model="showModal"
      @submitted="onReportSubmitted"
    />

    <!-- Reports List Dialog -->
    <BugReportListDialog
      v-model="showReportsList"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useBugReport, type BugReport } from '@/composables/useBugReport'
import BugReportModal from './BugReportModal.vue'
import BugReportListDialog from './BugReportListDialog.vue'

const $q = useQuasar()
const { 
  reports, 
  reportCount, 
  criticalCount, 
  highCount, 
  exportToJSON, 
  exportToCSV 
} = useBugReport()

const showModal = ref(false)
const showReportsList = ref(false)
const showQuickActions = ref(false)
const showExportMenu = ref(false)

// Show additional quick actions if there are reports
const hasUnresolvedReports = computed(() => criticalCount.value > 0 || highCount.value > 0)

// Keyboard shortcut handler
const handleKeyboardShortcut = (event: KeyboardEvent) => {
  // Ctrl+Shift+B or Cmd+Shift+B to open bug report
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'B') {
    event.preventDefault()
    toggleModal()
  }
  
  // Escape to close modal
  if (event.key === 'Escape' && showModal.value) {
    showModal.value = false
  }
}

const toggleModal = () => {
  showModal.value = !showModal.value
}

const toggleReportsList = () => {
  showReportsList.value = !showReportsList.value
}

const onReportSubmitted = (report: BugReport) => {
  // Show success notification with action buttons
  $q.notify({
    type: 'positive',
    message: 'Bug report saved!',
    caption: `Severity: ${report.severity}`,
    timeout: 5000,
    actions: [
      {
        label: 'View Reports',
        color: 'white',
        handler: () => toggleReportsList()
      },
      {
        label: 'Export',
        color: 'white',
        handler: () => showExportMenu.value = true
      },
      {
        icon: 'close',
        color: 'white',
        round: true,
        handler: () => {}
      }
    ]
  })
  
  // Pulse the FAB briefly to indicate successful submission
  const fabElement = document.querySelector('.bug-report-fab .q-btn')
  if (fabElement) {
    fabElement.classList.add('fab-success-pulse')
    setTimeout(() => {
      fabElement.classList.remove('fab-success-pulse')
    }, 2000)
  }
}

// Show/hide quick actions based on interaction
let hideQuickActionsTimeout: NodeJS.Timeout

const showQuickActionsHandler = () => {
  showQuickActions.value = true
  clearTimeout(hideQuickActionsTimeout)
}

const hideQuickActionsHandler = () => {
  hideQuickActionsTimeout = setTimeout(() => {
    showQuickActions.value = false
  }, 3000)
}

onMounted(() => {
  // Add keyboard shortcut listener
  document.addEventListener('keydown', handleKeyboardShortcut)
  
  // Show a subtle notification if there are existing reports
  if (reportCount.value > 0) {
    setTimeout(() => {
      $q.notify({
        type: 'info',
        message: `You have ${reportCount.value} bug report${reportCount.value !== 1 ? 's' : ''} saved locally`,
        caption: 'Click the bug report button to export them',
        timeout: 3000,
        position: 'bottom-left',
        actions: [
          {
            label: 'View',
            color: 'white',
            handler: () => toggleReportsList()
          }
        ]
      })
    }, 2000)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboardShortcut)
  clearTimeout(hideQuickActionsTimeout)
})
</script>

<style scoped>
.bug-report-fab {
  z-index: 2000;
}

/* Pulsing animation for urgent reports */
.fab-pulsing {
  animation: fab-pulse 2s infinite;
}

@keyframes fab-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
  }
}

/* Success pulse animation */
.fab-success-pulse {
  animation: fab-success-pulse 0.5s ease-in-out 4;
}

@keyframes fab-success-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Hover effects for mini FABs */
.q-btn.q-btn--fab-mini {
  transition: all 0.3s ease;
}

.q-btn.q-btn--fab-mini:hover {
  transform: scale(1.1);
}

/* Position adjustments for mobile */
@media (max-width: 768px) {
  .q-page-sticky {
    bottom: 20px !important;
    right: 20px !important;
  }
}
</style>