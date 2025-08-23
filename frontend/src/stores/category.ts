import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/types'
import { categoryApi } from '@/utils/api'

export const useCategoryStore = defineStore('category', () => {
  // State
  const categories = ref<Category[]>([])
  const currentCategory = ref<Category | null>(null)
  const categoryHierarchy = ref<Category[]>([])
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

  const rootCategories = computed(() => 
    categories.value.filter(cat => !cat.parent_id)
  )

  const toolCategories = computed(() => 
    categories.value.filter(cat => cat.is_tool_category)
  )

  const productCategories = computed(() => 
    categories.value.filter(cat => !cat.is_tool_category)
  )

  const categoryStats = computed(() => {
    const total = categories.value.length
    const active = activeCategories.value.length
    const tools = toolCategories.value.length
    const products = productCategories.value.length
    const hierarchyDepth = Math.max(...categoryHierarchy.value.map(cat => 
      getHierarchyDepth(cat)
    ), 0)

    return {
      total,
      active,
      tools,
      products,
      hierarchyDepth
    }
  })

  // Helper function to calculate hierarchy depth
  const getHierarchyDepth = (category: Category, depth = 1): number => {
    if (!category.children || category.children.length === 0) {
      return depth
    }
    return Math.max(...category.children.map(child => 
      getHierarchyDepth(child, depth + 1)
    ))
  }

  // Actions
  const fetchCategories = async (params?: {
    active_only?: boolean
    parent_id?: string | null
    include_children?: boolean
    search?: string
  }) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await categoryApi.getCategories({
        ...filters.value,
        ...params
      })

      categories.value = response.categories
      return response
    } catch (err: any) {
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

  const fetchHierarchy = async () => {
    try {
      isLoading.value = true
      error.value = null

      const response = await categoryApi.getHierarchy()
      categoryHierarchy.value = response.hierarchy
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch category hierarchy'
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
      
      // Refresh hierarchy if this is a parent/child relationship
      if (categoryData.parent_id || categories.value.some(cat => !cat.parent_id)) {
        await fetchHierarchy()
      }

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

      // Refresh hierarchy if parent relationships changed
      if (updates.parent_id !== undefined) {
        await fetchHierarchy()
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

      // Refresh hierarchy
      await fetchHierarchy()

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

  const getCategoryBySlug = (slug: string): Category | undefined => {
    return categories.value.find(cat => cat.slug === slug)
  }

  const getChildCategories = (parentId: string): Category[] => {
    return categories.value.filter(cat => cat.parent_id === parentId)
  }

  const getCategoryPath = (categoryId: string): Category[] => {
    const path: Category[] = []
    let current = getCategoryById(categoryId)
    
    while (current) {
      path.unshift(current)
      if (typeof current.parent_id === 'string') {
        current = getCategoryById(current.parent_id)
      } else if (current.parent_id && typeof current.parent_id === 'object') {
        current = current.parent_id as Category
        path.unshift(current)
        break
      } else {
        break
      }
    }
    
    return path
  }

  const getCategoryBreadcrumb = (categoryId: string): string => {
    const path = getCategoryPath(categoryId)
    return path.map(cat => cat.name).join(' > ')
  }

  const searchCategories = (query: string): Category[] => {
    if (!query.trim()) return categories.value

    const searchTerm = query.toLowerCase()
    return categories.value.filter(cat => 
      cat.name.toLowerCase().includes(searchTerm) ||
      cat.description?.toLowerCase().includes(searchTerm) ||
      cat.slug.toLowerCase().includes(searchTerm)
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
    categoryHierarchy,
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
    fetchHierarchy,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryBySlug,
    getChildCategories,
    getCategoryPath,
    getCategoryBreadcrumb,
    searchCategories,
    updateFilters,
    clearFilters,
    clearError,
    setCurrentCategory
  }
})
