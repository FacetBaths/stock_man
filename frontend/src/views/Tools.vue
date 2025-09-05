<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { toolsApi, categoryApi } from "@/utils/api";
import { debounce } from "quasar";
import type { Tag } from "@/types";
import ToolsTable from "@/components/ToolsTable.vue";
import EditToolModal from "@/components/EditToolModal.vue";
import AddToolModal from "@/components/AddToolModal.vue";
import StatsCarousel from "@/components/StatsCarousel.vue";
import ReturnToolsDialog from "@/components/ReturnToolsDialog.vue";
import { useToolsStore } from "@/stores/tools";

// Dashboard statistics
const dashboardStats = ref({
  totalTools: 0,
  availableTools: 0,
  loanedTools: 0,
  overdueLoans: 0,
  totalValue: 0,
});

// Active loans data
const activeLoans = ref<Tag[]>([]);
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Loading states
const isLoading = ref(true);
const isLoadingLoans = ref(false);
const isUpdating = ref(false);
const error = ref<string | null>(null);

// Tool Checkout Modal states - Tag Modal Style
const checkoutStep = ref(1);
const totalCheckoutSteps = 3;
const checkoutError = ref<string | null>(null);
const isLoadingTools = ref(false);
const isSubmittingCheckout = ref(false);
const isScanningTool = ref(false);
const showToolSelector = ref(true);

// Tool data and search
const availableTools = ref<any[]>([]);
const selectedTools = ref<
  Array<{
    tool: any;
    quantity: number;
    available_instances: number;
  }>
>([]);
const toolInput = ref("");
const toolSearchQuery = ref("");
const toolCategoryFilter = ref("all");

// Form data
const checkoutForm = ref({
  customer_name: "",
  project_name: "",
  due_date: "",
  notes: "",
  sku_items: [] as Array<{
    sku_id: string;
    quantity: number;
  }>,
});

// Modal states
const showCreateLoanModal = ref(false);
const showReturnModal = ref(false);
const selectedReturnLoanId = ref<string | null>(null);
const showEditToolModal = ref(false);
const selectedTool = ref(null);
const showLoanDetailsModal = ref(false);
const selectedLoan = ref<Tag | null>(null);
const showDeleteDialog = ref(false);
const showReturnDialog = ref(false);
const returnReason = ref("");
const selectedLoanForAction = ref<Tag | null>(null);
const isProcessingAction = ref(false);
const showAddToolModal = ref(false);
const toolToDelete = ref<any>(null);

// Router
const router = useRouter();

// Tab management
const currentTab = ref("dashboard");

// Stores
const authStore = useAuthStore();
const toolsStore = useToolsStore();

// Computed properties
const filteredLoans = computed(() => {
  if (!searchTerm.value) return activeLoans.value;

  const term = searchTerm.value.toLowerCase();
  return activeLoans.value.filter(
    (loan) =>
      loan.customer_name.toLowerCase().includes(term) ||
      (loan.project_name && loan.project_name.toLowerCase().includes(term)) ||
      loan.sku_items?.some(
        (item) =>
          typeof item.sku_id === "object" &&
          item.sku_id.name.toLowerCase().includes(term)
      )
  );
});

const totalLoans = computed(() => filteredLoans.value.length);
const totalPages = computed(() =>
  Math.ceil(totalLoans.value / itemsPerPage.value)
);

const paginatedLoans = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredLoans.value.slice(start, end);
});

// Debounced search
const debouncedSearch = debounce(() => {
  currentPage.value = 1; // Reset to first page on search
}, 300);

// Watch for search term changes
watch(searchTerm, debouncedSearch);

// Methods
const loadDashboardStats = async () => {
  try {
    const stats = await toolsApi.getDashboardStats();
    dashboardStats.value = stats.stats;
  } catch (err: any) {
    console.error("Failed to load dashboard stats:", err);
    error.value = "Failed to load dashboard statistics";
  }
};

const loadActiveLoans = async () => {
  try {
    isLoadingLoans.value = true;
    error.value = null;

    const response = await toolsApi.getActiveLoans({
      sort_by: "due_date",
      sort_order: "asc",
      limit: 100, // Maximum allowed by backend validation
    });

    activeLoans.value = response.tags || [];
  } catch (err: any) {
    console.error("Failed to load active loans:", err);
    error.value = "Failed to load active loans";
  } finally {
    isLoadingLoans.value = false;
  }
};

const refreshDashboard = async () => {
  isLoading.value = true;
  try {
    await Promise.all([loadDashboardStats(), loadActiveLoans()]);
  } catch (err) {
    console.error("Failed to refresh dashboard:", err);
  } finally {
    isLoading.value = false;
  }
};

const viewLoanDetails = (loan: Tag) => {
  selectedLoan.value = loan;
  showLoanDetailsModal.value = true;
};

const returnLoan = async (loan: Tag) => {
  // Open the return dialog preselecting this loan
  selectedReturnLoanId.value = loan._id;
  showReturnModal.value = true;
};

// Return all tools function - properly returns tools to inventory
const confirmReturnCheckout = (loan: Tag) => {
  selectedLoanForAction.value = loan;
  showReturnDialog.value = true;
};

const returnCheckout = async () => {
  if (!selectedLoanForAction.value) return;

  try {
    isProcessingAction.value = true;

    console.log(
      "🔄 Returning all tools from checkout:",
      selectedLoanForAction.value._id
    );
    const response = await toolsApi.returnCheckout(
      selectedLoanForAction.value._id,
      returnReason.value
    );

    console.log("✅ Successfully returned all tools:", response);

    // Close dialog and refresh data
    showReturnDialog.value = false;
    selectedLoanForAction.value = null;
    returnReason.value = "";

    // Force refresh of all data - both dashboard stats and loan list
    console.log("🔄 Refreshing dashboard and inventory data...");
    await Promise.all([
      refreshDashboard(),
      toolsStore.fetchToolsInventory(), // Force refresh tools inventory
    ]);

    // Show success message
    console.log(
      `✅ All tools returned to inventory and checkout completed - dashboard refreshed`
    );
  } catch (err: any) {
    console.error("❌ Failed to return tools:", err);
    console.error("Error details:", err.response?.data || err.message);
    // You might want to show an error notification here
  } finally {
    isProcessingAction.value = false;
  }
};

const navigateToToolsInventory = async () => {
  try {
    // Get tool categories to pass as query parameters
    const categoriesResponse = await categoryApi.getCategories({
      active_only: true,
    });
    const toolCategories = categoriesResponse.categories.filter(
      (cat) => cat.type === "tool"
    );

    if (toolCategories.length > 0) {
      // Navigate to inventory with tools filter
      // If there are multiple tool categories, we'll use the first one or implement a selection
      const primaryToolCategory = toolCategories[0];
      router.push({
        path: "/inventory",
        query: {
          category_id: primaryToolCategory._id,
          category_name: primaryToolCategory.name,
          filter_type: "tools",
        },
      });
    } else {
      // No tool categories found, navigate to inventory with a search filter
      router.push({
        path: "/inventory",
        query: {
          search: "tool",
          filter_type: "tools",
        },
      });
    }
  } catch (err: any) {
    console.error("Failed to navigate to tools inventory:", err);
    // Fallback to basic inventory page with search
    router.push({
      path: "/inventory",
      query: {
        search: "tool",
      },
    });
  }
};

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Tool editing functionality
const editTool = (tool: any) => {
  selectedTool.value = tool;
  showEditToolModal.value = true;
};

// Tool deletion functionality
const handleDeleteTool = (tool: any) => {
  toolToDelete.value = tool;
  showDeleteDialog.value = true;
};

