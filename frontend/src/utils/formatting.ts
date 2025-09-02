/**
 * Utility functions for formatting text and data display
 */

/**
 * Capitalizes the first letter of each word in a string
 * @param text - The text to capitalize
 * @returns The text with each word capitalized
 */
export const capitalizeWords = (text: string): string => {
  if (!text) return ''
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Formats category names for display with proper capitalization
 * @param categoryName - The category name to format
 * @returns The formatted category name
 */
export const formatCategoryName = (categoryName: string): string => {
  categoryName == 'rawmaterials' ? categoryName = 'Raw Materials' : categoryName == 'showerdoors' ? categoryName = 'Shower Doors' : void 0;
  return capitalizeWords(categoryName)
}

/**
 * Formats currency values for display
 * @param value - The numeric value to format
 * @param minimumFractionDigits - Minimum decimal places (default: 0)
 * @param maximumFractionDigits - Maximum decimal places (default: 0)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: number,
  minimumFractionDigits: number = 0,
  maximumFractionDigits: number = 0
): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value)
}

/**
 * Formats dates for display
 * @param dateString - The date string to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  return new Date(dateString).toLocaleDateString('en-US', options)
}

/**
 * Formats numbers with proper locale formatting
 * @param value - The number to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {}
): string => {
  return new Intl.NumberFormat('en-US', options).format(value)
}
