# Stock Manager TODO: Depreciation System Implementation

## Overview
Add a comprehensive depreciation system to track current value of inventory items over time, providing more accurate financial reporting and asset valuation.

## Database Schema Changes

### Backend - Item Model Updates
**File:** `backend/src/models/Item.js`

Add new fields to Item schema:
```javascript
depreciationMethod: {
  type: String,
  enum: ['none', 'straight-line', 'accelerated', 'seasonal'],
  default: 'straight-line'
},
// Reference to depreciation profile
depreciationProfile: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'DepreciationProfile'
},
// Optional: Override profile settings for specific items
overrides: {
  usefulLifeMonths: Number,
  salvageValue: Number,
  customValues: mongoose.Schema.Types.Mixed // For custom formula variables
}
```

### Depreciation Profile Model (NEW)
**File:** `backend/src/models/DepreciationProfile.js` (NEW)

Create a new model for managing depreciation profiles:
```javascript
const depreciationProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  method: {
    type: String,
    enum: ['none', 'straight-line', 'declining-balance', 'sum-of-years', 'custom'],
    required: true
  },
  usefulLifeMonths: {
    type: Number,
    required: true,
    min: 1
  },
  salvageValueType: {
    type: String,
    enum: ['percentage', 'fixed-amount'],
    default: 'percentage'
  },
  salvageValue: {
    type: Number,
    required: true,
    min: 0
  },
  // For declining balance method
  declineRate: {
    type: Number,
    min: 0,
    max: 1
  },
  // For custom formulas
  customFormula: {
    type: String, // e.g., "cost * (1 - (age / useful_life))^2"
    validate: {
      validator: function(v) {
        return this.method !== 'custom' || (v && v.length > 0);
      },
      message: 'Custom formula is required when method is custom'
    }
  },
  // Product types this profile applies to
  applicableProductTypes: [{
    type: String,
    enum: ['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous']
  }],
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Ensure only one default profile per product type
depreciationProfileSchema.index({ 
  applicableProductTypes: 1, 
  isDefault: 1 
}, { 
  unique: true, 
  partialFilterExpression: { isDefault: true } 
});

module.exports = mongoose.model('DepreciationProfile', depreciationProfileSchema);
```

## Backend API Enhancements

### Depreciation Profile Management API
**File:** `backend/src/routes/depreciationProfiles.js` (NEW)

Create CRUD endpoints for depreciation profiles:
```javascript
const express = require('express');
const { auth, requireAdminOrWarehouse } = require('../middleware/auth');
const DepreciationProfile = require('../models/DepreciationProfile');
const router = express.Router();

// GET /api/depreciation-profiles - List all profiles
router.get('/', [auth], async (req, res) => {
  const profiles = await DepreciationProfile.find({ isActive: true })
    .sort({ name: 1 });
  res.json({ profiles });
});

// POST /api/depreciation-profiles - Create new profile
router.post('/', [auth, requireAdminOrWarehouse], async (req, res) => {
  const profile = new DepreciationProfile({
    ...req.body,
    createdBy: req.user.username
  });
  await profile.save();
  res.status(201).json({ profile });
});

// PUT /api/depreciation-profiles/:id - Update profile
router.put('/:id', [auth, requireAdminOrWarehouse], async (req, res) => {
  const profile = await DepreciationProfile.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    { new: true }
  );
  res.json({ profile });
});

// DELETE /api/depreciation-profiles/:id - Soft delete profile
router.delete('/:id', [auth, requireAdminOrWarehouse], async (req, res) => {
  await DepreciationProfile.findByIdAndUpdate(
    req.params.id, 
    { isActive: false }
  );
  res.json({ message: 'Profile deactivated' });
});

// POST /api/depreciation-profiles/:id/assign - Assign profile to product types
router.post('/:id/assign', [auth, requireAdminOrWarehouse], async (req, res) => {
  const { productTypes } = req.body;
  const profile = await DepreciationProfile.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { applicableProductTypes: { $each: productTypes } } },
    { new: true }
  );
  res.json({ profile });
});

// POST /api/depreciation-profiles/test-formula - Test custom formula
router.post('/test-formula', [auth, requireAdminOrWarehouse], async (req, res) => {
  const { formula, testValues } = req.body;
  try {
    const result = FormulaCalculator.evaluate(formula, testValues);
    res.json({ result, isValid: true });
  } catch (error) {
    res.json({ error: error.message, isValid: false });
  }
});

module.exports = router;
```

