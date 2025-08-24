export interface User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'warehouse_manager' | 'sales_rep' | 'viewer'
  isActive: boolean
  isEmailVerified?: boolean
  lastLogin?: string
  fullName?: string
  preferences?: {
    theme: string
    language: string
    notifications: {
      email: boolean
      lowStock: boolean
      systemAlerts: boolean
    }
  }
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  message: string
  accessToken: string
  refreshToken: string
  user: User
}

export interface TokenRefreshRequest {
  refreshToken: string
}

export interface TokenRefreshResponse {
  message: string
  accessToken: string
  user: User
}

export interface UpdateProfileRequest {
  firstName?: string
  lastName?: string
  email?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// New Category system for hierarchical organization
export interface Category {
  _id: string
  name: string
  slug: string
  description?: string
  parent_id?: string | Category
  children?: Category[]
  is_tool_category: boolean
  status: 'active' | 'inactive'
  sort_order: number
  created_by: string
  last_updated_by: string
  createdAt: string
  updatedAt: string
}

// Enhanced SKU model - Single source of truth
export interface SKU {
  _id: string
  sku_code: string
  category_id: string | Category
  
  // Core product information
  name: string
  description?: string
  brand?: string
  model?: string
  
  // Category-specific details (polymorphic)
  details: {
    // For walls:
    product_line?: string
    color_name?: string
    dimensions?: string
    finish?: string
    
    // For tools:
    tool_type?: string
    manufacturer?: string
    serial_number?: string
    voltage?: string
    features?: string[]
    
    // Common fields:
    weight?: number
    specifications?: Record<string, any>
  }
  
  // Costing information
  unit_cost: number
  currency: string
  cost_history: Array<{
    cost: number
    effective_date: string
    updated_by: string
    notes?: string
    createdAt: string
    updatedAt: string
  }>
  
  // Status and metadata
  status: 'active' | 'discontinued' | 'pending'
  barcode?: string
  
  supplier_info: {
    supplier_name: string
    supplier_sku: string
    lead_time_days: number
  }
  
  images: string[]
  
  stock_thresholds: {
    understocked: number
    overstocked: number
  }
  
  // Bundle configuration
  is_bundle: boolean
  bundle_items: Array<{
    sku_id: string | SKU
    quantity: number
    notes?: string
  }>
  
  created_by: string
  last_updated_by: string
  createdAt: string
  updatedAt: string
  
  // Computed fields from backend
  inventory?: Inventory
  total_quantity?: number
  available_quantity?: number
  stock_status?: StockStatus
}

// New Item model - Individual instances only
export interface Item {
  _id: string
  sku_id: string | SKU
  
  // Instance-specific information only
  serial_number?: string
  condition: 'new' | 'used' | 'damaged' | 'refurbished'
  location: string
  notes?: string
  
  // Purchase information (instance-specific)
  purchase_date?: string
  purchase_price?: number
  batch_number?: string
  
  // Quantity for this specific item instance
  quantity: number
  
  // Usage history tracking
  usage_history: Array<{
    quantity_used: number
    used_for: string
    location?: string
    project_name?: string
    customer_name?: string
    notes?: string
    used_by: string
    used_date: string
  }>
  
  created_by: string
  last_updated_by: string
  createdAt: string
  updatedAt: string
}

// New Inventory model - Real-time aggregation
export interface Inventory {
  _id: string
  sku_id: string | SKU
  
  // Real-time quantity tracking by status
  quantities: {
    total: number
    available: number
    reserved: number
    broken: number
    loaned: number
  }
  
  // Location tracking
  locations: Array<{
    location: string
    quantity: number
  }>
  
  // Financial information
  valuation: {
    total_value: number
    average_cost: number
    last_cost: number
  }
  
  // Status flags
  status_flags: {
    is_low_stock: boolean
    is_out_of_stock: boolean
    is_overstocked: boolean
    has_reservations: boolean
    has_broken_items: boolean
  }
  
  // Last activity tracking
  last_movement: {
    type: 'received' | 'reserved' | 'used' | 'transferred'
    quantity: number
    date: string
    user: string
    notes?: string
  }
  