const confirmDeleteTool = async () => {
  if (!toolToDelete.value) return;

  try {
    console.log("🗑️ [Tools] Deleting tool:", toolToDelete.value);

    // Check if deleteTool method exists, if not use API directly (browser cache issue workaround)
    if (typeof toolsStore.deleteTool === "function") {
      await toolsStore.deleteTool(toolToDelete.value._id);
    } else {
      console.log("⚠️ [Tools] Using direct API call due to cache issue");
      // Import API directly as fallback
      const { skuApi } = await import("@/utils/api");
      await skuApi.deleteSKU(toolToDelete.value._id);
    }

    console.log("✅ [Tools] Tool deleted successfully");

    // Close dialog and reset
    showDeleteDialog.value = false;
    toolToDelete.value = null;

    // Refresh dashboard stats and tools inventory
    await Promise.all([refreshDashboard(), toolsStore.fetchToolsInventory()]);

    console.log("🔄 [Tools] Dashboard and inventory refreshed after deletion");
  } catch (error) {
    console.error("❌ [Tools] Delete tool error:", error);
    // Error notification is handled by the store
  }
};

const cancelDeleteTool = () => {
  showDeleteDialog.value = false;
  toolToDelete.value = null;
};

const handleToolUpdated = async () => {
  // Refresh the tools table after an edit
  showEditToolModal.value = false;
  selectedTool.value = null;

  // Refresh the tools inventory data
  try {
    await toolsStore.fetchToolsInventory();
    console.log("✅ Tools inventory refreshed after edit");
  } catch (error) {
    console.error("❌ Failed to refresh tools inventory after edit:", error);
  }
};

// Computed stats for carousel
const toolsStats = computed(() => [
  {
    value: dashboardStats.value.totalTools,
    label: "Total Tools",
    icon: "build",
    iconColor: "primary",
    valueClass: "text-primary",
  },
  {
    value: dashboardStats.value.availableTools,
    label: "Available",
    icon: "check_circle",
    iconColor: "positive",
    valueClass: "text-positive",
  },
  {
    value: dashboardStats.value.loanedTools,
    label: "Checked Out",
    icon: "assignment",
    iconColor: "warning",
    valueClass: "text-warning",
  },
  {
    value: dashboardStats.value.overdueLoans,
    label: "Overdue",
    icon: "error",
    iconColor: "negative",
    valueClass: "text-negative",
  },
  {
    value: `$${formatCurrency(dashboardStats.value.totalValue)}`,
    label: "Total Value",
    icon: "attach_money",
    iconColor: "info",
    valueClass: "text-info",
  },
]);

// Tool Checkout Modal Methods
const loadAvailableTools = async (search = "") => {
  try {
    isLoadingTools.value = true;
    const response = await toolsApi.getInventory({
      search: search,
      status: "all", // Get all tools, filter client-side for availability > 0
      limit: 50,
    });
    console.log("🔍 Available tools API response:", response);
    console.log("🔍 Raw tools inventory data:", response.inventory);

    // Transform inventory data to match expected tool format
    const tools =
      response.inventory?.map((inv) => ({
        _id: inv.sku_id || inv.sku?._id,
        sku_code: inv.sku_code || inv.sku?.sku_code,
        name: inv.name || inv.sku?.name,
        description: inv.description || inv.sku?.description,
        category_id: inv.category || inv.sku?.category_id,
        inventory: {
          total_quantity: inv.total_quantity,
          available_quantity: inv.available_quantity,
          reserved_quantity: inv.reserved_quantity,
          broken_quantity: inv.broken_quantity,
          loaned_quantity: inv.loaned_quantity,
        },
      })) || [];

    console.log(
      "🔍 Transformed tools with real-time inventory:",
      tools.map((tool) => ({
        name: tool.name,
        sku_code: tool.sku_code,
        available: tool.inventory?.available_quantity,
        total: tool.inventory?.total_quantity,
        category: tool.category_id?.name,
      }))
    );

    availableTools.value = tools;
  } catch (err: any) {
    console.error("❌ Failed to load available tools:", err);
    checkoutError.value =
      "Failed to load available tools: " + (err.message || "Unknown error");
  } finally {
    isLoadingTools.value = false;
  }
};

const filterTools = (val: string, update: Function) => {
  update(async () => {
    await loadAvailableTools(val);
  });
};

const addToolToCheckout = () => {
  checkoutForm.value.sku_items.push({
    sku_id: "",
    quantity: 1,
  });
};

const removeToolFromCheckout = (index: number) => {
  checkoutForm.value.sku_items.splice(index, 1);
};

const resetCheckoutForm = () => {
  checkoutForm.value = {
    customer_name: "",
    project_name: "",
    due_date: "",
    notes: "",
    sku_items: [],
  };
  availableTools.value = [];
};

const cancelCheckout = () => {
  showCreateLoanModal.value = false;
  resetCheckoutState();
};

// canSubmitCheckout moved to new structure below

// submitCheckout moved to new structure below

// Tool Checkout Modal - Additional Methods and Computed Properties

// Computed properties for tool filtering and selection
const filteredTools = computed(() => {
  let filtered = availableTools.value;

  console.log("🔍 filteredTools - starting with tools:", filtered.length);
  console.log("🔍 All tools:", filtered);

  // Filter by category
  if (toolCategoryFilter.value !== "all") {
    const beforeCategoryFilter = filtered.length;
    filtered = filtered.filter(
      (tool) =>
        tool.category_id?._id === toolCategoryFilter.value ||
        tool.category_id?.name?.toLowerCase() ===
          toolCategoryFilter.value.toLowerCase()
    );
    console.log(
      `🔍 After category filter (${toolCategoryFilter.value}): ${beforeCategoryFilter} -> ${filtered.length}`
    );
  }

  // Filter by search query
  if (toolSearchQuery.value.trim()) {
    const beforeSearchFilter = filtered.length;
    const query = toolSearchQuery.value.toLowerCase().trim();
    filtered = filtered.filter((tool) => {
      const toolName = getToolDisplayName(tool).toLowerCase();
      const toolCode = tool.sku_code?.toLowerCase() || "";
      const category = tool.category_id?.name?.toLowerCase() || "";
      return (
        toolName.includes(query) ||
        toolCode.includes(query) ||
        category.includes(query)
      );
    });
    console.log(
      `🔍 After search filter (${query}): ${beforeSearchFilter} -> ${filtered.length}`
    );
  }

  // Debug: Show inventory info before filtering
  console.log(
    "🔍 Tools with inventory info:",
    filtered.map((tool) => ({
      name: tool.name,
      sku_code: tool.sku_code,
      available_quantity: tool.inventory?.available_quantity,
      total_quantity: tool.inventory?.total_quantity,
      loaned_quantity: tool.inventory?.loaned_quantity,
      reserved_quantity: tool.inventory?.reserved_quantity,
    }))
  );

  // TEMPORARILY COMMENT OUT INVENTORY FILTER TO SEE ALL TOOLS
  // Only show tools with available inventory
  filtered = filtered.filter(
    (tool) =>
      tool.inventory?.available_quantity &&
      tool.inventory.available_quantity > 0
  );

  // Show tools regardless of inventory for debugging
  const beforeInventoryFilter = filtered.length;
  // Keep all tools for now to debug
  console.log(
    `🔍 After inventory filter (DISABLED): ${beforeInventoryFilter} -> ${filtered.length}`
  );

  console.log("🔍 Final filtered tools:", filtered);
  return filtered;
});

const toolCategoryOptions = computed(() => {
  const uniqueCategories = [
    ...new Set(
      availableTools.value
        .filter((tool) => tool.category_id)
        .map((tool) => tool.category_id)
    ),
  ];

  return uniqueCategories.map((category) => ({
    label: category.name || "Unknown Category",
    value: category._id,
  }));
});

const totalSelectedTools = computed(() => selectedTools.value.length);
const totalSelectedQuantity = computed(() =>
  selectedTools.value.reduce((sum, tool) => sum + tool.quantity, 0)
);

const canProceedToNextStep = computed(() => {
  if (checkoutStep.value === 1) {
    return checkoutForm.value.customer_name.trim().length > 0;
  }
  if (checkoutStep.value === 2) {
    return (
      selectedTools.value.length > 0 &&
      selectedTools.value.every((tool) => tool.quantity > 0)
    );
  }
  return true;
});

