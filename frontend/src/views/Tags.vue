<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useTagStore } from "@/stores/tag";
import { useCategoryStore } from "@/stores/category";
import { tagApi } from "@/utils/api";
import type { Tag } from "@/types";
import { TAG_TYPES } from "@/types";
import CreateTagModal from "@/components/CreateTagModal.vue";
import EditTagModal from "@/components/EditTagModal.vue";
import EditTagItemsModal from "@/components/EditTagItemsModal.vue";
import FulfillTagsDialog from "@/components/FulfillTagsDialog.vue";
import StageTagsDialog from "@/components/StageTagsDialog.vue";
import StatsCarousel from "@/components/StatsCarousel.vue";
import NoteThread from "@/components/NoteThread.vue";
import { useQuasar } from "quasar";

const authStore = useAuthStore();
const tagStore = useTagStore();
const categoryStore = useCategoryStore();
const $q = useQuasar();

// Local state for modals
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showEditItemsModal = ref(false);
const tagToEdit = ref<Tag | null>(null);
const tagToEditItems = ref<Tag | null>(null);
const showFulfillDialog = ref(false);
const showStageDialog = ref(false);
const selectedTags = ref<Tag[]>([]);

// Expansion state for tags
const expandedTags = ref(new Set<string>());

// Store state computed properties
const error = computed(() => tagStore.error);
const isLoading = computed(() => tagStore.isLoading);
const stats = computed(() => tagStore.tagStats);

// Filters - sync with store filters
const statusFilter = computed({
  get: () => tagStore.filters.status || "active",
  set: (value) => {
    tagStore.updateFilters({ status: value === "all" ? "" : value });
  },
});

const tagTypeFilter = computed({
  get: () => tagStore.filters.tag_type || "all",
  set: (value) => {
    tagStore.updateFilters({ tag_type: value === "all" ? "" : value });
  },
});

const customerFilter = computed({
  get: () => tagStore.filters.customer_name || "",
  set: (value) => {
    tagStore.updateFilters({ customer_name: value.trim() });
  },
});

// Use store tags, but hide broken/imperfect from default view
// They only show when explicitly filtered by type
const hiddenTypesInDefaultView = ['broken', 'imperfect'] as const;

const filteredTags = computed(() => {
  const activeTypeFilter = tagStore.filters.tag_type;
  // If user explicitly selected a type (including broken/imperfect), show all
  if (activeTypeFilter && activeTypeFilter !== '') {
    return tagStore.tags;
  }
  // Default view: hide broken and imperfect
  return tagStore.tags.filter(tag => !hiddenTypesInDefaultView.includes(tag.tag_type as any));
});

// Group tags by tag_type for sectioned display
const tagsByTypeGrouped = computed(() => {
  const groups: Array<{ type: string; label: string; color: string; tags: Tag[] }> = [];
  
  for (const tt of TAG_TYPES) {
    const matching = filteredTags.value.filter(tag => tag.tag_type === tt.value);
    if (matching.length > 0) {
      groups.push({
        type: tt.value,
        label: tt.label,
        color: tt.color,
        tags: matching
      });
    }
  }
  
  // Catch any tags with types not in TAG_TYPES
  const knownTypes = new Set(TAG_TYPES.map(t => t.value));
  const other = filteredTags.value.filter(tag => !knownTypes.has(tag.tag_type));
  if (other.length > 0) {
    groups.push({ type: 'other', label: 'Other', color: '#6c757d', tags: other });
  }
  
  return groups;
});

// Stats carousel configuration for StatsCarousel component
const tagStatsCarousel = computed(() => {
  if (!stats.value) return [];
  
  return [
    {
      icon: 'local_offer',
      label: 'Active Tags',
      value: stats.value.active || 0,
      color: '#1976d2',
    },
    {
      icon: 'people',
      label: 'Customers',
      value: stats.value.uniqueCustomers || 0,
      color: '#388e3c',
    },
    {
      icon: 'local_shipping',
      label: 'Staged',
      value: stats.value.staged || 0,
      color: '#ff8f00',
    },
    {
      icon: 'done_all',
      label: 'Fulfilled',
      value: stats.value.fulfilled || 0,
      color: '#00796b',
    },
    {
      icon: 'cancel',
      label: 'Cancelled',
      value: stats.value.cancelled || 0,
      color: '#d32f2f',
    },
  ];
});

const getTagTypeColor = (tagType: string) => {
  const type = TAG_TYPES.find((t) => t.value === tagType);
  return type?.color || "#6c757d";
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "positive";
    case "staged":
      return "amber-8";
    case "fulfilled":
      return "info";
    case "cancelled":
      return "negative";
    default:
      return "grey";
  }
};

// Updated methods to use store
const loadTags = async () => {
  await tagStore.fetchTags();
};

const loadStats = async () => {
  await tagStore.fetchStats();
};