### Inventory Stats Endpoint Update
**File:** `backend/src/routes/inventory.js` - `/stats` endpoint

Add depreciation calculations to aggregation pipeline:
```javascript
// Additional aggregation stage for current values
{
  $addFields: {
    ageInMonths: {
      $dateDiff: {
        startDate: '$createdAt',
        endDate: new Date(),
        unit: 'month'
      }
    },
    currentValue: {
      $switch: {
        branches: [
          {
            case: { $eq: ['$depreciationMethod', 'none'] },
            then: '$cost'
          },
          {
            case: { $eq: ['$depreciationMethod', 'straight-line'] },
            then: {
              // Straight-line depreciation formula
              $max: [
                '$salvageValue',
                {
                  $subtract: [
                    '$cost',
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: ['$cost', '$salvageValue'] },
                            '$usefulLifeMonths'
                          ]
                        },
                        '$ageInMonths'
                      ]
                    }
                  ]
                }
              ]
            }
          }
          // Add other depreciation methods as needed
        ],
        default: '$cost'
      }
    }
  }
}
```

Add new stats fields:
```javascript
res.json({
  // ... existing stats
  totalOriginalValue,
  totalCurrentValue,
  totalDepreciation: totalOriginalValue - totalCurrentValue,
  depreciationPercentage: ((totalOriginalValue - totalCurrentValue) / totalOriginalValue * 100)
});
```

## Frontend Type Updates

### TypeScript Interfaces
**File:** `frontend/src/types/index.ts`

Add new interfaces for depreciation management:
```typescript
export interface DepreciationProfile {
  _id: string
  name: string
  description?: string
  method: 'none' | 'straight-line' | 'declining-balance' | 'sum-of-years' | 'custom'
  usefulLifeMonths: number
  salvageValueType: 'percentage' | 'fixed-amount'
  salvageValue: number
  declineRate?: number
  customFormula?: string
  applicableProductTypes: string[]
  isDefault: boolean
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FormulaTestRequest {
  formula: string
  testValues: {
    cost: number
    age: number
    useful_life: number
    salvage_value: number
  }
}

export interface FormulaTestResponse {
  result?: number
  error?: string
  isValid: boolean
}

Update Item interface:
```typescript
export interface Item {
  // ... existing fields
  depreciationProfile?: string | DepreciationProfile
  overrides?: {
    usefulLifeMonths?: number
    salvageValue?: number
    customValues?: Record<string, any>
  }
  // Computed fields (returned by API)
  ageInMonths?: number
  currentValue?: number
}
```

Update InventoryStats interface:
```typescript
export interface InventoryStats {
  // ... existing fields
  totalOriginalValue?: number
  totalCurrentValue?: number
  totalDepreciation?: number
  depreciationPercentage?: number
}
```

### Formula Calculator Service
**File:** `backend/src/services/formulaCalculator.js` (NEW)

```javascript
class FormulaCalculator {
  static evaluate(formula, variables) {
    // Sanitize and evaluate custom depreciation formulas
    // Available variables: cost, age, useful_life, salvage_value
    const allowedVariables = ['cost', 'age', 'useful_life', 'salvage_value'];
    const safeFormula = this.sanitizeFormula(formula, allowedVariables);
    
    // Create safe evaluation context
    const context = {
      cost: variables.cost || 0,
      age: variables.age || 0,
      useful_life: variables.useful_life || 1,
      salvage_value: variables.salvage_value || 0,
      Math: Math, // Allow math functions
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      sqrt: Math.sqrt
    };
    
    // Use Function constructor for safe evaluation
    const func = new Function(...Object.keys(context), `return ${safeFormula}`);
    return func(...Object.values(context));
  }
  
