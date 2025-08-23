<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useQuasar } from 'quasar'

const authStore = useAuthStore()
const $q = useQuasar()

// Profile update form
const profileForm = ref({
  firstName: authStore.user?.firstName || '',
  lastName: authStore.user?.lastName || '',
  email: authStore.user?.email || ''
})

const profileLoading = ref(false)

// Password change form
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordLoading = ref(false)
const showPasswordDialog = ref(false)

// Computed properties
const userFullName = computed(() => {
  const user = authStore.user
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`
  }
  return user?.username || 'Unknown User'
})

const roleDisplay = computed(() => {
  const role = authStore.user?.role || ''
  return role.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
})

// Methods
const updateProfile = async () => {
  try {
    profileLoading.value = true
    await authStore.updateProfile(profileForm.value)
    
    $q.notify({
      type: 'positive',
      message: 'Profile updated successfully!',
      position: 'top-right'
    })
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Failed to update profile',
      position: 'top-right'
    })
  } finally {
    profileLoading.value = false
  }
}

const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    $q.notify({
      type: 'negative',
      message: 'New passwords do not match',
      position: 'top-right'
    })
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    $q.notify({
      type: 'negative',
      message: 'Password must be at least 6 characters long',
      position: 'top-right'
    })
    return
  }

  try {
    passwordLoading.value = true
    await authStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    })
    
    // Reset form
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    
    showPasswordDialog.value = false
    
    $q.notify({
      type: 'positive',
      message: 'Password changed successfully!',
      position: 'top-right'
    })
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Failed to change password',
      position: 'top-right'
    })
  } finally {
    passwordLoading.value = false
  }
}

const resetProfileForm = () => {
  profileForm.value = {
    firstName: authStore.user?.firstName || '',
    lastName: authStore.user?.lastName || '',
    email: authStore.user?.email || ''
  }
}
</script>

<template>
  <div class="user-profile-container">
    <q-card class="profile-card glass-card">
      <q-card-section class="profile-header">
        <div class="row items-center q-gutter-md">
          <q-avatar size="64px" class="user-avatar">
            <q-icon name="account_circle" size="48px" class="text-primary" />
          </q-avatar>
          <div class="user-info">
            <h5 class="text-h5 q-ma-none text-dark text-weight-bold">
              {{ userFullName }}
            </h5>
            <p class="text-body2 q-ma-none text-grey-7">
              {{ roleDisplay }} • @{{ authStore.user?.username }}
            </p>
            <q-chip 
              :color="authStore.user?.isActive ? 'positive' : 'negative'"
              text-color="white"
              size="sm"
              class="q-mt-xs"
            >
              {{ authStore.user?.isActive ? 'Active' : 'Inactive' }}
            </q-chip>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <h6 class="text-h6 q-mt-none q-mb-md text-primary">Profile Information</h6>
        
        <form @submit.prevent="updateProfile" class="profile-form">
          <div class="row q-gutter-md">
            <div class="col-12 col-md-5">
              <q-input
                v-model="profileForm.firstName"
                label="First Name"
                outlined
                dense
                class="profile-input"
              >
                <template v-slot:prepend>
                  <q-icon name="person" color="primary" />
                </template>
              </q-input>
            </div>
            
            <div class="col-12 col-md-5">
              <q-input
                v-model="profileForm.lastName"
                label="Last Name"
                outlined
                dense
                class="profile-input"
              >
                <template v-slot:prepend>
                  <q-icon name="person_outline" color="primary" />
                </template>
              </q-input>
            </div>
          </div>

          <div class="row q-gutter-md q-mt-sm">
            <div class="col-12 col-md-10">
              <q-input
                v-model="profileForm.email"
                type="email"
                label="Email Address"
                outlined
                dense
                class="profile-input"
              >
                <template v-slot:prepend>
                  <q-icon name="email" color="primary" />
                </template>
              </q-input>
            </div>
          </div>

          <div class="row q-gutter-sm q-mt-lg">
            <q-btn
              type="submit"
              color="primary"
              :loading="profileLoading"
              :disable="profileLoading"
              unelevated
              no-caps
              class="profile-btn"
            >
              <q-icon name="save" class="q-mr-sm" />
              Update Profile
            </q-btn>
            
            <q-btn
              type="button"
              color="grey-7"
              outline
              no-caps
              @click="resetProfileForm"
              class="profile-btn"
            >
              <q-icon name="refresh" class="q-mr-sm" />
              Reset
            </q-btn>
          </div>
        </form>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <h6 class="text-h6 q-mt-none q-mb-md text-primary">Security</h6>
        
        <div class="row items-center justify-between">
          <div>
            <p class="text-body2 q-ma-none text-dark text-weight-medium">Password</p>
            <p class="text-caption q-ma-none text-grey-6">
              Last updated: {{ authStore.user?.lastLogin ? new Date(authStore.user.lastLogin).toLocaleDateString() : 'Never' }}
            </p>
          </div>
          
          <q-btn
            color="secondary"
            outline
            no-caps
            @click="showPasswordDialog = true"
            class="profile-btn"
          >
            <q-icon name="lock_reset" class="q-mr-sm" />
            Change Password
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- Password Change Dialog -->
    <q-dialog v-model="showPasswordDialog" persistent>
      <q-card style="min-width: 400px" class="glass-card">
        <q-card-section class="bg-primary text-white">
          <h6 class="text-h6 q-ma-none">Change Password</h6>
        </q-card-section>

        <q-card-section>
          <form @submit.prevent="changePassword" class="q-gutter-md">
            <q-input
              v-model="passwordForm.currentPassword"
              type="password"
              label="Current Password"
              outlined
              dense
              required
              :rules="[val => !!val || 'Current password is required']"
            >
              <template v-slot:prepend>
                <q-icon name="lock" color="primary" />
              </template>
            </q-input>

            <q-input
              v-model="passwordForm.newPassword"
              type="password"
              label="New Password"
              outlined
              dense
              required
              :rules="[
                val => !!val || 'New password is required',
                val => val.length >= 6 || 'Password must be at least 6 characters'
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="lock_open" color="primary" />
              </template>
            </q-input>

            <q-input
              v-model="passwordForm.confirmPassword"
              type="password"
              label="Confirm New Password"
              outlined
              dense
              required
              :rules="[
                val => !!val || 'Please confirm your password',
                val => val === passwordForm.newPassword || 'Passwords do not match'
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="lock_outline" color="primary" />
              </template>
            </q-input>
          </form>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            label="Cancel"
            color="grey-7"
            v-close-popup
            no-caps
          />
          <q-btn
            unelevated
            label="Change Password"
            color="primary"
            :loading="passwordLoading"
            :disable="passwordLoading"
            @click="changePassword"
            no-caps
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.user-profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.profile-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.profile-header {
  background: linear-gradient(135deg, rgba(153, 69, 255, 0.1), rgba(20, 241, 149, 0.1));
  border-bottom: 1px solid rgba(153, 69, 255, 0.2);
}

.user-avatar {
  background: rgba(153, 69, 255, 0.1);
  border: 2px solid rgba(153, 69, 255, 0.3);
}

.user-info {
  flex: 1;
}

.profile-form {
  .profile-input {
    :deep(.q-field__control) {
      border-radius: 8px;
    }
  }
}

.profile-btn {
  border-radius: 8px;
  min-width: 120px;
  font-weight: 500;
}

.glass-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

@media (max-width: 600px) {
  .user-profile-container {
    padding: 0.5rem;
  }
  
  .profile-header {
    .row {
      flex-direction: column;
      text-align: center;
      
      .user-info {
        margin-top: 1rem;
      }
    }
  }
}
</style>
