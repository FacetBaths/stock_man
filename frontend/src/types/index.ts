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

// New Category system - matches actual backend Category model structure
export interface Category {
  _id: string
  name: string
  type: 'product' | 'tool'        // Backend uses 'type' not is_tool_category
  description?: string
  attributes?: string[]           // Backend has attributes array
  sort_order: number
  status: 'active' | 'inactive'
  createdAt?: string
  updatedAt?: string
  displayName?: string            // Backend virtual field
  id?: string                     // Backend includes this
  parent_id?: string | Category   // For hierarchical structure (if used)
  children?: Category[]           // For hierarchical structure (if used)
}

// ✅ SKU model - matches ACTUAL backend model (SKU.js) EXACTLY
export interface SKU {
  _id: string
  sku_code: string               // ❌ NOT "item_code"
  category_id: string            // Reference to Category

  // Consolidated product information
  name: string                   // Product name
  description: string
  brand: string
  model: string

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

  // Consolidated costing information
  unit_cost: number              // Current cost (not current_cost)
  currency: string
  cost_history: Array<{
    cost: number
    effective_date: string
    updated_by: string
    notes: string
    createdAt: string
    updatedAt: string
  }>

  // Status management
  status: 'active' | 'discontinued' | 'pending'

  // Metadata
  barcode: string
  supplier_info: {
    supplier_name: string
    supplier_sku: string
    lead_time_days: number
  }
  images: string[]

  // Stock thresholds
  stock_thresholds: {
    understocked: number
    overstocked: number
  }

  // Bundle/Kit configuration
  is_bundle: boolean
  bundle_items: Array<{
    sku_id: string
    quantity: number
    description: string
  }>

  // SKU-specific notes
  sku_notes: string
  
  // Tracking
  created_by: string
  last_updated_by: string

  // POPULATED RELATIONSHIP (from API response)
  category?: {
    _id: string
    name: string
    type: 'product' | 'tool'
    description: string
  }

  // METADATA
  createdAt: string
  updatedAt: string
}

// ✅ Instance model - matches BACKEND_API_REFERENCE.md EXACTLY
export interface Instance {
  _id: string
  sku_id: string
  acquisition_date: string
  acquisition_cost: number
  tag_id: string | null
  location: string
  supplier: string
  reference_number: string
  notes: string
  added_by: string
  createdAt: string
  updatedAt: string
}

// ✅ Inventory model - matches BACKEND_API_REFERENCE.md EXACTLY
export interface Inventory {
  _id: string
  sku_id: string
  total_quantity: number
  available_quantity: number
  reserved_quantity: number
  broken_quantity: number
  loaned_quantity: number
  total_value: number
  average_cost: number
  minimum_stock_level: number
  reorder_point: number
  maximum_stock_level: number
  is_low_stock: boolean
  is_out_of_stock: boolean
  is_overstock: boolean
  last_updated_by: string
  last_movement_date: string
  createdAt: string
  updatedAt: string

  // ✅ Additional fields from API response (BACKEND_API_REFERENCE.md)
  sku?: {
    _id: string
    sku_code: string
    description: string
    current_cost: number
  }
  needs_reorder?: boolean
  utilization_rate?: number
  has_tags?: boolean
  tag_summary?: {
    reserved: number
    broken: number
    loaned: number
    totalTagged: number
  }
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

// ✅ API Response types - match BACKEND_API_REFERENCE.md EXACTLY
export interface InventoryResponse {
  inventory: Inventory[]
  pagination: {
    current_page: number
    total_pages: number
    total_items: number
    items_per_page: number
  }
  filters: {
    status: string
    sort_by: string
    sort_order: string
  }
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
  sku_notes?: string
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
  sku_notes?: string
}

// ✅ Instance management - matches backend endpoints
export interface AddStockRequest {
  sku_id: string
  quantity: number
  unit_cost: number
  location?: string
  supplier?: string
  reference_number?: string
  notes?: string
}

export interface UpdateInstanceRequest {
  location?: string
  supplier?: string
  reference_number?: string
  notes?: string
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
  type: 'product' | 'tool'
  description?: string
  attributes?: string[]
  sort_order?: number
  status?: 'active' | 'inactive'
}

export interface UpdateCategoryRequest {
  name?: string
  type?: 'product' | 'tool'
  description?: string
  attributes?: string[]
  sort_order?: number
  status?: 'active' | 'inactive'
}

// ✅ Tag model - Instance-based architecture (clean implementation)
export interface Tag {
  _id: string
  customer_name: string
  tag_type: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  status: 'active' | 'fulfilled' | 'cancelled'

  // ✅ SKU items with pure instance-based architecture
  sku_items: Array<{
    _id: string
    sku_id: string | {
      _id: string
      sku_code: string
      name: string
      description: string
    }
    // Single source of truth: quantity = selected_instance_ids.length
    selected_instance_ids: string[]
    selection_method: 'auto' | 'manual' | 'fifo' | 'cost_based'
    notes: string
  }>

  notes: string
  due_date?: string
  project_name: string
  created_by: string
  last_updated_by: string
  fulfilled_date?: string
  fulfilled_by?: string
  createdAt: string
  updatedAt: string

  // ✅ Virtual/computed fields from API response
  is_partially_fulfilled?: boolean
  is_fully_fulfilled?: boolean
  is_overdue?: boolean
  total_quantity?: number
  fulfillment_progress?: number
}

// ✅ Create tag request - Pure instance-based structure
export interface CreateTagRequest {
  customer_name: string
  tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  sku_items: Array<{
    sku_id: string
    selected_instance_ids?: string[] // Optional for auto-selection
    selection_method?: 'auto' | 'manual' | 'fifo' | 'cost_based'
    quantity?: number // Only for auto-selection methods
    notes?: string
  }>
  notes?: string
  due_date?: string
  project_name?: string
}

// ✅ Update tag request - Pure instance-based structure
export interface UpdateTagRequest {
  customer_name?: string
  tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
  sku_items?: Array<{
    sku_id: string
    selected_instance_ids: string[]
    selection_method: 'auto' | 'manual' | 'fifo' | 'cost_based'
    notes?: string
  }>
  notes?: string
  status?: 'active' | 'fulfilled' | 'cancelled'
  due_date?: string
  project_name?: string
}

// ✅ Fulfill tag items request - matches backend structure
export interface FulfillTagRequest {
  fulfillment_items: Array<{
    item_id: string
    quantity_fulfilled: number
  }>
}

// ✅ Tag API Response - matches BACKEND_API_REFERENCE.md EXACTLY
export interface TagResponse {
  tags: Tag[]
  pagination: {
    currentPage: number
    totalPages: number
    totalTags: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
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
  sku_id: string
  create_sku?: boolean
}

// Stock status types
export type StockStatus = 'out_of_stock' | 'understocked' | 'adequate' | 'overstocked'

export const STOCK_STATUS_CONFIG = {
  out_of_stock: { label: 'Out of Stock', color: 'red-6', icon: 'cancel' },
  understocked: { label: 'Understocked', color: 'orange-6', icon: 'warning' },
  adequate: { label: 'Adequate', color: 'green-6', icon: 'check_circle' },
  overstocked: { label: 'Overstocked', color: 'yellow-6', icon: 'inventory_2' }
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