  static sanitizeFormula(formula, allowedVars) {
    // Remove dangerous functions and validate formula
    const dangerous = ['eval', 'Function', 'require', 'process', 'global'];
    dangerous.forEach(word => {
      if (formula.includes(word)) {
        throw new Error(`Forbidden function: ${word}`);
      }
    });
    return formula;
  }
  
  static getFormulaExamples() {
    return {
      'Straight Line': 'cost - ((cost - salvage_value) * (age / useful_life))',
      'Declining Balance': 'cost * Math.pow((1 - 0.2), age)',
      'Accelerated': 'cost * Math.pow((1 - (age / useful_life)), 2)',
      'Custom Seasonal': 'cost * (1 - (age / useful_life) * (1 + 0.1 * Math.sin(age * Math.PI / 6)))'
    };
  }
}
module.exports = FormulaCalculator;
```

## Frontend UI Components

### Depreciation Management Page (NEW)
**File:** `frontend/src/views/DepreciationManagement.vue` (NEW)

Create a comprehensive depreciation management interface:
```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import DepreciationProfileForm from '@/components/DepreciationProfileForm.vue'
import DepreciationProfileList from '@/components/DepreciationProfileList.vue'
import DepreciationAssignments from '@/components/DepreciationAssignments.vue'
import FormulaBuilder from '@/components/FormulaBuilder.vue'

const authStore = useAuthStore()
const activeTab = ref('profiles')
const showCreateModal = ref(false)
const selectedProfile = ref(null)

// Profile management functions
const handleCreateProfile = () => {
  showCreateModal.value = true
}

const handleEditProfile = (profile) => {
  selectedProfile.value = profile
  showCreateModal.value = true
}
</script>

<template>
  <q-page class="depreciation-management-page">
    <div class="container q-pa-md">
      <!-- Page Header -->
      <div class="page-header glass-card q-pa-md q-mb-md">
        <div class="row items-center justify-between">
          <div class="col-auto">
            <h1 class="text-h4 text-dark q-mb-xs">
              <q-icon name="trending_down" class="q-mr-sm" />
              Depreciation Management
            </h1>
            <p class="text-body2 text-dark opacity-80">
              Create and manage depreciation profiles for accurate asset valuation
            </p>
          </div>
          <div class="col-auto">
            <q-btn
              @click="handleCreateProfile"
              color="positive"
              icon="add"
              label="Create Profile"
              no-caps
            />
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-section glass-card q-mb-lg">
        <q-tabs v-model="activeTab" class="custom-tabs">
          <q-tab name="profiles" label="Profiles" icon="description" />
          <q-tab name="assignments" label="Assignments" icon="assignment" />
          <q-tab name="formulas" label="Formula Builder" icon="functions" />
          <q-tab name="preview" label="Preview" icon="visibility" />
        </q-tabs>
      </div>

      <!-- Tab Panels -->
      <q-tab-panels v-model="activeTab" class="transparent">
        <!-- Profiles Tab -->
        <q-tab-panel name="profiles" class="q-pa-none">
          <DepreciationProfileList
            @edit="handleEditProfile"
            @delete="handleDeleteProfile"
          />
        </q-tab-panel>

        <!-- Assignments Tab -->
        <q-tab-panel name="assignments" class="q-pa-none">
          <DepreciationAssignments />
        </q-tab-panel>

        <!-- Formula Builder Tab -->
        <q-tab-panel name="formulas" class="q-pa-none">
          <FormulaBuilder />
        </q-tab-panel>

        <!-- Preview Tab -->
        <q-tab-panel name="preview" class="q-pa-none">
          <DepreciationPreview />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- Create/Edit Profile Modal -->
    <DepreciationProfileForm
      v-if="showCreateModal"
      :profile="selectedProfile"
      @close="showCreateModal = false; selectedProfile = null"
      @success="handleProfileSuccess"
    />
  </q-page>
