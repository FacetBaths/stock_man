<template>
  <q-dialog
    v-model="isOpen"
    :persistent="loading"
    @hide="onHide"
  >
    <q-card class="glass-card" style="min-width: 450px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-weight-bold text-dark">
          {{ deletionType === 'hard' ? 'Permanently Delete User' : 'Deactivate User' }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup :disable="loading" />
      </q-card-section>

      <q-card-section class="q-pt-md">
        <!-- Admin Protection Warning -->
        <div v-if="user?.role === 'admin'" class="q-mb-lg">
          <q-banner class="bg-info text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="security" />
            </template>
            <div class="text-weight-medium">Admin User Protection</div>
            <div class="text-body2 q-mt-xs">
              Admin users cannot be permanently deleted for security reasons. 
              You can only deactivate admin accounts, which can be reversed later.
            </div>
          </q-banner>
        </div>

        <div class="row items-center q-gutter-md q-mb-lg">
          <q-icon 
            :name="deletionType === 'hard' ? 'warning' : 'block'" 
            :color="deletionType === 'hard' ? 'negative' : 'orange'"
            size="48px"
          />
          <div class="col">
            <div class="text-h6 text-weight-medium">
              {{ deletionType === 'hard' ? 'Permanent Deletion' : 'Deactivate Account' }}
            </div>
            <div class="text-body2 text-grey-7">
              {{ deletionType === 'hard' 
                ? 'This action cannot be undone. All user data will be permanently removed.' 
                : 'User will be deactivated but data will be preserved. This can be reversed later.'
              }}
            </div>
          </div>
        </div>

        <div v-if="user" class="glass-card-dark q-pa-md q-mb-md">
          <div class="text-weight-medium q-mb-xs">User Details:</div>
          <div class="text-body2">
            <div><strong>Name:</strong> {{ user.firstName }} {{ user.lastName }}</div>
            <div><strong>Username:</strong> {{ user.username }}</div>
            <div><strong>Email:</strong> {{ user.email }}</div>
            <div><strong>Role:</strong> 
              <q-chip 
                :color="getRoleColor(user.role)"
                text-color="white"
                size="sm"
              >
                {{ formatRole(user.role) }}
              </q-chip>
            </div>
            <div><strong>Status:</strong> 
              <q-chip 
                :color="user.isActive ? 'positive' : 'negative'"
                text-color="white"
                size="sm"
              >
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </q-chip>
            </div>
          </div>
        </div>

        <div v-if="deletionType === 'hard'" class="q-mb-md">
          <q-banner class="bg-negative text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="warning" />
            </template>
            <div class="text-weight-medium">DANGER: Permanent Action</div>
            <div class="text-body2 q-mt-xs">
              This will permanently delete the user account and cannot be undone. 
              Consider deactivation instead if you might need to restore access later.
            </div>
          </q-banner>
        </div>

        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">Confirmation Options:</div>
          <q-option-group
            v-model="deletionType"
            :options="availableDeletionOptions"
            color="primary"
            :disable="loading"
          />
        </div>

        <!-- Confirmation input for permanent deletion -->
        <div v-if="deletionType === 'hard'" class="q-mb-md">
          <q-input
            v-model="confirmationInput"
            :label="`Type '${user?.username}' to confirm permanent deletion`"
            outlined
            dense
            :disable="loading"
            :error="confirmationInput.length > 0 && confirmationInput !== user?.username"
            error-message="Username does not match"
          />
        </div>

        <div v-if="errorMessage" class="text-negative q-mb-md">
          {{ errorMessage }}
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn 
          flat 
          label="Cancel" 
          @click="onCancel"
          :disable="loading"
          class="q-mr-sm"
        />
        <q-btn 
          :label="deletionType === 'hard' ? 'Permanently Delete' : 'Deactivate User'"
          :color="deletionType === 'hard' ? 'negative' : 'orange'"
          :loading="loading"
          :disable="!canProceed"
          @click="onConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useQuasar } from 'quasar'

interface User {
  _id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
}

const props = defineProps<{
  modelValue: boolean
  user: User | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'deleted', user: User): void
  (e: 'deactivated', user: User): void
}>()

const $q = useQuasar()
const usersStore = useUsersStore()
const authStore = useAuthStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const loading = ref(false)
const errorMessage = ref('')
const deletionType = ref<'soft' | 'hard'>('soft')
const confirmationInput = ref('')

const baseDeletionOptions = [
  {
    label: 'Deactivate (Recommended)',
    value: 'soft',
    description: 'User cannot log in, but data is preserved'
  },
  {
    label: 'Permanently Delete',
    value: 'hard', 
    description: 'Remove all user data (irreversible)'
  }
]

// Filter options based on user role - admins cannot be permanently deleted
const availableDeletionOptions = computed(() => {
  if (props.user?.role === 'admin') {
    return baseDeletionOptions.filter(option => option.value === 'soft')
  }
  return baseDeletionOptions
})

const canProceed = computed(() => {
  if (!props.user) return false
  
  // Don't allow self-deletion
  if (props.user._id === authStore.user?.id) {
    return false
  }
  
  if (deletionType.value === 'soft') {
    return true
  }
  
  // For hard delete, require username confirmation and check admin role
  if (props.user.role === 'admin') {
    return false // Admin users cannot be hard deleted
  }
  
  return confirmationInput.value === props.user?.username
})

const formatRole = (role: string) => {
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'red'
    case 'warehouse_manager': return 'purple'
    case 'sales_rep': return 'blue'
    case 'viewer': return 'grey'
    default: return 'grey'
  }
}

const resetForm = () => {
  deletionType.value = 'soft'
  confirmationInput.value = ''
  errorMessage.value = ''
  loading.value = false
}

const onHide = () => {
  if (!loading.value) {
    resetForm()
  }
}

const onCancel = () => {
  isOpen.value = false
}

const onConfirm = async () => {
  if (!props.user) return
  
  // Additional safety checks
  if (props.user._id === authStore.user?.id) {
    errorMessage.value = 'You cannot delete your own account'
    return
  }
  
  if (props.user.role === 'admin' && deletionType.value === 'hard') {
    errorMessage.value = 'Admin users cannot be permanently deleted'
    return
  }
  
  loading.value = true
  errorMessage.value = ''
  
  try {
    if (deletionType.value === 'hard') {
      await usersStore.deleteUser(props.user._id)
      
      $q.notify({
        type: 'negative',
        message: `User "${props.user.username}" has been permanently deleted`,
        icon: 'delete_forever',
        position: 'top',
        timeout: 5000
      })
      
      emit('deleted', props.user)
    } else {
      await usersStore.deactivateUser(props.user._id)
      
      $q.notify({
        type: 'warning', 
        message: `User "${props.user.username}" has been deactivated`,
        icon: 'block',
        position: 'top',
        timeout: 3000
      })
      
      emit('deactivated', props.user)
    }
    
    isOpen.value = false
  } catch (error: any) {
    errorMessage.value = error.message || 'Operation failed'
    
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to process user deletion',
      position: 'top',
      timeout: 5000
    })
  } finally {
    loading.value = false
  }
}

// Reset form when dialog opens and adjust deletion type for admin users
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    resetForm()
    // Force soft delete for admin users
    if (props.user?.role === 'admin') {
      deletionType.value = 'soft'
    }
  }
})

// Watch for user changes and update deletion type accordingly
watch(() => props.user?.role, (newRole) => {
  if (newRole === 'admin' && deletionType.value === 'hard') {
    deletionType.value = 'soft'
  }
})
</script>

<style scoped>
.glass-card {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.glass-card-dark {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}
</style>
