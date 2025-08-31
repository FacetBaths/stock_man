<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useInventoryStore } from "@/stores/inventory";
import { useCategoryStore } from "@/stores/category";
import { skuApi } from "@/utils/api";
import { formatCategoryName } from "@/utils/formatting";
import type { CreateSKURequest, SKU } from "@/types";

interface Props {
  initialMode?: "create" | "add_stock";
  initialBarcode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: "create",
  initialBarcode: "",
});

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const authStore = useAuthStore();
const inventoryStore = useInventoryStore();
const categoryStore = useCategoryStore();

// Mode toggle: 'create' for new SKU, 'add_stock' for existing SKU
const mode = ref<"create" | "add_stock">(props.initialMode);
const availableSKUs = ref<SKU[]>([]);
const isLoadingSKUs = ref(false);

const formData = ref({
  // Mode selection
  existing_sku_id: "",

  // SKU creation fields (EXACT backend field names from FRONTEND_DEV_REFERENCE.md)
  sku_code: "", // Allow custom SKU codes (manufacturer SKUs)
  category_id: "",
  name: "",
  description: "",
  brand: "",
  model: "",
  color: "",
  dimensions: "",
  finish: "",
  unit_cost: 0,
  barcode: props.initialBarcode || "",
  notes: "",

  // Instance creation fields (EXACT backend field names)
  quantity: 1,
  location: "",
  supplier: "",
  reference_number: "",
});

const canEditCost = computed(
  () =>
    authStore.user?.role === "admin" ||
    authStore.user?.role === "warehouse_manager"
);

