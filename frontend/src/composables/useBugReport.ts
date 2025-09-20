import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export interface BugReport {
  id: string
  title: string
  description: string
  stepsToReproduce: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  page: string
  route: string
  userRole: string
  timestamp: string
  browser: string
  url: string
  userAgent: string
  screenshots: string[] // base64 encoded images
}

export const useBugReport = () => {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  
  const reports = ref<BugReport[]>([])
  const isCapturingScreenshot = ref(false)
  
  // Load reports from localStorage on mount
  const loadReports = () => {
    try {
      const stored = localStorage.getItem('bug-reports')
      if (stored) {
        reports.value = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Failed to load bug reports from localStorage:', error)
    }
  }
  
  // Save reports to localStorage
  const saveReports = () => {
    try {
      localStorage.setItem('bug-reports', JSON.stringify(reports.value))
    } catch (error) {
      console.warn('Failed to save bug reports to localStorage:', error)
    }
  }
  
  // Get current environment info
  const getCurrentContext = () => {
    return {
      page: document.title || 'Unknown Page',
      route: route.path,
      userRole: authStore.user?.role || 'anonymous',
      browser: getBrowserInfo(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }
  }
  
  // Get browser information
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent
    let browser = 'Unknown'
    
    if (userAgent.includes('Chrome')) browser = 'Chrome'
    else if (userAgent.includes('Firefox')) browser = 'Firefox'
    else if (userAgent.includes('Safari')) browser = 'Safari'
    else if (userAgent.includes('Edge')) browser = 'Edge'
    
    return `${browser} (${navigator.platform})`
  }
  
  // Capture screenshot using HTML5 canvas
  const captureScreenshot = async (): Promise<string | null> => {
    try {
      isCapturingScreenshot.value = true
      
      // Use modern Screen Capture API if available
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' }
        })
        
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()
        
        return new Promise((resolve) => {
          video.addEventListener('loadedmetadata', () => {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(video, 0, 0)
            
            stream.getTracks().forEach(track => track.stop())
            
            const dataURL = canvas.toDataURL('image/png', 0.8)
            resolve(dataURL)
          })
        })
      } else {
        // Fallback: Just capture viewport info (no actual screenshot)
        console.warn('Screen capture not available in this browser')
        return null
      }
    } catch (error) {
      console.warn('Failed to capture screenshot:', error)
      return null
    } finally {
      isCapturingScreenshot.value = false
    }
  }
  
  // Create a new bug report
  const createReport = async (reportData: Partial<BugReport>): Promise<BugReport> => {
    const context = getCurrentContext()
    
    const report: BugReport = {
      id: `bug-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: reportData.title || 'Untitled Bug',
      description: reportData.description || '',
      stepsToReproduce: reportData.stepsToReproduce || '',
      severity: reportData.severity || 'Medium',
      screenshots: reportData.screenshots || [],
      ...context
    }
    
    reports.value.unshift(report)
    saveReports()
    
    return report
  }
  
  // Delete a bug report
  const deleteReport = (id: string) => {
    const index = reports.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reports.value.splice(index, 1)
      saveReports()
    }
  }
  
  // Clear all reports
  const clearAllReports = () => {
    reports.value = []
    saveReports()
  }
  
  // Export reports to JSON
  const exportToJSON = () => {
    const dataStr = JSON.stringify(reports.value, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    const link = document.createElement('a')
    link.href = URL.createObjectURL(dataBlob)
    link.download = `bug-reports-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(link.href)
  }
  
  // Export reports to CSV
  const exportToCSV = () => {
    const headers = [
      'ID', 'Title', 'Description', 'Steps to Reproduce', 'Severity',
      'Page', 'Route', 'User Role', 'Timestamp', 'Browser', 'URL'
    ]
    
    const csvContent = [
      headers.join(','),
      ...reports.value.map(report => [
        report.id,
        `"${report.title.replace(/"/g, '""')}"`,
        `"${report.description.replace(/"/g, '""')}"`,
        `"${report.stepsToReproduce.replace(/"/g, '""')}"`,
        report.severity,
        `"${report.page.replace(/"/g, '""')}"`,
        report.route,
        report.userRole,
        report.timestamp,
        `"${report.browser.replace(/"/g, '""')}"`,
        `"${report.url.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    
    const link = document.createElement('a')
    link.href = URL.createObjectURL(dataBlob)
    link.download = `bug-reports-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(link.href)
  }
  
  // Computed properties
  const reportCount = computed(() => reports.value.length)
  const criticalCount = computed(() => reports.value.filter(r => r.severity === 'Critical').length)
  const highCount = computed(() => reports.value.filter(r => r.severity === 'High').length)
  
  // Load reports on mount
  onMounted(() => {
    loadReports()
  })
  
  return {
    reports,
    isCapturingScreenshot,
    reportCount,
    criticalCount,
    highCount,
    createReport,
    deleteReport,
    clearAllReports,
    captureScreenshot,
    exportToJSON,
    exportToCSV,
    getCurrentContext
  }
}