// Tool display and utility methods
const getToolDisplayName = (tool: any): string => {
  if (tool.name && tool.name.trim()) {
    return `${tool.sku_code} - ${tool.name}`;
  }
  return tool.sku_code || "Unknown Tool";
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Tool input and scanning methods
const handleToolInput = async () => {
  const toolCode = toolInput.value.trim().toUpperCase();
  if (!toolCode) return;

  try {
    isScanningTool.value = true;
    checkoutError.value = null;

    // Check if tool already selected
    const existingIndex = selectedTools.value.findIndex(
      (selected) => selected.tool.sku_code === toolCode
    );

    if (existingIndex >= 0) {
      // Increment quantity of existing tool
      const selectedTool = selectedTools.value[existingIndex];
      if (selectedTool.quantity < selectedTool.available_instances) {
        selectedTool.quantity += 1;
      } else {
        checkoutError.value = `Maximum available quantity (${selectedTool.available_instances}) already selected for ${toolCode}`;
        setTimeout(() => (checkoutError.value = null), 3000);
      }
      toolInput.value = "";
      return;
    }

    // Look up tool in available tools
    const matchingTool = availableTools.value.find(
      (tool) =>
        tool.sku_code === toolCode && tool.inventory?.available_quantity > 0
    );

    if (!matchingTool) {
      checkoutError.value = `No available tool found with code: ${toolCode}`;
      setTimeout(() => (checkoutError.value = null), 3000);
      return;
    }

    // Add tool to selected list
    addToolFromSelector(matchingTool);
    toolInput.value = "";
  } catch (err: any) {
    checkoutError.value = err.response?.data?.message || "Tool lookup failed";
    setTimeout(() => (checkoutError.value = null), 3000);
  } finally {
    isScanningTool.value = false;
  }
};

const addToolFromSelector = (tool: any) => {
  const existingIndex = selectedTools.value.findIndex(
    (selected) => selected.tool._id === tool._id
  );

  if (existingIndex >= 0) {
    const selectedTool = selectedTools.value[existingIndex];
    if (selectedTool.quantity < selectedTool.available_instances) {
      selectedTool.quantity += 1;
    }
  } else {
    selectedTools.value.push({
      tool: tool,
      quantity: 1,
      available_instances: tool.inventory?.available_quantity || 0,
    });
  }
};

const updateToolQuantity = (index: number, quantity: number) => {
  if (quantity <= 0) {
    removeSelectedTool(index);
  } else {
    const selectedTool = selectedTools.value[index];
    selectedTool.quantity = Math.min(
      quantity,
      selectedTool.available_instances
    );
  }
};

const removeSelectedTool = (index: number) => {
  selectedTools.value.splice(index, 1);
};

// Step navigation methods
const nextCheckoutStep = async () => {
  if (checkoutStep.value === 1 && canProceedToNextStep.value) {
    checkoutStep.value = 2;
    if (availableTools.value.length === 0) {
      await loadAvailableTools();
    }
  } else if (checkoutStep.value === 2 && canProceedToNextStep.value) {
    // Convert selectedTools to sku_items format for form
    checkoutForm.value.sku_items = selectedTools.value.map((selected) => ({
      sku_id: selected.tool._id,
      quantity: selected.quantity,
    }));
    checkoutStep.value = 3;
  }
};

const prevCheckoutStep = () => {
  if (checkoutStep.value > 1) {
    checkoutStep.value--;
  }
};

// Reset checkout state
const resetCheckoutState = () => {
  checkoutStep.value = 1;
  checkoutError.value = null;
  selectedTools.value = [];
  toolInput.value = "";
  toolSearchQuery.value = "";
  toolCategoryFilter.value = "all";
  showToolSelector.value = true;
  resetCheckoutForm();
};

// Enhanced resetCheckoutForm now handled by resetCheckoutState

// Update canSubmitCheckout to work with new structure
const canSubmitCheckout = computed(() => {
  return (
    checkoutForm.value.customer_name.trim() !== "" &&
    selectedTools.value.length > 0 &&
    selectedTools.value.every((tool) => tool.quantity > 0)
  );
});

// Update submitCheckout to use selectedTools
const submitCheckout = async () => {
  try {
    isSubmittingCheckout.value = true;
    checkoutError.value = null;

    // Prepare checkout data using selectedTools
    const checkoutData = {
      customer_name: checkoutForm.value.customer_name.trim(),
      project_name: checkoutForm.value.project_name.trim() || undefined,
      notes: checkoutForm.value.notes.trim() || undefined,
      due_date: checkoutForm.value.due_date || undefined,
      sku_items: selectedTools.value.map((selected) => ({
        sku_id: selected.tool._id,
        quantity: selected.quantity,
      })),
    };

    // Submit checkout
    const response = await toolsApi.createCheckout(checkoutData);

    // Success feedback
    console.log("✅ Tool checkout created successfully:", response);

    // Close modal and reset form
    showCreateLoanModal.value = false;
    resetCheckoutState();

    // Refresh dashboard data
    await refreshDashboard();

    // Show success notification
    console.log(
      `✅ Successfully checked out tools to ${checkoutData.customer_name}`
    );
  } catch (err: any) {
    console.error("❌ Failed to create tool checkout:", err);
    checkoutError.value =
      err?.response?.data?.message ||
      err?.message ||
      "Failed to check out tools";
  } finally {
    isSubmittingCheckout.value = false;
  }
};

// Watch for modal opening to load tools
watch(showCreateLoanModal, (newValue) => {
  if (newValue) {
    resetCheckoutState();
    loadAvailableTools();
    // Set a default due date (7 days from now)
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);
    checkoutForm.value.due_date = defaultDueDate.toISOString().slice(0, 16); // Format for datetime-local input
  } else {
    resetCheckoutState();
  }
});

