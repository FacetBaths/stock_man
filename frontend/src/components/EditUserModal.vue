<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useQuasar } from 'quasar'

interface Props {
  user: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const usersStore = useUsersStore()
const $q = useQuasar()

// Form data
const formData = ref({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  role: 'viewer' as 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer',
  isActive: true
})

// Form validation rules
const rules = {
  required: (val: string) => (val && val.trim().length > 0) || 'This field is required',
  email: (val: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(val) || 'Please enter a valid email address'
  },
  username: (val: string) => {
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    return usernameRegex.test(val) || 'Username can only contain letters, numbers, underscores, and hyphens'
  }
}

// Role options
const roleOptions = [
  { label: 'Admin', value: 'admin', description: 'Full system access and user management' },
  { label: 'Warehouse Manager', value: 'warehouse_manager', description: 'Inventory and stock management' },
  { label: 'Sales Rep', value: 'sales_rep', description: 'Basic inventory access and reservations' },
  { label: 'Viewer', value: 'viewer', description: 'Read-only access to inventory' }
]

// Loading state
const isLoading = ref(false)

// Computed properties
const isFormValid = computed(() => {
  return formData.value.username.trim().length > 0 &&
         formData.value.email.trim().length > 0 &&
         formData.value.firstName.trim().length > 0 &&
         formData.value.lastName.trim().length > 0 &&
         formData.value.role
})

const hasChanges = computed(() => {
  if (!props.user) return false
  
  return formData.value.username !== props.user.username ||
         formData.value.email !== props.user.email ||
         formData.value.firstName !== props.user.firstName ||
         formData.value.lastName !== props.user.lastName ||
         formData.value.role !== props.user.role ||
         formData.value.isActive !== props.user.isActive
})

// Initialize form data
onMounted(() => {
  if (props.user) {
    formData.value = {
      username: props.user.username || '',
      email: props.user.email || '',
      firstName: props.user.firstName || '',
      lastName: props.user.lastName || '',
      role: props.user.role || 'viewer',
      isActive: props.user.isActive !== undefined ? props.user.isActive : true
    }
  }
})

// Methods
const handleSubmit = async () => {
  if (!isFormValid.value) {
    $q.notify({
      type: 'negative',
      message: 'Please fill in all required fields correctly',
      position: 'top'
    })
    return
  }

  if (!hasChanges.value) {
    $q.notify({
      type: 'info',
      message: 'No changes to save',
      position: 'top'
    })
    return
  }

  try {
    isLoading.value = true
    
    await usersStore.updateUser(props.user._id, {
      username: formData.value.username.trim(),
      email: formData.value.email.trim(),
      firstName: formData.value.firstName.trim(),
      lastName: formData.value.lastName.trim(),
      role: formData.value.role,
      isActive: formData.value.isActive
    })

    $q.notify({
      type: 'positive',
      message: `User ${formData.value.username} updated successfully`,
      position: 'top'
    })

    emit('success')
  } catch (error: any) {
    console.error('Failed to update user:', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to update user',
      position: 'top'
    })
  } finally {
    isLoading.value = false
  }
}

const handleClose = () => {
  emit('close')
}

// Role color mapping
const getRoleColor = (role: string) => {
  const colorMap: { [key: string]: string } = {
    'admin': 'red',
    'warehouse_manager': 'purple',
    'sales_rep': 'blue',
    'viewer': 'grey'
  }
  return colorMap[role] || 'grey'
}

