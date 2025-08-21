export interface User {
  username: string
  role: 'admin' | 'warehouse_manager' | 'sales_rep'
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  message: string
  token: string
  user: User
}

export interface WallDetails {
  product_line: string
  color_name: string
  dimensions: string
  finish: string
}

export interface ProductDetails {
  name: string
  brand?: string
  model?: string
  color?: string
  dimensions?: string
  finish?: string
  description?: string
  specifications?: Record<string, string>
}

export interface Item {
  _id: string
  product_type: 'wall' | 'toilet' | 'base' | 'tub' | 'vanity' | 'shower_door' | 'raw_material' | 'accessory' | 'miscellaneous'
  product_details: WallDetails | ProductDetails
  quantity: number
  location?: string
  notes?: string
  cost?: number
  sku_id?: string | SKU
  stock_thresholds?: StockThresholds
  stockStatus?: StockStatus
  createdAt: string
  updatedAt: string
  tagSummary?: {
    reserved: number
    broken: number
    imperfect: number
    stock: number
    totalTagged: number
  }
  tags?: Tag[]
}

export interface InventoryStats {
  totalItems: number
  totalInStock: number
  lastUpdated?: string
  totalValue?: number
  itemsWithCost?: number
  totalQuantityWithCost?: number
  byProductType: Array<{
    _id: string
    count: number
    totalQuantity: number
    inStock: number
  }>
  tagStatus?: {
    broken: {
      count: number
      totalQuantity: number
      uniqueItemCount: number
    }
    imperfect: {
      count: number
      totalQuantity: number
      uniqueItemCount: number
    }
    reserved: {
      count: number
      totalQuantity: number
      uniqueItemCount: number
    }
  }
}

export interface InventoryResponse {
  items: Item[]
  totalItems: number
  totalPages: number
  currentPage: number
}

export interface CreateItemRequest {
  product_type: string
  product_details: WallDetails | ProductDetails
  quantity: number
  location?: string
  notes?: string
  cost?: number
}

export interface UpdateItemRequest {
  quantity?: number
  location?: string
  notes?: string
  cost?: number
  product_details?: Partial<WallDetails | ProductDetails>
}

export interface Tag {
  _id: string
  item_id: string | Item
  customer_name: string
  quantity: number
  tag_type: 'stock' | 'reserved' | 'broken' | 'imperfect' | 'expected' | 'partial_shipment' | 'backorder'
  notes?: string
  created_by: string
  status: 'active' | 'fulfilled' | 'cancelled'
  due_date?: string
  createdAt: string
  updatedAt: string
}

export interface CreateTagRequest {
  item_id: string
  customer_name: string
  quantity: number
  tag_type?: string
  notes?: string
  due_date?: string
}

export interface UpdateTagRequest {
  customer_name?: string
  quantity?: number
  tag_type?: string
  notes?: string
  status?: string
  due_date?: string
}

export interface TagResponse {
  tags: Tag[]
  totalTags: number
  totalPages: number
  currentPage: number
}

export interface ItemTagsResponse {
  tags: Tag[]
  stockQuantity: number
  reservedQuantity: number
  totalTagged: number
}

export const PRODUCT_TYPES = [
  { value: 'wall', label: 'Wall' },
  { value: 'toilet', label: 'Toilet' },
  { value: 'base', label: 'Base' },
  { value: 'tub', label: 'Tub' },
  { value: 'vanity', label: 'Vanity' },
  { value: 'shower_door', label: 'Shower Door' },
  { value: 'raw_material', label: 'Raw Materials' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'miscellaneous', label: 'Miscellaneous' }
] as const

export const TAG_TYPES = [
  { value: 'stock', label: 'Available Stock', color: '#28a745' },
  { value: 'reserved', label: 'Reserved', color: '#007bff' },
  { value: 'broken', label: 'Broken', color: '#dc3545' },
  { value: 'imperfect', label: 'Imperfect', color: '#fd7e14' },
  { value: 'expected', label: 'Expected', color: '#6f42c1' },
  { value: 'partial_shipment', label: 'Partial Shipment', color: '#17a2b8' },
  { value: 'backorder', label: 'Backorder', color: '#ffc107' }
] as const

// SKU-related interfaces
export interface StockThresholds {
  understocked: number
  overstocked: number
}

export interface CostHistoryEntry {
  cost: number
  effective_date: string
  updated_by: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface SKU {
  _id: string
  sku_code: string
  product_type: 'wall' | 'toilet' | 'base' | 'tub' | 'vanity' | 'shower_door' | 'raw_material' | 'accessory' | 'miscellaneous'
  product_details: WallDetails | ProductDetails | string
  current_cost: number
  cost_history: CostHistoryEntry[]
  stock_thresholds: StockThresholds
  is_auto_generated: boolean
  generation_template?: string
  manufacturer_model?: string
  barcode?: string
  description?: string
  notes?: string
  created_by: string
  last_updated_by: string
  status: 'active' | 'inactive' | 'discontinued'
  createdAt: string
  updatedAt: string
  // Enhanced fields from API responses
  totalQuantity?: number
  stockStatus?: 'understocked' | 'adequate' | 'overstocked'
  itemCount?: number
  items?: Item[]
}

export interface CreateSKURequest {
  sku_code: string
  product_type: string
  product_details: string
  current_cost?: number
  stock_thresholds?: StockThresholds
  manufacturer_model?: string
  barcode?: string
  description?: string
  notes?: string
}

export interface UpdateSKURequest {
  sku_code?: string
  stock_thresholds?: StockThresholds
  manufacturer_model?: string
  barcode?: string
  description?: string
  notes?: string
  status?: 'active' | 'inactive' | 'discontinued'
}

export interface SKUResponse {
  skus: SKU[]
  totalSkus: number
  totalPages: number
  currentPage: number
}

export interface AddCostRequest {
  cost: number
  notes?: string
}

// Barcode scanning interfaces
export interface BarcodeResult {
  barcode: string
  sku?: SKU
}

export interface BatchScanRequest {
  barcodes: string[]
}

export interface BatchScanResponse {
  found: Array<{
    barcode: string
    sku: SKU
  }>
  notFound: Array<{
    barcode: string
  }>
  summary: {
    total: number
    found: number
    notFound: number
  }
}

export interface CreateMissingItem {
  barcode: string
  sku_code: string
  product_type: string
  product_details: string
  quantity?: number
  current_cost?: number
  stock_thresholds?: StockThresholds
  location?: string
  description?: string
  notes?: string
}

export interface CreateMissingRequest {
  missing_items: CreateMissingItem[]
}

export interface TagAssignmentRequest {
  barcodes: string[]
  tag_data: {
    customer_name: string
    tag_type?: string
    notes?: string
    due_date?: string
  }
}

export interface LinkExistingRequest {
  barcode: string
  item_id: string
  create_sku?: boolean
}

// Stock status types
export type StockStatus = 'understocked' | 'adequate' | 'overstocked'

export const STOCK_STATUS_CONFIG = {
  understocked: { label: 'Understocked', color: 'red-6', icon: 'warning' },
  adequate: { label: 'Adequate', color: 'green-6', icon: 'check_circle' },
  overstocked: { label: 'Overstocked', color: 'orange-6', icon: 'inventory_2' }
} as const

// Export types
export interface ExportOptions {
  format?: 'csv'
  include_skus?: boolean
  include_tags?: boolean
  include_cost_history?: boolean
  start_date?: string
  end_date?: string
}