// Initialize dashboard
onMounted(async () => {
  await refreshDashboard();
});
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
              <h4 class="text-h4 q-ma-none text-weight-bold text-dark">
                Tools Management
              </h4>
              <p class="text-body1 q-ma-none text-grey-7">
                Track tool inventory, manage check-outs, and monitor
                availability
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="col-12">
        <div class="glass-card flex justify-around">
          <q-tabs
            v-model="currentTab"
            dense
            class="text-primary"
            active-color="primary"
            indicator-color="primary"
            align="center"
            no-caps
          >
            <q-tab name="dashboard" icon="dashboard" label="Dashboard" />
            <!-- <q-tab name="inventory" icon="inventory" label="Inventory" /> -->
            <q-tab
              v-if="authStore.canWrite"
              name="add-tool"
              icon="add"
              label="Add Tool"
              @click="showAddToolModal = true"
              class="add-tool-tab"
            />
            <q-tab name="loans" icon="assignment" label="Check-outs" />
          </q-tabs>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="col-12">
        <q-tab-panels v-model="currentTab" animated>
          <!-- Dashboard Tab -->
          <q-tab-panel name="dashboard" class="q-pa-none">
            <div class="row q-col-gutter-lg">
              <!-- Tools Statistics -->
              <div class="col-12">
                <StatsCarousel :stats="toolsStats" :is-loading="isLoading" />
              </div>

              <!-- Quick Actions -->
              <div class="col-12">
                <div class="glass-card q-pa-lg">
                  <div class="row items-center q-mb-md">
                    <h5 class="text-h5 q-ma-none text-weight-bold">
                      Quick Actions
                    </h5>
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
                    <div class="col-12 col-sm-6">
                      <q-btn
                        color="positive"
                        icon="add_shopping_cart"
                        label="Check Out Tools"
                        class="full-width"
                        size="lg"
                        no-caps
                        @click="showCreateLoanModal = true"
                        :disable="isLoading"
                      />
                    </div>
                    <div class="col-12 col-sm-6">
                      <q-btn
                        color="warning"
                        icon="assignment_return"
                        label="Check In Tools"
                        class="full-width"
                        size="lg"
                        no-caps
                        @click="showReturnModal = true"
                        :disable="isLoading"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tool Inventory Section -->
              <div class="col-12">
                <div class="tools-inventory-section">
                  <ToolsTable
                    :can-write="authStore.canWrite"
                    @edit="editTool"
                    @delete="handleDeleteTool"
                  />
                </div>
              </div>
            </div>
          </q-tab-panel>

          <!-- Inventory Tab -->
          <!-- <q-tab-panel name="inventory" class="q-pa-none">
            <div class="glass-card q-pa-lg">
              <div class="row items-center q-mb-lg">
                <q-icon
                  name="inventory"
                  size="32px"
                  class="text-primary q-mr-md"
                />
                <div>
                  <h5 class="text-h5 q-ma-none text-weight-bold">
                    Tool Inventory
                  </h5>
                  <p class="text-body2 q-ma-none text-grey-7">
                    Manage and track all your tools with real-time inventory
                    status
                  </p>
                </div>
              </div>
              <ToolsTable
                :can-write="true"
                @edit="editTool"
                @delete="handleDeleteTool"
              />
            </div>
          </q-tab-panel> -->

          <!-- Loans Tab -->
          <q-tab-panel name="loans" class="q-pa-none">
            <div class="glass-card q-pa-lg">
              <div class="row items-center q-mb-lg">
                <q-icon
                  name="assignment"
                  size="32px"
                  class="text-primary q-mr-md"
                />
                <div>
                  <h5 class="text-h5 q-ma-none text-weight-bold">
                    Tool Check-outs Management
                  </h5>
                  <p class="text-body2 q-ma-none text-grey-7">
                    Track active check-outs, create new check-outs, and process
                    returns
                  </p>
                </div>
                <q-space />
                <q-input
                  v-model="searchTerm"
                  placeholder="Search check-outs..."
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
                <div class="text-body1 text-grey-7">
                  Loading active check-outs...
                </div>
              </div>

              <!-- Error State -->
              <div v-else-if="error && !isLoading" class="text-center q-py-xl">
                <q-icon
                  name="error"
                  size="48px"
                  class="text-negative q-mb-md"
                />
                <div class="text-body1 text-grey-7 q-mb-md">{{ error }}</div>
                <q-btn
                  color="primary"
                  outline
                  @click="loadActiveLoans"
                  label="Retry"
                />
              </div>

              <!-- Empty State -->
              <div
                v-else-if="filteredLoans.length === 0"
                class="text-center q-py-xl"
              >
                <q-icon
                  name="assignment"
                  size="64px"
                  class="text-grey-5 q-mb-md"
                />
                <div class="text-h6 text-grey-6 q-mb-sm">
                  {{
                    activeLoans.length === 0
                      ? "No Active Check-outs"
                      : "No Matching Check-outs"
                  }}
                </div>
                <div class="text-body2 text-grey-7 q-mb-md">
                  {{
                    activeLoans.length === 0
                      ? "No tools are currently checked out."
                      : "No check-outs match your search criteria."
                  }}
                </div>
                <q-btn
                  v-if="activeLoans.length === 0"
                  color="primary"
                  @click="showCreateLoanModal = true"
                  label="Create First Check-out"
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
                            <div class="text-h6 text-weight-bold">
                              {{ loan.customer_name }}
                            </div>
                            <div
                              v-if="loan.project_name"
                              class="text-caption text-grey-7"
                            >
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
                            <div class="col-5 text-caption text-grey-7">
                              Items:
                            </div>
                            <div class="col text-caption text-weight-medium">
                              {{ loan.total_quantity || 0 }} tools
                            </div>
                          </div>
                          <div v-if="loan.due_date" class="row q-mb-xs">
                            <div class="col-5 text-caption text-grey-7">
                              Due:
                            </div>
                            <div
                              class="col text-caption text-weight-medium"
                              :class="{ 'text-negative': loan.is_overdue }"
                            >
                              {{ formatDate(loan.due_date) }}
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-5 text-caption text-grey-7">
                              Created:
                            </div>
                            <div class="col text-caption text-weight-medium">
                              {{ formatDate(loan.createdAt) }}
                            </div>
                          </div>
                        </div>

                        <!-- Tools List -->
                        <div
                          v-if="loan.sku_items && loan.sku_items.length > 0"
                          class="q-mb-md"
                        >
                          <div class="text-caption text-grey-7 q-mb-xs">
                            Tools:
                          </div>
                          <div class="tools-list">
                            <div
                              v-for="item in loan.sku_items.slice(0, 3)"
                              :key="item._id"
                              class="tool-item"
                            >
                              <q-icon
                                name="build"
                                size="16px"
                                class="q-mr-xs"
                              />
                              <span class="text-caption">
                                {{
                                  typeof item.sku_id === "object"
                                    ? item.sku_id.name
                                    : "Unknown Tool"
                                }}
                              </span>
                              <span class="text-caption text-grey-6 q-ml-xs">
                                ×{{ item.selected_instance_ids?.length || 0 }}
                              </span>
                            </div>
                            <div
                              v-if="loan.sku_items.length > 3"
                              class="text-caption text-grey-6"
                            >
                              +{{ loan.sku_items.length - 3 }} more
                            </div>
                          </div>
                        </div>
                      </q-card-section>

                      <q-separator />

                      <q-card-actions align="around" class="q-pt-sm">
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
                          label="Check In"
                          @click="returnLoan(loan)"
                          :loading="isUpdating"
                        />
                        <q-btn
                          flat
                          size="sm"
                          color="warning"
                          label="Return All"
                          @click="confirmReturnCheckout(loan)"
                          :loading="isProcessingAction"
                        />
                      </q-card-actions>
                    </q-card>
                  </div>
                </div>

                <!-- Pagination -->
                <div
                  v-if="totalPages > 1"
                  class="row items-center justify-center q-mt-lg"
                >
                  <q-pagination
                    v-model="currentPage"
                    :max="totalPages"
                    :max-pages="7"
                    boundary-numbers
                    direction-links
                    color="primary"
                  />
                  <div class="q-ml-md text-caption text-grey-7">
                    Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{
                      Math.min(currentPage * itemsPerPage, totalLoans)
                    }}
                    of {{ totalLoans }} check-outs
                  </div>
                </div>
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- Tool Checkout Modal -->
      <div
        v-if="showCreateLoanModal"
        class="modal-overlay tool-checkout-modal"
        @click.self="cancelCheckout"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <!-- Header -->
            <div class="modal-header">
              <div class="header-content">
                <h3>
                  <q-icon name="build" class="q-mr-sm" />
                  Check Out Tools
                </h3>
                <div class="step-indicator">
                  Step {{ checkoutStep }} of {{ totalCheckoutSteps }}
                </div>
              </div>
              <button class="close-button" @click="cancelCheckout">
                &times;
              </button>
            </div>

            <!-- Progress Bar -->
            <div class="progress-container">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: `${(checkoutStep / totalCheckoutSteps) * 100}%`,
                  }"
                ></div>
              </div>
              <div class="step-labels">
                <span
                  :class="{
                    active: checkoutStep >= 1,
                    completed: checkoutStep > 1,
                  }"
                  >Checkout Details</span
                >
                <span
                  :class="{
                    active: checkoutStep >= 2,
                    completed: checkoutStep > 2,
                  }"
                  >Select Tools</span
                >
                <span :class="{ active: checkoutStep >= 3 }"
                  >Review & Submit</span
                >
              </div>
            </div>

            <div class="modal-body">
              <!-- Error Display -->
              <div v-if="checkoutError" class="alert alert-danger">
                {{ checkoutError }}
                <button
                  type="button"
                  class="btn-close"
                  @click="checkoutError = null"
                >
                  &times;
                </button>
              </div>

              <!-- Step 1: Checkout Details -->
              <div v-if="checkoutStep === 1" class="step-content">
                <h4>Checkout Details</h4>

                <!-- Customer/Installer Name -->
                <div class="form-group">
                  <label for="customer-name" class="form-label"
                    >Installer Name *</label
                  >
                  <input
                    id="customer-name"
                    v-model="checkoutForm.customer_name"
                    type="text"
                    class="form-control"
                    placeholder="e.g., John Smith, ABC Construction, Installation Team"
                    required
                  />
                </div>

                <!-- Project Name -->
                <div class="form-group">
                  <label for="project-name" class="form-label"
                    >Project Name (Optional)</label
                  >
                  <input
                    id="project-name"
                    v-model="checkoutForm.project_name"
                    type="text"
                    class="form-control"
                    hint="e.g., ILLJONES001, Jones Bathroom Install, General Purpose"
                    hint-hide
                  />
                  <small class="form-text">
                    Optional project or job name for better organization
                  </small>
                </div>

                <!-- Due Date -->
                <div class="form-group">
                  <label for="due-date" class="form-label"
                    >Expected Return Date (Optional)</label
                  >
                  <input
                    id="due-date"
                    v-model="checkoutForm.due_date"
                    type="datetime-local"
                    class="form-control"
                  />
                  <small class="form-text">
                    When these tools are expected to be returned
                  </small>
                </div>

                <!-- Notes -->
                <div class="form-group">
                  <label for="notes" class="form-label">Notes (Optional)</label>
                  <textarea
                    id="notes"
                    v-model="checkoutForm.notes"
                    class="form-control"
                    rows="3"
                    placeholder="Additional notes about this checkout..."
                  ></textarea>
                </div>
              </div>

              <!-- Step 2: Select Tools -->
              <div
                v-if="checkoutStep === 2"
                class="step-content step-2-content"
              >
                <h4>Select Tools to Check Out</h4>
                <p class="step-description">
                  Scan tool codes or browse & select tools to check out to
                  <strong>{{ checkoutForm.customer_name }}</strong
                  >.
                </p>

                <!-- Tool Scanner -->
                <div class="scanner-section">
                  <div class="form-group">
                    <label for="tool-input" class="form-label">
                      <q-icon name="qr_code_scanner" class="q-mr-sm" />
                      Scan or Enter Tool Code
                    </label>
                    <div class="sku-input-container">
                      <input
                        id="tool-input"
                        v-model="toolInput"
                        type="text"
                        class="form-control sku-input"
                        placeholder="Scan barcode or enter tool code..."
                        @keyup.enter="handleToolInput"
                        :disabled="isScanningTool"
                      />

                      <button
                        type="button"
                        class="btn btn-primary add-sku-btn"
                        @click="handleToolInput"
                        :disabled="!toolInput.trim() || isScanningTool"
                      >
                        <span v-if="isScanningTool" class="spinner mr-2"></span>
                        Add
                      </button>
                    </div>
                    <small class="form-text">
                      <q-icon name="info" class="q-mr-xs" />
                      Press Enter or click Add after scanning/typing a tool code
                    </small>
                  </div>
                </div>

                <!-- Two-Panel Layout -->
                <div class="two-panel-layout">
                  <!-- Left Panel: Tool Browser -->
                  <div class="sku-browser-panel">
                    <div class="panel-header">
                      <h5>
                        <q-icon name="build" class="q-mr-sm" />
                        Available Tools ({{ filteredTools.length }})
                      </h5>
                      <div class="panel-header-controls">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary"
                          @click="showToolSelector = !showToolSelector"
                        >
                          {{ showToolSelector ? "Hide" : "Show" }}
                        </button>
                      </div>
                    </div>

                    <div v-if="showToolSelector" class="panel-content">
                      <!-- Search & Filter Controls -->
                      <div class="browser-controls">
                        <div class="search-control">
                          <input
                            v-model="toolSearchQuery"
                            type="text"
                            class="form-control search-input"
                            placeholder="Search tools by code, name, or category..."
                          />
                          <q-icon name="search" class="search-icon" />
                        </div>
                        <div class="filter-control">
                          <select
                            v-model="toolCategoryFilter"
                            class="form-select filter-select"
                          >
                            <option value="all">All Categories</option>
                            <option
                              v-for="category in toolCategoryOptions"
                              :key="category.value"
                              :value="category.value"
                            >
                              {{ category.label }}
                            </option>
                          </select>
                        </div>
                      </div>

                      <!-- Tools Grid -->
                      <div v-if="isLoadingTools" class="loading-state">
                        <q-icon name="hourglass_empty" size="32px" />
                        <p>Loading available tools...</p>
                      </div>

                      <div v-else class="skus-grid">
                        <div
                          v-for="tool in filteredTools"
                          :key="tool._id"
                          class="sku-card tool-card"
                          @click="addToolFromSelector(tool)"
                        >
                          <div class="sku-info">
                            <strong>{{ getToolDisplayName(tool) }}</strong>
                            <div class="sku-meta">
                              <span class="sku-location">{{
                                tool.category_id?.name || "Unknown Category"
                              }}</span>
                              <span class="sku-quantity"
                                >Available:
                                {{
                                  tool.inventory?.available_quantity || 0
                                }}</span
                              >
                              <span
                                v-if="tool.inventory?.loaned_quantity > 0"
                                class="reserved-quantity"
                              >
                                On Loan: {{ tool.inventory.loaned_quantity }}
                              </span>
                            </div>
                          </div>
                          <div class="add-icon">
                            <q-icon name="add" />
                          </div>
                        </div>
                      </div>

                      <div
                        v-if="!isLoadingTools && filteredTools.length === 0"
                        class="no-results"
                      >
                        <q-icon name="search_off" size="32px" color="grey" />
                        <p>No tools found matching your search.</p>
                      </div>
                    </div>
                  </div>

                  <!-- Right Panel: Selected Tools -->
                  <div class="selected-skus-panel">
                    <div class="panel-header">
                      <h5>
                        <q-icon name="shopping_cart" class="q-mr-sm" />
                        Selected Tools ({{ totalSelectedTools }})
                      </h5>
                      <div v-if="totalSelectedTools > 0" class="panel-stats">
                        Total: {{ totalSelectedQuantity }} tools
                      </div>
                    </div>

                    <div class="panel-content">
                      <div
                        v-if="selectedTools.length > 0"
                        class="selected-skus-list"
                      >
                        <div
                          v-for="(selectedTool, index) in selectedTools"
                          :key="`selected-${selectedTool.tool._id}-${index}`"
                          class="selected-sku"
                        >
                          <div class="sku-info">
                            <strong>{{
                              getToolDisplayName(selectedTool.tool)
                            }}</strong>
                            <div class="sku-meta">
                              <span class="sku-code">{{
                                selectedTool.tool.sku_code
                              }}</span>
                              <span class="availability"
                                >Available:
                                {{ selectedTool.available_instances }}</span
                              >
                            </div>
                          </div>

                          <div class="sku-controls">
                            <!-- Quantity Controls -->
                            <div class="quantity-controls">
                              <button
                                type="button"
                                class="qty-btn"
                                @click="
                                  updateToolQuantity(
                                    index,
                                    selectedTool.quantity - 1
                                  )
                                "
                              >
                                <q-icon name="remove" size="12px" />
                              </button>
                              <input
                                type="number"
                                class="qty-input"
                                :value="selectedTool.quantity"
                                :max="selectedTool.available_instances"
                                min="1"
                                @input="
                                  updateToolQuantity(
                                    index,
                                    parseInt(
                                      ($event.target as HTMLInputElement).value
                                    )
                                  )
                                "
                              />
                              <button
                                type="button"
                                class="qty-btn"
                                @click="
                                  updateToolQuantity(
                                    index,
                                    selectedTool.quantity + 1
                                  )
                                "
                                :disabled="
                                  selectedTool.quantity >=
                                  selectedTool.available_instances
                                "
                              >
                                <q-icon name="add" size="12px" />
                              </button>
                            </div>

                            <!-- Remove Button -->
                            <button
                              type="button"
                              class="remove-btn"
                              @click="removeSelectedTool(index)"
                            >
                              <q-icon name="close" size="14px" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div v-else class="no-selection-message">
                        <q-icon name="build" size="48px" color="grey" />
                        <p>No tools selected yet.</p>
                        <small
                          >Scan tool codes or browse tools to get
                          started.</small
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 3: Review & Submit -->
              <div v-if="checkoutStep === 3" class="step-content">
                <h4>Review & Submit Checkout</h4>

                <!-- Checkout Summary -->
                <div class="tag-summary">
                  <div class="summary-header">
                    <div class="tag-badge" style="background-color: #10b981">
                      Tool Checkout
                    </div>
                    <div class="summary-stats">
                      <span
                        ><strong>{{ totalSelectedTools }}</strong> tools</span
                      >
                      <span
                        ><strong>{{ totalSelectedQuantity }}</strong> total
                        instances</span
                      >
                    </div>
                  </div>

                  <div class="summary-details">
                    <div class="detail-row">
                      <strong>Checked Out To:</strong>
                      {{ checkoutForm.customer_name }}
                    </div>
                    <div v-if="checkoutForm.project_name" class="detail-row">
                      <strong>Project:</strong>
                      {{ checkoutForm.project_name }}
                    </div>
                    <div v-if="checkoutForm.due_date" class="detail-row">
                      <strong>Expected Return:</strong>
                      {{ formatDateTime(checkoutForm.due_date) }}
                    </div>
                    <div v-if="checkoutForm.notes" class="detail-row">
                      <strong>Notes:</strong>
                      {{ checkoutForm.notes }}
                    </div>
                  </div>
                </div>

                <!-- Tools List -->
                <div class="review-skus">
                  <h5>Tools to be Checked Out</h5>
                  <div class="review-skus-list">
                    <div
                      v-for="(selectedTool, index) in selectedTools"
                      :key="`review-${selectedTool.tool._id}-${index}`"
                      class="review-sku"
                    >
                      <div class="sku-info">
                        <strong>{{
                          getToolDisplayName(selectedTool.tool)
                        }}</strong>
                        <div class="sku-details">
                          <span>Code: {{ selectedTool.tool.sku_code }}</span>
                          <span
                            >Category:
                            {{
                              selectedTool.tool.category_id?.name || "Unknown"
                            }}</span
                          >
                        </div>
                      </div>
                      <div class="sku-quantity">
                        <span class="quantity-badge"
                          >{{ selectedTool.quantity }} tools</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="modal-footer">
              <button
                v-if="checkoutStep > 1"
                type="button"
                class="btn btn-secondary"
                @click="prevCheckoutStep"
              >
                <q-icon name="arrow_back" class="q-mr-sm" />
                Back
              </button>

              <div class="flex-spacer"></div>

              <button
                type="button"
                class="btn btn-secondary"
                @click="cancelCheckout"
              >
                Cancel
              </button>

              <button
                v-if="checkoutStep < totalCheckoutSteps"
                type="button"
                class="btn btn-primary"
                @click="nextCheckoutStep"
                :disabled="!canProceedToNextStep"
              >
                Next
                <q-icon name="arrow_forward" class="q-ml-sm" />
              </button>

              <button
                v-else
                type="button"
                class="btn btn-success"
                @click="submitCheckout"
                :disabled="isSubmittingCheckout || !canSubmitCheckout"
              >
                <span v-if="isSubmittingCheckout" class="spinner mr-2"></span>
                {{
                  isSubmittingCheckout ? "Checking Out..." : "Check Out Tools"
                }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Return Modal -->
      <ReturnToolsDialog
        v-model="showReturnModal"
        :loans="activeLoans"
        :preselect-loan-id="selectedReturnLoanId"
        @checked-in="
          async () => {
            selectedReturnLoanId = null;
            await refreshDashboard();
          }
        "
      />

      <!-- Edit Tool Modal -->
      <EditToolModal
        v-if="selectedTool"
        v-model="showEditToolModal"
        :tool="selectedTool"
        @updated="handleToolUpdated"
      />

      <!-- Add Tool Modal -->
      <AddToolModal
        v-if="showAddToolModal"
        @close="showAddToolModal = false"
        @success="
          async () => {
            showAddToolModal = false;
            await toolsStore.fetchToolsInventory();
            await refreshDashboard();
          }
        "
      />

      <!-- Loan Details Modal -->
      <q-dialog v-model="showLoanDetailsModal" persistent>
        <q-card style="min-width: 600px; max-width: 800px">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6 text-weight-bold">
              <q-icon name="assignment" class="q-mr-sm" />
              Tool Check-out Details
            </div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section v-if="selectedLoan">
            <!-- Loan Header Info -->
            <div class="q-mb-lg">
              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-6">
                  <div class="text-caption text-grey-7 q-mb-xs">
                    Customer/Installer
                  </div>
                  <div class="text-h6 text-weight-medium">
                    {{ selectedLoan.customer_name }}
                  </div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7 q-mb-xs">Status</div>
                  <q-chip
                    :color="selectedLoan.is_overdue ? 'negative' : 'warning'"
                    text-color="white"
                    :label="selectedLoan.is_overdue ? 'Overdue' : 'Active'"
                  />
                </div>
              </div>

              <div
                class="row q-col-gutter-md q-mb-md"
                v-if="selectedLoan.project_name"
              >
                <div class="col-6">
                  <div class="text-caption text-grey-7 q-mb-xs">
                    Project Name
                  </div>
                  <div class="text-body1">{{ selectedLoan.project_name }}</div>
                </div>
              </div>

              <div class="row q-col-gutter-md">
                <div class="col-6">
                  <div class="text-caption text-grey-7 q-mb-xs">
                    Check-out Date
                  </div>
                  <div class="text-body2">
                    {{ formatDateTime(selectedLoan.createdAt) }}
                  </div>
                </div>
                <div class="col-6" v-if="selectedLoan.due_date">
                  <div class="text-caption text-grey-7 q-mb-xs">
                    Expected Return
                  </div>
                  <div
                    class="text-body2"
                    :class="{ 'text-negative': selectedLoan.is_overdue }"
                  >
                    {{ formatDateTime(selectedLoan.due_date) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes Section -->
            <div v-if="selectedLoan.notes" class="q-mb-lg">
              <div class="text-caption text-grey-7 q-mb-xs">Notes</div>
              <div
                class="text-body2 q-pa-md"
                style="background: #f5f5f5; border-radius: 4px"
              >
                {{ selectedLoan.notes }}
              </div>
            </div>

            <!-- Tools Section -->
            <div
              v-if="selectedLoan.sku_items && selectedLoan.sku_items.length > 0"
            >
              <div class="text-subtitle1 text-weight-bold q-mb-md">
                <q-icon name="build" class="q-mr-sm" />
                Checked Out Tools ({{ selectedLoan.sku_items.length }})
              </div>

              <div class="q-mb-md">
                <div
                  class="row text-caption text-grey-7 q-pa-sm"
                  style="background: #f8f9fa; font-weight: 500"
                >
                  <div class="col-5">Tool</div>
                  <div class="col-3">Code</div>
                  <div class="col-2">Quantity</div>
                  <div class="col-2">Instances</div>
                </div>

                <div
                  v-for="(item, index) in selectedLoan.sku_items"
                  :key="index"
                  class="row q-pa-sm"
                  :class="{ 'bg-grey-1': index % 2 === 1 }"
                >
                  <div class="col-5">
                    <div class="text-body2 text-weight-medium">
                      {{
                        typeof item.sku_id === "object"
                          ? item.sku_id.name
                          : "Unknown Tool"
                      }}
                    </div>
                    <div
                      v-if="
                        typeof item.sku_id === 'object' &&
                        item.sku_id.category_id
                      "
                      class="text-caption text-grey-6"
                    >
                      {{ item.sku_id.category_id.name }}
                    </div>
                  </div>
                  <div class="col-3">
                    <code class="text-primary text-weight-medium">
                      {{
                        typeof item.sku_id === "object"
                          ? item.sku_id.sku_code
                          : "N/A"
                      }}
                    </code>
                  </div>
                  <div class="col-2">
                    <div class="text-body2">{{ item.quantity || 1 }}</div>
                  </div>
                  <div class="col-2">
                    <div class="text-body2">
                      {{ item.selected_instance_ids?.length || 0 }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Summary Stats -->
            <div class="q-mt-lg">
              <div class="row q-col-gutter-md text-center">
                <div class="col">
                  <div class="text-h6 text-primary text-weight-bold">
                    {{ selectedLoan.sku_items?.length || 0 }}
                  </div>
                  <div class="text-caption text-grey-7">Tool Types</div>
                </div>
                <div class="col">
                  <div class="text-h6 text-warning text-weight-bold">
                    {{ selectedLoan.total_quantity || 0 }}
                  </div>
                  <div class="text-caption text-grey-7">Total Items</div>
                </div>
                <div class="col">
                  <div class="text-h6 text-info text-weight-bold">
                    {{
                      selectedLoan.sku_items?.reduce(
                        (sum, item) =>
                          sum + (item.selected_instance_ids?.length || 0),
                        0
                      ) || 0
                    }}
                  </div>
                  <div class="text-caption text-grey-7">Instances</div>
                </div>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
            <q-btn
              color="positive"
              label="Check In Tools"
              icon="assignment_return"
              @click="
                () => {
                  showLoanDetailsModal = false;
                  returnLoan(selectedLoan);
                }
              "
              :loading="isUpdating"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Delete Tool Confirmation Dialog -->
      <q-dialog v-model="showDeleteDialog" persistent>
        <q-card style="min-width: 400px">
          <q-card-section class="row items-center">
            <q-avatar icon="delete" color="negative" text-color="white" />
            <span class="q-ml-sm text-h6">Delete Tool</span>
          </q-card-section>

          <q-card-section v-if="toolToDelete">
            <p class="q-mb-md">
              Are you sure you want to <strong>permanently delete</strong> this
              tool?
            </p>
            <p class="q-mb-md">This action will:</p>
            <ul class="q-pl-md q-mb-md">
              <li>Delete the tool SKU and all its data</li>
              <li>
                Remove all {{ toolToDelete.total_quantity || 0 }} stock
                instances
              </li>
              <li>Delete any associated history</li>
            </ul>
            <p class="text-weight-medium">
              Tool: <span class="text-primary">{{ toolToDelete.name }}</span
              ><br />
              SKU Code:
              <span class="text-secondary">{{ toolToDelete.sku_code }}</span
              ><br />
              <span v-if="toolToDelete.brand || toolToDelete.model">
                {{ toolToDelete.brand }} {{ toolToDelete.model }}<br />
              </span>
              Total Quantity:
              <span class="text-orange">{{
                toolToDelete.total_quantity || 0
              }}</span>
            </p>
            <q-banner class="bg-negative text-white q-mt-md" rounded>
              <q-icon name="warning" class="q-mr-sm" />
              <strong>This action CANNOT be undone!</strong>
            </q-banner>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              color="primary"
              @click="cancelDeleteTool"
            />
            <q-btn
              label="Delete Tool"
              color="negative"
              @click="confirmDeleteTool"
              :loading="toolsStore.loading"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Return All Tools Confirmation Dialog -->
      <q-dialog v-model="showReturnDialog" persistent>
        <q-card style="min-width: 400px">
          <q-card-section class="row items-center">
            <q-avatar
              icon="assignment_return"
              color="warning"
              text-color="white"
            />
            <span class="q-ml-sm text-h6">Return All Tools</span>
          </q-card-section>

          <q-card-section v-if="selectedLoanForAction">
            <p class="q-mb-md">
              Are you sure you want to <strong>return all tools</strong> from
              this checkout?
            </p>
            <p class="q-mb-md">This action will:</p>
            <ul class="q-pl-md q-mb-md">
              <li>Return all tools back to available inventory</li>
              <li>Mark the checkout as completed/fulfilled</li>
              <li>Keep the checkout record for audit purposes</li>
            </ul>
            <p class="text-weight-medium">
              Customer:
              <span class="text-primary">{{
                selectedLoanForAction.customer_name
              }}</span
              ><br />
              <span v-if="selectedLoanForAction.project_name">
                Project:
                <span class="text-secondary">{{
                  selectedLoanForAction.project_name
                }}</span
                ><br />
              </span>
              Tools:
              <span class="text-orange"
                >{{ selectedLoanForAction.sku_items?.length || 0 }} types</span
              >
            </p>

            <q-input
              v-model="returnReason"
              type="textarea"
              label="Return notes (optional)"
              placeholder="e.g., Project completed, tools returned in good condition"
              rows="3"
              outlined
              class="q-mt-md"
            />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              flat
              label="Keep Checkout Active"
              color="primary"
              v-close-popup
            />
            <q-btn
              label="Return All Tools"
              color="warning"
              @click="returnCheckout"
              :loading="isProcessingAction"
            />
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

/* Tools Inventory Section Styling */
.tools-inventory-section {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 24px;
  margin-top: 8px;
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
  background: linear-gradient(
    135deg,
    rgba(244, 67, 54, 0.05) 0%,
    transparent 100%
  );
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

/* Responsive adjustments */
@media (max-width: 600px) {
  .q-page {
    padding: 8px !important;
  }
  
  .glass-card {
    padding: 16px !important;
    margin-bottom: 12px;
  }
  
  .tools-inventory-section {
    padding: 16px;
    margin-top: 4px;
  }
  
  .q-col-gutter-lg > .col-12 {
    padding: 8px;
  }
}

/* Tool Checkout Modal Styles - Tag Modal Style */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-dialog {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 900px;
  max-height: 95vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0.75rem 0.75rem 0 0;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-content h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  color: #111827;
}

.step-indicator {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.progress-container {
  padding: 1rem 1.5rem 0;
  background: #f9fafb;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.step-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.step-labels span {
  color: #9ca3af;
  transition: color 0.2s;
}

.step-labels span.active {
  color: #3b82f6;
}

.step-labels span.completed {
  color: #059669;
}

.modal-body {
  padding: 2rem 1.5rem;
  min-height: 400px;
}

.step-content h4 {
  margin-bottom: 0.5rem;
  color: #111827;
  font-weight: 600;
}

.step-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-control,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-control:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-text {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Scanner and panel styles */
.scanner-section {
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.sku-input-container {
  display: flex;
  gap: 0.75rem;
}

.sku-input {
  flex: 1;
  font-family: "Courier New", monospace;
  font-size: 1.1rem;
}

.add-sku-btn {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
  min-width: 80px;
}

.add-sku-btn:hover:not(:disabled) {
  background: #2563eb;
}

.add-sku-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.two-panel-layout {
  display: flex;
  gap: 1.5rem;
  margin-top: 1.5rem;
  height: 400px;
}

.sku-browser-panel,
.selected-skus-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: white;
  overflow: hidden;
}

.panel-header {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panel-header h5 {
  margin: 0;
  color: #111827;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.panel-stats {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.browser-controls {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.search-control {
  flex: 2;
  position: relative;
}

.search-input {
  padding-right: 2.5rem;
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}

.filter-control {
  flex: 1;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

.skus-grid {
  flex: 1;
  overflow-y: auto;
}

.sku-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  border-left: 4px solid #10b981;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sku-card:hover {
  background-color: #f8fafc;
}

.sku-card.tool-card {
  border-left-color: #f59e0b;
}

.sku-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sku-info strong {
  color: #111827;
  font-size: 0.9rem;
  line-height: 1.3;
}

.sku-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.sku-quantity {
  font-weight: 500;
  color: #059669;
}

.sku-location {
  font-weight: 500;
  color: #3b82f6;
}

.reserved-quantity {
  font-weight: 500;
  color: #dc2626;
}

.add-icon {
  width: 28px;
  height: 28px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.sku-card:hover .add-icon {
  background: #059669;
  transform: scale(1.05);
}

.selected-skus-list {
  flex: 1;
  overflow-y: auto;
}

.selected-sku {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  gap: 1rem;
}

.sku-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  width: 28px;
  height: 28px;
  background: #e5e7eb;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.qty-btn:hover:not(:disabled) {
  background: #d1d5db;
}

.qty-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qty-input {
  width: 50px;
  text-align: center;
  padding: 0.375rem 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.remove-btn:hover {
  background: #dc2626;
}

.no-selection-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  text-align: center;
  flex: 1;
}

/* Review styles */
.tag-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.tag-badge {
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.875rem;
}

.summary-stats {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.summary-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  color: #374151;
}

.review-skus h5 {
  color: #111827;
  margin-bottom: 1rem;
  font-weight: 600;
}

.review-skus-list {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.review-sku {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.review-sku:last-child {
  border-bottom: none;
}

.review-sku .sku-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.quantity-badge {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.sku-code {
  font-family: "Courier New", monospace;
  font-weight: 600;
  color: #3b82f6;
}

.availability {
  color: #059669;
  font-weight: 500;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
}

.flex-spacer {
  flex: 1;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-outline-primary {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-outline-primary:hover {
  background: #3b82f6;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alert {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alert-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

/* Mobile Responsiveness - Comprehensive */
@media (max-width: 768px) {
  /* Page Layout Adjustments */
  .q-page {
    padding: 0.75rem !important;
  }

  .row.q-col-gutter-lg {
    margin: 0 !important;
  }

  .row.q-col-gutter-lg > div {
    padding: 0.375rem !important;
    width: 100% !important;
  }

  /* Page Header Mobile Fixes */
  .glass-card {
    width: 100% !important;
    margin: 0 0 1rem 0 !important;
  }

  .glass-card .row.items-center {
    width: 100% !important;
    margin: 0 !important;
  }

  .glass-card .row.items-center.q-gutter-md {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
    gap: 1rem !important;
  }

  .glass-card .row.items-center.q-gutter-md > * {
    margin: 0 !important;
  }

  /* Tab Navigation */
  .q-tabs {
    font-size: 0.875rem;
  }

  .q-tab {
    padding: 0.5rem 0.75rem;
    min-width: auto;
  }

  /* Search Input in Loans Tab */
  .q-input[style*="width: 250px"] {
    width: 100% !important;
    max-width: none !important;
    margin-right: 0 !important;
    margin-bottom: 1rem;
  }

  /* Loan Cards Grid - Stack Vertically */
  .row.q-col-gutter-md > .col-12.col-md-6.col-lg-4 {
    padding: 0.25rem !important;
  }

  .loan-card {
    margin-bottom: 0.75rem;
  }

  .loan-card .q-card__section {
    padding: 1rem;
  }

  .loan-card .q-card__actions {
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .loan-card .q-btn {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
    flex: 1;
    min-width: auto;
  }

  /* Tools Table Container */
  .glass-card .q-pa-lg {
    padding: 1rem !important;
  }

  /* Quick Actions Buttons */
  .row.q-col-gutter-md .col-12.col-sm-6.col-md-4 {
    padding: 0.25rem !important;
    margin-bottom: 0.5rem;
  }

  .q-btn.full-width.size-lg {
    font-size: 0.875rem;
    padding: 0.75rem;
  }

  /* MODAL IMPROVEMENTS */

  /* Modal Overlay - Full Screen on Mobile */
  .modal-overlay {
    padding: 0;
    align-items: stretch;
  }

  .modal-dialog {
    margin: 0;
    max-width: none;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Modal Header - Compact */
  .modal-header {
    padding: 1rem;
    flex-shrink: 0;
    border-radius: 0;
  }

  .header-content h3 {
    font-size: 1.25rem;
  }

  .step-indicator {
    font-size: 0.75rem;
  }

  /* Progress Bar */
  .progress-container {
    padding: 0.75rem 1rem 0;
  }

  .step-labels {
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }

  /* Modal Body - Scrollable */
  .modal-body {
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* Step Content */
  .step-content h4 {
    font-size: 1.125rem;
    margin-bottom: 1rem;
  }

  .step-description {
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  /* Form Improvements */
  .form-group {
    margin-bottom: 1rem;
  }

  .form-label {
    font-size: 0.875rem;
    margin-bottom: 0.375rem;
  }

  .form-control,
  .form-select {
    padding: 0.75rem;
    font-size: 1rem;
    border-radius: 0.375rem;
  }

  .form-text {
    font-size: 0.75rem;
  }

  /* Scanner Section */
  .scanner-section {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .sku-input-container {
    flex-direction: column;
    gap: 0.5rem;
  }

  .sku-input {
    font-size: 1.1rem;
    padding: 0.875rem;
  }

  .add-sku-btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
  }

  /* Two Panel Layout - Stack Vertically */
  .two-panel-layout {
    flex-direction: column;
    gap: 1rem;
    height: auto;
    margin-top: 1rem;
  }

  .sku-browser-panel,
  .selected-skus-panel {
    max-height: none;
    min-height: 250px;
  }

  .sku-browser-panel {
    order: 2;
  }

  .selected-skus-panel {
    order: 1;
    max-height: 200px;
  }

  /* Panel Headers */
  .panel-header {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .panel-header h5 {
    font-size: 0.875rem;
  }

  .panel-stats {
    font-size: 0.75rem;
  }

  .panel-header-controls .btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  /* Browser Controls */
  .browser-controls {
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .search-control,
  .filter-control {
    flex: none;
  }

  .search-input {
    padding-right: 2.5rem;
    font-size: 1rem;
  }

  /* Tool Cards - Better Organization */
  .sku-card {
    padding: 1rem;
    border-left-width: 4px;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    transition: all 0.2s ease;
  }

  .sku-card:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(2px);
  }

  .sku-info {
    flex: 1;
    min-width: 0; /* Prevent text overflow */
  }

  .sku-info strong {
    font-size: 0.9rem;
    line-height: 1.3;
    display: block;
    margin-bottom: 0.25rem;
    color: #1a1a1a;
    font-weight: 700;
  }

  .sku-meta {
    gap: 0.5rem;
    font-size: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }

  .sku-meta span {
    background: rgba(255, 255, 255, 0.8);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .add-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* Selected Tools List */
  .selected-sku {
    padding: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .sku-controls {
    gap: 0.5rem;
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .quantity-controls {
    gap: 0.375rem;
  }

  .qty-btn {
    width: 32px;
    height: 32px;
  }

  .qty-input {
    width: 60px;
    padding: 0.5rem 0.25rem;
  }

  .remove-btn {
    width: 32px;
    height: 32px;
  }

  /* Review Step */
  .tag-summary {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .summary-stats {
    gap: 1rem;
    font-size: 0.8rem;
  }

  .tag-badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
  }

  .review-skus h5 {
    font-size: 1rem;
    margin-bottom: 0.75rem;
  }

  .review-sku {
    padding: 0.75rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .review-sku .sku-details {
    gap: 0.75rem;
    font-size: 0.8rem;
    flex-wrap: wrap;
  }

  .quantity-badge {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
  }

  /* Modal Footer */
  .modal-footer {
    padding: 1rem;
    flex-shrink: 0;
    flex-wrap: wrap;
    border-radius: 0;
  }

  .modal-footer .btn {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    min-width: auto;
  }

  .btn-primary,
  .btn-success {
    order: 1;
    flex: 1;
  }

  .btn-secondary {
    order: 2;
    flex: 1;
  }

  .flex-spacer {
    display: none;
  }

  /* DIALOG IMPROVEMENTS */

  /* Quasar Dialog Mobile Improvements */
  .q-dialog__inner {
    padding: 0.5rem !important;
  }

  .q-card {
    max-height: 90vh !important;
    width: 100% !important;
    max-width: none !important;
  }

  .q-card[style*="min-width: 600px"] {
    min-width: auto !important;
    width: 100% !important;
    max-width: none !important;
  }

  .q-card[style*="min-width: 400px"] {
    min-width: auto !important;
    width: 100% !important;
    max-width: none !important;
  }

  .q-card__section {
    padding: 1rem !important;
  }

  .q-card__actions {
    padding: 0.75rem 1rem !important;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .q-card__actions .q-btn {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
  }

  /* Loan Details Table */
  .row.q-pa-sm {
    padding: 0.5rem !important;
    font-size: 0.875rem;
  }

  .row.text-caption.text-grey-7 {
    font-size: 0.75rem !important;
    font-weight: 600;
  }

  /* Stats Row in Dialogs */
  .row.q-col-gutter-md.text-center .col {
    padding: 0.25rem !important;
  }

  .text-h6 {
    font-size: 1.25rem !important;
  }

  /* Loading States */
  .loading-state {
    padding: 1.5rem;
  }

  .no-selection-message,
  .no-results {
    padding: 1.5rem;
  }

  /* Alert Messages */
  .alert {
    padding: 0.75rem;
    font-size: 0.875rem;
  }

  .btn-close {
    font-size: 1rem;
  }

  /* Pagination */
  .q-pagination {
    font-size: 0.875rem;
  }

  .text-caption {
    font-size: 0.75rem !important;
  }
}
</style>
