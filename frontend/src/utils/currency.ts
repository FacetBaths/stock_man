/**
 * Currency formatting utilities with K/M abbreviations
 */

export interface CurrencyFormatResult {
  formatted: string
  exact: string
  rawValue: number
}

/**
 * Formats currency values with K/M abbreviations
 * @param value - The numeric value to format
 * @param currency - Currency symbol (default: '$')
 * @param decimalPlaces - Number of decimal places for abbreviated values (default: 1)
 * @returns Object with formatted, exact, and raw values
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = '$',
  decimalPlaces: number = 1
): CurrencyFormatResult {
  // Handle null, undefined, or invalid values
  const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0)
  
  if (isNaN(numValue)) {
    return {
      formatted: `${currency}0`,
      exact: `${currency}0.00`,
      rawValue: 0
    }
  }

  // Round to nearest dollar for exact display
  const roundedValue = Math.round(numValue)
  const exactFormatted = `${currency}${roundedValue.toLocaleString()}`

  // Format abbreviated version
  let abbreviated: string

  if (Math.abs(numValue) >= 1_000_000) {
    // Millions
    const millions = numValue / 1_000_000
    abbreviated = `${currency}${millions.toFixed(decimalPlaces)}M`
  } else if (Math.abs(numValue) >= 1_000) {
    // Thousands  
    const thousands = numValue / 1_000
    abbreviated = `${currency}${thousands.toFixed(decimalPlaces)}K`
  } else {
    // Less than 1000, show actual value rounded to nearest dollar
    abbreviated = `${currency}${Math.round(numValue)}`
  }

  return {
    formatted: abbreviated,
    exact: exactFormatted,
    rawValue: numValue
  }
}

/**
 * Formats percentage values
 * @param value - The numeric value to format (e.g., 0.15 for 15%)
 * @param decimalPlaces - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimalPlaces: number = 1
): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0)
  
  if (isNaN(numValue)) {
    return '0%'
  }

  // Convert to percentage (multiply by 100) and format
  const percentage = numValue * 100
  return `${percentage.toFixed(decimalPlaces)}%`
}

/**
 * Formats currency for display in Vue components with tooltip
 * Returns an object that can be used with v-bind for both display and tooltip
 */
export function currencyDisplayProps(
  value: number | string | null | undefined,
  currency: string = '$'
) {
  const formatted = formatCurrency(value, currency)
  
  return {
    text: formatted.formatted,
    tooltip: formatted.exact,
    class: 'cursor-help'
  }
}

/**
 * Simple number formatting with K/M abbreviations (no currency symbol)
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimalPlaces: number = 1
): CurrencyFormatResult {
  const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0)
  
  if (isNaN(numValue)) {
    return {
      formatted: '0',
      exact: '0',
      rawValue: 0
    }
  }

  const roundedValue = Math.round(numValue)
  const exactFormatted = roundedValue.toLocaleString()

  let abbreviated: string

  if (Math.abs(numValue) >= 1_000_000) {
    const millions = numValue / 1_000_000
    abbreviated = `${millions.toFixed(decimalPlaces)}M`
  } else if (Math.abs(numValue) >= 1_000) {
    const thousands = numValue / 1_000
    abbreviated = `${thousands.toFixed(decimalPlaces)}K`
  } else {
    abbreviated = Math.round(numValue).toString()
  }

  return {
    formatted: abbreviated,
    exact: exactFormatted,
    rawValue: numValue
  }
}
