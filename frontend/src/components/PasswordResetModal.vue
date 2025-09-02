<script setup lang="ts">
import { ref, computed } from 'vue'
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
  newPassword: '',
  confirmPassword: ''
})

// Form validation rules
const rules = {
  required: (val: string) => (val && val.trim().length > 0) || 'This field is required',
  password: (val: string) => val.length >= 6 || 'Password must be at least 6 characters long',
  confirmPassword: (val: string) => val === formData.value.newPassword || 'Passwords do not match'
}

// Loading state
const isLoading = ref(false)

// Show passwords toggle
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// Generate random password
const generateRandomPassword = () => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  formData.value.newPassword = password
  formData.value.confirmPassword = password
}

// Computed properties
const isFormValid = computed(() => {
  return formData.value.newPassword.length >= 6 &&
         formData.value.confirmPassword === formData.value.newPassword
})

// Methods
const handleSubmit = async () => {
  if (!isFormValid.value) {
    $q.notify({
      type: 'negative',
      message: 'Please enter a valid password and confirm it',
      position: 'top'
    })
    return
  }

  try {
    isLoading.value = true
    
    await usersStore.resetUserPassword(props.user._id, formData.value.newPassword)

    $q.notify({
      type: 'positive',
      message: `Password reset successfully for ${props.user.username}`,
      position: 'top'
    })

    emit('success')
  } catch (error: any) {
    console.error('Failed to reset password:', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to reset password',
      position: 'top'
    })
  } finally {
    isLoading.value = false
  }
}

const handleClose = () => {
  emit('close')
}

// Copy password to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    $q.notify({
      type: 'positive',
      message: 'Password copied to clipboard',
      position: 'top',
      timeout: 2000
    })
  } catch (error) {
    console.error('Failed to copy password:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to copy password to clipboard',
      position: 'top'
    })
  }
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
    transition-show="scale"
    transition-hide="scale"
  >
    <q-card style="min-width: 500px; max-width: 600px;">
      <q-card-section class="row items-center q-pb-none bg-warning text-white">
        <q-icon name="lock_reset" size="md" class="q-mr-sm" />
        <div class="text-h6">Reset User Password</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" color="white" />
      </q-card-section>

      <q-card-section class="q-pa-lg" v-if="user">
        <!-- User Info -->
        <q-card flat class="bg-grey-1 q-mb-lg">
          <q-card-section class="q-pa-md">
            <div class="row items-center">
              <q-avatar size="50px" color="warning" text-color="white" class="q-mr-md">
                <q-icon name="account_circle" size="30px" />
              </q-avatar>
              <div>
                <div class="text-h6">{{ user.firstName }} {{ user.lastName }}</div>
                <div class="text-body2 text-grey-6">@{{ user.username }} • {{ formatRole(user.role) }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Warning Notice -->
        <q-banner class="bg-orange-1 text-orange-8 q-mb-lg" dense rounded>
          <template v-slot:avatar>
            <q-icon name="warning" color="orange" />
          </template>
          <div class="text-body2">
            <strong>Security Notice:</strong> This will immediately invalidate all existing sessions for this user. 
            They will need to log in again with the new password.
          </div>
        </q-banner>

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

          <!-- Password Generation -->
          <div class="q-mb-md">
            <div class="row justify-between items-center q-mb-sm">
              <div class="text-subtitle2 text-grey-8">New Password</div>
              <q-btn
                flat
                dense
                color="primary"
                label="Generate Random"
                icon="shuffle"
                size="sm"
                @click="generateRandomPassword"
              />
            </div>
          </div>

          <!-- New Password Input -->
          <q-input
            v-model="formData.newPassword"
            label="New Password *"
            :type="showNewPassword ? 'text' : 'password'"
            outlined
            :rules="[rules.required, rules.password]"
            lazy-rules
            hide-bottom-space
            autocomplete="new-password"
          >
            <template v-slot:prepend>
              <q-icon name="lock" />
            </template>
            <template v-slot:append>
              <q-btn
                flat
                dense
                round
                :icon="showNewPassword ? 'visibility_off' : 'visibility'"
                @click="showNewPassword = !showNewPassword"
                color="grey-6"
              />
              <q-btn
                v-if="formData.newPassword"
                flat
                dense
                round
                icon="content_copy"
                @click="copyToClipboard(formData.newPassword)"
                color="grey-6"
              >
                <q-tooltip>Copy to clipboard</q-tooltip>
              </q-btn>
            </template>
            <template v-slot:hint>
              Minimum 6 characters. Click the copy icon to copy the password.
            </template>
          </q-input>

          <!-- Confirm Password Input -->
          <q-input
            v-model="formData.confirmPassword"
            label="Confirm Password *"
            :type="showConfirmPassword ? 'text' : 'password'"
            outlined
            :rules="[rules.required, rules.confirmPassword]"
            lazy-rules
            hide-bottom-space
            autocomplete="new-password"
          >
            <template v-slot:prepend>
              <q-icon name="lock" />
            </template>
            <template v-slot:append>
              <q-btn
                flat
                dense
                round
                :icon="showConfirmPassword ? 'visibility_off' : 'visibility'"
                @click="showConfirmPassword = !showConfirmPassword"
                color="grey-6"
              />
            </template>
          </q-input>

          <!-- Password Strength Indicator -->
          <div v-if="formData.newPassword" class="q-mt-md">
            <div class="text-caption text-grey-6 q-mb-xs">Password Strength:</div>
            <div class="row q-gutter-xs">
              <div
                v-for="i in 4"
                :key="i"
                class="col strength-bar"
                :class="{
                  'bg-red': formData.newPassword.length >= 1 && i <= 1,
                  'bg-orange': formData.newPassword.length >= 6 && i <= 2,
                  'bg-amber': formData.newPassword.length >= 8 && i <= 3,
                  'bg-green': formData.newPassword.length >= 10 && i <= 4,
                  'bg-grey-3': formData.newPassword.length < (i * 3 - 2)
                }"
              ></div>
            </div>
            <div class="text-caption text-grey-6 q-mt-xs">
              {{ 
                formData.newPassword.length < 6 ? 'Too short' :
                formData.newPassword.length < 8 ? 'Fair' :
                formData.newPassword.length < 10 ? 'Good' : 'Strong'
              }}
            </div>
          </div>
        </q-form>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-lg">
        <q-btn
          flat
          label="Cancel"
          color="grey-7"
          @click="handleClose"
          :disable="isLoading"
          class="q-mr-sm"
        />
        <q-btn
          color="warning"
          label="Reset Password"
          icon="lock_reset"
          @click="handleSubmit"
          :loading="isLoading"
          :disable="!isFormValid"
          unelevated
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.strength-bar {
  height: 4px;
  border-radius: 2px;
  transition: background-color 0.3s;
}
</style>
