<template>
  <q-dialog 
    v-model="showDialog" 
    maximized 
    class="admin-settings-dialog"
    @hide="$emit('close')"
  >
    <q-card class="admin-settings-card">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none admin-header">
        <q-icon name="settings" size="28px" class="text-primary q-mr-sm" />
        <div class="text-h6 text-weight-bold">Admin Settings</div>
        <q-space />
        <q-btn 
          icon="close" 
          flat 
          round 
          dense 
          @click="$emit('close')"
          aria-label="Close Admin Settings"
        />
      </q-card-section>

      <!-- Tabs -->
      <q-card-section class="q-pt-none">
        <q-tabs
          v-model="activeTab"
          dense
          class="admin-tabs"
          active-color="primary"
          indicator-color="primary"
          align="left"
          narrow-indicator
        >
          <q-tab name="categories" icon="category" label="Categories" />
          <q-tab name="users" icon="people" label="Users" />
          <q-tab name="system" icon="tune" label="System" />
        </q-tabs>
      </q-card-section>

      <!-- Tab Panels -->
      <q-card-section class="admin-content">
        <q-tab-panels v-model="activeTab" animated>
          <!-- Categories Tab -->
          <q-tab-panel name="categories" class="q-pa-none">
            <CategoryManagement />
          </q-tab-panel>

          <!-- Users Tab -->
          <q-tab-panel name="users" class="q-pa-md">
            <div class="text-center text-grey-6 q-py-xl">
              <q-icon name="people" size="64px" class="q-mb-md" />
              <div class="text-h6">User Management</div>
              <div class="text-body2">Coming Soon</div>
            </div>
          </q-tab-panel>

          <!-- System Tab -->
          <q-tab-panel name="system" class="q-pa-md">
            <div class="text-center text-grey-6 q-py-xl">
              <q-icon name="tune" size="64px" class="q-mb-md" />
              <div class="text-h6">System Settings</div>
              <div class="text-body2">Coming Soon</div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CategoryManagement from './CategoryManagement.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

// State
const activeTab = ref('categories')

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

// Watch for dialog close to emit close event
watch(showDialog, (newValue) => {
  if (!newValue) {
    emit('close')
  }
})
</script>

<style scoped>
.admin-settings-dialog .admin-settings-card {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
}

.admin-settings-dialog .admin-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-height: 64px;
}

.admin-settings-dialog .admin-header .q-btn {
  color: white;
}

.admin-settings-dialog .admin-tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.admin-settings-dialog .admin-tabs :deep(.q-tab) {
  min-height: 48px;
  font-weight: 500;
}

.admin-settings-dialog .admin-tabs :deep(.q-tab--active) {
  color: var(--q-primary);
}

.admin-settings-dialog .admin-content {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.admin-settings-dialog .admin-content :deep(.q-tab-panels) {
  height: 100%;
  overflow-y: auto;
}

.admin-settings-dialog .admin-content :deep(.q-tab-panel) {
  height: 100%;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

/* Mobile adjustments */
@media (max-width: 599px) {
  .admin-settings-dialog .admin-header {
    min-height: 56px;
  }
  
  .admin-settings-dialog .admin-header .text-h6 {
    font-size: 1.1rem;
  }
  
  .admin-settings-dialog .admin-tabs :deep(.q-tab) {
    min-height: 44px;
    padding: 8px 12px;
  }
  
  .admin-settings-dialog .admin-tabs :deep(.q-tab) .q-tab__content {
    font-size: 0.85rem;
  }
  
  .admin-settings-dialog .admin-tabs :deep(.q-tab) .q-tab__icon {
    font-size: 18px;
  }
}

/* Dark mode support */
body.body--dark .admin-settings-dialog .admin-tabs {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}
</style>
