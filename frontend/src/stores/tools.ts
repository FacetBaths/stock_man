import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import axios from 'axios';

// Create axios instance with same config as main API
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface ToolInventoryItem {
  _id: string;
  sku_id: string;
  sku_code: string;
  name: string;
  description?: string;
  brand: string;
  model: string;
  details: {
    tool_type?: string;
    manufacturer?: string;
    serial_number?: string;
    voltage?: string;
    features: string[];
    specifications?: Record<string, any>;
    product_line?: string;
    color_name?: string;
    dimensions?: string;
    finish?: string;
    weight?: number;
  };
  category: {
    _id: string;
    name: string;
    type: 'tool';
  };
  unit_cost: number;
  currency: string;
  status: string;
  total_quantity: number;
  available_quantity: number;
  loaned_quantity: number;
  reserved_quantity: number;
  broken_quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ToolInventoryResponse {
  inventory: ToolInventoryItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ToolUpdateData {
  name: string;
  description?: string;
  brand: string;
  model: string;
  details: {
    tool_type?: string;
    manufacturer?: string;
    serial_number?: string;
    voltage?: string;
    features: string[];
    specifications?: Record<string, any>;
    product_line?: string;
    color_name?: string;
    dimensions?: string;
    finish?: string;
    weight?: number;
  };
  unit_cost: number;
}

export const useToolsStore = defineStore('tools', {
  state: () => ({
    toolsInventory: [] as ToolInventoryItem[],
    loading: false,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalRecords: 0,
      limit: 50,
      hasNextPage: false,
      hasPrevPage: false,
    },
    searchTerm: '',
    statusFilter: 'all',
  }),

  getters: {
    filteredTools(state) {
      let filtered = [...state.toolsInventory];
      
      // Apply search filter
      if (state.searchTerm) {
        const search = state.searchTerm.toLowerCase();
        filtered = filtered.filter(tool => 
          tool.sku_code.toLowerCase().includes(search) ||
          tool.name.toLowerCase().includes(search) ||
          tool.brand.toLowerCase().includes(search) ||
          tool.model.toLowerCase().includes(search) ||
          tool.details.manufacturer?.toLowerCase().includes(search) ||
          tool.details.tool_type?.toLowerCase().includes(search)
        );
      }

      // Apply status filter
      if (state.statusFilter !== 'all') {
        switch (state.statusFilter) {
          case 'available':
            filtered = filtered.filter(tool => tool.available_quantity > 0);
            break;
          case 'loaned':
            filtered = filtered.filter(tool => tool.loaned_quantity > 0);
            break;
          case 'maintenance':
            filtered = filtered.filter(tool => tool.broken_quantity > 0);
            break;
          case 'out_of_stock':
            filtered = filtered.filter(tool => tool.total_quantity === 0);
            break;
        }
      }

      return filtered;
    },
  },

  actions: {
    async fetchToolsInventory(options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      category_id?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    } = {}) {
      this.loading = true;
      
      try {
        const params: Record<string, string> = {};
        if (options.page) params.page = options.page.toString();
        if (options.limit) params.limit = options.limit.toString();
        if (options.search) params.search = options.search;
        if (options.status) params.status = options.status;
        if (options.category_id) params.category_id = options.category_id;
        if (options.sort_by) params.sort_by = options.sort_by;
        if (options.sort_order) params.sort_order = options.sort_order;

        const response = await api.get('/tools/inventory', { params });
        const data: ToolInventoryResponse = response.data;
        
        this.toolsInventory = data.inventory;
        this.pagination = data.pagination;
        
        // Update local filters
        if (options.search !== undefined) this.searchTerm = options.search;
        if (options.status) this.statusFilter = options.status;

        console.log('✅ Tools inventory fetched successfully:', data.inventory.length, 'tools');
        
      } catch (error) {
        console.error('❌ Failed to fetch tools inventory:', error)
        Notify.create({
          type: 'negative',
          message: `Failed to fetch tools inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          position: 'top',
        })
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateTool(toolId: string, updateData: ToolUpdateData) {
      try {
        console.log('🔧 Updating tool:', toolId, 'with data:', updateData);

        const response = await api.put(`/skus/${toolId}`, updateData);
        const updatedTool = response.data;
        
        // Update tool in local state
        const toolIndex = this.toolsInventory.findIndex(tool => tool._id === toolId);
        if (toolIndex !== -1) {
          // Merge updated data while preserving inventory quantities
          this.toolsInventory[toolIndex] = {
            ...this.toolsInventory[toolIndex],
            ...updatedTool,
            // Preserve inventory data that wouldn't be in SKU update response
            total_quantity: this.toolsInventory[toolIndex].total_quantity,
            available_quantity: this.toolsInventory[toolIndex].available_quantity,
            loaned_quantity: this.toolsInventory[toolIndex].loaned_quantity,
            reserved_quantity: this.toolsInventory[toolIndex].reserved_quantity,
            broken_quantity: this.toolsInventory[toolIndex].broken_quantity,
          };
        }

        console.log('✅ Tool updated successfully:', updatedTool);
        
        Notify.create({
          type: 'positive',
          message: 'Tool updated successfully',
          position: 'top',
        });

        return updatedTool;
        
      } catch (error) {
        console.error('❌ Failed to update tool:', error);
        Notify.create({
          type: 'negative',
          message: `Failed to update tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
          position: 'top',
        });
        throw error;
      }
    },

    // Helper methods for filtering
    setSearchTerm(term: string) {
      this.searchTerm = term;
    },

    setStatusFilter(status: string) {
      this.statusFilter = status;
    },

    clearFilters() {
      this.searchTerm = '';
      this.statusFilter = 'all';
    },

    // Helper to get condition status display
    getConditionStatus(tool: ToolInventoryItem): 'available' | 'loaned' | 'maintenance' | 'mixed' {
      if (tool.broken_quantity > 0) {
        return tool.available_quantity > 0 || tool.loaned_quantity > 0 ? 'mixed' : 'maintenance';
      }
      if (tool.loaned_quantity > 0) {
        return tool.available_quantity > 0 ? 'mixed' : 'loaned';
      }
      if (tool.available_quantity > 0) {
        return 'available';
      }
      return 'maintenance'; // No available, no loaned, must be all broken/reserved
    },

    getConditionDisplay(tool: ToolInventoryItem): string {
      const status = this.getConditionStatus(tool);
      const parts: string[] = [];
      
      if (tool.available_quantity > 0) {
        parts.push(`${tool.available_quantity} Available`);
      }
      if (tool.loaned_quantity > 0) {
        parts.push(`${tool.loaned_quantity} Loaned`);
      }
      if (tool.reserved_quantity > 0) {
        parts.push(`${tool.reserved_quantity} Reserved`);
      }
      if (tool.broken_quantity > 0) {
        parts.push(`${tool.broken_quantity} Maintenance`);
      }
      
      return parts.join(' • ') || 'No Stock';
    }
  }
});