</template>
```

### Depreciation Profile Form Component (NEW)
**File:** `frontend/src/components/DepreciationProfileForm.vue` (NEW)

```vue
<script setup lang="ts">
interface Props {
  profile?: DepreciationProfile | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [], success: [] }>()

const formData = ref({
  name: '',
  description: '',
  method: 'straight-line',
  usefulLifeMonths: 60,
  salvageValueType: 'percentage',
  salvageValue: 0,
  declineRate: 0.2,
  customFormula: '',
  applicableProductTypes: []
})

const formulaExamples = {
  'straight-line': 'cost - ((cost - salvage_value) * (age / useful_life))',
  'declining-balance': 'cost * Math.pow((1 - decline_rate), age)',
  'sum-of-years': 'cost * ((useful_life - age) / (useful_life * (useful_life + 1) / 2))',
  'custom': ''
}

const testFormulaValues = ref({
  cost: 1000,
  age: 12,
  useful_life: 60,
  salvage_value: 100
})

const testFormulaResult = ref(null)

const testFormula = async () => {
  // Test custom formula with sample values
  const response = await depreciationApi.testFormula({
    formula: formData.value.customFormula,
    testValues: testFormulaValues.value
  })
  testFormulaResult.value = response
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal-dialog large">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ profile ? 'Edit' : 'Create' }} Depreciation Profile</h3>
          <button class="close-button" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <!-- Basic Info -->
            <div class="form-section">
              <h4>Basic Information</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Profile Name *</label>
                  <input v-model="formData.name" type="text" required />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <input v-model="formData.description" type="text" />
                </div>
              </div>
            </div>

            <!-- Depreciation Method -->
            <div class="form-section">
              <h4>Depreciation Method</h4>
              <div class="method-selector">
                <div v-for="method in depreciationMethods" :key="method.value" 
                     class="method-option" 
                     :class="{ active: formData.method === method.value }"
                     @click="formData.method = method.value">
                  <div class="method-name">{{ method.label }}</div>
                  <div class="method-description">{{ method.description }}</div>
                </div>
              </div>
            </div>

            <!-- Method-Specific Settings -->
            <div class="form-section">
              <h4>Settings</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Useful Life (Months) *</label>
                  <input v-model.number="formData.usefulLifeMonths" type="number" min="1" required />
                </div>
                <div class="form-group">
                  <label>Salvage Value *</label>
                  <div class="input-group">
                    <select v-model="formData.salvageValueType">
                      <option value="percentage">Percentage</option>
                      <option value="fixed-amount">Fixed Amount</option>
                    </select>
                    <input v-model.number="formData.salvageValue" type="number" min="0" step="0.01" required />
                    <span class="input-suffix">{{ formData.salvageValueType === 'percentage' ? '%' : '$' }}</span>
                  </div>
                </div>
              </div>

              <!-- Declining Balance Rate -->
              <div v-if="formData.method === 'declining-balance'" class="form-group">
                <label>Decline Rate (0-1) *</label>
                <input v-model.number="formData.declineRate" type="number" min="0" max="1" step="0.01" required />
                <small class="form-text">0.2 = 20% per period</small>
              </div>

              <!-- Custom Formula -->
              <div v-if="formData.method === 'custom'" class="form-group">
                <label>Custom Formula *</label>
                <textarea v-model="formData.customFormula" rows="3" required 
                          placeholder="e.g., cost * (1 - (age / useful_life))"></textarea>
                <div class="formula-help">
                  <small>Available variables: cost, age, useful_life, salvage_value</small>
                  <div class="formula-test">
                    <div class="test-inputs">
                      <input v-model.number="testFormulaValues.cost" placeholder="Cost" type="number" />
                      <input v-model.number="testFormulaValues.age" placeholder="Age (months)" type="number" />
                      <button type="button" @click="testFormula">Test Formula</button>
                    </div>
                    <div v-if="testFormulaResult" class="test-result" 
                         :class="{ valid: testFormulaResult.isValid, invalid: !testFormulaResult.isValid }">
                      {{ testFormulaResult.isValid ? `Result: $${testFormulaResult.result}` : `Error: ${testFormulaResult.error}` }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Product Type Assignment -->
            <div class="form-section">
              <h4>Applicable Product Types</h4>
              <div class="product-type-grid">
                <label v-for="productType in PRODUCT_TYPES" :key="productType.value" class="product-type-checkbox">
                  <input type="checkbox" :value="productType.value" v-model="formData.applicableProductTypes" />
                  <span>{{ productType.label }}</span>
                </label>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
              <button type="submit" class="btn btn-primary">{{ profile ? 'Update' : 'Create' }} Profile</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
```

## Frontend UI Components

### InventoryTable Updates
**File:** `frontend/src/components/InventoryTable.vue`

Add new columns (role-based visibility):
- "Current Value" column showing depreciated value
- "Age" column showing item age in months
- "Depreciation" column showing amount/percentage depreciated

Add helper functions:
```javascript
const formatCurrentValue = (item: Item) => {
  if (!item.currentValue) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(item.currentValue)
}

const formatDepreciation = (item: Item) => {
  if (!item.cost || !item.currentValue) return '-'
  const depreciated = item.cost - item.currentValue
  const percentage = (depreciated / item.cost * 100).toFixed(1)
  return `${formatCurrency(depreciated)} (${percentage}%)`
}

const formatAge = (item: Item) => {
  if (!item.ageInMonths) return '-'
  const months = item.ageInMonths
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`
}
```

### Dashboard Enhancements
**File:** `frontend/src/views/Dashboard.vue`

Update Total Value card to show both values:
```javascript
// Replace single Total Value card with dual-value card
<q-card class="glass-card stat-card text-center depreciation-card">
  <q-card-section class="q-pa-md">
    <q-icon name="trending_down" class="text-h4 text-warning q-mb-xs" />
    <div class="row q-gutter-md">
      <div class="col">
        <div class="text-h5 text-dark text-weight-bold">
          {{ formatTotalValue(inventoryStore.stats.totalOriginalValue) }}
        </div>
        <div class="text-body2 text-dark opacity-80">Original Value</div>
      </div>
      <div class="col">
        <div class="text-h5 text-dark text-weight-bold text-positive">
          {{ formatTotalValue(inventoryStore.stats.totalCurrentValue) }}
        </div>
        <div class="text-body2 text-dark opacity-80">Current Value</div>
      </div>
    </div>
    <div class="text-caption text-dark opacity-60 q-mt-xs">
      {{ formatDepreciationSummary() }}
    </div>
  </q-card-section>
</q-card>
```

### Modal Updates for Depreciation Settings
**File:** `frontend/src/components/AddItemModal.vue` & `EditItemModal.vue`

Replace individual depreciation fields with profile selection:
```html
<!-- Depreciation Profile Selection (Advanced) -->
<div v-if="canEditCost" class="form-group">
  <q-expansion-item 
    label="Depreciation Settings" 
    icon="trending_down"
    header-class="text-primary"
  >
    <div class="q-pa-md bg-grey-1">
      <div class="form-group">
        <label>Depreciation Profile</label>
        <select v-model="formData.depreciationProfile">
          <option value="">Use default for {{ formData.product_type }}</option>
          <option v-for="profile in availableProfiles" :key="profile._id" :value="profile._id">
            {{ profile.name }} ({{ profile.method }})
          </option>
        </select>
        <small class="form-text">Choose a depreciation profile or use the default for this product type</small>
      </div>
      
      <!-- Override Settings (if profile selected) -->
      <div v-if="formData.depreciationProfile" class="override-section">
        <h5>Override Profile Settings (Optional)</h5>
        <div class="form-row">
          <div class="form-group">
            <label>Override Useful Life</label>
            <input v-model.number="formData.overrides.usefulLifeMonths" type="number" min="1" 
                   placeholder="Leave empty to use profile default" />
          </div>
          <div class="form-group">
            <label>Override Salvage Value</label>
            <input v-model.number="formData.overrides.salvageValue" type="number" min="0" step="0.01" 
                   placeholder="Leave empty to use profile default" />
          </div>
        </div>
      </div>
      
      <!-- Profile Info Display -->
      <div v-if="selectedProfileInfo" class="profile-info">
        <div class="info-header">Selected Profile: {{ selectedProfileInfo.name }}</div>
        <div class="info-details">
          <span>Method: {{ selectedProfileInfo.method }}</span>
          <span>Useful Life: {{ selectedProfileInfo.usefulLifeMonths }} months</span>
          <span>Salvage: {{ selectedProfileInfo.salvageValue }}{{ selectedProfileInfo.salvageValueType === 'percentage' ? '%' : '$' }}</span>
        </div>
      </div>
    </div>
  </q-expansion-item>
</div>
```

## New Components to Create

### Depreciation Profile List Component
**File:** `frontend/src/components/DepreciationProfileList.vue` (NEW)

Lists all depreciation profiles with actions:
- View/edit profile details
- Activate/deactivate profiles
- Assign to product types
- Clone existing profiles

### Depreciation Assignments Component  
**File:** `frontend/src/components/DepreciationAssignments.vue` (NEW)

Matrix view showing:
- Product types vs. assigned depreciation profiles
- Default profile indicators
- Bulk assignment tools
- Coverage report (which product types have profiles)

### Formula Builder Component
**File:** `frontend/src/components/FormulaBuilder.vue` (NEW)

Interactive formula creation:
- Drag-and-drop formula builder
- Real-time formula testing
- Formula templates/examples
- Variable documentation
- Visual formula validation

### Depreciation Preview Component
**File:** `frontend/src/components/DepreciationPreview.vue` (NEW)

Visual preview showing:
- Sample depreciation curves for each profile
- Comparison charts between methods
- Impact analysis on current inventory
- Value projections over time

### DepreciationReport Component
**File:** `frontend/src/components/DepreciationReport.vue` (NEW)

Create a detailed depreciation report showing:
- Monthly depreciation schedule
- Items losing value fastest
- Depreciation by product type
- Projected future values

### DepreciationChart Component  
**File:** `frontend/src/components/DepreciationChart.vue` (NEW)

Visual chart showing:
- Total inventory value over time
- Depreciation trends
- Value by product category

## Backend Services/Utilities

### Depreciation Calculator Service
**File:** `backend/src/services/depreciationCalculator.js` (NEW)

```javascript
class DepreciationCalculator {
  static calculateCurrentValue(item, currentDate = new Date()) {
    const ageInMonths = this.getAgeInMonths(item.createdAt, currentDate);
    
    switch (item.depreciationMethod) {
      case 'none':
        return item.cost;
      case 'straight-line':
        return this.straightLineDepreciation(item.cost, item.salvageValue, item.usefulLifeMonths, ageInMonths);
      case 'accelerated':
        return this.acceleratedDepreciation(item.cost, item.salvageValue, item.usefulLifeMonths, ageInMonths);
      case 'seasonal':
        return this.seasonalDepreciation(item.cost, item.salvageValue, item.createdAt, currentDate);
      default:
        return item.cost;
    }
  }
  
  static straightLineDepreciation(cost, salvageValue, usefulLife, currentAge) {
    if (currentAge >= usefulLife) return salvageValue;
    const monthlyDepreciation = (cost - salvageValue) / usefulLife;
    return Math.max(salvageValue, cost - (monthlyDepreciation * currentAge));
  }
  
  // ... other depreciation methods
}
```

## Migration Strategy

### Database Migration
**File:** `backend/migrations/addDepreciationFields.js` (NEW)

```javascript
// Add depreciation fields to existing items with product-type defaults
db.items.updateMany(
  { product_type: 'wall' },
  { 
    $set: { 
      depreciationMethod: 'none',
      usefulLifeMonths: 120,
      salvageValue: 0
    }
  }
);
// ... repeat for each product type
```

## Testing Requirements

### Unit Tests
- Depreciation calculation accuracy
- Edge cases (negative values, zero costs, etc.)
- Different depreciation methods

### Integration Tests  
- API endpoints return correct depreciation data
- Role-based access to depreciation features
- Database migrations work correctly

## UI/UX Considerations

### Role-Based Display
- Admin/Warehouse Manager: Full depreciation visibility
- Sales Rep: No depreciation data shown
- Maybe add "Show Depreciation" toggle for advanced users

### Performance
- Consider caching depreciation calculations for large inventories
- Maybe compute values on-demand vs. storing calculated fields

### User Experience
- Clear explanations of depreciation methods
- Tooltips explaining salvage values and useful life
- Color coding for items losing value rapidly

### Navigation Updates
**File:** `frontend/src/App.vue` or router

Add Depreciation Management to navigation (admin/warehouse only):
```javascript
const navTabs = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/inventory", label: "Inventory", icon: "inventory_2" },
  { path: "/tags", label: "Tags", icon: "local_offer" },
  { 
    path: "/depreciation", 
    label: "Depreciation", 
    icon: "trending_down",
    requiresRole: ['admin', 'warehouse_manager']
  },
];
```

## Frontend API Integration

### Depreciation API Service
**File:** `frontend/src/utils/api.ts`

Add depreciation profile API methods:
```typescript
export const depreciationApi = {
  getProfiles: async (): Promise<{ profiles: DepreciationProfile[] }> => {
    const response = await api.get('/depreciation-profiles')
    return response.data
  },
  
  createProfile: async (profile: Partial<DepreciationProfile>): Promise<{ profile: DepreciationProfile }> => {
    const response = await api.post('/depreciation-profiles', profile)
    return response.data
  },
  
  updateProfile: async (id: string, updates: Partial<DepreciationProfile>): Promise<{ profile: DepreciationProfile }> => {
    const response = await api.put(`/depreciation-profiles/${id}`, updates)
    return response.data
  },
  
  deleteProfile: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/depreciation-profiles/${id}`)
    return response.data
  },
  
  assignProfile: async (id: string, productTypes: string[]): Promise<{ profile: DepreciationProfile }> => {
    const response = await api.post(`/depreciation-profiles/${id}/assign`, { productTypes })
    return response.data
  },
  
  testFormula: async (request: FormulaTestRequest): Promise<FormulaTestResponse> => {
    const response = await api.post('/depreciation-profiles/test-formula', request)
    return response.data
  }
}
```

## Implementation Priority

1. **Phase 1**: Backend depreciation profile model and CRUD APIs
2. **Phase 2**: Depreciation Management page with profile creation/editing
3. **Phase 3**: Formula builder and testing functionality
4. **Phase 4**: Profile assignment to product types and item overrides
5. **Phase 5**: Integration with inventory table and dashboard
6. **Phase 6**: Advanced reporting and analytics components

## Business Rules to Clarify

- Should items start depreciating immediately upon creation or upon first use?
- Different depreciation rules for damaged/returned items?
- Tax depreciation vs. book depreciation - which one or both?
- Seasonal adjustments for certain product types?

---

This TODO provides a complete roadmap for implementing a sophisticated depreciation system while maintaining the existing architecture and role-based security model. The system would provide significant business value for accurate inventory valuation and financial reporting.
