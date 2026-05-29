<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { bugReportApi } from '@/utils/api'
import { BUG_REPORT_TYPES, BUG_REPORT_AREAS, BUG_REPORT_STATUSES } from '@/types'
import type { BugReport } from '@/types'

const $q = useQuasar()
const authStore = useAuthStore()

const reports = ref<BugReport[]>([])
const isLoading = ref(false)
const statusFilter = ref('open')
const expandedReport = ref<string | null>(null)
const replyText = ref<Record<string, string>>({})

const isAdmin = computed(() => ['admin', 'warehouse_manager'].includes(authStore.user?.role || ''))

const loadReports = async () => {
  try {
    isLoading.value = true
    const params: any = {}
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    const response = await bugReportApi.getReports(params)
    reports.value = response.reports || []
  } catch (err: any) {
    $q.notify({ type: 'negative', message: 'Failed to load reports' })
  } finally {
    isLoading.value = false
  }
}

const getTypeConfig = (type: string) =>
  BUG_REPORT_TYPES.find(t => t.value === type) || BUG_REPORT_TYPES[0]

const getAreaLabel = (area: string) =>
  BUG_REPORT_AREAS.find(a => a.value === area)?.label || area

const getStatusConfig = (status: string) =>
  BUG_REPORT_STATUSES.find(s => s.value === status) || BUG_REPORT_STATUSES[0]

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

const toggleExpand = (id: string) => {
  expandedReport.value = expandedReport.value === id ? null : id
}

const handleReply = async (reportId: string) => {
  const message = replyText.value[reportId]?.trim()
  if (!message) return

  try {
    await bugReportApi.addReply(reportId, message)
    replyText.value[reportId] = ''
    await loadReports()
  } catch (err: any) {
    $q.notify({ type: 'negative', message: 'Failed to send reply' })
  }
}

const handleStatusChange = async (reportId: string, newStatus: string) => {
  try {
    await bugReportApi.updateStatus(reportId, newStatus)
    await loadReports()
  } catch (err: any) {
    $q.notify({ type: 'negative', message: 'Failed to update status' })
  }
}