const handleEditTag = async (tag: Tag) => {
  try {
    console.log("Opening edit modal for tag:", tag);

    // Fetch the tag with populated items to ensure we have all the details
    const fullTag = await tagStore.fetchTag(tag._id, true);

    console.log("Full tag data received:", fullTag);

    // Validate that we have the tag data
    if (!fullTag) {
      throw new Error("Tag data not found");
    }

    tagToEdit.value = fullTag;
    showEditModal.value = true;
  } catch (err) {
    console.error("Edit tag error:", err);
    $q.notify({
      type: "negative",
      message: `Failed to load tag details: ${err.message}`,
      timeout: 3000,
    });

    // Fallback: Use the existing tag data if fetch fails
    if (tag && tag._id) {
      console.log("Using fallback tag data:", tag);
      tagToEdit.value = tag;
      showEditModal.value = true;
    }
  }
};

const handleCreateSuccess = async () => {
  showCreateModal.value = false;
  await Promise.all([loadTags(), loadStats()]);
};

const handleEditSuccess = async () => {
  showEditModal.value = false;
  tagToEdit.value = null;
  await Promise.all([loadTags(), loadStats()]);
};

const handleEditItems = async (tag: Tag) => {
  try {
    console.log("Opening edit items modal for tag:", tag);

    // Fetch the tag with populated items to ensure we have all the details
    const fullTag = await tagStore.fetchTag(tag._id, true);

    console.log("Full tag data received for items editing:", fullTag);

    // Validate that we have the tag data
    if (!fullTag) {
      throw new Error("Tag data not found");
    }

    tagToEditItems.value = fullTag;
    showEditItemsModal.value = true;
  } catch (err) {
    console.error("Edit tag items error:", err);
    $q.notify({
      type: "negative",
      message: `Failed to load tag details: ${err.message}`,
      timeout: 3000,
    });

    // Fallback: Use the existing tag data if fetch fails
    if (tag && tag._id) {
      console.log("Using fallback tag data for items editing:", tag);
      tagToEditItems.value = tag;
      showEditItemsModal.value = true;
    }
  }
};

const handleEditItemsSuccess = async () => {
  showEditItemsModal.value = false;
  tagToEditItems.value = null;
  await Promise.all([loadTags(), loadStats()]);
};

const handleDeleteTag = async (tag: Tag) => {
  if (
    confirm(`Are you sure you want to delete tag for ${tag.customer_name}?`)
  ) {
    try {
      await tagStore.deleteTag(tag._id);
      await Promise.all([loadTags(), loadStats()]);
    } catch (err) {
      tagStore.error = err.message || "Failed to delete tag";
    }
  }
};

const clearError = () => {
  tagStore.clearError();
};

// Fulfill Tags workflow
const handleFulfillTags = () => {
  showFulfillDialog.value = true;
};

// Stage Tags workflow
const handleStageTags = () => {
  showStageDialog.value = true;
};

// Unstage a tag
const handleUnstageTag = async (tag: Tag) => {
  $q.dialog({
    title: 'Unstage Tag',
    message: `Revert all staging for ${tag.customer_name}? Items will be marked as unstaged.`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await tagApi.unstageTag(tag._id, { unstage_all: true });
      $q.notify({
        type: 'positive',
        message: 'Tag unstaged successfully',
        timeout: 3000,
      });
      await Promise.all([loadTags(), loadStats()]);
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err.response?.data?.message || 'Failed to unstage tag',
        timeout: 3000,
      });
    }
  });
};

const handleStageSuccess = async () => {
  showStageDialog.value = false;
  await Promise.all([loadTags(), loadStats()]);
  $q.notify({
    type: "positive",
    message: "Tag staged successfully",
    timeout: 3000,
  });
};

