const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const Category = require('../src/models/Category');
const SKU = require('../src/models/SKU');
const Tag = require('../src/models/Tag');
const Inventory = require('../src/models/Inventory');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');

describe('Tool Filtering Integration Tests', () => {
  let authToken;
  let toolCategory;
  let productCategory;
  let toolSKU;
  let productSKU;
  let tagWithTool;
  let tagWithProduct;
  let testUser;

  beforeAll(async () => {
    // Create test user (let User model handle password hashing)
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      isActive: true
    });
    await testUser.save();

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.accessToken;
  });

  beforeEach(async () => {
    // Clear existing data
    await Category.deleteMany({});
    await SKU.deleteMany({});
    await Tag.deleteMany({});
    await Inventory.deleteMany({});

    // Create test categories
    toolCategory = new Category({
      name: 'Test Tools',
      slug: 'test-tools',
      type: 'tool',
      description: 'Test tool category'
    });
    await toolCategory.save();

    productCategory = new Category({
      name: 'Test Products',
      slug: 'test-products', 
      type: 'product',
      description: 'Test product category'
    });
    await productCategory.save();

    // Create test SKUs
    toolSKU = new SKU({
      sku_code: 'TOOL-001',
      name: 'Test Tool',
      description: 'A test tool',
      category_id: toolCategory._id,
      unit_cost: 100,
      created_by: 'testuser',
      last_updated_by: 'testuser'
    });
    await toolSKU.save();

    productSKU = new SKU({
      sku_code: 'PROD-001', 
      name: 'Test Product',
      description: 'A test product',
      category_id: productCategory._id,
      unit_cost: 50,
      created_by: 'testuser',
      last_updated_by: 'testuser'
    });
    await productSKU.save();

    // Create inventory records
    const toolInventory = new Inventory({
      sku_id: toolSKU._id,
      total_quantity: 10,
      available_quantity: 8,
      reserved_quantity: 2,
      primary_location: 'Tool Room'
    });
    await toolInventory.save();

    const productInventory = new Inventory({
      sku_id: productSKU._id,
      total_quantity: 20,
      available_quantity: 15,
      reserved_quantity: 5,
      primary_location: 'Warehouse A'
    });
    await productInventory.save();

    // Create test tags
    tagWithTool = new Tag({
      customer_name: 'Test Customer Tool',
      tag_type: 'reserved',
      project_name: 'Tool Project',
      sku_items: [{
        sku_id: toolSKU._id,
        quantity: 2,
        notes: 'Tool tag item'
      }],
      status: 'active',
      created_by: 'testuser',
      last_updated_by: 'testuser'
    });
    await tagWithTool.save();

    tagWithProduct = new Tag({
      customer_name: 'Test Customer Product',
      tag_type: 'reserved',
      project_name: 'Product Project',
      sku_items: [{
        sku_id: productSKU._id,
        quantity: 3,
        notes: 'Product tag item'
      }],
      status: 'active',
      created_by: 'testuser',
      last_updated_by: 'testuser'
    });
    await tagWithProduct.save();
  });

  describe('SKUs Endpoint Filtering', () => {
    test('GET /api/skus should exclude tool SKUs', async () => {
      const response = await request(app)
        .get('/api/skus')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.skus).toHaveLength(1);
      expect(response.body.skus[0].sku_code).toBe('PROD-001');
      expect(response.body.skus[0].name).toBe('Test Product');
      
      // Verify tool SKU is not included
      const toolSKUExists = response.body.skus.some(sku => sku.sku_code === 'TOOL-001');
      expect(toolSKUExists).toBe(false);
    });

    test('GET /api/skus/:id should return 404 for tool SKUs', async () => {
      const response = await request(app)
        .get(`/api/skus/${toolSKU._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toBe('SKU not found');
    });

    test('GET /api/skus/:id should return product SKUs normally', async () => {
      const response = await request(app)
        .get(`/api/skus/${productSKU._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.sku.sku_code).toBe('PROD-001');
      expect(response.body.sku.name).toBe('Test Product');
    });

    test('GET /api/skus?category_id=toolCategoryId should return empty results', async () => {
      const response = await request(app)
        .get(`/api/skus?category_id=${toolCategory._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.skus).toHaveLength(0);
      expect(response.body.pagination.totalSkus).toBe(0);
    });

    test('GET /api/skus?category_id=productCategoryId should return product SKUs', async () => {
      const response = await request(app)
        .get(`/api/skus?category_id=${productCategory._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.skus).toHaveLength(1);
      expect(response.body.skus[0].sku_code).toBe('PROD-001');
    });
  });

  describe('Tags Endpoint Filtering', () => {
    test('GET /api/tags should exclude tags containing tool SKUs', async () => {
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tags).toHaveLength(1);
      expect(response.body.tags[0].customer_name).toBe('Test Customer Product');
      expect(response.body.tags[0].project_name).toBe('Product Project');
      
      // Verify tag with tool is not included
      const toolTagExists = response.body.tags.some(tag => tag.customer_name === 'Test Customer Tool');
      expect(toolTagExists).toBe(false);
    });

    test('GET /api/tags/:id should return 404 for tags containing tool SKUs', async () => {
      const response = await request(app)
        .get(`/api/tags/${tagWithTool._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toBe('Tag not found');
    });

    test('GET /api/tags/:id should return tags with product SKUs normally', async () => {
      const response = await request(app)
        .get(`/api/tags/${tagWithProduct._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tag.customer_name).toBe('Test Customer Product');
      expect(response.body.tag.project_name).toBe('Product Project');
    });

    test('GET /api/tags?include_items=true should populate SKU details correctly for product tags', async () => {
      const response = await request(app)
        .get('/api/tags?include_items=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tags).toHaveLength(1);
      const tag = response.body.tags[0];
      expect(tag.sku_items).toHaveLength(1);
      expect(tag.sku_items[0].sku_id.sku_code).toBe('PROD-001');
      expect(tag.sku_items[0].sku_id.category_id.type).toBe('product');
    });
  });

  describe('Inventory Endpoint Filtering', () => {
    test('GET /api/inventory should exclude tool inventory', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.inventory).toHaveLength(1);
      expect(response.body.inventory[0].sku.sku_code).toBe('PROD-001');
      expect(response.body.inventory[0].sku.name).toBe('Test Product');
      
      // Verify tool inventory is not included
      const toolInventoryExists = response.body.inventory.some(inv => inv.sku.sku_code === 'TOOL-001');
      expect(toolInventoryExists).toBe(false);
    });

    test('GET /api/inventory/stats should exclude tools from statistics', async () => {
      const response = await request(app)
        .get('/api/inventory/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should have stats summary structure
      expect(response.body.summary).toBeDefined();
      
      // Category breakdown should only include product category (tools excluded)
      expect(response.body.by_category).toBeDefined();
      expect(Array.isArray(response.body.by_category)).toBe(true);
      
      // If there are categories returned, none should be tool categories
      if (response.body.by_category.length > 0) {
        const toolCategoryInStats = response.body.by_category.some(cat => 
          cat._id && cat._id.name === 'Test Tools'
        );
        expect(toolCategoryInStats).toBe(false);
      }
    });
  });

  describe('Mixed SKU Tags', () => {
    beforeEach(async () => {
      // Create a tag with both tool and product SKUs
      const mixedTag = new Tag({
        customer_name: 'Mixed Customer',
        tag_type: 'reserved',
        project_name: 'Mixed Project',
        sku_items: [
          {
            sku_id: toolSKU._id,
            quantity: 1,
            notes: 'Tool item'
          },
          {
            sku_id: productSKU._id,
            quantity: 2,
            notes: 'Product item'
          }
        ],
        status: 'active',
        created_by: 'testuser',
        last_updated_by: 'testuser'
      });
      await mixedTag.save();
    });

    test('Tags containing any tool SKUs should be excluded', async () => {
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only return the pure product tag, not the mixed tag
      expect(response.body.tags).toHaveLength(1);
      expect(response.body.tags[0].customer_name).toBe('Test Customer Product');
      
      // Mixed tag should be excluded
      const mixedTagExists = response.body.tags.some(tag => tag.customer_name === 'Mixed Customer');
      expect(mixedTagExists).toBe(false);
    });
  });

  describe('Search and Filter Combinations', () => {
    test('SKU search should only search within filtered (non-tool) results', async () => {
      const response = await request(app)
        .get('/api/skus?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only find the product SKU, not the tool SKU
      expect(response.body.skus).toHaveLength(1);
      expect(response.body.skus[0].sku_code).toBe('PROD-001');
    });

    test('Tag search should only search within filtered (non-tool) results', async () => {
      const response = await request(app)
        .get('/api/tags?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only find the product tag, not the tool tag
      expect(response.body.tags).toHaveLength(1);
      expect(response.body.tags[0].customer_name).toBe('Test Customer Product');
    });

    test('Inventory search should only search within filtered (non-tool) results', async () => {
      const response = await request(app)
        .get('/api/inventory?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only find the product inventory, not the tool inventory  
      expect(response.body.inventory).toHaveLength(1);
      expect(response.body.inventory[0].sku.sku_code).toBe('PROD-001');
    });
  });

  afterAll(async () => {
    // Clean up test user
    await User.deleteMany({});
  });
});
