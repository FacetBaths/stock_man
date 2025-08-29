// Debug utility for testing auth token refresh
export const debugTokenRefresh = () => {
  const checkTokens = () => {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    const user = localStorage.getItem('user')
    
    console.log('=== TOKEN DEBUG INFO ===')
    console.log('Access Token:', accessToken ? 'Present' : 'Missing')
    console.log('Refresh Token:', refreshToken ? 'Present' : 'Missing')
    console.log('User Data:', user ? 'Present' : 'Missing')
    
    if (accessToken) {
      try {
        const base64Url = accessToken.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        
        const decoded = JSON.parse(jsonPayload)
        const currentTime = Date.now() / 1000
        const expiresIn = decoded.exp - currentTime
        
        console.log('Token expires in:', expiresIn, 'seconds')
        console.log('Token expired:', expiresIn <= 0)
        console.log('Token expires soon:', expiresIn <= 120)
        console.log('Token payload:', decoded)
      } catch (error) {
        console.error('Failed to decode access token:', error)
      }
    }
    
    if (refreshToken) {
      console.log('Refresh Token (first 20 chars):', refreshToken.substring(0, 20) + '...')
    }
    
    console.log('========================')
  }
  
  // Make available globally for debugging
  (window as any).debugTokens = checkTokens
  
  // Check tokens now
  checkTokens()
  
  // Set up periodic checking
  setInterval(checkTokens, 30000) // Every 30 seconds
}

export const testTokenRefresh = async () => {
  try {
    console.log('=== TESTING TOKEN REFRESH ===')
    
    // Get auth store
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    
    if (!authStore.refreshToken) {
      console.error('No refresh token available for testing')
      return
    }
    
    console.log('Current access token:', authStore.accessToken ? 'Present' : 'Missing')
    console.log('Current refresh token:', authStore.refreshToken ? 'Present' : 'Missing')
    
    // Test refresh
    console.log('Attempting to refresh tokens...')
    await authStore.refreshTokens()
    
    console.log('Refresh successful!')
    console.log('New access token:', authStore.accessToken ? 'Present' : 'Missing')
    console.log('============================')
    
  } catch (error) {
    console.error('Token refresh test failed:', error)
  }
}

// Make test function globally available
if (typeof window !== 'undefined') {
  (window as any).testTokenRefresh = testTokenRefresh
  (window as any).debugTokenRefresh = debugTokenRefresh
}
