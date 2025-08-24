// Simple test to verify auth flow improvements
export const testAuthFlow = async () => {
  console.log('=== AUTH FLOW TEST STARTING ===')
  
  try {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    
    console.log('1. Testing store initialization...')
    await authStore.initializeAuth()
    console.log('✓ Store initialized')
    
    console.log('2. Current auth state:')
    console.log('   - Is authenticated:', authStore.isAuthenticated)
    console.log('   - Has access token:', !!authStore.accessToken)
    console.log('   - Has refresh token:', !!authStore.refreshToken)
    console.log('   - User:', authStore.user?.username || 'No user')
    
    if (authStore.isAuthenticated && authStore.refreshToken) {
      console.log('3. Testing token refresh...')
      try {
        await authStore.refreshTokens()
        console.log('✓ Token refresh successful')
      } catch (error) {
        console.log('✗ Token refresh failed:', error)
      }
      
      console.log('4. Testing logout...')
      try {
        await authStore.logout()
        console.log('✓ Logout successful')
      } catch (error) {
        console.log('✗ Logout failed:', error)
      }
    } else {
      console.log('3. Not authenticated, skipping token refresh and logout tests')
    }
    
    console.log('=== AUTH FLOW TEST COMPLETED ===')
    
  } catch (error) {
    console.error('=== AUTH FLOW TEST ERROR ===', error)
  }
}

// Add to window for manual testing
if (typeof window !== 'undefined') {
  (window as any).testAuthFlow = testAuthFlow
}
