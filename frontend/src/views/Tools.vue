<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toolsApi, categoryApi } from '@/utils/api'
import { debounce } from 'quasar'
import type { Tag } from '@/types'

// Dashboard statistics
const dashboardStats = ref({
  totalTools: 0,
  availableTools: 0,
  loanedTools: 0,
  overdueLoans: 0,
  totalValue: 0,
  lowStockTools: 0,
  outOfStockTools: 0
})

// Active loans data
const activeLoans = ref<Tag[]>([])
const searchTerm = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Loading states
const isLoading = ref(true)
const isLoadingLoans = ref(false)
const isUpdating = ref(false)
const error = ref<string | null>(null)

// Modal states
const showCreateLoanModal = ref(false)
const showReturnModal = ref(false)

// Router
const router = useRouter()

// Computed properties
const filteredLoans = computed(() => {
  if (!searchTerm.value) return activeLoans.value
  
  const term = searchTerm.value.toLowerCase()
  return activeLoans.value.filter(loan => 
    loan.customer_name.toLowerCase().includes(term) ||
    (loan.project_name && loan.project_name.toLowerCase().includes(term)) ||
    loan.sku_items?.some(item => 
      typeof item.sku_id === 'object' && 
      item.sku_id.name.toLowerCase().includes(term)
    )
  )
})

const totalLoans = computed(() => filteredLoans.value.length)
const totalPages = computed(() => Math.ceil(totalLoans.value / itemsPerPage.value))

const paginatedLoans = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredLoans.value.slice(start, end)
})

// Debounced search
const debouncedSearch = debounce(() => {
  currentPage.value = 1 // Reset to first page on search
}, 300)

// Watch for search term changes
watch(searchTerm, debouncedSearch)

// Methods
const loadDashboardStats = async () => {
  try {
    const stats = await toolsApi.getDashboardStats()
    dashboardStats.value = stats.stats
  } catch (err: any) {
    console.error('Failed to load dashboard stats:', err)
    error.value = 'Failed to load dashboard statistics'
  }
}

const loadActiveLoans = async () => {
  try {
    isLoadingLoans.value = true
    error.value = null
    
    const response = await toolsApi.getActiveLoans({
      sort_by: 'due_date',
      sort_order: 'asc',
      limit: 100 // Maximum allowed by backend validation
    })
    
    activeLoans.value = response.tags || []
  } catch (err: any) {
    console.error('Failed to load active loans:', err)
    error.value = 'Failed to load active loans'
  } finally {
    isLoadingLoans.value = false
  }
}

const refreshDashboard = async () => {
  isLoading.value = true
  try {
    await Promise.all([
      loadDashboardStats(),
      loadActiveLoans()
    ])
  } catch (err) {
    console.error('Failed to refresh dashboard:', err)
  } finally {
    isLoading.value = false
  }
}

const viewLoanDetails = (loan: Tag) => {
  // TODO: Implement loan details view
  console.log('View loan details:', loan)
}

const returnLoan = async (loan: Tag) => {
  try {
    isUpdating.value = true
    // TODO: Implement return loan functionality
    console.log('Return loan:', loan)
    // await toolsApi.returnLoan(loan._id)
    // await loadActiveLoans()
    // await loadDashboardStats()
  } catch (err: any) {
    console.error('Failed to return loan:', err)
  } finally {
    isUpdating.value = false
  }
}

const navigateToToolsInventory = async () => {
  try {
    // Get tool categories to pass as query parameters
    const categoriesResponse = await categoryApi.getCategories({ active_only: true })
    const toolCategories = categoriesResponse.categories.filter(cat => cat.type === 'tool')
    
    if (toolCategories.length > 0) {
      // Navigate to inventory with tools filter
      // If there are multiple tool categories, we'll use the first one or implement a selection
      const primaryToolCategory = toolCategories[0]
      router.push({
        path: '/inventory',
        query: {
          category_id: primaryToolCategory._id,
          category_name: primaryToolCategory.name,
          filter_type: 'tools'
        }
      })
    } else {
      // No tool categories found, navigate to inventory with a search filter
      router.push({
        path: '/inventory',
        query: {
          search: 'tool',
          filter_type: 'tools'
        }
      })
    }
  } catch (err: any) {
    console.error('Failed to navigate to tools inventory:', err)
    // Fallback to basic inventory page with search
    router.push({
      path: '/inventory',
      query: {
        search: 'tool'
      }
    })
  }
}

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Initialize dashboard
onMounted(async () => {
  await refreshDashboard()
})
</script>

