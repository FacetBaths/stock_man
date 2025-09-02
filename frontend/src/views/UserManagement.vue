<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useQuasar } from 'quasar'
import AddUserModal from '@/components/AddUserModal.vue'
import EditUserModal from '@/components/EditUserModal.vue'
import PasswordResetModal from '@/components/PasswordResetModal.vue'
import DeleteUserModal from '@/components/modals/DeleteUserModal.vue'

const authStore = useAuthStore()
const usersStore = useUsersStore()
const $q = useQuasar()

// Check admin access - redirect if not admin
if (!authStore.isAdmin) {
  console.warn('Non-admin user attempted to access user management')
  // This will be caught by the router guard, but add extra protection
}

// Component state
const showAddUserModal = ref(false)
const showEditUserModal = ref(false)
const showPasswordResetModal = ref(false)
const showDeleteUserModal = ref(false)
const showDeactivateDialog = ref(false)
const selectedUser = ref(null)

// Table configuration
const tableColumns = [
  {
    name: 'username',
    required: true,
    label: 'Username',
    align: 'left',
    field: 'username',
    sortable: true
  },
  {
    name: 'fullName',
    label: 'Full Name',
    align: 'left',
    field: (row: any) => `${row.firstName} ${row.lastName}`,
    sortable: false
  },
  {
    name: 'email',
    label: 'Email',
    align: 'left',
    field: 'email',
    sortable: true
  },
  {
    name: 'role',
    label: 'Role',
    align: 'left',
    field: 'role',
    sortable: true
  },
  {
    name: 'status',
    label: 'Status',
    align: 'center',
    field: 'isActive',
    sortable: true
  },
  {
    name: 'lastLogin',
    label: 'Last Login',
    align: 'left',
    field: 'lastLogin',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    sortable: false
  }
]

// Table pagination
const tablePagination = ref({
  sortBy: 'createdAt',
  descending: true,
  page: 1,
  rowsPerPage: 20
})

// Computed properties
const displayUsers = computed(() => usersStore.filteredUsers)

const userStats = computed(() => {
  if (!usersStore.stats) return null
  return usersStore.stats
})

// Role formatting
const formatRole = (role: string) => {
  return role.replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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

// Date formatting
const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
        return diffInMinutes < 5 ? 'Just now' : `${diffInMinutes} minutes ago`
      }
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7)
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30)
      return months === 1 ? '1 month ago' : `${months} months ago`
    } else {
      return date.toLocaleDateString()
    }
  } catch {
    return 'Invalid date'
  }
}

// Methods
const openAddUserModal = () => {
  showAddUserModal.value = true
}

const openEditUserModal = (user: any) => {
  selectedUser.value = { ...user }
  showEditUserModal.value = true
}

const openPasswordResetModal = (user: any) => {
  selectedUser.value = user
  showPasswordResetModal.value = true
}

const openDeleteUserModal = (user: any) => {
  selectedUser.value = user
  showDeleteUserModal.value = true
}

const openDeactivateDialog = (user: any) => {
  selectedUser.value = user
  showDeactivateDialog.value = true
}

const unlockUser = async (user: any) => {
  try {
    await usersStore.unlockUser(user._id)
    $q.notify({
      type: 'positive',
      message: `User ${user.username} has been unlocked`,
      position: 'top'
    })
    await usersStore.refreshUsers()
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to unlock user',
      position: 'top'
    })
  }
}

const handleDeactivateUser = async () => {
  if (!selectedUser.value) return
  
  try {
    await usersStore.deactivateUser(selectedUser.value._id)
    $q.notify({
      type: 'positive',
      message: `User ${selectedUser.value.username} has been deactivated`,
      position: 'top'
    })
    showDeactivateDialog.value = false
    selectedUser.value = null
    await usersStore.refreshUsers()
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to deactivate user',
      position: 'top'
    })
  }
}

const viewUserActivity = (user: any) => {
  // TODO: Implement user activity view
  console.log('View user activity:', user)
  $q.notify({
    type: 'info',
    message: 'User activity view coming soon',
    position: 'top'
  })
}

// Load initial data
onMounted(async () => {
  if (usersStore.canManageUsers) {
    try {
      await Promise.all([
        usersStore.fetchUsers(),
        usersStore.fetchUserStats()
      ])
    } catch (error) {
      console.error('Failed to load user management data:', error)
    }
  }
})

