import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tag, CreateTagRequest, UpdateTagRequest } from '@/types'
import { tagApi } from '@/utils/api'

export const useTagStore = defineStore('tag', () => {
  // State
  const tags = ref<Tag[]>([])
  const currentTag = ref<Tag | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const isFulfilling = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    currentPage: 1,
    totalPages: 0,
    totalTags: 0,
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false
  })

  // Filters for new architecture
  const filters = ref({
    customer_name: '',
    tag_type: '' as '' | 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock',
    status: 'active' as 'active' | 'fulfilled' | 'cancelled' | '',
    project_name: '',
    search: '',
    include_items: true, // Always include item details for proper display
    overdue_only: false,
    sort_by: 'created_at' as 'created_at' | 'due_date' | 'customer_name' | 'project_name',
    sort_order: 'desc' as 'asc' | 'desc'
  })

  // Computed properties for new architecture
  const activeTags = computed(() => 
    tags.value.filter(tag => tag.status === 'active')
  )
  
  const fulfilledTags = computed(() => 
    tags.value.filter(tag => tag.status === 'fulfilled')
  )
  
  const cancelledTags = computed(() => 
    tags.value.filter(tag => tag.status === 'cancelled')
  )
  
  const overdueTags = computed(() => 
    tags.value.filter(tag => 
      tag.status === 'active' && 
      tag.due_date && 
      new Date(tag.due_date) < new Date()
    )
  )
  
  const partiallyFulfilledTags = computed(() => 
    tags.value.filter(tag => tag.is_partially_fulfilled)
  )

  const tagsByType = computed(() => {
    const result: Record<string, Tag[]> = {
      reserved: [],
      broken: [],
      imperfect: [],
      loaned: [],
      stock: []
    }
    
    tags.value.forEach(tag => {
      if (result[tag.tag_type]) {
        result[tag.tag_type].push(tag)
      }
    })
    
    return result
  })

  const tagsByCustomer = computed(() => {
    const result: Record<string, Tag[]> = {}
    tags.value.forEach(tag => {
      if (!result[tag.customer_name]) {
        result[tag.customer_name] = []
      }
      result[tag.customer_name].push(tag)
    })
    return result
  })

  const tagStats = computed(() => {
    const total = tags.value.length
    const active = activeTags.value.length
    const fulfilled = fulfilledTags.value.length
    const overdue = overdueTags.value.length
    const partiallyFulfilled = partiallyFulfilledTags.value.length
    
    const totalQuantity = tags.value.reduce((sum, tag) => 
      sum + (tag.total_quantity || 0), 0
    )
    const totalValue = tags.value.reduce((sum, tag) => 
      sum + (tag.total_value || 0), 0
    )
    const uniqueCustomers = Object.keys(tagsByCustomer.value).length

    return {
      total,
      active,
      fulfilled,
      overdue,
      partiallyFulfilled,
      totalQuantity,
      totalValue,
      uniqueCustomers,
      byType: {
        reserved: tagsByType.value.reserved.length,
        broken: tagsByType.value.broken.length,
        imperfect: tagsByType.value.imperfect.length,
        loaned: tagsByType.value.loaned.length,
        stock: tagsByType.value.stock.length
      }
    }
  })

  // Actions for new architecture
  const fetchTags = async (params?: {
    customer_name?: string
    tag_type?: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock'
    status?: 'active' | 'fulfilled' | 'cancelled'
    project_name?: string
    search?: string
    include_items?: boolean
    overdue_only?: boolean
    sort_by?: 'created_at' | 'due_date' | 'customer_name' | 'project_name'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
  }) => {
    try {
      isLoading.value = true
      error.value = null
      
      // Merge with current filters
      const requestParams = {
        ...filters.value,
        ...params
      }
      
      console.log('=== FETCHING TAGS ===')
      console.log('Request params:', requestParams)
      
      const response = await tagApi.getTags(requestParams)
      
      console.log('Fetch tags response:', response)
      console.log('Tags received:', response.tags?.length || 0)
      if (response.tags?.length > 0) {
        console.log('First tag sample:', response.tags[0])
        console.log('First tag items:', response.tags[0]?.items)
      }
      console.log('====================')
      
      tags.value = response.tags
      
      if (response.pagination) {
        pagination.value = {
          currentPage: response.pagination.currentPage,
          totalPages: response.pagination.totalPages,
          totalTags: response.pagination.totalTags,
          limit: response.pagination.limit,
          hasNextPage: response.pagination.hasNextPage,
          hasPrevPage: response.pagination.hasPrevPage
        }
      }
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch tags'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchTag = async (id: string, includeItems = false) => {
    try {
      isLoading.value = true
      error.value = null
      
      console.log('=== FETCHING SINGLE TAG ===')
      console.log('Tag ID:', id)
      console.log('Include items:', includeItems)
      
      const response = await tagApi.getTag(id, includeItems)
      
      console.log('Single tag response:', response)
      console.log('Tag data:', response.tag)
      console.log('Tag items:', response.tag?.items)
      console.log('==========================')
      
      currentTag.value = response.tag
      
      // Update in list if exists
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value[index] = response.tag
      }
      
      return response.tag
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const createTag = async (tagData: CreateTagRequest) => {
    try {
      isCreating.value = true
      error.value = null

      const response = await tagApi.createTag(tagData)
      
      // Add to local list
      tags.value.unshift(response.tag)
      pagination.value.totalTags += 1

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create tag'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  const updateTag = async (id: string, updates: UpdateTagRequest) => {
    try {
      isUpdating.value = true
      error.value = null

      const response = await tagApi.updateTag(id, updates)
      
      // Update in list
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value[index] = response.tag
      }

      // Update current tag if it's the same
      if (currentTag.value?._id === id) {
        currentTag.value = response.tag
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update tag'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const deleteTag = async (id: string) => {
    try {
      isDeleting.value = true
      error.value = null

      await tagApi.deleteTag(id)
      
      // Remove from list
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value.splice(index, 1)
        pagination.value.totalTags -= 1
      }

      // Clear current tag if it was deleted
      if (currentTag.value?._id === id) {
        currentTag.value = null
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete tag'
      throw err
    } finally {
      isDeleting.value = false
    }
  }

  // New architecture method: Fulfill tag items
  const fulfillTag = async (id: string, fulfillmentItems: Array<{
    item_id: string
    quantity_fulfilled: number
  }>) => {
    try {
      isFulfilling.value = true
      error.value = null

      const response = await tagApi.fulfillTag(id, fulfillmentItems)
      
      // Update in list
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value[index] = response.tag
      }

      // Update current tag if it's the same
      if (currentTag.value?._id === id) {
        currentTag.value = response.tag
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fulfill tag'
      throw err
    } finally {
      isFulfilling.value = false
    }
  }

  // Get tag statistics
  const fetchStats = async () => {
    try {
      const response = await tagApi.getStats()
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch tag stats'
      throw err
    }
  }

  // Get customers list
  const fetchCustomers = async () => {
    try {
      return await tagApi.getCustomers()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch customers'
      throw err
    }
  }


  // Helper methods for new architecture
  const getTagsByCustomer = (customerName: string) => {
    return tags.value.filter(tag => 
      tag.customer_name.toLowerCase().includes(customerName.toLowerCase())
    )
  }

  const getTagsByProject = (projectName: string) => {
    return tags.value.filter(tag => 
      tag.project_name?.toLowerCase().includes(projectName.toLowerCase())
    )
  }

  const getTagsByItems = (itemIds: string[]) => {
    return tags.value.filter(tag => 
      tag.items?.some(tagItem => {
        const itemId = typeof tagItem.item_id === 'string' 
          ? tagItem.item_id 
          : tagItem.item_id._id
        return itemIds.includes(itemId)
      })
    )
  }

  const searchTags = (query: string) => {
    if (!query.trim()) return tags.value

    const searchTerm = query.toLowerCase()
    return tags.value.filter(tag => 
      tag.customer_name.toLowerCase().includes(searchTerm) ||
      tag.project_name?.toLowerCase().includes(searchTerm) ||
      tag.notes?.toLowerCase().includes(searchTerm)
    )
  }

  const updateFilters = (newFilters: Partial<typeof filters.value>) => {
    filters.value = { ...filters.value, ...newFilters }
    fetchTags({ page: 1 })
  }

  const clearFilters = () => {
    filters.value = {
      customer_name: '',
      tag_type: '',
      status: 'active',
      project_name: '',
      search: '',
      include_items: true, // Always include item details for proper display
      overdue_only: false,
      sort_by: 'created_at',
      sort_order: 'desc'
    }
    fetchTags({ page: 1 })
  }

  const clearError = () => {
    error.value = null
  }

  const setCurrentTag = (tag: Tag | null) => {
    currentTag.value = tag
  }

  return {
    // State
    tags,
    currentTag,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isFulfilling,
    error,
    pagination,
    filters,

    // Computed
    activeTags,
    fulfilledTags,
    cancelledTags,
    overdueTags,
    partiallyFulfilledTags,
    tagsByType,
    tagsByCustomer,
    tagStats,

    // Actions
    fetchTags,
    fetchTag,
    createTag,
    updateTag,
    deleteTag,
    fulfillTag,
    fetchStats,
    fetchCustomers,
    
    // Helper methods
    getTagsByCustomer,
    getTagsByProject,
    getTagsByItems,
    searchTags,
    updateFilters,
    clearFilters,
    clearError,
    setCurrentTag
  }
})
