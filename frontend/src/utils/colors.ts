// Utility functions for consistent color generation across the app

// Extended color palette for better variety and visual distinction
const COLOR_PALETTE = [
  'primary',     // Blue
  'green',       // Green
  'orange',      // Orange  
  'cyan',        // Cyan
  'purple',      // Purple
  'teal',        // Teal
  'amber',       // Amber/Yellow
  'pink',        // Pink
  'indigo',      // Indigo
  'deep-purple', // Deep Purple
  'deep-orange', // Deep Orange
  'brown',       // Brown
  'blue-grey',   // Blue Grey
  'lime',        // Lime
  'light-green', // Light Green
  'red',         // Red (use sparingly)
  'yellow',      // Yellow
  'light-blue',  // Light Blue
  'purple-4',    // Purple variant
  'green-4'      // Green variant
] as const

// Generate a consistent color based on a string input (like category ID or name)
export const generateColorFromString = (input: string): string => {
  if (!input || typeof input !== 'string') return 'grey'
  
  // Create a simple hash from the string
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Use absolute value to ensure positive index
  const index = Math.abs(hash) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

// Get category color - works with category ID, name, or category object
export const getCategoryColor = (category: string | { _id?: string; name?: string } | null | undefined): string => {
  if (!category) return 'grey'
  
  // Handle category object
  if (typeof category === 'object') {
    // Prefer using ID for consistency, fallback to name
    const identifier = category._id || category.name
    return identifier ? generateColorFromString(identifier) : 'grey'
  }
  
  // Handle string (could be ID or name)
  return generateColorFromString(category)
}

// Get category color with database priority - prefers database color over generated
export const getCategoryColorFromData = (category: { color?: string; _id?: string; name?: string } | null | undefined): string => {
  if (!category) return '#1976d2' // Default blue
  
  // Use database color if available
  if (category.color) {
    return category.color
  }
  
  // Fall back to generated color from ID or name
  const identifier = category._id || category.name
  if (identifier) {
    // Convert Quasar color name to hex for consistency
    const generatedColor = generateColorFromString(identifier)
    return convertQuasarColorToHex(generatedColor)
  }
  
  return '#1976d2' // Default blue
}

// Convert Quasar color names to hex values
const convertQuasarColorToHex = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    'primary': '#1976d2',
    'green': '#4caf50',
    'orange': '#ff9800',
    'cyan': '#00bcd4',
    'purple': '#9c27b0',
    'teal': '#009688',
    'amber': '#ffc107',
    'pink': '#e91e63',
    'indigo': '#3f51b5',
    'deep-purple': '#673ab7',
    'deep-orange': '#ff5722',
    'brown': '#795548',
    'blue-grey': '#607d8b',
    'lime': '#cddc39',
    'light-green': '#8bc34a',
    'red': '#f44336',
    'yellow': '#ffeb3b',
    'light-blue': '#03a9f4',
    'purple-4': '#ab47bc',
    'green-4': '#66bb6a',
    'grey': '#9e9e9e'
  }
  
  return colorMap[colorName] || '#1976d2'
}

// Legacy mapping for known product types (maintains backward compatibility)
const LEGACY_TYPE_COLORS: Record<string, string> = {
  'walls': 'primary',
  'wall': 'primary', 
  'toilet': 'positive',
  'toilets': 'positive',
  'base': 'amber',
  'bases': 'amber',
  'tub': 'cyan',
  'tubs': 'cyan',
  'vanity': 'deep-purple',
  'vanities': 'deep-purple',
  'shower_door': 'deep-orange',
  'shower_doors': 'deep-orange',
  'showerdoors': 'deep-orange',
  'raw_material': 'brown',
  'raw_materials': 'brown',
  'rawmaterials': 'brown',
  'accessory': 'pink',
  'accessories': 'pink',
  'miscellaneous': 'grey',
  'misc': 'grey',
  'parts': 'orange',
  'part': 'orange'
}

// Get product type color with fallback to dynamic generation
export const getProductTypeColor = (productType: string): string => {
  if (!productType) return 'grey'
  
  const normalizedType = productType.toLowerCase().trim()
  
  // Check legacy mapping first for consistent colors on known types
  if (LEGACY_TYPE_COLORS[normalizedType]) {
    return LEGACY_TYPE_COLORS[normalizedType]
  }
  
  // For new/unknown types, generate a consistent color
  return generateColorFromString(productType)
}

// Status colors (keep existing logic)
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'active': 'green',
    'inactive': 'orange', 
    'discontinued': 'red',
    'pending': 'amber'
  }
  return statusColors[status?.toLowerCase()] || 'grey'
}

// Stock status colors
export const getStockStatusColor = (status: string): string => {
  const stockColors: Record<string, string> = {
    'out_of_stock': 'negative',
    'low_stock': 'warning', 
    'understocked': 'warning',
    'adequate': 'positive',
    'in_stock': 'positive',
    'overstocked': 'info',
    'overstock': 'info'
  }
  return stockColors[status?.toLowerCase()] || 'grey'
}

export default {
  generateColorFromString,
  getCategoryColor,
  getCategoryColorFromData,
  getProductTypeColor,
  getStatusColor,
  getStockStatusColor
}