// Refresh data
const refreshData = async () => {
  try {
    await Promise.all([
      usersStore.fetchUsers(usersStore.currentPage, usersStore.pagination.users_per_page, true),
      usersStore.fetchUserStats()
    ])
    $q.notify({
      type: 'positive',
      message: 'Data refreshed successfully',
      position: 'top'
    })
  } catch (error) {
    console.error('Failed to refresh data:', error)
  }
}
</script>

<template>
  <q-page class="q-pa-lg">
    <!-- Access Denied for Non-Admin -->
    <div v-if="!usersStore.canManageUsers" class="text-center q-pa-xl">
      <q-icon name="block" size="120px" color="negative" class="q-mb-md" />
      <h4 class="text-h4 text-grey-7 q-mb-md">Access Denied</h4>
      <p class="text-body1 text-grey-6">
        You don't have permission to access user management. 
        Only administrators can manage users.
      </p>
      <q-btn
        color="primary"
        label="Back to Dashboard"
        icon="dashboard"
        :to="{ name: 'Dashboard' }"
        class="q-mt-lg"
      />
    </div>

    <!-- Main User Management Interface -->
    <div v-else>
      <!-- Header -->
      <div class="row items-center justify-between q-mb-lg">
        <div>
          <h4 class="text-h4 q-my-none text-grey-8">User Management</h4>
          <p class="text-body2 text-grey-6 q-mt-sm">
            Manage system users, roles, and permissions
          </p>
        </div>
        <div class="row q-gutter-md">
          <q-btn
            color="primary"
            icon="refresh"
            label="Refresh"
            @click="refreshData"
            :loading="usersStore.isLoading"
            outline
          />
          <q-btn
            color="positive"
            icon="add"
            label="Add User"
            @click="openAddUserModal"
          />
        </div>
      </div>

      <!-- Stats Cards -->
      <div v-if="userStats" class="row q-gutter-md q-mb-lg">
        <div class="col-12 col-md-3">
          <q-card class="glass-card">
            <q-card-section class="text-center">
              <div class="text-h6 text-primary">{{ userStats.summary.totalUsers }}</div>
              <div class="text-caption text-grey-6">Total Users</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-3">
          <q-card class="glass-card">
            <q-card-section class="text-center">
              <div class="text-h6 text-positive">{{ userStats.summary.activeUsers }}</div>
              <div class="text-caption text-grey-6">Active Users</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-3">
          <q-card class="glass-card">
            <q-card-section class="text-center">
              <div class="text-h6 text-warning">{{ userStats.summary.inactiveUsers }}</div>
              <div class="text-caption text-grey-6">Inactive Users</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-3">
          <q-card class="glass-card">
            <q-card-section class="text-center">
              <div class="text-h6 text-negative">{{ userStats.summary.lockedUsers }}</div>
              <div class="text-caption text-grey-6">Locked Users</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Filters -->
      <q-card class="glass-card q-mb-lg">
        <q-card-section>
          <div class="row q-gutter-md items-end">
            <div class="col-12 col-md-4">
              <q-input
                v-model="usersStore.searchQuery"
                label="Search users..."
                dense
                outlined
                clearable
                debounce="300"
                :loading="usersStore.isLoading"
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select
                v-model="usersStore.selectedRole"
                :options="usersStore.roleOptions"
                option-label="label"
                option-value="value"
                emit-value
                map-options
                label="Filter by role"
                dense
                outlined
                clearable
              />
            </div>
            <div class="col-12 col-md-3">
              <q-select
                v-model="usersStore.statusFilter"
                :options="usersStore.statusOptions"
                option-label="label"
                option-value="value"
                emit-value
                map-options
                label="Filter by status"
                dense
                outlined
                clearable
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Users Table -->
      <q-card class="glass-card">
        <q-table
          :rows="displayUsers"
          :columns="tableColumns"
          :loading="usersStore.isLoading"
          :pagination="tablePagination"
          row-key="_id"
          flat
          bordered
          class="users-table"
        >
          <!-- Role column -->
          <template v-slot:body-cell-role="props">
            <q-td :props="props">
              <q-chip
                :color="getRoleColor(props.value)"
                text-color="white"
                dense
                :label="formatRole(props.value)"
              />
            </q-td>
          </template>

          <!-- Status column -->
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip
                :color="props.value ? 'positive' : 'negative'"
                text-color="white"
                dense
                :label="props.value ? 'Active' : 'Inactive'"
                :icon="props.value ? 'check' : 'block'"
              />
            </q-td>
          </template>

          <!-- Last Login column -->
          <template v-slot:body-cell-lastLogin="props">
            <q-td :props="props">
              <span class="text-body2">{{ formatDate(props.value) }}</span>
            </q-td>
          </template>

          <!-- Actions column -->
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn-group flat>
                <q-btn
                  flat
                  dense
                  color="primary"
                  icon="edit"
                  @click="openEditUserModal(props.row)"
                >
                  <q-tooltip>Edit User</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  color="warning"
                  icon="lock_reset"
                  @click="openPasswordResetModal(props.row)"
                >
                  <q-tooltip>Reset Password</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="delete"
                  @click="openDeleteUserModal(props.row)"
                  :disable="props.row._id === authStore.user?._id"
                >
                  <q-tooltip>Delete/Deactivate User</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  color="info"
                  icon="history"
                  @click="viewUserActivity(props.row)"
                >
                  <q-tooltip>View Activity</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  color="orange"
                  icon="lock_open"
                  @click="unlockUser(props.row)"
                >
                  <q-tooltip>Unlock Account</q-tooltip>
                </q-btn>
              </q-btn-group>
            </q-td>
          </template>

          <!-- No data -->
          <template v-slot:no-data="{ message }">
            <div class="full-width row flex-center text-grey q-gutter-sm q-pa-lg">
              <q-icon size="2em" name="people_outline" />
              <span class="text-body1">{{ message || 'No users found' }}</span>
            </div>
          </template>

          <!-- Loading -->
          <template v-slot:loading>
            <q-inner-loading showing color="primary" />
          </template>
        </q-table>
      </q-card>

      <!-- Error Display -->
      <q-banner v-if="usersStore.error" class="text-white bg-negative q-mt-md" rounded>
        <template v-slot:avatar>
          <q-icon name="error" color="white" />
        </template>
        {{ usersStore.error }}
        <template v-slot:action>
          <q-btn flat color="white" label="Dismiss" @click="usersStore.clearError" />
        </template>
      </q-banner>
    </div>

    <!-- Deactivate Confirmation Dialog -->
    <q-dialog v-model="showDeactivateDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="warning" text-color="white" />
          <span class="q-ml-sm">Are you sure you want to deactivate this user?</span>
        </q-card-section>

        <q-card-section v-if="selectedUser" class="q-pt-none">
          <div class="text-body2">
            <strong>Username:</strong> {{ selectedUser.username }}<br>
            <strong>Name:</strong> {{ selectedUser.firstName }} {{ selectedUser.lastName }}<br>
            <strong>Role:</strong> {{ formatRole(selectedUser.role) }}
          </div>
          <div class="q-mt-md text-caption text-grey-6">
            This action will prevent the user from logging in. You can reactivate them later if needed.
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn 
            flat 
            label="Deactivate" 
            color="negative" 
            @click="handleDeactivateUser"
            :loading="usersStore.isLoading"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add User Modal -->
    <AddUserModal
      v-if="showAddUserModal"
      @close="showAddUserModal = false"
      @success="() => { showAddUserModal = false; refreshData(); }"
    />

    <!-- Edit User Modal -->
    <EditUserModal
      v-if="showEditUserModal && selectedUser"
      :user="selectedUser"
      @close="() => { showEditUserModal = false; selectedUser = null; }"
      @success="() => { showEditUserModal = false; selectedUser = null; refreshData(); }"
    />

    <!-- Password Reset Modal -->
    <PasswordResetModal
      v-if="showPasswordResetModal && selectedUser"
      :user="selectedUser"
      @close="() => { showPasswordResetModal = false; selectedUser = null; }"
      @success="() => { showPasswordResetModal = false; selectedUser = null; }"
    />

    <!-- Delete User Modal -->
    <DeleteUserModal
      v-if="showDeleteUserModal && selectedUser"
      v-model="showDeleteUserModal"
      :user="selectedUser"
      @deleted="() => { showDeleteUserModal = false; selectedUser = null; refreshData(); }"
      @deactivated="() => { showDeleteUserModal = false; selectedUser = null; refreshData(); }"
    />
  </q-page>
</template>

<style scoped>
.users-table {
  background: transparent;
}

.users-table .q-table__container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 8px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
