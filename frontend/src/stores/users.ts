import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

interface UserData {
  _id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLogin?: string
}

interface UserStats {
  summary: {
    totalUsers: number
    activeUsers: number
    inactiveUsers: number
    lockedUsers: number
  }
  by_role: Array<{
    _id: string
    count: number
    activeCount: number
  }>
  recent_activity: {
    recent_logins: number
    period_days: number
  }
}

interface UsersPagination {
  current_page: number
  total_pages: number
  total_users: number
  users_per_page: number
}

export const useUsersStore = defineStore('users', () => {
  const authStore = useAuthStore()
  
  // State
  const users = ref<UserData[]>([])
  const stats = ref<UserStats | null>(null)
  const pagination = ref<UsersPagination>({
    current_page: 1,
    total_pages: 0,
    total_users: 0,
    users_per_page: 20
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Search and filter state
  const currentPage = ref(1)
  const searchQuery = ref('')
  const selectedRole = ref<string>('all')
  const statusFilter = ref<string>('all') // all, active, inactive
  
  // Computed
  const canManageUsers = computed(() => authStore.hasRole('admin'))
  
  const filteredUsers = computed(() => {
    return users.value.filter(user => {
      // Search filter
      const matchesSearch = !searchQuery.value || 
        user.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchQuery.value.toLowerCase())
      
      // Role filter
      const matchesRole = selectedRole.value === 'all' || user.role === selectedRole.value
      
      // Status filter
      const matchesStatus = statusFilter.value === 'all' || 
        (statusFilter.value === 'active' && user.isActive) ||
        (statusFilter.value === 'inactive' && !user.isActive)
      
      return matchesSearch && matchesRole && matchesStatus
    })
  })
  
  const roleOptions = [
    { label: 'All Roles', value: 'all' },
    { label: 'Admin', value: 'admin' },
    { label: 'Warehouse Manager', value: 'warehouse_manager' },
    { label: 'Sales Rep', value: 'sales_rep' },
    { label: 'Viewer', value: 'viewer' }
  ]
  
  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ]
  
  // Actions
  const fetchUsers = async (page = 1, limit = 20, forceRefresh = false) => {
    if (!canManageUsers.value) {
      error.value = 'Insufficient permissions to manage users'
      return
    }
    
    if (isLoading.value && !forceRefresh) return
    
    try {
      isLoading.value = true
      error.value = null
      
      const params: any = {
        page,
        limit
      }
      
      if (searchQuery.value) params.search = searchQuery.value
      if (selectedRole.value !== 'all') params.role = selectedRole.value
      if (statusFilter.value !== 'all') params.active = statusFilter.value === 'active'
      
      const response = await userApi.getUsers(params)
      
      users.value = response.users
      pagination.value = response.pagination
      currentPage.value = page
      
      console.log('Users fetched successfully:', response.users.length, 'users')
    } catch (err: any) {
      console.error('Failed to fetch users:', err)
      error.value = err.response?.data?.message || 'Failed to load users'
    } finally {
      isLoading.value = false
    }
  }
  
  const fetchUserStats = async () => {
    if (!canManageUsers.value) return
    
    try {
      const response = await userApi.getStats()
      stats.value = response
      console.log('User stats fetched successfully')
    } catch (err: any) {
      console.error('Failed to fetch user stats:', err)
      // Don't show error for stats as it's not critical
    }
  }
  
  const getUser = async (id: string) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions')
    }
    
    try {
      const response = await userApi.getUser(id)
      return response.user
    } catch (err: any) {
      console.error('Failed to fetch user:', err)
      throw new Error(err.response?.data?.message || 'Failed to load user details')
    }
  }
  
  const createUser = async (userData: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    role: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
  }) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to create users')
    }
    
    try {
      const response = await userApi.createUser(userData)
      
      // Add the new user to the list if we're on the current page
      if (users.value.length < pagination.value.users_per_page) {
        users.value.unshift(response.user)
      }
      
      // Update stats if available
      if (stats.value) {
        stats.value.summary.totalUsers++
        if (response.user.isActive) {
          stats.value.summary.activeUsers++
        }
      }
      
      console.log('User created successfully:', response.user.username)
      return response
    } catch (err: any) {
      console.error('Failed to create user:', err)
      throw new Error(err.response?.data?.message || 'Failed to create user')
    }
  }
  
  const updateUser = async (id: string, updates: {
    username?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
    isActive?: boolean
  }) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to update users')
    }
    
    try {
      const response = await userApi.updateUser(id, updates)
      
      // Update the user in the local list
      const userIndex = users.value.findIndex(user => user._id === id)
      if (userIndex !== -1) {
        users.value[userIndex] = { ...users.value[userIndex], ...response.user }
      }
      
      console.log('User updated successfully:', response.user.username)
      return response
    } catch (err: any) {
      console.error('Failed to update user:', err)
      throw new Error(err.response?.data?.message || 'Failed to update user')
    }
  }
  
  const resetUserPassword = async (id: string, newPassword: string) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to reset passwords')
    }
    
    try {
      const response = await userApi.resetPassword(id, newPassword)
      console.log('Password reset successfully for user:', id)
      return response
    } catch (err: any) {
      console.error('Failed to reset password:', err)
      throw new Error(err.response?.data?.message || 'Failed to reset password')
    }
  }
  
  const unlockUser = async (id: string) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to unlock users')
    }
    
    try {
      const response = await userApi.unlockUser(id)
      
      // Find and update the user in the list (reset any locked status)
      const userIndex = users.value.findIndex(user => user._id === id)
      if (userIndex !== -1) {
        // User unlock doesn't return user data, so we just refresh the user info
        await fetchUsers(currentPage.value, pagination.value.users_per_page, true)
      }
      
      console.log('User unlocked successfully:', id)
      return response
    } catch (err: any) {
      console.error('Failed to unlock user:', err)
      throw new Error(err.response?.data?.message || 'Failed to unlock user')
    }
  }
  
  const deactivateUser = async (id: string) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to deactivate users')
    }
    
    try {
      const response = await userApi.deactivateUser(id)
      
      // Update the user in the local list
      const userIndex = users.value.findIndex(user => user._id === id)
      if (userIndex !== -1) {
        users.value[userIndex].isActive = false
      }
      
      // Update stats if available
      if (stats.value) {
        stats.value.summary.activeUsers--
        stats.value.summary.inactiveUsers++
      }
      
      console.log('User deactivated successfully:', id)
      return response
    } catch (err: any) {
      console.error('Failed to deactivate user:', err)
      throw new Error(err.response?.data?.message || 'Failed to deactivate user')
    }
  }
  
  const deleteUser = async (id: string) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to delete users')
    }
    
    try {
      const response = await userApi.deleteUser(id)
      
      // Remove the user from the local list
      const userIndex = users.value.findIndex(user => user._id === id)
      if (userIndex !== -1) {
        const deletedUser = users.value[userIndex]
        users.value.splice(userIndex, 1)
        
        // Update stats if available
        if (stats.value) {
          stats.value.summary.totalUsers--
          if (deletedUser.isActive) {
            stats.value.summary.activeUsers--
          } else {
            stats.value.summary.inactiveUsers--
          }
        }
      }
      
      console.log('User permanently deleted successfully:', id)
      return response
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      throw new Error(err.response?.data?.message || 'Failed to delete user')
    }
  }
  
  const getUserActivity = async (id: string, days = 30, limit = 50) => {
    if (!canManageUsers.value) {
      throw new Error('Insufficient permissions to view user activity')
    }
    
    try {
      const response = await userApi.getUserActivity(id, { days, limit })
      return response
    } catch (err: any) {
      console.error('Failed to fetch user activity:', err)
      throw new Error(err.response?.data?.message || 'Failed to load user activity')
    }
  }
  
  // Filter and search actions
  const setSearchQuery = (query: string) => {
    searchQuery.value = query
    currentPage.value = 1
    fetchUsers(1, pagination.value.users_per_page, true)
  }
  
  const setRoleFilter = (role: string) => {
    selectedRole.value = role
    currentPage.value = 1
    fetchUsers(1, pagination.value.users_per_page, true)
  }
  
  const setStatusFilter = (status: string) => {
    statusFilter.value = status
    currentPage.value = 1
    fetchUsers(1, pagination.value.users_per_page, true)
  }
  
  const nextPage = () => {
    if (currentPage.value < pagination.value.total_pages) {
      fetchUsers(currentPage.value + 1, pagination.value.users_per_page)
    }
  }
  
  const prevPage = () => {
    if (currentPage.value > 1) {
      fetchUsers(currentPage.value - 1, pagination.value.users_per_page)
    }
  }
  
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.value.total_pages) {
      fetchUsers(page, pagination.value.users_per_page)
    }
  }
  
  const clearError = () => {
    error.value = null
  }
  
  const refreshUsers = () => {
    fetchUsers(currentPage.value, pagination.value.users_per_page, true)
  }
  
  return {
    // State
    users,
    stats,
    pagination,
    isLoading,
    error,
    searchQuery,
    selectedRole,
    statusFilter,
    currentPage,
    
    // Computed
    canManageUsers,
    filteredUsers,
    roleOptions,
    statusOptions,
    
    // Actions
    fetchUsers,
    fetchUserStats,
    getUser,
    createUser,
    updateUser,
    resetUserPassword,
    unlockUser,
    deactivateUser,
    deleteUser,
    getUserActivity,
    
    // Filter actions
    setSearchQuery,
    setRoleFilter,
    setStatusFilter,
    nextPage,
    prevPage,
    goToPage,
    
    // Utility
    clearError,
    refreshUsers
  }
})