<template>
  <q-page class="q-pa-lg">
    <div class="row q-col-gutter-lg">
      <!-- Page Header -->
      <div class="col-12">
        <div class="glass-card q-pa-lg">
          <div class="row items-center q-gutter-md">
            <q-icon name="build" size="48px" class="text-primary" />
            <div>
              <h4 class="text-h4 q-ma-none text-weight-bold">Tools Management</h4>
              <p class="text-body1 q-ma-none text-grey-7">
                Manage tool inventory, checkouts, returns, and maintenance
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tools Statistics -->
      <div class="col-12">
        <div class="row q-col-gutter-md">
          <!-- Total Tools -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="primary"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-primary">
                    {{ dashboardStats.totalTools }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">Total Tools</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Available Tools -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="positive"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-positive">
                    {{ dashboardStats.availableTools }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">Available</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Loaned Tools -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="warning"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-warning">
                    {{ dashboardStats.loanedTools }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">On Loan</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Overdue Loans -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="negative"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-negative">
                    {{ dashboardStats.overdueLoans }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">Overdue</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Total Value -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="info"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-info">
                    ${{ formatCurrency(dashboardStats.totalValue) }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">Total Value</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Low Stock Tools -->
          <div class="col-12 col-sm-6 col-md">
            <q-card class="glass-card full-height">
              <q-card-section class="text-center">
                <q-circular-progress
                  v-if="isLoading"
                  indeterminate
                  size="50px"
                  color="orange"
                />
                <div v-else>
                  <div class="text-h3 text-weight-bold text-orange">
                    {{ dashboardStats.lowStockTools }}
                  </div>
                  <div class="text-subtitle1 text-grey-7">Low Stock</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="col-12">
        <div class="glass-card q-pa-lg">
          <div class="row items-center q-mb-md">
            <h5 class="text-h5 q-ma-none text-weight-bold">Quick Actions</h5>
            <q-space />
            <q-btn
              flat
              round
              icon="refresh"
              size="sm"
              @click="refreshDashboard"
              :loading="isLoading"
              :disable="isLoading"
            >
              <q-tooltip>Refresh Dashboard</q-tooltip>
            </q-btn>
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6 col-md-3">
              <q-btn
                color="primary"
                icon="assignment"
                label="View Tools Inventory"
                class="full-width"
                size="lg"
                no-caps
                @click="navigateToToolsInventory"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-btn
                color="positive"
                icon="add_shopping_cart"
                label="Create Loan"
                class="full-width"
                size="lg"
                no-caps
                @click="showCreateLoanModal = true"
                :disable="isLoading"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-btn
                color="warning"
                icon="assignment_return"
                label="Return Tools"
                class="full-width"
                size="lg"
                no-caps
                @click="showReturnModal = true"
                :disable="isLoading"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-btn
                color="info"
                icon="analytics"
                label="Reports"
                class="full-width"
                size="lg"
                no-caps
                disable
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Active Loans Section -->
      <div class="col-12">
        <div class="glass-card q-pa-lg">
          <div class="row items-center q-mb-md">
            <h5 class="text-h5 q-ma-none text-weight-bold">Active Loans</h5>
            <q-space />
            <q-input
              v-model="searchTerm"
              placeholder="Search loans..."
              dense
              outlined
              clearable
              class="q-mr-md"
              style="width: 250px"
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingLoans" class="text-center q-py-xl">
            <q-circular-progress
              indeterminate
              size="50px"
              color="primary"
              class="q-mb-md"
            />
            <div class="text-body1 text-grey-7">Loading active loans...</div>
          </div>

          <!-- Error State -->
          <div v-else-if="error && !isLoading" class="text-center q-py-xl">
            <q-icon name="error" size="48px" class="text-negative q-mb-md" />
            <div class="text-body1 text-grey-7 q-mb-md">{{ error }}</div>
            <q-btn
              color="primary"
              outline
              @click="loadActiveLoans"
              label="Retry"
            />
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredLoans.length === 0" class="text-center q-py-xl">
            <q-icon name="assignment" size="64px" class="text-grey-5 q-mb-md" />
            <div class="text-h6 text-grey-6 q-mb-sm">
              {{ activeLoans.length === 0 ? 'No Active Loans' : 'No Matching Loans' }}
            </div>
            <div class="text-body2 text-grey-7 q-mb-md">
              {{ activeLoans.length === 0 
                ? 'No tools are currently loaned out.' 
                : 'No loans match your search criteria.' }}
            </div>
            <q-btn
              v-if="activeLoans.length === 0"
              color="primary"
              @click="showCreateLoanModal = true"
              label="Create First Loan"
              icon="add"
            />
          </div>

          <!-- Loans List -->
          <div v-else>
            <div class="row q-col-gutter-md">
              <div 
                v-for="loan in paginatedLoans" 
                :key="loan._id" 
                class="col-12 col-md-6 col-lg-4"
              >
                <q-card 
                  class="loan-card full-height"
                  :class="{ 'overdue-card': loan.is_overdue }"
                >
                  <q-card-section>
                    <!-- Loan Header -->
                    <div class="row items-center q-mb-sm">
                      <div class="col">
                        <div class="text-h6 text-weight-bold">{{ loan.customer_name }}</div>
                        <div v-if="loan.project_name" class="text-caption text-grey-7">
                          {{ loan.project_name }}
                        </div>
                      </div>
                      <div class="col-auto">
                        <q-chip
                          :color="loan.is_overdue ? 'negative' : 'warning'"
                          text-color="white"
                          size="sm"
                          :label="loan.is_overdue ? 'Overdue' : 'Active'"
                        />
                      </div>
                    </div>

                    <!-- Loan Details -->
                    <div class="q-mb-md">
                      <div class="row q-mb-xs">
                        <div class="col-5 text-caption text-grey-7">Items:</div>
                        <div class="col text-caption text-weight-medium">
                          {{ loan.total_quantity || 0 }} tools
                        </div>
                      </div>
                      <div v-if="loan.due_date" class="row q-mb-xs">
                        <div class="col-5 text-caption text-grey-7">Due:</div>
                        <div class="col text-caption text-weight-medium"
                             :class="{ 'text-negative': loan.is_overdue }">
                          {{ formatDate(loan.due_date) }}
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-5 text-caption text-grey-7">Created:</div>
                        <div class="col text-caption text-weight-medium">
                          {{ formatDate(loan.createdAt) }}
                        </div>
                      </div>
                    </div>

                    <!-- Tools List -->
                    <div v-if="loan.sku_items && loan.sku_items.length > 0" class="q-mb-md">
                      <div class="text-caption text-grey-7 q-mb-xs">Tools:</div>
                      <div class="tools-list">
                        <div 
                          v-for="item in loan.sku_items.slice(0, 3)" 
                          :key="item._id" 
                          class="tool-item"
                        >
                          <q-icon name="build" size="16px" class="q-mr-xs" />
                          <span class="text-caption">
                            {{ typeof item.sku_id === 'object' ? item.sku_id.name : 'Unknown Tool' }}
                          </span>
                          <span class="text-caption text-grey-6 q-ml-xs">
                            ×{{ item.selected_instance_ids?.length || 0 }}
                          </span>
                        </div>
                        <div v-if="loan.sku_items.length > 3" class="text-caption text-grey-6">
                          +{{ loan.sku_items.length - 3 }} more
                        </div>
                      </div>
                    </div>
                  </q-card-section>

                  <q-separator />

                  <q-card-actions align="around">
                    <q-btn
                      flat
                      size="sm"
                      color="primary"
                      label="Details"
                      @click="viewLoanDetails(loan)"
                    />
                    <q-btn
                      flat
                      size="sm"
                      color="positive"
                      label="Return"
                      @click="returnLoan(loan)"
                      :loading="isUpdating"
                    />
                  </q-card-actions>
                </q-card>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="row items-center justify-center q-mt-lg">
              <q-pagination
                v-model="currentPage"
                :max="totalPages"
                :max-pages="7"
                boundary-numbers
                direction-links
                color="primary"
              />
              <div class="q-ml-md text-caption text-grey-7">
                Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, totalLoans) }} 
                of {{ totalLoans }} loans
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Loan Modal -->
      <q-dialog v-model="showCreateLoanModal">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Create New Tool Loan</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <div class="text-body2 text-grey-7 q-mb-md">
              Loan creation interface will be implemented here.
            </div>
            <div class="text-body2">
              This would include:
              <ul class="q-mt-sm q-mb-none">
                <li>Customer selection/input</li>
                <li>Tool selection from available inventory</li>
                <li>Due date selection</li>
                <li>Project name and notes</li>
              </ul>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="grey" v-close-popup />
            <q-btn flat label="Create Loan (Coming Soon)" color="primary" disable />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Return Modal -->
      <q-dialog v-model="showReturnModal">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Return Tools</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <div class="text-body2 text-grey-7 q-mb-md">
              Tool return interface will be implemented here.
            </div>
            <div class="text-body2">
              This would include:
              <ul class="q-mt-sm q-mb-none">
                <li>Loan selection</li>
                <li>Item condition assessment</li>
                <li>Return notes</li>
              </ul>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="grey" v-close-popup />
            <q-btn flat label="Process Return (Coming Soon)" color="positive" disable />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.q-card.glass-card {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.loan-card {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.loan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.overdue-card {
  border-left: 4px solid #f44336;
}

.overdue-card .q-card__section {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, transparent 100%);
}

.tools-list {
  max-height: 80px;
  overflow-y: auto;
}

.tool-item {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
  padding: 2px 0;
}

.tool-item:last-child {
  margin-bottom: 0;
}

/* Custom colors for Quasar components */
.text-orange {
  color: #ff9800;
}
</style>