// Format role for display
const formatRole = (role: string) => {
  return role.replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
</script>

<template>
  <q-dialog
    :model-value="true"
    @hide="handleClose"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="edit-user-modal">
      <q-card-section class="row items-center q-pb-none bg-primary text-white">
        <q-icon name="edit" size="md" class="q-mr-sm" />
        <div class="text-h6">Edit User</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" color="white" />
      </q-card-section>

      <q-card-section class="q-pa-lg" v-if="user">
        <!-- User Info Header -->
        <q-card flat class="bg-grey-1 q-mb-lg">
          <q-card-section class="q-pa-md">
            <div class="row items-center">
              <q-avatar size="60px" color="primary" text-color="white" class="q-mr-md">
                <q-icon name="account_circle" size="40px" />
              </q-avatar>
              <div>
                <div class="text-h6">{{ user.firstName }} {{ user.lastName }}</div>
                <div class="text-body2 text-grey-6">@{{ user.username }}</div>
                <q-chip 
                  :color="getRoleColor(user.role)" 
                  text-color="white" 
                  size="sm" 
                  :label="formatRole(user.role)"
                  class="q-mt-sm"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-form @submit.prevent="handleSubmit" class="q-gutter-md">
          <!-- Error Banner -->
          <q-banner
            v-if="usersStore.error"
            class="bg-negative text-white q-mb-md"
            dense
            rounded
          >
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            {{ usersStore.error }}
          </q-banner>

          <!-- Personal Information -->
          <div class="row q-gutter-md">
            <div class="col-12">
              <h6 class="text-h6 q-my-sm text-grey-8">Personal Information</h6>
              <q-separator class="q-mb-md" />
            </div>
            
            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.firstName"
                label="First Name *"
                outlined
                :rules="[rules.required]"
                lazy-rules
                hide-bottom-space
              >
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>

            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.lastName"
                label="Last Name *"
                outlined
                :rules="[rules.required]"
                lazy-rules
                hide-bottom-space
              >
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Account Information -->
          <div class="row q-gutter-md">
            <div class="col-12">
              <h6 class="text-h6 q-my-sm text-grey-8">Account Information</h6>
              <q-separator class="q-mb-md" />
            </div>

            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.username"
                label="Username *"
                outlined
                :rules="[rules.required, rules.username]"
                lazy-rules
                hide-bottom-space
              >
                <template v-slot:prepend>
                  <q-icon name="account_circle" />
                </template>
                <template v-slot:hint>
                  Only letters, numbers, underscores, and hyphens
                </template>
              </q-input>
            </div>

            <div class="col-12 col-md-6">
              <q-input
                v-model="formData.email"
                label="Email Address *"
                type="email"
                outlined
                :rules="[rules.required, rules.email]"
                lazy-rules
                hide-bottom-space
              >
                <template v-slot:prepend>
                  <q-icon name="email" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Role & Status -->
          <div class="row q-gutter-md">
            <div class="col-12">
              <h6 class="text-h6 q-my-sm text-grey-8">Role & Status</h6>
              <q-separator class="q-mb-md" />
            </div>

            <div class="col-12 col-md-8">
              <div class="q-gutter-sm">
                <q-radio
                  v-for="option in roleOptions"
                  :key="option.value"
                  v-model="formData.role"
                  :val="option.value"
                  :label="option.label"
                  :color="getRoleColor(option.value)"
                  size="md"
                  class="q-mr-lg"
                />
              </div>
              
              <!-- Role Description -->
              <q-card flat class="bg-grey-1 q-mt-md" v-if="formData.role">
                <q-card-section class="q-pa-md">
                  <div class="text-body2 text-grey-7">
                    <q-icon :name="
                      formData.role === 'admin' ? 'admin_panel_settings' :
                      formData.role === 'warehouse_manager' ? 'warehouse' :
                      formData.role === 'sales_rep' ? 'point_of_sale' : 'visibility'
                    " 
                    :color="getRoleColor(formData.role)" 
                    class="q-mr-sm" />
                    {{ roleOptions.find(r => r.value === formData.role)?.description }}
                  </div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-12 col-md-4">
              <div class="text-subtitle2 text-grey-8 q-mb-md">Account Status</div>
              <q-toggle
                v-model="formData.isActive"
                :label="formData.isActive ? 'Active' : 'Inactive'"
                :color="formData.isActive ? 'positive' : 'negative'"
                :icon="formData.isActive ? 'check_circle' : 'cancel'"
                size="lg"
              />
              <div class="text-caption text-grey-6 q-mt-sm">
                {{ formData.isActive ? 'User can log in and access the system' : 'User cannot log in' }}
              </div>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-lg bg-grey-1">
        <q-btn
          flat
          label="Cancel"
          color="grey-7"
          @click="handleClose"
          :disable="isLoading"
          class="q-mr-sm"
        />
        <q-btn
          color="primary"
          label="Save Changes"
          icon="save"
          @click="handleSubmit"
          :loading="isLoading"
          :disable="!isFormValid || !hasChanges"
          unelevated
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.edit-user-modal {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .edit-user-modal {
    height: 100vh;
  }
}
</style>
