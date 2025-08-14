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
  createdAt: string
  updatedAt: string
}

export interface InventoryStats {
  totalItems: number
  totalInStock: number
  byProductType: Array<{
    _id: string
    count: number
    totalQuantity: number
    inStock: number
  }>
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
}

export interface UpdateItemRequest {
  quantity?: number
  location?: string
  notes?: string
  product_details?: Partial<WallDetails | ProductDetails>
}

export interface Tag {
  _id: string
  item_id: string | Item
  customer_name: string
  quantity: number
  tag_type: 'stock' | 'customer' | 'project' | 'hold' | 'reserved'
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
  { value: 'stock', label: 'Stock', color: '#28a745' },
  { value: 'customer', label: 'Customer', color: '#007bff' },
  { value: 'project', label: 'Project', color: '#6f42c1' },
  { value: 'hold', label: 'Hold', color: '#ffc107' },
  { value: 'reserved', label: 'Reserved', color: '#dc3545' }
] as const
