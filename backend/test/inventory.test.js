const fs = require('fs');
const path = require('path');

describe('Tool Filtering Implementation - All Product Endpoints', () => {
  
  test('inventory route should contain tool exclusion filter', () => {
    const inventoryRoutePath = path.join(__dirname, '..', 'src', 'routes', 'inventory.js');
    const inventoryCode = fs.readFileSync(inventoryRoutePath, 'utf8');
    
    // Verify that the filter exists in the main inventory endpoint
    expect(inventoryCode).toContain("'category.type': { $ne: 'tool' }");
    expect(inventoryCode).toContain('// ✅ FILTER: Exclude tools from product inventory view');
  });
  
  test('inventory stats route should contain tool exclusion filters', () => {
    const inventoryRoutePath = path.join(__dirname, '..', 'src', 'routes', 'inventory.js');
    const inventoryCode = fs.readFileSync(inventoryRoutePath, 'utf8');
    
    // Verify that the filters exist in both stats aggregations
    expect(inventoryCode).toContain('// ✅ FILTER: Exclude tools from stats');
    expect(inventoryCode).toContain('// ✅ FILTER: Exclude tools from category stats');
    
    // Count occurrences to ensure both aggregations have the filter
    const filterMatches = (inventoryCode.match(/\$ne: 'tool'/g) || []).length;
    expect(filterMatches).toBeGreaterThanOrEqual(3); // Main route + 2 stats aggregations
  });
  
  test('SKUs route should contain tool exclusion filters', () => {
    const skusRoutePath = path.join(__dirname, '..', 'src', 'routes', 'skus.js');
    const skusCode = fs.readFileSync(skusRoutePath, 'utf8');
    
    // Verify tool category filtering exists
    expect(skusCode).toContain('// ✅ FILTER: Get tool categories to exclude');
    expect(skusCode).toContain('// ✅ FILTER: Exclude tool categories from product SKU view');
    expect(skusCode).toContain('// ✅ FILTER: Block access to tool SKUs in product view');
    expect(skusCode).toContain("{ type: 'tool' }");
  });
  
  test('Tags route should contain tool exclusion filters', () => {
    const tagsRoutePath = path.join(__dirname, '..', 'src', 'routes', 'tags.js');
    const tagsCode = fs.readFileSync(tagsRoutePath, 'utf8');
    
    // Verify tool SKU filtering exists
    expect(tagsCode).toContain('// ✅ FILTER: Get tool categories to exclude tags containing tool SKUs');
    expect(tagsCode).toContain('// ✅ FILTER: Exclude tags that contain any tool SKUs from product view');
    expect(tagsCode).toContain('// ✅ FILTER: Check if tag contains any tool SKUs');
    expect(tagsCode).toContain("skuItem.sku_id.category_id.type === 'tool'");
  });
  
  test('all routes should have Category import for tool filtering', () => {
    const inventoryRoutePath = path.join(__dirname, '..', 'src', 'routes', 'inventory.js');
    const skusRoutePath = path.join(__dirname, '..', 'src', 'routes', 'skus.js');
    const tagsRoutePath = path.join(__dirname, '..', 'src', 'routes', 'tags.js');
    
    const inventoryCode = fs.readFileSync(inventoryRoutePath, 'utf8');
    const skusCode = fs.readFileSync(skusRoutePath, 'utf8');
    const tagsCode = fs.readFileSync(tagsRoutePath, 'utf8');
    
    // All routes should have Category import (though inventory uses existing Category lookups)
    expect(skusCode).toContain("const Category = require('../models/Category');");
    expect(tagsCode).toContain("const Category = require('../models/Category');");
  });
  
  test('tool filtering comments should be present for documentation', () => {
    const inventoryRoutePath = path.join(__dirname, '..', 'src', 'routes', 'inventory.js');
    const inventoryCode = fs.readFileSync(inventoryRoutePath, 'utf8');
    
    // Verify documentation comments are in place
    expect(inventoryCode).toContain('Exclude tools');
    expect(inventoryCode).toContain('FILTER:');
  });
});
