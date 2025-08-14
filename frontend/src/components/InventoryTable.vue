<script setup lang="ts">
import type { Item, WallDetails, ProductDetails } from '@/types'

interface Props {
  items: Item[]
  canWrite: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [item: Item]
  delete: [item: Item]
}>()

const formatProductDetails = (item: Item) => {
  const details = item.product_details

  if (item.product_type === 'wall') {
    const wall = details as WallDetails
    return {
      primary: `${wall.product_line} - ${wall.color_name}`,
      secondary: `${wall.dimensions} | ${wall.finish}`
    }
  } else {
    const product = details as ProductDetails
    let primary = product.name || 'Unnamed Product'
    if (product.brand) primary = `${product.brand} ${primary}`
    if (product.model) primary = `${primary} (${product.model})`

    let secondary = []
    if (product.color) secondary.push(product.color)
    if (product.dimensions) secondary.push(product.dimensions)
    if (product.finish) secondary.push(product.finish)

    return {
      primary,
      secondary: secondary.join(' | ') || product.description || ''
    }
  }
}

const getStockStatus = (quantity: number) => {
  if (quantity === 0) return { class: 'out-of-stock', text: 'Out of Stock' }
  if (quantity <= 5) return { class: 'low-stock', text: 'Low Stock' }
  return { class: 'in-stock', text: 'In Stock' }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <div class="inventory-table-container">
    <div v-if="items.length === 0" class="no-items">
      <p>No items found matching your criteria.</p>
    </div>
    
    <div v-else class="table-responsive">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Product Type</th>
            <th>Details</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Location</th>
            <th>Last Updated</th>
            <th v-if="canWrite" class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id" class="item-row">
            <td class="product-type">
              <span class="type-badge" :class="`type-${item.product_type}`">
                {{ item.product_type.replace('_', ' ') }}
              </span>
            </td>
            
            <td class="product-details">
              <div class="detail-primary">{{ formatProductDetails(item).primary }}</div>
              <div v-if="formatProductDetails(item).secondary" class="detail-secondary">
                {{ formatProductDetails(item).secondary }}
              </div>
              <div v-if="item.notes" class="detail-notes">
                <small>{{ item.notes }}</small>
              </div>
            </td>
            
            <td class="quantity">
              <span class="quantity-value">{{ item.quantity }}</span>
            </td>
            
            <td class="status">
              <span class="status-badge" :class="getStockStatus(item.quantity).class">
                {{ getStockStatus(item.quantity).text }}
              </span>
            </td>
            
            <td class="location">
              {{ item.location || '-' }}
            </td>
            
            <td class="updated-date">
              {{ formatDate(item.updatedAt) }}
            </td>
            
            <td v-if="canWrite" class="actions">
              <div class="action-buttons">
                <button
                  class="btn btn-sm btn-primary"
                  @click="emit('edit', item)"
                  title="Edit item"
                >
                  Edit
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  @click="emit('delete', item)"
                  title="Delete item"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.inventory-table-container {
  background: white;
  border-radius: 0 0 0.5rem 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.no-items {
  padding: 3rem;
  text-align: center;
  color: #6c757d;
}

.table-responsive {
  overflow-x: auto;
}

.inventory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.inventory-table thead {
  background-color: #f8f9fa;
}

.inventory-table th,
.inventory-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.inventory-table th {
  font-weight: 600;
  color: #495057;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
}

.item-row:hover {
  background-color: #f8f9fa;
}

.product-type {
  white-space: nowrap;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
  color: white;
}

.type-wall { background-color: #007bff; }
.type-toilet { background-color: #28a745; }
.type-base { background-color: #ffc107; color: #212529; }
.type-tub { background-color: #17a2b8; }
.type-vanity { background-color: #6f42c1; }
.type-shower_door { background-color: #fd7e14; }
.type-raw_material { background-color: #795548; }
.type-accessory { background-color: #e91e63; }
.type-miscellaneous { background-color: #9e9e9e; }

.product-details {
  min-width: 300px;
}

.detail-primary {
  font-weight: 600;
  color: #212529;
  margin-bottom: 0.25rem;
}

.detail-secondary {
  color: #6c757d;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.detail-notes {
  color: #6c757d;
  font-style: italic;
}

.quantity {
  text-align: center;
  font-weight: 600;
  font-size: 1.1rem;
}

.quantity-value {
  display: inline-block;
  min-width: 2rem;
  padding: 0.25rem 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}

.status {
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.in-stock {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.low-stock {
  background-color: #fff3cd;
  color: #856404;
}

.status-badge.out-of-stock {
  background-color: #f8d7da;
  color: #721c24;
}

.location {
  color: #6c757d;
}

.updated-date {
  color: #6c757d;
  font-size: 0.85rem;
  white-space: nowrap;
}

.actions-column {
  width: 120px;
}

.actions {
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .inventory-table th,
  .inventory-table td {
    padding: 0.5rem;
  }
  
  .product-details {
    min-width: 200px;
  }
  
  .detail-primary {
    font-size: 0.9rem;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