  last_updated: string
  updatedAt: string
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

// New architecture request/response models
export interface CreateSKURequest {
  sku_code: string
  category_id: string
  name: string
  description?: string
  brand?: string
  model?: string
  details: {
    product_line?: string
    color_name?: string
    dimensions?: string
    finish?: string
    tool_type?: string
    manufacturer?: string
    serial_number?: string
    voltage?: string
    features?: string[]
    weight?: number
    specifications?: Record<string, any>
  }
  unit_cost?: number
  currency?: string
  barcode?: string
  supplier_info?: {
    supplier_name: string
    supplier_sku: string
    lead_time_days: number
  }
  images?: string[]
  stock_thresholds?: {
    understocked: number
    overstocked: number
  }
}

export interface UpdateSKURequest {
  sku_code?: string
  category_id?: string
  name?: string
  description?: string
  brand?: string
  model?: string
  details?: Partial<{
    product_line?: string
    color_name?: string
    dimensions?: string
    finish?: string
    tool_type?: string
    manufacturer?: string
    serial_number?: string
    voltage?: string
    features?: string[]
    weight?: number
    specifications?: Record<string, any>
  }>
  unit_cost?: number
  currency?: string
  status?: 'active' | 'discontinued' | 'pending'
  barcode?: string
  supplier_info?: Partial<{
    supplier_name: string
    supplier_sku: string
    lead_time_days: number
  }>
  images?: string[]
  stock_thresholds?: Partial<{
    understocked: number
    overstocked: number
  }>
}

export interface CreateItemRequest {
  sku_id: string
  serial_number?: string
  condition?: 'new' | 'used' | 'damaged' | 'refurbished'
  location: string
  notes?: string
  purchase_date?: string
  purchase_price?: number
  batch_number?: string
  quantity: number
}

export interface UpdateItemRequest {
  serial_number?: string
  condition?: 'new' | 'used' | 'damaged' | 'refurbished'
  location?: string
  notes?: string
  purchase_date?: string
  purchase_price?: number
  batch_number?: string
  quantity?: number
}

// Use items functionality
export interface UseItemsRequest {
  quantity_used: number
  used_for: string
  location?: string
  project_name?: string
  customer_name?: string
  notes?: string
}

// Category management
export interface CreateCategoryRequest {
  name: string
  slug?: string
  description?: string
  parent_id?: string
  is_tool_category?: boolean
  sort_order?: number
}

export interface UpdateCategoryRequest {
  name?: string
  slug?: string
  description?: string
  parent_id?: string
  is_tool_category?: boolean
  status?: 'active' | 'inactive'
  sort_order?: number
}

// New Tag model with proper relationships
export interface Tag {
  _id: string
  customer_name: string
  tag_type: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  status: 'active' | 'fulfilled' | 'cancelled'
  
  // Items in this tag (proper item references)
  items: Array<{
    item_id: string | Item
    quantity: number
    remaining_quantity: number
    notes?: string
  }>
  
  // Metadata
  notes?: string
  due_date?: string
  project_name?: string
  
  // Tracking
  created_by: string
  last_updated_by: string
  
  // Fulfillment tracking
  fulfilled_date?: string
  fulfilled_by?: string
  
  createdAt: string
  updatedAt: string
  
  // Computed properties (populated by backend)
  total_quantity?: number
  total_remaining_quantity?: number
  total_value?: number
  is_partially_fulfilled?: boolean
  is_fully_fulfilled?: boolean
}

// Create tag request for new architecture (multi-item)
export interface CreateTagRequest {
  customer_name: string
  tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  items: Array<{
    item_id: string
    quantity: number
    notes?: string
  }>
  notes?: string
  due_date?: string
  project_name?: string
}

// Update tag request for new architecture
export interface UpdateTagRequest {
  customer_name?: string
  tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  items?: Array<{
    item_id: string
    quantity: number
    remaining_quantity?: number
    notes?: string
  }>
  notes?: string
  status?: 'active' | 'fulfilled' | 'cancelled'
  due_date?: string
  project_name?: string
}

// Fulfill tag items request
export interface FulfillTagRequest {
  item_id: string
  quantity_fulfilled: number
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
  { value: 'loaned', label: 'Loaned', color: '#6f42c1' }
] as const

// Response models
export interface SKUResponse {
  skus: SKU[]
  totalSkus: number
  totalPages: number
  currentPage: number
}

export interface CategoryResponse {
  categories: Category[]
  totalCategories: number
  totalPages: number
  currentPage: number
}

// Legacy interfaces for compatibility
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

// Legacy product detail interfaces for compatibility (commented out for future reference)
// export interface WallDetails {
//   product_line: string
//   color_name: string
//   dimensions: string
//   finish: string
// }

// export interface ProductDetails {
//   name: string
//   description?: string
//   brand?: string
//   model?: string
//   color?: string
//   dimensions?: string
//   finish?: string
// }

// Legacy Item interface for EditItemModal compatibility (commented out for future reference)
// export interface LegacyItem {
//   _id: string
//   sku_id?: string
//   sku_code?: string
//   product_type: string
//   product_details: WallDetails | ProductDetails
//   quantity: number
//   cost?: number
//   location: string
//   notes?: string
//   barcode?: string
//   createdAt: string
//   updatedAt: string
// }

// Export types
export interface ExportOptions {
  format?: 'csv'
  include_skus?: boolean
  include_tags?: boolean
  include_cost_history?: boolean
  start_date?: string
  end_date?: string
}