// Get only product categories (exclude tools) with proper formatting
const productCategories = computed(() => {
  return categoryStore.categories
    .filter((cat) => cat.type !== "tool" && cat.status === "active") // Exclude tool categories
    .map((cat) => ({
      _id: cat._id,
      name: formatCategoryName(cat.name || cat.displayName || "Unnamed"),
      type: cat.type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

// Load all active SKUs for add_stock mode
const loadSKUs = async () => {
  try {
    isLoadingSKUs.value = true;
    const response = await skuApi.getSKUs({
      status: "active",
      limit: 100,
    });
    availableSKUs.value = response.skus;
  } catch (error) {
    console.error("Failed to load SKUs:", error);
    availableSKUs.value = [];
  } finally {
    isLoadingSKUs.value = false;
  }
};

// Watch mode changes to load SKUs when needed
watch(
  mode,
  (newMode) => {
    if (newMode === "add_stock") {
      loadSKUs();
    }
  },
  { immediate: false }
);

// Helper function to format SKU description
const formatSKUDescription = (sku: SKU): string => {
  if (!sku) return "No description";

  if (sku.description && sku.description.trim()) {
    return sku.description;
  }

  if (sku.name && sku.name.trim()) {
    return sku.name;
  }

  return sku.sku_code || "No description";
};

const handleSubmit = async () => {
  try {
    if (mode.value === "create") {
      // Create new SKU with instances using EXACT backend fields
      await inventoryStore.createItem({
        sku_code: formData.value.sku_code, // Custom SKU code support
        category_id: formData.value.category_id,
        name: formData.value.name,
        description: formData.value.description,
        brand: formData.value.brand,
        model: formData.value.model,
        color: formData.value.color,
        dimensions: formData.value.dimensions,
        finish: formData.value.finish,
        unit_cost: formData.value.unit_cost,
        barcode: formData.value.barcode,
        notes: formData.value.notes,
        quantity: formData.value.quantity,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number,
      });
    } else {
      // Add stock to existing SKU using EXACT backend API
      if (!formData.value.existing_sku_id) {
        throw new Error("Please select a SKU");
      }

      await inventoryStore.addStock({
        sku_id: formData.value.existing_sku_id,
        quantity: formData.value.quantity,
        unit_cost: formData.value.unit_cost,
        location: formData.value.location,
        supplier: formData.value.supplier,
        reference_number: formData.value.reference_number,
        notes: formData.value.notes,
      });
    }

    emit("success");
  } catch (error) {
    console.error("Create/Add item error:", error);
  }
};

const handleClose = () => {
  emit("close");
};

// Load categories on component mount
onMounted(() => {
  categoryStore.fetchCategories();
});
</script>

<template>
  <q-dialog
    :model-value="true"
    @hide="handleClose"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="add-item-modal">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add New Item</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form @submit.prevent="handleSubmit">
          <q-banner
            v-if="inventoryStore.error"
            class="bg-negative text-white q-mb-md"
            dense
            rounded
          >
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            {{ inventoryStore.error }}
          </q-banner>

          <!-- Mode Selection -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">What would you like to do?</div>
            <q-btn-toggle
              v-model="mode"
              toggle-color="primary"
              :options="[
                {
                  label: 'Create New SKU',
                  value: 'create',
                  icon: 'add_circle',
                },
                {
                  label: 'Add Stock to Existing',
                  value: 'add_stock',
                  icon: 'inventory_2',
                },
              ]"
              class="q-mb-sm"
            />
            <div class="text-caption text-grey-6">
              {{
                mode === "create"
                  ? "Create a new product (SKU) and add initial stock"
                  : "Add stock to an existing product (SKU)"
              }}
            </div>
          </div>

          <!-- Existing SKU Selection (add_stock mode only) -->
          <q-select
            v-if="mode === 'add_stock'"
            v-model="formData.existing_sku_id"
            :options="availableSKUs"
            option-value="_id"
            :option-label="
              (sku) => `${sku.sku_code} - ${formatSKUDescription(sku)}`
            "
            label="Select SKU *"
            outlined
            dense
            :loading="isLoadingSKUs"
            :disable="isLoadingSKUs"
            :rules="[(val) => !!val || 'Please select a SKU']"
            class="q-mb-md"
          >
            <template v-slot:hint>
              Choose the SKU you want to add stock to
            </template>
          </q-select>

          <!-- SKU Creation Fields (create mode only) -->
          <div v-if="mode === 'create'">
            <!-- SKU Code Field -->
            <q-input
              v-model="formData.sku_code"
              label="SKU Code"
              outlined
              dense
              class="q-mb-md"
            >
              <template v-slot:hint>
                Optional: Enter manufacturer's part number. If model number is
                provided, system will default to "FR-{model}". Leave blank for
                category-based auto-generation.
              </template>
            </q-input>

            <!-- Basic Product Details -->
            <q-input
              v-model="formData.name"
              label="Product Name *"
              outlined
              dense
              :rules="[(val) => !!val || 'Product name is required']"
              class="q-mb-md"
            />

            <q-input
              v-model="formData.description"
              label="Description"
              type="textarea"
              outlined
              rows="3"
              class="q-mb-md"
            />

            <div class="row q-gutter-md q-mb-md">
              <q-input
                v-model="formData.brand"
                label="Brand"
                outlined
                dense
                class="col"
              />

              <q-input
                v-model="formData.model"
                label="Model #"
                outlined
                dense
                class="col"
              />
            </div>

            <!-- Category and Barcode -->
            <div class="row q-gutter-md q-mb-md">
              <q-select
                v-model="formData.category_id"
                :options="productCategories"
                option-value="_id"
                :option-label="(cat) => `${cat.name} (${cat.type})`"
                label="Category *"
                outlined
                dense
                :loading="categoryStore.isLoading"
                :disable="categoryStore.isLoading"
                :rules="[(val) => !!val || 'Category is required']"
                class="col"
              >
                <template v-slot:hint>
                  Required: Category for this SKU
                </template>
              </q-select>

              <q-input
                v-model="formData.barcode"
                label="Barcode"
                outlined
                dense
                class="col"
              >
                <template v-slot:hint>
                  Optional: Barcode for this SKU
                </template>
              </q-input>
            </div>
          </div>

          <!-- Stock/Instance Fields (both modes) -->
          <q-separator class="q-my-md" />
          <div class="text-subtitle2 q-mb-sm">
            {{ mode === "create" ? "Initial Stock" : "Stock Details" }}
          </div>

          <div class="row q-gutter-md q-mb-md">
            <q-input
              v-model.number="formData.quantity"
              label="Quantity *"
              type="number"
              outlined
              dense
              :rules="[(val) => val > 0 || 'Quantity must be greater than 0']"
              class="col"
            />

            <q-input
              v-if="canEditCost"
              v-model.number="formData.unit_cost"
              label="Unit Cost (USD)"
              type="number"
              outlined
              dense
              step="0.01"
              min="0"
              prefix="$"
              class="col"
            />

            <q-input
              v-model="formData.location"
              label="Location"
              outlined
              dense
              placeholder="e.g., Warehouse A, Shelf 3"
              class="col"
            />
          </div>

          <div class="row q-gutter-md q-mb-md">
            <q-input
              v-model="formData.supplier"
              label="Supplier"
              outlined
              dense
              class="col"
            />

            <q-input
              v-model="formData.reference_number"
              label="Reference #"
              outlined
              dense
              placeholder="PO#, Invoice#, etc."
              class="col"
            />
          </div>

          <q-input
            v-model="formData.notes"
            label="Notes"
            type="textarea"
            outlined
            rows="2"
            placeholder="Any additional notes..."
            class="q-mb-md"
          />
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="grey" @click="handleClose" />
        <q-btn
          unelevated
          label="Add Item"
          color="primary"
          :loading="inventoryStore.isCreating"
          @click="handleSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.add-item-modal {
  width: 100%;
  max-width: 800px;
}

@media (max-width: 768px) {
  .add-item-modal {
    height: 100vh;
  }

  .row {
    flex-direction: column;
  }

  .row .col {
    width: 100%;
  }
}
</style>