// Handle fulfill dialog success
const handleFulfillSuccess = async (results: any) => {
  const fulfilledCount = results.fulfilled_tags?.length || 0;
  const failedCount = results.failed_tags?.length || 0;

  if (fulfilledCount > 0) {
    $q.notify({
      type: "positive",
      message: `Successfully fulfilled ${fulfilledCount} tag${
        fulfilledCount === 1 ? "" : "s"
      }`,
      timeout: 5000,
    });
  }

  if (failedCount > 0) {
    $q.notify({
      type: "warning",
      message: `${failedCount} tag${
        failedCount === 1 ? "" : "s"
      } failed to fulfill`,
      timeout: 5000,
    });
  }

  await loadTags();
  await loadStats();
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const getItemsDisplay = (skuItems: any[]) => {
  console.log("📋 [Tags] getItemsDisplay called with:", skuItems);

  if (!skuItems || skuItems.length === 0) {
    console.log("❌ [Tags] No sku_items found");
    return "No items";
  }

  return skuItems
    .map((tagItem) => {
      console.log("🔄 [Tags] Processing tagItem:", tagItem);

      // INSTANCE-BASED ARCHITECTURE: Handle sku_items with direct sku_id reference or populated SKU data
      const sku = tagItem.sku_details || tagItem.sku_id || null;

      // Use selected_instance_ids.length as single source of truth
      const quantity = tagItem.selected_instance_ids
        ? tagItem.selected_instance_ids.length
        : 0;

      if (!sku) {
        console.log("⚠️ [Tags] No SKU data found for item");
        return `SKU ${tagItem.sku_id} (${quantity})`;
      }

      let displayName = sku.sku_code || "Unknown SKU";

      // Add description if available
      if (sku.description && sku.description.trim()) {
        displayName = `${sku.sku_code} - ${sku.description}`;
      } else if (sku.name) {
        displayName = `${sku.sku_code} - ${sku.name}`;
      }

      const result = `${displayName} (${quantity})`;
      console.log("✅ [Tags] Item display result:", result);
      return result;
    })
    .join(", ");
};

const getTotalQuantity = (items: any[]) => {
  if (!items) return 0;
  return items.reduce((sum, item) => {
    // INSTANCE-BASED ARCHITECTURE: Use selected_instance_ids.length as single source of truth
    const quantity = item.selected_instance_ids
      ? item.selected_instance_ids.length
      : 0;
    return sum + quantity;
  }, 0);
};

// Split sku_items into staged vs unstaged for the expansion view
const getStagedItems = (skuItems: any[]) => {
  if (!skuItems) return [];
  return skuItems.filter(item => {
    const stagedCount = item.staged_instance_ids?.length || 0;
    const selectedCount = item.selected_instance_ids?.length || 0;
    return stagedCount > 0 && stagedCount >= selectedCount;
  });
};

const getPartiallyStagedItems = (skuItems: any[]) => {
  if (!skuItems) return [];
  return skuItems.filter(item => {
    const stagedCount = item.staged_instance_ids?.length || 0;
    const selectedCount = item.selected_instance_ids?.length || 0;
    return stagedCount > 0 && stagedCount < selectedCount;
  });
};

const getUnstagedItems = (skuItems: any[]) => {
  if (!skuItems) return [];
  return skuItems.filter(item => {
    const stagedCount = item.staged_instance_ids?.length || 0;
    return stagedCount === 0;
  });
};

const hasAnyStagingData = (skuItems: any[]) => {
  if (!skuItems) return false;
  return skuItems.some(item => (item.staged_instance_ids?.length || 0) > 0);
};

// Toggle tag expansion
const toggleTagExpansion = (tagId: string) => {
  if (expandedTags.value.has(tagId)) {
    expandedTags.value.delete(tagId);
  } else {
    expandedTags.value.add(tagId);
  }
};

// ===== NOTES THREAD HELPERS =====

// Notes may be undefined for tags that haven't been saved with the new
// schema yet; treat missing/non-array values as empty threads.
const getNotesArray = (tag: Tag) =>
  Array.isArray((tag as any).notes) ? ((tag as any).notes as any[]) : [];

const getNoteCount = (tag: Tag) => getNotesArray(tag).length;

// Latest note by createdAt. Used for the inline preview on each tag card.
const getLatestNote = (tag: Tag) => {
  const notes = getNotesArray(tag);
  if (notes.length === 0) return null;
  return [...notes].sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  })[0];
};

const formatNoteTimestamp = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const truncateNote = (text: string, max = 140) => {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
};

// Legacy / author-less entries are normalized server-side to kind:'system';
// fall back to the same label here so the preview never reads "Unknown".
const displayNoteAuthor = (note: any) => {
  const author = typeof note?.author === 'string' ? note.author.trim() : '';
  if (!note) return 'System';
  if (note.kind === 'system' || !author || author.toLowerCase() === 'system') {
    return 'System';
  }
  return author;
};

// Warning heuristic: a tag marked complete whose most recent note was
// written before the tag's last structural update is suspicious — it's the
// exact shape of the bug that motivated the chat thread.
const hasStaleCompletionNote = (tag: Tag) => {
  if (!tag.is_complete) return false;
  const latest = getLatestNote(tag);
  if (!latest) return false;
  const latestTime = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
  const updatedTime = tag.updatedAt ? new Date(tag.updatedAt).getTime() : 0;
  if (!latestTime || !updatedTime) return false;
  // Allow a small buffer (60s) so we don't warn purely because of save ordering.
  return updatedTime - latestTime > 60 * 1000;
};

onMounted(async () => {
  await Promise.all([loadTags(), loadStats()]);
});

