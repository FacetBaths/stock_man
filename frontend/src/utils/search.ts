interface SearchableSKU {
  sku_code?: string
  barcode?: string
  name?: string
  description?: string
}

// Scans must match a complete identifier, never a partial barcode.
export const matchesSKUIdentifier = (sku: SearchableSKU | null | undefined, input: string): boolean => {
  const code = input.trim().toLowerCase()
  return !!code && [sku?.sku_code, sku?.barcode].some(value => value?.trim().toLowerCase() === code)
}

export const matchesSKUSearch = (sku: SearchableSKU | null | undefined, input: string): boolean => {
  const query = input.trim().toLowerCase()
  return !query || [sku?.sku_code, sku?.barcode, sku?.name, sku?.description]
    .some(value => value?.toLowerCase().includes(query))
}

export const matchesTagSearch = (tag: {
  customer_name: string
  project_name?: string
  sku_items?: Array<{ sku_id: string | SearchableSKU | null }>
}, input: string): boolean => {
  const query = input.trim().toLowerCase()
  return !query ||
    tag.customer_name.toLowerCase().includes(query) ||
    !!tag.project_name?.toLowerCase().includes(query) ||
    !!tag.sku_items?.some(item => typeof item.sku_id === 'object' && matchesSKUSearch(item.sku_id, query))
}
