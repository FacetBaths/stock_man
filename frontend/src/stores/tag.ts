import { defineStore } from 'pinia'

import { ref, computed } from 'vue'
import type { Tag, TagNote, CreateTagRequest, UpdateTagRequest, StageTagRequest } from '@/types'
import { tagApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

export const useTagStore = defineStore('tag', () => {
  // State
  const tags = ref<Tag[]>([])
  const currentTag = ref<Tag | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const isFulfilling = ref(false)
  const isStaging = ref(false)
  const isSavingNote = ref(false)
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
  
  const stagedTags = computed(() => 
    tags.value.filter(tag => tag.status === 'staged')
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
    const staged = stagedTags.value.length
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
      staged,
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
        console.log('First tag sku_items:', response.tags[0]?.sku_items)
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
      console.log('Tag sku_items:', response.tag?.sku_items)
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

  // Stage tag items
  const stageTag = async (id: string, stagingData: StageTagRequest) => {
    try {
      isStaging.value = true
      error.value = null

      const response = await tagApi.stageTag(id, stagingData)
      
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
      error.value = err.response?.data?.message || 'Failed to stage tag'
      throw err
    } finally {
      isStaging.value = false
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

  const getTagsBySKUs = (skuIds: string[]) => {
    return tags.value.filter(tag => 
      tag.sku_items?.some(tagSkuItem => {
        const skuId = typeof tagSkuItem.sku_id === 'string' 
          ? tagSkuItem.sku_id 
          : tagSkuItem.sku_id._id
        return skuIds.includes(skuId)
      })
    )
  }

  const searchTags = (query: string) => {
    if (!query.trim()) return tags.value

    const searchTerm = query.toLowerCase()
    return tags.value.filter(tag => {
      if (tag.customer_name.toLowerCase().includes(searchTerm)) return true
      if (tag.project_name?.toLowerCase().includes(searchTerm)) return true
      // `notes` is now a thread of entries; search across every message body.
      const notesText = Array.isArray(tag.notes)
        ? tag.notes.map(note => note?.message || '').join(' ').toLowerCase()
        : ''
      return notesText.includes(searchTerm)
    })
  }

  // ===== NOTES THREAD =====

  // Replace the tag in local state with the server response.
  const replaceTagInState = (updated: Tag) => {
    const index = tags.value.findIndex(t => t._id === updated._id)
    if (index !== -1) {
      tags.value[index] = updated
    }
    if (currentTag.value?._id === updated._id) {
      currentTag.value = updated
    }
  }

  // Append a new message to a tag's notes thread.
  const addNote = async (tagId: string, message: string) => {
    try {
      isSavingNote.value = true
      error.value = null
      const response = await tagApi.addNote(tagId, message)
      replaceTagInState(response.tag)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to add note'
      throw err
    } finally {
      isSavingNote.value = false
    }
  }

  // Edit an existing note (server enforces admin-or-author).
  const updateNote = async (tagId: string, noteId: string, message: string) => {
    try {
      isSavingNote.value = true
      error.value = null
      const response = await tagApi.updateNote(tagId, noteId, message)
      replaceTagInState(response.tag)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update note'
      throw err
    } finally {
      isSavingNote.value = false
    }
  }

  // Soft-delete a note (server enforces admin-or-author).
  const deleteNote = async (tagId: string, noteId: string) => {
    try {
      isSavingNote.value = true
      error.value = null
      const response = await tagApi.deleteNote(tagId, noteId)
      replaceTagInState(response.tag)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete note'
      throw err
    } finally {
      isSavingNote.value = false
    }
  }

  // Is the current user allowed to edit/delete the given note?
  // Mirrors the server rule: admin OR original author, not a system note,
  // and not already deleted.
  const canEditNote = (note: Pick<TagNote, 'author' | 'kind' | 'deleted_at'> | null | undefined) => {
    if (!note) return false
    if (note.kind === 'system') return false
    if (note.deleted_at) return false
    const auth = useAuthStore()
    if (auth.isAdmin) return true
    return !!auth.user && note.author === auth.user.username
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
    isStaging,
    isSavingNote,
    error,
    pagination,
    filters,

    // Computed
    activeTags,
    stagedTags,
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
    stageTag,
    addNote,
    updateNote,
    deleteNote,
    canEditNote,
    fetchStats,
    fetchCustomers,
    
    // Helper methods
    getTagsByCustomer,
    getTagsByProject,
    getTagsBySKUs,
    searchTags,
    updateFilters,
    clearFilters,
    clearError,
    setCurrentTag
  }
})
