import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tag } from '@/types'
import { tagApi } from '@/utils/api'

export const useTagStore = defineStore('tag', () => {
  // State
  const tags = ref<Tag[]>([])
  const currentTag = ref<Tag | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeTags = computed(() => tags.value.filter(tag => tag.status === 'active'))
  const tagsByType = computed(() => {
    const result: Record<string, Tag[]> = {}
    tags.value.forEach(tag => {
      if (!result[tag.type]) {
        result[tag.type] = []
      }
      result[tag.type].push(tag)
    })
    return result
  })

  // Actions
  const fetchTags = async () => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await tagApi.getTags()
      tags.value = response.tags
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch tags'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const createTag = async (tagData: {
    name: string
    type: string
    description?: string
    color?: string
  }) => {
    try {
      isLoading.value = true
      error.value = null

      const newTag = await tagApi.createTag(tagData)
      tags.value.unshift(newTag)

      return newTag
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateTag = async (id: string, updates: Partial<Tag>) => {
    try {
      isLoading.value = true
      error.value = null

      const updatedTag = await tagApi.updateTag(id, updates)
      
      // Update in list
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value[index] = updatedTag
      }

      // Update current tag if it's the same
      if (currentTag.value?._id === id) {
        currentTag.value = updatedTag
      }

      return updatedTag
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteTag = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null

      await tagApi.deleteTag(id)
      
      // Remove from list
      const index = tags.value.findIndex(t => t._id === id)
      if (index !== -1) {
        tags.value.splice(index, 1)
      }

      // Clear current tag if it was deleted
      if (currentTag.value?._id === id) {
        currentTag.value = null
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const assignSKUsToTag = async (tagId: string, skuIds: string[]) => {
    try {
      isLoading.value = true
      error.value = null

      await tagApi.assignSKUsToTag(tagId, skuIds)
      
      // Refresh the specific tag to get updated SKU assignments
      const updatedTag = await tagApi.getTag(tagId)
      const index = tags.value.findIndex(t => t._id === tagId)
      if (index !== -1) {
        tags.value[index] = updatedTag
      }

      return updatedTag
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to assign SKUs to tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const removeSKUsFromTag = async (tagId: string, skuIds: string[]) => {
    try {
      isLoading.value = true
      error.value = null

      await tagApi.removeSKUsFromTag(tagId, skuIds)
      
      // Refresh the specific tag to get updated SKU assignments
      const updatedTag = await tagApi.getTag(tagId)
      const index = tags.value.findIndex(t => t._id === tagId)
      if (index !== -1) {
        tags.value[index] = updatedTag
      }

      return updatedTag
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to remove SKUs from tag'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const getTagsBySKU = (skuId: string) => {
    return tags.value.filter(tag => 
      tag.skus && tag.skus.includes(skuId)
    )
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
    error,

    // Computed
    activeTags,
    tagsByType,

    // Actions
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    assignSKUsToTag,
    removeSKUsFromTag,
    getTagsBySKU,
    clearError,
    setCurrentTag
  }
})
