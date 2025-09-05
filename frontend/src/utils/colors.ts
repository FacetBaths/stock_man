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
  getProductTypeColor,
  getStatusColor,
  getStockStatusColor
}
