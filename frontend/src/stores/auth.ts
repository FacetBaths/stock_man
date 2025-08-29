import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  User, 
  LoginCredentials, 
  LoginResponse, 
  TokenRefreshResponse, 
  UpdateProfileRequest,
  ChangePasswordRequest
} from '@/types'
import { authApi } from '@/utils/api'

interface JwtPayload {
  exp: number
  userId: string
  username: string
  role: string
  sessionId?: string
  iat: number
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)
  const refreshPromise = ref<Promise<void> | null>(null)
  const tokenRefreshTimer = ref<NodeJS.Timeout | null>(null)

  // Computed properties
  const isAuthenticated = computed(() => {
    return !!accessToken.value && !!refreshToken.value && !!user.value
  })

  const canWrite = computed(() => {
    if (!user.value) return false
    return user.value.role === 'admin' || 
           user.value.role === 'warehouse_manager' ||
           user.value.role === 'sales_rep'
  })

  const isAdmin = computed(() => user.value?.role === 'admin')

  // Helper functions
  const hasRole = (role: string | string[]) => {
    if (!user.value) return false
    if (user.value.role === 'admin') return true
    
    if (Array.isArray(role)) {
      return role.includes(user.value.role)
    }
    return user.value.role === role
  }

  const hasPermission = (permission: string) => {
    if (!user.value) return false
    
    // Role-based permission mapping
    const rolePermissions = {
      admin: ['read', 'write', 'delete', 'manage_users', 'view_audit_logs'],
      warehouse_manager: ['read', 'write', 'delete'],
      sales_rep: ['read', 'write'],
      viewer: ['read']
    }
    
    const userPermissions = rolePermissions[user.value.role as keyof typeof rolePermissions] || []
    return userPermissions.includes(permission)
  }

  const isTokenExpired = (token: string): boolean => {
    try {
      // Simple JWT decode without library dependency
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      
      const decoded = JSON.parse(jsonPayload) as JwtPayload
      const currentTime = Date.now() / 1000
      const expiresIn = decoded.exp - currentTime
      
      console.log(`Token expires in ${expiresIn} seconds`)
      
      // Consider expired if expires in next 2 minutes to allow time for refresh
      return expiresIn <= 120
    } catch (error) {
      console.error('Token decode error:', error)
      return true
    }
  }

  // Token refresh logic
  const refreshTokens = async (): Promise<void> => {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    // If there's already a refresh in progress, wait for it
    if (refreshPromise.value) {
      return refreshPromise.value
    }

    refreshPromise.value = (async () => {
      try {
        console.log('Refreshing tokens...')
        const response = await authApi.refreshToken(refreshToken.value!)

        if (response.accessToken && response.user) {
          accessToken.value = response.accessToken
          user.value = response.user
          
          // Store tokens securely
          localStorage.setItem('accessToken', response.accessToken)
          localStorage.setItem('user', JSON.stringify(response.user))
          
          console.log('Tokens refreshed successfully')
        } else {
          throw new Error('Invalid refresh response')
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
        // Clear all auth data on refresh failure - don't call API logout to avoid infinite loop
        clearAuthData()
        throw error
      } finally {
        refreshPromise.value = null
      }
    })()

    return refreshPromise.value
  }

  const getValidAccessToken = async (): Promise<string | null> => {
    if (!accessToken.value || !refreshToken.value) {
      return null
    }

    // Check if access token is expired or about to expire
    if (isTokenExpired(accessToken.value)) {
      try {
        await refreshTokens()
      } catch (error) {
        console.error('Failed to refresh token:', error)
        return null
      }
    }

    return accessToken.value
  }

  // Auth actions
  const initializeAuth = async () => {
    if (initialized.value) return
    
    console.log('=== INITIALIZING AUTH ===')
    
    try {
      const storedAccessToken = localStorage.getItem('accessToken') || localStorage.getItem('token')
      const storedRefreshToken = localStorage.getItem('refreshToken')
      const storedUser = localStorage.getItem('user')
      
      console.log('Stored auth data:', {
        hasAccessToken: !!storedAccessToken,
        hasRefreshToken: !!storedRefreshToken,
        hasUser: !!storedUser
      })
      
      if (storedAccessToken && storedUser) {
        try {
          // Parse user data first to validate it
          const userData = JSON.parse(storedUser)
          
          // Check if access token is expired
          const tokenExpired = isTokenExpired(storedAccessToken)
          console.log('Access token expired:', tokenExpired)
          
          if (tokenExpired) {
            // If access token is expired but we have refresh token, try to refresh
            if (storedRefreshToken && !isTokenExpired(storedRefreshToken)) {
              console.log('Access token expired but refresh token is valid, setting up for refresh...')
              // Set the tokens so refresh can work
              accessToken.value = storedAccessToken
              refreshToken.value = storedRefreshToken
              user.value = userData
              
              // Try to refresh immediately during initialization
              try {
                await refreshTokens()
                console.log('Token refresh during init successful')
              } catch (refreshError) {
                console.error('Token refresh during init failed:', refreshError)
                clearAuthData()
                return
              }
            } else {
              console.log('Both access and refresh tokens are expired, clearing auth')
              clearAuthData()
              return
            }
          } else {
            // Token is still valid
            console.log('Access token is still valid')
            accessToken.value = storedAccessToken
            refreshToken.value = storedRefreshToken
            user.value = userData
          }
          
          console.log('Auth initialized successfully:', { 
            user: user.value?.username,
            hasAccessToken: !!accessToken.value,
            hasRefreshToken: !!refreshToken.value
          })
        } catch (parseError) {
          console.error('Error parsing stored user data:', parseError)
          clearAuthData()
        }
      } else {
        console.log('No complete stored auth data found, clearing any partial data')
        clearAuthData()
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      clearAuthData()
    } finally {
      initialized.value = true
      console.log('=== AUTH INITIALIZATION COMPLETED ===')
    }
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await authApi.login(credentials)
      
      // Handle both new and legacy response formats
      if (response.accessToken && response.refreshToken) {
        // New enhanced auth system
        accessToken.value = response.accessToken
        refreshToken.value = response.refreshToken
        user.value = response.user
        
        localStorage.setItem('accessToken', response.accessToken)
        localStorage.setItem('refreshToken', response.refreshToken)
        localStorage.setItem('user', JSON.stringify(response.user))
        
        // Clean up any legacy token
        localStorage.removeItem('token')
      } else if ((response as any).token) {
        // Legacy auth system fallback
        accessToken.value = (response as any).token
        user.value = response.user
        
        localStorage.setItem('accessToken', (response as any).token)
        localStorage.setItem('token', (response as any).token) // Keep for compatibility
        localStorage.setItem('user', JSON.stringify(response.user))
      } else {
        throw new Error('Invalid login response format')
      }
      
      console.log('Login successful')
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Helper function to clear all auth data
  const clearAuthData = () => {
    // Clear reactive state
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    refreshPromise.value = null
    error.value = null
    
    // Clear localStorage completely
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('token') // Clear legacy token
    localStorage.removeItem('user')
    
    console.log('All auth data cleared')
  }

  const logout = async () => {
    console.log('=== LOGOUT PROCESS STARTED ===')
    console.log('Current tokens:', { 
      hasRefreshToken: !!refreshToken.value, 
      hasAccessToken: !!accessToken.value 
    })
    
    try {
      // Attempt to logout on server if we have tokens
      if (refreshToken.value) {
        console.log('Attempting server logout with refresh token...')
        try {
          // Try token-based logout first (doesn't require auth)
          await authApi.logoutWithToken(refreshToken.value)
          console.log('Server logout with refresh token succeeded')
        } catch (tokenError) {
          console.warn('Token-based logout failed, trying authenticated logout:', tokenError)
          try {
            // Fallback to authenticated logout if token logout fails
            await authApi.logout(refreshToken.value)
            console.log('Authenticated logout succeeded')
          } catch (authError) {
            console.warn('Both logout methods failed, proceeding with local logout:', authError)
          }
        }
      } else if (accessToken.value) {
        console.log('Attempting server logout with access token only...')
        try {
          await authApi.logout()
          console.log('Server logout with access token succeeded')
        } catch (error) {
          console.warn('Access token logout failed, proceeding with local logout:', error)
        }
      } else {
        console.log('No tokens found, skipping server logout')
      }
    } catch (error) {
      console.warn('Server logout failed (continuing with local logout):', error)
      // Continue with local logout even if server logout fails
    }
    
    console.log('Clearing local auth data...')
    // Always clear local auth data regardless of server response
    clearAuthData()
    
    console.log('Auth data cleared, redirecting to login...')
    // Force redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/#/login'
    }
    console.log('=== LOGOUT PROCESS COMPLETED ===')
  }

  const updateProfile = async (profileData: UpdateProfileRequest) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await authApi.updateProfile(profileData)
      
      if (response.user) {
        user.value = response.user
        localStorage.setItem('user', JSON.stringify(response.user))
        console.log('Profile updated successfully')
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Profile update failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (passwordData: ChangePasswordRequest) => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await authApi.changePassword(passwordData)
      console.log('Password changed successfully')
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Password change failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isLoading,
    error,
    initialized,
    
    // Computed
    isAuthenticated,
    canWrite,
    isAdmin,
    
    // Methods
    hasRole,
    hasPermission,
    initializeAuth,
    login,
    logout,
    refreshTokens,
    getValidAccessToken,
    updateProfile,
    changePassword,
    clearError,
    clearAuthData
  }
})
