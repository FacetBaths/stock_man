import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/types'
import { categoryApi } from '@/utils/api'

export const useCategoryStore = defineStore('category', () => {
  // State
  const categories = ref<Category[]>([])
  const currentCategory = ref<Category | null>(null)
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)

  // Filters
  const filters = ref({
    active_only: true,
    search: '',
    parent_id: null as string | null
  })

  // Computed
  const activeCategories = computed(() => 
    categories.value.filter(cat => cat.status === 'active')
  )

  const inactiveCategories = computed(() => 
    categories.value.filter(cat => cat.status === 'inactive')
  )

  const rootCategories = computed(() => categories.value)

  const toolCategories = computed(() => 
    categories.value.filter(cat => cat.type === 'tool')
  )

  const productCategories = computed(() => 
    categories.value.filter(cat => cat.type === 'product')
  )

  const categoryStats = computed(() => ({
    total: categories.value.length,
    active: activeCategories.value.length,
    tools: toolCategories.value.length,
    products: productCategories.value.length
  }))


  // Actions
  const fetchCategories = async (params?: {
    active_only?: boolean
    parent_id?: string | null
    include_children?: boolean
    search?: string
  }) => {
    try {
      console.log('🔍 [CategoryStore] fetchCategories called with:', {
        filters: filters.value,
        params,
        mergedParams: { ...filters.value, ...params }
      })
      
      isLoading.value = true
      error.value = null

      const response = await categoryApi.getCategories({
        ...filters.value,
        ...params
      })

      console.log('✅ [CategoryStore] API response received:', response)
      console.log('📦 [CategoryStore] Categories array:', response.categories)
      console.log('📊 [CategoryStore] Categories count:', response.categories?.length || 0)

      categories.value = response.categories
      console.log('💾 [CategoryStore] Categories stored in state:', categories.value)
      
      return response
    } catch (err: any) {
      console.error('❌ [CategoryStore] fetchCategories error:', err)
      console.error('❌ [CategoryStore] Error response:', err.response?.data)
      error.value = err.response?.data?.message || 'Failed to fetch categories'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchCategory = async (id: string) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await categoryApi.getCategory(id)
      currentCategory.value = response.category

      // Update in list if exists
      const index = categories.value.findIndex(cat => cat._id === id)
      if (index !== -1) {
        categories.value[index] = response.category
      }

      return response.category
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch category'
      throw err
    } finally {
      isLoading.value = false
    }
  }


  const createCategory = async (categoryData: CreateCategoryRequest) => {
    try {
      isCreating.value = true
      error.value = null

      const response = await categoryApi.createCategory(categoryData)
      
      // Add to list
      categories.value.unshift(response.category)
      

      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to create category'
      throw err
    } finally {
      isCreating.value = false
    }
  }

  const updateCategory = async (id: string, updates: UpdateCategoryRequest) => {
    try {
      isUpdating.value = true
      error.value = null

      const response = await categoryApi.updateCategory(id, updates)
      
      // Update in list
      const index = categories.value.findIndex(cat => cat._id === id)
      if (index !== -1) {
        categories.value[index] = response.category
      }

      // Update current category if it's the same
      if (currentCategory.value?._id === id) {
        currentCategory.value = response.category
      }


      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update category'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      isDeleting.value = true
      error.value = null

      await categoryApi.deleteCategory(id)
      
      // Remove from list
      const index = categories.value.findIndex(cat => cat._id === id)
      if (index !== -1) {
        categories.value.splice(index, 1)
      }

      // Clear current category if it was deleted
      if (currentCategory.value?._id === id) {
        currentCategory.value = null
      }


    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete category'
      throw err
    } finally {
      isDeleting.value = false
    }
  }

  const getCategoryById = (id: string): Category | undefined => {
    return categories.value.find(cat => cat._id === id)
  }

  const getCategoryByName = (name: string): Category | undefined => {
    return categories.value.find(cat => cat.name === name)
  }


  const searchCategories = (query: string): Category[] => {
    if (!query.trim()) return categories.value

    const searchTerm = query.toLowerCase()
    return categories.value.filter(cat => 
      cat.name.toLowerCase().includes(searchTerm) ||
      cat.description?.toLowerCase().includes(searchTerm)
    )
  }

  const updateFilters = (newFilters: Partial<typeof filters.value>) => {
    filters.value = { ...filters.value, ...newFilters }
    fetchCategories()
  }

  const clearFilters = () => {
    filters.value = {
      active_only: true,
      search: '',
      parent_id: null
    }
    fetchCategories()
  }

  const clearError = () => {
    error.value = null
  }

  const setCurrentCategory = (category: Category | null) => {
    currentCategory.value = category
  }

  return {
    // State
    categories,
    currentCategory,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    filters,

    // Computed
    activeCategories,
    inactiveCategories,
    rootCategories,
    toolCategories,
    productCategories,
    categoryStats,

    // Actions
    fetchCategories,
    fetchCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryByName,
    searchCategories,
    updateFilters,
    clearFilters,
    clearError,
    setCurrentCategory
  }
})