const tableColumns = [
  {
    name: "items",
    label: "Items",
    field: "sku_items", // Changed from 'items' to 'sku_items'
    format: (skuItems: any[]) => getItemsDisplay(skuItems),
    align: "left",
    sortable: false,
  },
  {
    name: "customer",
    label: "Customer",
    field: "customer_name",
    align: "left",
    sortable: true,
  },
  {
    name: "type",
    label: "Type",
    field: "tag_type",
    align: "center",
    sortable: true,
  },
  {
    name: "quantity",
    label: "Total Quantity",
    field: "sku_items", // Changed from 'items' to 'sku_items'
    format: (skuItems: any[]) => getTotalQuantity(skuItems),
    align: "center",
    sortable: false,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "center",
    sortable: true,
  },
  {
    name: "created",
    label: "Created",
    field: "createdAt",
    format: (date: string) => formatDate(date),
    align: "center",
    sortable: true,
  },
  {
    name: "actions",
    label: "Actions",
    align: "center",
  },
];
</script>

<template>
  <q-page class="tags-page">
    <div class="container q-pa-md">
      <!-- Page Header -->
      <div class="page-header glass-card q-pa-md q-mb-md" data-aos="fade-up">
        <div class="header-content">
          <div class="header-text">
            <h1 class="text-h4 text-dark q-mb-xs">
              <q-icon name="local_offer" class="q-mr-sm" />
              Tag Management
            </h1>
            <p class="text-body2 text-dark opacity-80">
              Track and manage inventory tags for customers, projects, and
              reservations
            </p>
          </div>
          <div class="header-stats" v-if="stats">
            <q-chip
              color="primary"
              text-color="white"
              icon="local_offer"
              class="stat-chip"
            >
              {{ stats.active }} Active Tags
            </q-chip>
            <q-chip
              color="positive"
              text-color="white"
              icon="people"
              class="stat-chip"
            >
              {{ stats.uniqueCustomers }} Customers
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <div
        class="stats-section q-mb-lg"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <StatsCarousel
          :stats="tagStatsCarousel"
          :is-loading="isLoading"
        />
      </div>

      <!-- Controls -->
      <div
        class="controls-section glass-card q-pa-md q-mb-md"
        data-aos="fade-up"
        data-aos-delay="200"
      >
        <div class="row items-center justify-between">
          <div class="col-auto">
            <div class="row q-gutter-md items-center">
              <!-- Customer Search -->
              <div class="col-auto">
                <q-input
                  v-model="customerFilter"
                  @update:model-value="loadTags"
                  filled
                  placeholder="Search by customer..."
                  class="search-input"
                  style="min-width: 250px;"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" class="text-dark" />
                  </template>
                </q-input>
              </div>

              <!-- Status Filter -->
              <div class="col-auto">
                <q-select
                  v-model="statusFilter"
                  @update:model-value="loadTags"
                  filled
                  :options="[
                    { label: 'All Status', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Staged', value: 'staged' },
                    { label: 'Fulfilled', value: 'fulfilled' },
                    { label: 'Cancelled', value: 'cancelled' },
                  ]"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  class="filter-select"
                  style="min-width: 140px;"
                />
              </div>

              <!-- Tag Type Filter -->
              <div class="col-auto">
                <q-select
                  v-model="tagTypeFilter"
                  @update:model-value="loadTags"
                  filled
                  :options="[
                    { label: 'All Types', value: 'all' },
                    ...TAG_TYPES.map((t) => ({
                      label: t.label,
                      value: t.value,
                    })),
                  ]"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  class="filter-select"
                  style="min-width: 140px;"
                />
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="col-auto" v-if="authStore.canWrite">
            <div class="row q-gutter-sm">
              <!-- Stage Tags -->
              <q-btn
                @click="handleStageTags"
                color="amber-8"
                text-color="white"
                icon="local_shipping"
                label="Stage"
                class="add-btn"
                no-caps
              >
                <q-tooltip>Verify & load items for pickup</q-tooltip>
              </q-btn>

              <!-- Fulfill Tags -->
              <q-btn
                @click="handleFulfillTags"
                color="positive"
                icon="done_all"
                label="Fulfill"
                class="add-btn"
                no-caps
              >
                <q-tooltip>Complete fulfillment of staged/active tags</q-tooltip>
              </q-btn>

              <!-- Create Tag -->
              <q-btn
                @click="showCreateModal = true"
                color="primary"
                icon="add"
                label="Create Tag"
                class="add-btn"
                no-caps
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <q-banner
        v-if="error"
        class="bg-negative text-white q-mb-lg"
        dense
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ error }}
        <template v-slot:action>
          <q-btn flat color="white" label="Dismiss" @click="clearError" />
        </template>
      </q-banner>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="loading-container glass-card q-pa-xl text-center"
      >
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-h6 text-dark q-mt-md">Loading tags...</div>
      </div>

      <!-- Tags List -->
      <div
        v-else
        class="tags-list-container glass-card"
        data-aos="fade-up"
        data-aos-delay="300"
      >
        <div v-if="filteredTags.length === 0" class="text-center q-pa-xl">
          <q-icon name="local_offer" size="48px" class="text-grey-6 q-mb-md" />
          <div class="text-h6 text-grey-8">No tags found</div>
          <div class="text-body2 text-grey-6">
            Create tags to track inventory for customers and projects
          </div>
        </div>

        <!-- Tags Grid - Grouped by Type -->
        <div class="tags-grid q-pa-md">
          <div v-for="group in tagsByTypeGrouped" :key="group.type" class="q-mb-lg">
            <!-- Section Header -->
            <div class="type-section-header q-mb-sm row items-center">
              <q-icon name="label" :style="{ color: group.color }" size="sm" class="q-mr-sm" />
              <span class="text-subtitle1 text-weight-bold text-dark">{{ group.label }}</span>
              <q-badge :style="{ backgroundColor: group.color }" text-color="white" class="q-ml-sm">
                {{ group.tags.length }}
              </q-badge>
            </div>

          <div class="tag-group-list">
            <q-card
              v-for="tag in group.tags"
              :key="tag._id"
              :class="[
                'tag-card',
                { 'tag-incomplete': !tag.is_complete && tag.status === 'active' },
                { 'tag-broken': tag.tag_type === 'broken' }
              ]"
              :flat="!(!tag.is_complete && tag.status === 'active')"
            >
              <!-- Tag Header -->
              <q-card-section class="tag-header-section">
                <!-- Top row: Customer + Actions -->
                <div class="row items-center no-wrap q-mb-sm">
                  <div class="col">
                    <div class="row items-center q-gutter-sm">
                      <q-avatar 
                        :color="tag.tag_type === 'broken' ? 'red-4' : 'primary'" 
                        text-color="white" 
                        size="md"
                      >
                        <q-icon :name="tag.tag_type === 'broken' ? 'broken_image' : 'person'" />
                      </q-avatar>
                      <div>
                        <div class="text-h6 text-weight-bold" :class="tag.tag_type === 'broken' ? 'text-red-8' : 'text-dark'">
                          {{ tag.customer_name }}
                        </div>
                        <div v-if="tag.project_name" class="text-caption text-grey-6">
                          <q-icon name="folder" size="xs" class="q-mr-xs" />
                          {{ tag.project_name }}
                        </div>
                        <div class="text-caption text-grey-7">
                          <q-icon name="schedule" size="xs" class="q-mr-xs" />
                          Created: {{ formatDate(tag.createdAt) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Actions (right-aligned) -->
                  <div class="col-auto">
                    <div class="row q-gutter-xs">
                      <q-btn
                        v-if="authStore.canWrite"
                        @click="handleEditTag(tag)"
                        color="primary"
                        icon="edit"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Edit Tag</q-tooltip>
                      </q-btn>
                      <q-btn
                        v-if="authStore.canWrite && tag.status === 'active'"
                        @click="handleEditItems(tag)"
                        color="secondary"
                        icon="edit_note"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Edit Items</q-tooltip>
                      </q-btn>
                      <q-btn
                        v-if="authStore.canWrite && hasAnyStagingData(tag.sku_items)"
                        @click="handleUnstageTag(tag)"
                        color="amber-8"
                        icon="undo"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Unstage Items</q-tooltip>
                      </q-btn>
                      <q-btn
                        v-if="authStore.canWrite"
                        @click="handleDeleteTag(tag)"
                        color="negative"
                        icon="delete"
                        size="sm"
                        round
                        flat
                        dense
                      >
                        <q-tooltip>Delete Tag</q-tooltip>
                      </q-btn>
                      
                      <!-- Expand/Collapse Button -->
                      <q-btn
                        @click="toggleTagExpansion(tag._id)"
                        :color="expandedTags.has(tag._id) ? 'primary' : 'grey-6'"
                        :icon="expandedTags.has(tag._id) ? 'expand_less' : 'expand_more'"
                        size="sm"
                        round
                        flat
                        dense
                      >
                      <q-tooltip>{{ expandedTags.has(tag._id) ? 'Collapse' : 'View Items' }}</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </div>

                <!-- Bottom row: Chips (wrapping naturally) -->
                <div class="row q-gutter-xs items-center" style="flex-wrap: wrap;">
                  <q-chip
                    :color="getStatusColor(tag.status)"
                    text-color="white"
                    size="sm"
                    class="text-weight-medium text-capitalize"
                    icon="flag"
                  >
                    {{ tag.status }}
                  </q-chip>
                  
                  <q-chip color="info" text-color="white" size="sm" icon="inventory">
                    {{ getTotalQuantity(tag.sku_items) }} items
                  </q-chip>
                  
                  <!-- Completeness -->
                  <q-chip
                    v-if="!tag.is_complete && tag.status === 'active'"
                    color="red-8"
                    text-color="white"
                    size="sm"
                    icon="warning"
                  >
                    Incomplete
                  </q-chip>
                  <q-chip
                    v-if="tag.is_complete && tag.status === 'active'"
                    color="green"
                    text-color="white"
                    size="sm"
                    icon="check_circle"
                  >
                    Complete
                  </q-chip>
                  
                  <!-- Staging progress -->
                  <q-chip
                    v-if="tag.staging_progress && tag.staging_progress.percentage > 0 && tag.status === 'active'"
                    color="amber"
                    text-color="white"
                    size="sm"
                    icon="local_shipping"
                  >
                    {{ tag.staging_progress.percentage }}% staged
                  </q-chip>

                  <!-- Broken notice -->
                  <q-chip
                    v-if="tag.tag_type === 'broken'"
                    color="red-2"
                    text-color="red-10"
                    size="sm"
                    icon="report_problem"
                  >
                    Damaged — Do Not Ship
                  </q-chip>
                </div>

                <!-- Notes thread preview (latest entry + count + stale warning) -->
                <div class="tag-notes q-mt-sm" v-if="getNoteCount(tag) > 0 || hasStaleCompletionNote(tag)">
                  <div class="row items-start q-gutter-xs">
                    <q-icon name="forum" size="xs" class="q-mt-xs text-grey-6" />
                    <div class="col">
                      <div class="row items-center q-gutter-xs">
                        <span class="text-caption text-grey-7" v-if="getLatestNote(tag)">
                          <strong>{{ displayNoteAuthor(getLatestNote(tag)) }}</strong>
                          &middot; {{ formatNoteTimestamp(getLatestNote(tag)?.createdAt) }}
                        </span>
                        <q-chip
                          dense
                          size="xs"
                          color="grey-4"
                          text-color="grey-9"
                          icon="forum"
                          :label="`${getNoteCount(tag)} note${getNoteCount(tag) === 1 ? '' : 's'}`"
                        />
                        <q-chip
                          v-if="hasStaleCompletionNote(tag)"
                          dense
                          size="xs"
                          color="warning"
                          text-color="white"
                          icon="warning"
                          label="Marked complete after latest note — verify status"
                        />
                      </div>
                      <div class="text-body2 text-grey-8 q-mt-xs" v-if="getLatestNote(tag)">
                        {{ truncateNote(getLatestNote(tag)?.message || '') }}
                      </div>
                    </div>
                  </div>
                </div>
              </q-card-section>

              <q-separator v-if="expandedTags.has(tag._id)" />

              <!-- Expandable Items Section -->
              <q-slide-transition>
                <q-card-section v-if="expandedTags.has(tag._id)" class="tag-items-section">
                  <div class="text-subtitle1 text-weight-medium text-dark q-mb-md">
                    <q-icon name="inventory_2" class="q-mr-sm" color="primary" />
                    Tagged Items ({{ tag.sku_items?.length || 0 }})
                  </div>

                  <div v-if="tag.sku_items && tag.sku_items.length > 0">
                    
                    <!-- STAGED section -->
                    <div v-if="getStagedItems(tag.sku_items).length > 0" class="q-mb-md">
                      <div class="section-label text-positive text-weight-bold q-mb-xs">
                        <q-icon name="check_circle" size="xs" class="q-mr-xs" />
                        Staged ({{ getStagedItems(tag.sku_items).length }})
                      </div>
                      <q-list dense separator class="compact-items-list">
                        <q-item
                          v-for="(skuItem, index) in getStagedItems(tag.sku_items)"
                          :key="'staged-' + index"
                          class="compact-item"
                          dense
                        >
                          <q-item-section avatar>
                            <q-avatar color="positive" text-color="white" size="xs">
                              <q-icon name="check" size="xs" />
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium text-dark">
                              <template v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.sku_code">
                                {{ skuItem.sku_id.sku_code || "Unknown SKU" }}
                              </template>
                              <template v-else>SKU {{ skuItem.sku_id }}</template>
                              <span v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.name" class="text-grey-7 q-ml-sm">
                                - {{ skuItem.sku_id.name }}
                              </span>
                            </q-item-label>
                            <q-item-label v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.description" caption class="text-grey-6" lines="1">
                              {{ skuItem.sku_id.description }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side>
                            <q-badge color="positive" :label="skuItem.selected_instance_ids?.length || 0" class="text-weight-bold" />
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </div>

                    <!-- PARTIALLY STAGED section -->
                    <div v-if="getPartiallyStagedItems(tag.sku_items).length > 0" class="q-mb-md">
                      <div class="section-label text-amber-8 text-weight-bold q-mb-xs">
                        <q-icon name="timelapse" size="xs" class="q-mr-xs" />
                        Partially Staged ({{ getPartiallyStagedItems(tag.sku_items).length }})
                      </div>
                      <q-list dense separator class="compact-items-list">
                        <q-item
                          v-for="(skuItem, index) in getPartiallyStagedItems(tag.sku_items)"
                          :key="'partial-' + index"
                          class="compact-item"
                          dense
                        >
                          <q-item-section avatar>
                            <q-avatar color="amber" text-color="white" size="xs">
                              <q-icon name="timelapse" size="xs" />
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium text-dark">
                              <template v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.sku_code">
                                {{ skuItem.sku_id.sku_code || "Unknown SKU" }}
                              </template>
                              <template v-else>SKU {{ skuItem.sku_id }}</template>
                              <span v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.name" class="text-grey-7 q-ml-sm">
                                - {{ skuItem.sku_id.name }}
                              </span>
                            </q-item-label>
                            <q-item-label v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.description" caption class="text-grey-6" lines="1">
                              {{ skuItem.sku_id.description }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side>
                            <q-badge color="amber" text-color="white" class="text-weight-bold">
                              {{ skuItem.staged_instance_ids?.length || 0 }}/{{ skuItem.selected_instance_ids?.length || 0 }}
                            </q-badge>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </div>

                    <!-- UNSTAGED section -->
                    <div v-if="getUnstagedItems(tag.sku_items).length > 0">
                      <div v-if="hasAnyStagingData(tag.sku_items)" class="section-label text-grey-6 text-weight-bold q-mb-xs">
                        <q-icon name="radio_button_unchecked" size="xs" class="q-mr-xs" />
                        Unstaged ({{ getUnstagedItems(tag.sku_items).length }})
                      </div>
                      <q-list dense separator class="compact-items-list">
                        <q-item
                          v-for="(skuItem, index) in getUnstagedItems(tag.sku_items)"
                          :key="'unstaged-' + index"
                          class="compact-item"
                          dense
                        >
                          <q-item-section avatar>
                            <q-avatar color="primary" text-color="white" size="xs">
                              <q-icon name="inventory" size="xs" />
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium text-dark">
                              <template v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.sku_code">
                                {{ skuItem.sku_id.sku_code || "Unknown SKU" }}
                              </template>
                              <template v-else>SKU {{ skuItem.sku_id }}</template>
                              <span v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.name" class="text-grey-7 q-ml-sm">
                                - {{ skuItem.sku_id.name }}
                              </span>
                            </q-item-label>
                            <q-item-label v-if="typeof skuItem.sku_id === 'object' && skuItem.sku_id?.description" caption class="text-grey-6" lines="1">
                              {{ skuItem.sku_id.description }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side>
                            <q-badge color="primary" :label="skuItem.selected_instance_ids?.length || 0" class="text-weight-bold" />
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </div>

                  </div>

                  <div v-else class="text-center q-pa-lg">
                    <q-icon
                      name="inventory_2"
                      size="64px"
                      class="text-grey-4 q-mb-md"
                    />
                    <div class="text-body1 text-grey-6">No items in this tag</div>
                  </div>

                  <!-- Notes thread (full history + compose) -->
                  <q-separator class="q-my-md" />
                  <div class="text-subtitle1 text-weight-medium text-dark q-mb-md">
                    <q-icon name="forum" class="q-mr-sm" color="primary" />
                    Notes Thread ({{ getNoteCount(tag) }})
                  </div>
                  <NoteThread :tag="tag" />
                </q-card-section>
              </q-slide-transition>
            </q-card>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Tag Management Modals -->
    <CreateTagModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @success="handleCreateSuccess"
    />

    <EditTagModal
      v-if="showEditModal && tagToEdit"
      :tag="tagToEdit"
      @close="showEditModal = false"
      @success="handleEditSuccess"
    />

    <!-- Edit Tag Items Modal -->
    <EditTagItemsModal
      v-if="showEditItemsModal && tagToEditItems"
      :tag="tagToEditItems"
      @close="showEditItemsModal = false"
      @success="handleEditItemsSuccess"
    />

    <!-- Stage Tags Dialog -->
    <StageTagsDialog
      :show="showStageDialog"
      @close="showStageDialog = false"
      @success="handleStageSuccess"
    />

    <!-- Fulfill Tags Dialog -->
    <FulfillTagsDialog
      :show="showFulfillDialog"
      @close="showFulfillDialog = false"
      @success="handleFulfillSuccess"
    />
  </q-page>
</template>

<style scoped>
.tags-page {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Glassmorphism Cards */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Page Header */
.page-header {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.3),
    rgba(255, 255, 255, 0.2)
  );
}

/* Stats Cards */
.stat-card {
  flex: 1 0 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
  transform: scale(1.02);
}

/* Controls Section */
.search-input,
.filter-select {
  border-radius: 15px;
}

.search-input :deep(.q-field__control),
.filter-select :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 15px;
}

.search-input :deep(.q-field__native),
.filter-select :deep(.q-field__native) {
  color: #333;
}

.search-input :deep(.q-field__native)::placeholder {
  color: rgba(0, 0, 0, 0.6);
}

.add-btn {
  border-radius: 15px;
  padding: 8px 24px;
  font-weight: 600;
  text-transform: none;
}

/* Loading Container */
.loading-container {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Tags List Container */
.tags-list-container {
  border-radius: 20px;
  overflow: visible;
  padding: 0;
}

/* Column Headers */
.tags-header {
  background: rgba(255, 255, 255, 0.15);
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  margin: 0;
  padding: 16px 20px !important;
}

.tags-header .col-1,
.tags-header .col-2,
.tags-header .col-3 {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.tags-header .text-center {
  justify-content: center;
}

/* Expansion Items */
.tag-expansion-item {
  background: transparent;
}

.tag-expansion-item :deep(.q-item) {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.tag-expansion-item :deep(.q-item:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.tag-header {
  padding: 16px 20px !important;
  min-height: 64px;
}

.tag-header .col-1,
.tag-header .col-2,
.tag-header .col-3 {
  display: flex;
  align-items: center;
}

.tag-header .text-center {
  justify-content: center;
}

/* Tag Items Container */
.tag-items-container {
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.items-scroll-area {
  max-height: 300px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 8px;
}

.items-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.items-scroll-area::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.items-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.items-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Item Details */
.item-detail {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.item-detail:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.item-detail :deep(.q-item__section) {
  color: rgba(33, 37, 41, 0.9);
}

.quantity-badge {
  font-size: 11px;
  font-weight: 600;
}

/* SKU Item Layout */
.sku-code {
  color: rgba(33, 37, 41, 0.95);
  font-weight: 700;
}

.sku-name {
  font-weight: 500;
  font-size: 0.9em;
}

.item-description {
  margin-top: 2px;
  font-size: 0.85em;
  line-height: 1.3;
  max-width: 400px;
  word-wrap: break-word;
}

.no-items-message {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
}

.opacity-80 {
  opacity: 0.8;
}

/* Tag group list - simple vertical stack with even spacing */
.tag-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* New Tag Card Styles */
.tag-card {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(25px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;
}

.tag-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.2) !important;
}

/* Incomplete tags: red left and bottom border */
.tag-card.tag-incomplete {
  border-left: 3px solid #d32f2f;
  border-bottom: 3px solid #d32f2f;
}

/* Broken tags: muted, distinct treatment */
.tag-card.tag-broken {
  background: rgba(255, 235, 238, 0.3) !important;
  border-color: rgba(211, 47, 47, 0.3);
  border-style: dashed;
  opacity: 0.85;
}

.tag-card.tag-broken:hover {
  opacity: 1;
  background: rgba(255, 235, 238, 0.45) !important;
}

.tag-header-section {
  background: rgba(255, 255, 255, 0.05);
}

.tag-items-section {
  background: rgba(255, 255, 255, 0.02);
}

.item-card {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.item-card:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

/* Type section headers */
.type-section-header {
  padding: 8px 4px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.08);
}

/* Section labels for staged/unstaged groups */
.section-label {
  font-size: 0.8rem;
  letter-spacing: 0.03em;
  padding: 4px 8px;
  display: flex;
  align-items: center;
}

/* Compact Items List Styles */
.compact-items-container {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.compact-items-list {
  background: transparent;
}

.compact-item {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.compact-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.compact-item .q-item__section--avatar {
  min-width: 32px;
}

.compact-item .q-item__section--side {
  padding-left: 16px;
}

/* Compact items scrollbar */
.compact-items-container::-webkit-scrollbar {
  width: 6px;
}

.compact-items-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.compact-items-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.compact-items-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Responsive Design for Lists */
@media (max-width: 1024px) {
  .tags-header,
  .tag-header {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px;
  }

  .tags-header > div,
  .tag-header > div {
    width: 100% !important;
    flex: none !important;
    justify-content: flex-start !important;
  }

  .tags-header .text-center,
  .tag-header .text-center {
    justify-content: flex-start !important;
  }
}

@media (max-width: 768px) {
  .tags-header {
    display: none;
  }

  .items-scroll-area {
    max-height: 200px;
  }

  .tag-header {
    padding: 12px 16px !important;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }

  .glass-card {
    border-radius: 15px;
    margin-bottom: 1rem;
  }

  .search-input {
    min-width: 200px !important;
  }

  /* Mobile header layout */
  .header-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header-text {
    text-align: center;
  }

  .header-text h1 {
    font-size: 1.5rem !important;
  }

  .header-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .stat-chip {
    flex: 1;
    min-width: 140px;
    justify-content: center;
  }

  /* Stack controls vertically on mobile */
  .controls-section .row {
    flex-direction: column;
    gap: 1rem;
  }

  .controls-section .col-auto {
    width: 100%;
  }

  .controls-section .col-auto .row {
    flex-direction: column;
    width: 100%;
  }

  .controls-section .q-input,
  .controls-section .q-select {
    width: 100%;
    min-width: unset !important;
  }

  .controls-section .add-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
