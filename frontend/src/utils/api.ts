import axios from 'axios'
import type { 
  LoginCredentials, 
  LoginResponse, 
  User, 
  InventoryResponse, 
  InventoryStats, 
  CreateItemRequest, 
  UpdateItemRequest,
  Item,
  TagResponse,
  ItemTagsResponse,
  CreateTagRequest,
  UpdateTagRequest,
  Tag
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  }
}

export const inventoryApi = {
  getItems: async (params?: {
    product_type?: string
    search?: string
    page?: number
    limit?: number
    in_stock_only?: boolean
  }): Promise<InventoryResponse> => {
    const response = await api.get('/inventory', { params })
    return response.data
  },

  getStats: async (): Promise<InventoryStats> => {
    const response = await api.get('/inventory/stats')
    return response.data
  },

  createItem: async (item: CreateItemRequest): Promise<{ message: string; item: Item }> => {
    const response = await api.post('/inventory', item)
    return response.data
  },

  updateItem: async (id: string, updates: UpdateItemRequest): Promise<{ message: string; item: Item }> => {
    const response = await api.put(`/inventory/${id}`, updates)
    return response.data
  },

  deleteItem: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/inventory/${id}`)
    return response.data
  }
}

export const tagApi = {
  getTags: async (params?: {
    item_id?: string
    customer_name?: string
    status?: string
    tag_type?: string
    page?: number
    limit?: number
  }): Promise<TagResponse> => {
    const response = await api.get('/tags', { params })
    return response.data
  },

  getItemTags: async (itemId: string): Promise<ItemTagsResponse> => {
    const response = await api.get(`/tags/item/${itemId}`)
    return response.data
  },

  createTag: async (tag: CreateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.post('/tags', tag)
    return response.data
  },

  updateTag: async (id: string, updates: UpdateTagRequest): Promise<{ message: string; tag: Tag }> => {
    const response = await api.put(`/tags/${id}`, updates)
    return response.data
  },

  deleteTag: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/tags/${id}`)
    return response.data
  },

  getStats: async (): Promise<{
    totalActiveTags: number
    uniqueCustomers: number
    byTagType: Array<{ _id: string; count: number; totalQuantity: number }>
  }> => {
    const response = await api.get('/tags/stats')
    return response.data
  }
}

export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string; environment: string }> => {
    const response = await api.get('/health')
    return response.data
  }
}

export default api