const handleDelete = (reportId: string) => {
  $q.dialog({
    title: 'Delete Report',
    message: 'Are you sure you want to delete this report? This cannot be undone.',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(async () => {
    try {
      await bugReportApi.deleteReport(reportId)
      $q.notify({ type: 'positive', message: 'Report deleted' })
      await loadReports()
    } catch (err: any) {
      $q.notify({ type: 'negative', message: 'Failed to delete report' })
    }
  })
}

onMounted(loadReports)
</script>

<template>
  <q-dialog :model-value="true" @update:model-value="$emit('close')" maximized>
    <q-card class="full-width full-height">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-sm bg-primary text-white">
        <q-icon name="assignment" size="sm" class="q-mr-sm" />
        <div class="text-h6">Bug Reports & Feature Requests</div>
        <q-space />
        <q-btn icon="refresh" flat round dense @click="loadReports" :loading="isLoading" class="q-mr-sm" />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- Filter tabs -->
      <q-tabs v-model="statusFilter" @update:model-value="loadReports" class="text-grey-8" active-color="primary" indicator-color="primary" align="left" dense>
        <q-tab name="all" label="All" />
        <q-tab name="open" label="Open" />
        <q-tab name="in_progress" label="In Progress" />
        <q-tab name="resolved" label="Resolved" />
      </q-tabs>

      <q-separator />

      <!-- Reports list -->
      <q-card-section class="q-pa-md" style="overflow-y: auto; max-height: calc(100vh - 140px);">
        <div v-if="isLoading" class="text-center q-pa-xl">
          <q-spinner-dots size="40px" color="primary" />
        </div>

        <div v-else-if="reports.length === 0" class="text-center q-pa-xl text-grey-6">
          <q-icon name="check_circle" size="48px" class="q-mb-md" />
          <div class="text-h6">No reports</div>
          <div class="text-body2">Nothing to show for the current filter.</div>
        </div>

        <q-list v-else separator class="q-gutter-sm">
          <q-card v-for="report in reports" :key="report._id" flat bordered class="report-card">
            <!-- Report header -->
            <q-card-section class="q-py-sm cursor-pointer" @click="toggleExpand(report._id)">
              <div class="row items-center q-gutter-sm">
                <!-- Type icon -->
                <q-icon
                  :name="getTypeConfig(report.type).icon"
                  :style="{ color: getTypeConfig(report.type).color }"
                  size="sm"
                />

                <!-- Area chip -->
                <q-chip size="sm" color="grey-3" text-color="grey-9" dense>
                  {{ getAreaLabel(report.area) }}
                </q-chip>

                <!-- Status chip -->
                <q-chip
                  size="sm"
                  :style="{ backgroundColor: getStatusConfig(report.status).color, color: 'white' }"
                  dense
                >
                  {{ getStatusConfig(report.status).label }}
                </q-chip>

                <!-- Reply count -->
                <q-chip v-if="report.replies.length > 0" size="sm" color="blue-1" text-color="primary" icon="forum" dense>
                  {{ report.replies.length }}
                </q-chip>

                <q-space />

                <!-- Meta -->
                <span class="text-caption text-grey-6">
                  {{ report.created_by }} &middot; {{ formatDate(report.createdAt) }}
                </span>

                <q-icon :name="expandedReport === report._id ? 'expand_less' : 'expand_more'" />
              </div>

              <!-- Description preview -->
              <div v-if="report.description && expandedReport !== report._id" class="text-body2 text-grey-7 q-mt-xs ellipsis">
                {{ report.description }}
              </div>
            </q-card-section>

            <!-- Expanded details -->
            <q-slide-transition>
              <div v-if="expandedReport === report._id">
                <q-separator />

                <!-- Full description -->
                <q-card-section v-if="report.description" class="q-py-sm">
                  <div class="text-caption text-weight-medium text-grey-8 q-mb-xs">Description</div>
                  <div class="text-body2" style="white-space: pre-wrap;">{{ report.description }}</div>
                </q-card-section>

                <!-- Thread -->
                <q-card-section class="q-py-sm">
                  <div class="text-caption text-weight-medium text-grey-8 q-mb-sm">
                    Thread ({{ report.replies.length }})
                  </div>

                  <div v-if="report.replies.length === 0" class="text-body2 text-grey-5 q-mb-sm">
                    No replies yet.
                  </div>

                  <div v-else class="q-gutter-sm q-mb-md">
                    <div
                      v-for="reply in report.replies"
                      :key="reply._id"
                      class="reply-bubble"
                      :class="{ 'reply-admin': ['admin', 'warehouse_manager'].includes(reply.author_role) }"
                    >
                      <div class="row items-center q-gutter-xs q-mb-xs">
                        <span class="text-weight-medium text-caption">{{ reply.author }}</span>
                        <q-chip v-if="['admin', 'warehouse_manager'].includes(reply.author_role)" size="xs" color="primary" text-color="white" dense>
                          {{ reply.author_role === 'admin' ? 'Admin' : 'Manager' }}
                        </q-chip>
                        <span class="text-caption text-grey-5">&middot; {{ formatDate(reply.createdAt) }}</span>
                      </div>
                      <div class="text-body2" style="white-space: pre-wrap;">{{ reply.message }}</div>
                    </div>
                  </div>

                  <!-- Reply input -->
                  <div class="row q-gutter-sm items-end">
                    <q-input
                      v-model="replyText[report._id]"
                      filled
                      dense
                      placeholder="Write a reply..."
                      class="col"
                      @keyup.enter.ctrl="handleReply(report._id)"
                      maxlength="2000"
                    />
                    <q-btn
                      icon="send"
                      color="primary"
                      dense
                      round
                      :disable="!replyText[report._id]?.trim()"
                      @click="handleReply(report._id)"
                    />
                  </div>
                </q-card-section>

                <!-- Admin actions -->
                <q-separator v-if="isAdmin" />
                <q-card-actions v-if="isAdmin" align="right" class="q-pa-sm">
                  <q-btn-dropdown flat dense no-caps label="Change Status" icon="flag" color="grey-8" size="sm">
                    <q-list dense>
                      <q-item
                        v-for="s in BUG_REPORT_STATUSES"
                        :key="s.value"
                        clickable
                        v-close-popup
                        @click="handleStatusChange(report._id, s.value)"
                        :active="report.status === s.value"
                      >
                        <q-item-section side>
                          <q-icon name="circle" size="xs" :style="{ color: s.color }" />
                        </q-item-section>
                        <q-item-section>{{ s.label }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-btn-dropdown>

                  <q-btn
                    v-if="authStore.isAdmin"
                    flat dense no-caps
                    label="Delete"
                    icon="delete"
                    color="negative"
                    size="sm"
                    @click="handleDelete(report._id)"
                  />
                </q-card-actions>
              </div>
            </q-slide-transition>
          </q-card>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.report-card {
  border-radius: 8px;
  transition: box-shadow 0.2s;
}
.report-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.reply-bubble {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 8px 12px;
  border-left: 3px solid #e0e0e0;
}
.reply-admin {
  background: #e3f2fd;
  border-left-color: #1976d2;
}
</style>
