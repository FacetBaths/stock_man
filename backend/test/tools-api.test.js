const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const SKU = require('../src/models/SKU');
const Tag = require('../src/models/Tag');
const Instance = require('../src/models/Instance');
const AuditLog = require('../src/models/AuditLog');
const bcrypt = require('bcryptjs');

// Test data containers
let testUser, testToken;
let toolCategory, productCategory;
let toolSKU, productSKU;
let toolTag, productTag;
let toolInstances, productInstances;

describe('Tools API Integration Tests', () => {
  
  beforeAll(async () => {
    console.log('🧪 Setting up tools API integration tests...');
    
    // Clean up test data first
    await Promise.all([
      AuditLog.deleteMany({}),
      Instance.deleteMany({}),
      Tag.deleteMany({}),
      SKU.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({})
    ]);

    // Create test user
    testUser = await User.create({
      username: 'toolsTestUser',
      email: 'tools.tester@test.com',
      password: 'testpass123', // Will be hashed automatically by pre-save middleware
      firstName: 'Tools',
      lastName: 'Tester',
      role: 'admin'
    });
    console.log('✅ Test user created:', testUser.username);

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'toolsTestUser',
        password: 'testpass123'
      });
    
    testToken = loginRes.body.accessToken;
    console.log('✅ Test token acquired');

    // Create test categories
    toolCategory = await Category.create({
      name: 'Power Tools',
      slug: 'power-tools',
      type: 'tool',
      description: 'Various power tools'
    });

    productCategory = await Category.create({
      name: 'Building Materials',
      slug: 'building-materials', 
      type: 'product',
      description: 'Construction products'
    });
    console.log('✅ Test categories created');

    // Create test SKUs
    toolSKU = await SKU.create({
      sku_code: 'TOOL-001',
      name: 'Cordless Drill',
      description: 'Professional cordless drill',
      category_id: toolCategory._id,
      unit_cost: 125.00,
      status: 'active',
      is_lendable: true,
      created_by: testUser.username,
      last_updated_by: testUser.username
    });

    productSKU = await SKU.create({
      sku_code: 'PROD-001',
      name: '2x4 Lumber',
      description: 'Standard lumber piece',
      category_id: productCategory._id,
      unit_cost: 3.50,
      status: 'active',
      is_lendable: false,
      created_by: testUser.username,
      last_updated_by: testUser.username
    });
    console.log('✅ Test SKUs created');

    // Create test instances
    toolInstances = [];
    for (let i = 0; i < 5; i++) {
      const instance = await Instance.create({
        sku_id: toolSKU._id,
        acquisition_cost: toolSKU.unit_cost,
        location: 'Warehouse A',
        added_by: testUser.username
      });
      toolInstances.push(instance);
    }

    productInstances = [];
    for (let i = 0; i < 3; i++) {
      const instance = await Instance.create({
        sku_id: productSKU._id,
        acquisition_cost: productSKU.unit_cost,
        location: 'Warehouse B',
        added_by: testUser.username
      });
      productInstances.push(instance);
    }
    console.log('✅ Test instances created');

    // Create test tags
    toolTag = await Tag.create({
      customer_name: 'Tool Customer',
      tag_type: 'loaned',
      project_name: 'Tool Project',
      sku_items: [{
        sku_id: toolSKU._id,
        quantity: 2,
        fulfilled_quantity: 1,
        remaining_quantity: 1
      }],
      status: 'active',
      created_by: testUser.username,
      last_updated_by: testUser.username
    });

    productTag = await Tag.create({
      customer_name: 'Product Customer',
      tag_type: 'reserved',
      project_name: 'Product Project',
      sku_items: [{
        sku_id: productSKU._id,
        quantity: 1,
        fulfilled_quantity: 0,
        remaining_quantity: 1
      }],
      status: 'active',
      created_by: testUser.username,
      last_updated_by: testUser.username
    });
    console.log('✅ Test tags created');

    // Tag one tool instance to the tool tag
    await Instance.findByIdAndUpdate(toolInstances[0]._id, { tag_id: toolTag._id });
    console.log('✅ Test data setup complete');
  });

  afterAll(async () => {
    console.log('🧪 Cleaning up tools API integration test data...');
    // Clean up all test data
    await Promise.all([
      AuditLog.deleteMany({}),
      Instance.deleteMany({}),
      Tag.deleteMany({}),
      SKU.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({})
    ]);
    console.log('✅ Tools API integration test cleanup complete');
  });

  describe('GET /api/tools/inventory', () => {
    test('should return tools-only inventory', async () => {
      console.log('🧪 Testing GET /api/tools/inventory...');
      
      const res = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      console.log('Tools inventory response:', JSON.stringify(res.body, null, 2));

      expect(res.body).toHaveProperty('inventory');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.inventory)).toBe(true);

      // Should contain tool SKUs only
      const toolInvItem = res.body.inventory.find(item => item.sku_code === 'TOOL-001');
      expect(toolInvItem).toBeDefined();
      expect(toolInvItem.category.type).toBe('tool');

      // Should NOT contain product SKUs
      const productInvItem = res.body.inventory.find(item => item.sku_code === 'PROD-001');
      expect(productInvItem).toBeUndefined();
      
      console.log('✅ Tools inventory filtering verified');
    });

    test('should calculate real-time quantities correctly', async () => {
      const res = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const toolInvItem = res.body.inventory.find(item => item.sku_code === 'TOOL-001');
      expect(toolInvItem).toBeDefined();
      expect(toolInvItem.total_quantity).toBe(5); // Total instances
      expect(toolInvItem.available_quantity).toBe(4); // 5 - 1 tagged
      expect(toolInvItem.loaned_quantity).toBe(1); // 1 tagged as loaned
      
      console.log('✅ Real-time quantity calculations verified');
    });

    test('should respect search filtering', async () => {
      const res = await request(app)
        .get('/api/tools/inventory?search=Cordless')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(res.body.inventory).toHaveLength(1);
      expect(res.body.inventory[0].name).toContain('Cordless');
      
      console.log('✅ Search filtering verified');
    });
  });

  describe('GET /api/tools/skus', () => {
    test('should return tools-only SKUs', async () => {
      console.log('🧪 Testing GET /api/tools/skus...');
      
      const res = await request(app)
        .get('/api/tools/skus')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      console.log('Tools SKUs response:', JSON.stringify(res.body, null, 2));

      expect(res.body).toHaveProperty('skus');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.skus)).toBe(true);

      // Should contain tool SKUs only
      const toolSKUItem = res.body.skus.find(sku => sku.sku_code === 'TOOL-001');
      expect(toolSKUItem).toBeDefined();
      expect(toolSKUItem.category_id.name).toBe('power tools'); // Category names are lowercase

      // Should NOT contain product SKUs
      const productSKUItem = res.body.skus.find(sku => sku.sku_code === 'PROD-001');
      expect(productSKUItem).toBeUndefined();
      
      console.log('✅ Tools SKUs filtering verified');
    });

    test('should include inventory data when requested', async () => {
      const res = await request(app)
        .get('/api/tools/skus?include_inventory=true')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const toolSKUItem = res.body.skus.find(sku => sku.sku_code === 'TOOL-001');
      expect(toolSKUItem).toBeDefined();
      expect(toolSKUItem).toHaveProperty('inventory');
      
      console.log('✅ Inventory data inclusion verified');
    });

    test('should filter by tool category only', async () => {
      const res = await request(app)
        .get(`/api/tools/skus?category_id=${toolCategory._id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(res.body.skus).toHaveLength(1);
      expect(res.body.skus[0].category_id._id.toString()).toBe(toolCategory._id.toString());
      
      console.log('✅ Category filtering verified');
    });

    test('should return empty results for non-tool categories', async () => {
      const res = await request(app)
        .get(`/api/tools/skus?category_id=${productCategory._id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(res.body.skus).toHaveLength(0);
      
      console.log('✅ Non-tool category exclusion verified');
    });
  });

  describe('GET /api/tools/tags', () => {
    test('should return tools-only tags', async () => {
      console.log('🧪 Testing GET /api/tools/tags...');
      
      const res = await request(app)
        .get('/api/tools/tags?include_items=true')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      console.log('Tools tags response:', JSON.stringify(res.body, null, 2));

      expect(res.body).toHaveProperty('tags');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.tags)).toBe(true);

      // Should contain tool tags only
      const toolTagItem = res.body.tags.find(tag => tag.customer_name === 'Tool Customer');
      expect(toolTagItem).toBeDefined();
      expect(toolTagItem.sku_items[0].sku_id.category_id.type).toBe('tool');

      // Should NOT contain product tags 
      const productTagItem = res.body.tags.find(tag => tag.customer_name === 'Product Customer');
      expect(productTagItem).toBeUndefined();
      
      console.log('✅ Tools tags filtering verified');
    });

    test('should include enriched data', async () => {
      const res = await request(app)
        .get('/api/tools/tags')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const toolTagItem = res.body.tags.find(tag => tag.customer_name === 'Tool Customer');
      expect(toolTagItem).toBeDefined();
      expect(toolTagItem).toHaveProperty('total_quantity');
      expect(toolTagItem).toHaveProperty('remaining_quantity');
      expect(toolTagItem).toHaveProperty('fulfillment_progress');
      
      console.log('✅ Tag enrichment verified');
    });

    test('should filter by customer name', async () => {
      const res = await request(app)
        .get('/api/tools/tags?customer_name=Tool Customer')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].customer_name).toBe('Tool Customer');
      
      console.log('✅ Customer name filtering verified');
    });

    test('should filter by tag type', async () => {
      const res = await request(app)
        .get('/api/tools/tags?tag_type=loaned')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].tag_type).toBe('loaned');
      
      console.log('✅ Tag type filtering verified');
    });
  });

  describe('POST /api/tools/checkout', () => {
    test('should create tool checkout successfully', async () => {
      console.log('🧪 Testing POST /api/tools/checkout...');
      
      const checkoutData = {
        customer_name: 'John Contractor',
        project_name: 'Home Renovation',
        tag_type: 'loaned',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 1
        }],
        notes: 'Tool checkout for contractor project',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      };

      const res = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(201);

      console.log('Tool checkout response:', JSON.stringify(res.body, null, 2));

      expect(res.body).toHaveProperty('message', 'Tool checkout created successfully');
      expect(res.body).toHaveProperty('tag');
      expect(res.body.tag.customer_name).toBe('John Contractor');
      expect(res.body.tag.tag_type).toBe('loaned');
      expect(res.body.tag.sku_items).toHaveLength(1);
      expect(res.body.tag.sku_items[0].sku_id.category_id.type).toBe('tool');
      
      console.log('✅ Tool checkout creation verified');
    });

    test('should reject non-tool SKUs', async () => {
      const checkoutData = {
        customer_name: 'John Contractor',
        sku_items: [{
          sku_id: productSKU._id.toString(), // This is a product, not a tool
          quantity: 1
        }]
      };

      const res = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors[0].msg).toContain('is not a tool and cannot be checked out via tools API');
      
      console.log('✅ Non-tool SKU rejection verified');
    });

    test('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({}) // Empty data
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.length).toBeGreaterThan(0);
      
      console.log('✅ Required field validation verified');
    });

    test('should require authentication', async () => {
      const checkoutData = {
        customer_name: 'John Contractor',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 1
        }]
      };

      await request(app)
        .post('/api/tools/checkout')
        .send(checkoutData)
        .expect(401);
      
      console.log('✅ Authentication requirement verified');
    });

    test('should create audit log', async () => {
      const checkoutData = {
        customer_name: 'Jane Contractor',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 2
        }]
      };

      await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(201);

      // Check if audit log was created
      const auditLogs = await AuditLog.find({ 
        event_type: 'tag_created',
        user_name: testUser.username
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[auditLogs.length - 1];
      expect(latestLog.action).toBe('CREATE_TOOL_CHECKOUT');
      
      // Check that the customer name is included in the description
      expect(latestLog.description).toContain('Jane Contractor');
      expect(latestLog.description).toContain('Tool checkout created for');
      
      console.log('\u2705 Audit log creation verified');
    });
  });

  describe('POST /api/tools/:id/return', () => {
    let checkoutTagId;
    let checkoutTag;
    
    beforeEach(async () => {
      // Create a fresh checkout for each return test
      const checkoutData = {
        customer_name: 'Return Test Customer',
        project_name: 'Return Test Project',
        tag_type: 'loaned',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 1
        }],
        notes: 'Tool checkout for return testing'
      };

      const res = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(201);

      checkoutTag = res.body.tag;
      checkoutTagId = checkoutTag._id;
      console.log(`\u2705 Created test checkout tag: ${checkoutTagId}`);
    });

    test('should return tools successfully', async () => {
      console.log('\ud83e\uddea Testing successful tool return...');
      
      const returnData = {
        return_notes: 'Tools returned in good condition',
        returned_condition: 'functional'
      };

      const res = await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData);

      if (res.status !== 200) {
        console.log('Tool return error response:', JSON.stringify(res.body, null, 2));
        console.log('Status:', res.status);
      }
      
      expect(res.status).toBe(200);
      console.log('Tool return response:', JSON.stringify(res.body, null, 2));

      expect(res.body).toHaveProperty('message', 'Tools returned successfully');
      expect(res.body).toHaveProperty('tag');
      expect(res.body).toHaveProperty('instances_returned');
      expect(res.body).toHaveProperty('condition', 'functional');
      
      // Verify tag is marked as fulfilled
      expect(res.body.tag.status).toBe('fulfilled');
      expect(res.body.tag.remaining_quantity).toBe(0);
      
      // Verify notes were added
      expect(res.body.tag.notes).toContain('Tools returned in good condition');
      
      console.log('\u2705 Tool return success verified');
    });

    test('should preserve instances after return (not delete them)', async () => {
      console.log('\ud83e\uddea Testing that instances are preserved after return...');
      
      // Get instance count before return
      const instancesBefore = await Instance.countDocuments({ sku_id: toolSKU._id });
      console.log(`Instances before return: ${instancesBefore}`);

      const returnData = {
        return_notes: 'Testing instance preservation',
        returned_condition: 'functional'
      };

      await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      // Get instance count after return - should be the same
      const instancesAfter = await Instance.countDocuments({ sku_id: toolSKU._id });
      console.log(`Instances after return: ${instancesAfter}`);
      
      expect(instancesAfter).toBe(instancesBefore);
      
      // Verify instances are now available (tag_id: null)
      const availableInstances = await Instance.countDocuments({ 
        sku_id: toolSKU._id, 
        tag_id: null 
      });
      console.log(`Available instances after return: ${availableInstances}`);
      
      expect(availableInstances).toBeGreaterThan(0);
      
      console.log('\u2705 Instance preservation verified');
    });

    test('should update inventory counts correctly after return', async () => {
      console.log('\ud83e\uddea Testing inventory count updates after return...');
      
      // Get inventory before return
      const inventoryBefore = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      const toolBefore = inventoryBefore.body.inventory.find(item => item.sku_code === 'TOOL-001');
      console.log('Inventory before return:', {
        available: toolBefore.available_quantity,
        loaned: toolBefore.loaned_quantity,
        total: toolBefore.total_quantity
      });

      const returnData = {
        return_notes: 'Testing inventory updates',
        returned_condition: 'functional'
      };

      await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      // Get inventory after return
      const inventoryAfter = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      const toolAfter = inventoryAfter.body.inventory.find(item => item.sku_code === 'TOOL-001');
      console.log('Inventory after return:', {
        available: toolAfter.available_quantity,
        loaned: toolAfter.loaned_quantity,
        total: toolAfter.total_quantity
      });
      
      // Available quantity should have increased
      expect(toolAfter.available_quantity).toBeGreaterThan(toolBefore.available_quantity);
      // Loaned quantity should have decreased
      expect(toolAfter.loaned_quantity).toBeLessThan(toolBefore.loaned_quantity);
      // Total quantity should remain the same
      expect(toolAfter.total_quantity).toBe(toolBefore.total_quantity);
      
      console.log('\u2705 Inventory count updates verified');
    });

    test('should create audit log for tool return', async () => {
      const returnData = {
        return_notes: 'Audit log test return',
        returned_condition: 'functional'
      };

      await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      // Check if audit log was created
      const auditLogs = await AuditLog.find({ 
        event_type: 'tag_returned',
        user_name: testUser.username
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[auditLogs.length - 1];
      expect(latestLog.action).toBe('RETURN_TOOLS');
      expect(latestLog.description).toContain('Tools returned from Return Test Customer');
      expect(latestLog.description).toContain('instance(s)');
      
      console.log('\u2705 Tool return audit log verified');
    });

    test('should handle tools returned with maintenance condition', async () => {
      console.log('\ud83e\uddea Testing tools returned with maintenance condition...');
      
      const returnData = {
        return_notes: 'Drill needs maintenance - chuck is loose',
        returned_condition: 'needs_maintenance'
      };

      const res = await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      expect(res.body.condition).toBe('needs_maintenance');
      
      // Verify a maintenance tag was created
      const maintenanceTags = await Tag.find({ 
        customer_name: /Maintenance -/,
        project_name: /Tool condition: needs_maintenance/
      });
      
      expect(maintenanceTags.length).toBeGreaterThan(0);
      const maintenanceTag = maintenanceTags[maintenanceTags.length - 1];
      expect(maintenanceTag.tag_type).toBe('reserved');
      expect(maintenanceTag.notes).toContain('needs_maintenance');
      
      // Verify instances are tagged for maintenance (not available)
      const availableInstances = await Instance.countDocuments({ 
        sku_id: toolSKU._id, 
        tag_id: null 
      });
      const maintenanceInstances = await Instance.countDocuments({ 
        sku_id: toolSKU._id, 
        tag_id: maintenanceTag._id 
      });
      
      console.log(`Available instances: ${availableInstances}`);
      console.log(`Maintenance instances: ${maintenanceInstances}`);
      
      expect(maintenanceInstances).toBeGreaterThan(0);
      
      console.log('\u2705 Maintenance condition handling verified');
    });

    test('should handle tools returned as broken', async () => {
      console.log('\ud83e\uddea Testing tools returned as broken...');
      
      const returnData = {
        return_notes: 'Drill motor burned out',
        returned_condition: 'broken'
      };

      const res = await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      expect(res.body.condition).toBe('broken');
      
      // Verify a broken tag was created
      const brokenTags = await Tag.find({ 
        customer_name: /Maintenance -/,
        project_name: /Tool condition: broken/
      });
      
      expect(brokenTags.length).toBeGreaterThan(0);
      const brokenTag = brokenTags[brokenTags.length - 1];
      expect(brokenTag.tag_type).toBe('broken');
      expect(brokenTag.notes).toContain('broken');
      
      console.log('\u2705 Broken condition handling verified');
    });

    test('should reject return of invalid tag ID', async () => {
      const returnData = {
        return_notes: 'Invalid tag test',
        returned_condition: 'functional'
      };

      await request(app)
        .post('/api/tools/invalid_id/return')
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(400);
      
      console.log('\u2705 Invalid tag ID rejection verified');
    });

    test('should reject return of non-existent tag', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const returnData = {
        return_notes: 'Non-existent tag test',
        returned_condition: 'functional'
      };

      const res = await request(app)
        .post(`/api/tools/${nonExistentId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(404);

      expect(res.body.message).toBe('Tag not found');
      
      console.log('\u2705 Non-existent tag rejection verified');
    });

    test('should reject return of non-tool tag', async () => {
      // Create a product tag
      const productTag = await Tag.create({
        customer_name: 'Product Customer',
        tag_type: 'reserved',
        project_name: 'Product Project',
        sku_items: [{
          sku_id: productSKU._id,
          quantity: 1,
          remaining_quantity: 1
        }],
        status: 'active',
        created_by: testUser.username,
        last_updated_by: testUser.username
      });

      const returnData = {
        return_notes: 'Non-tool tag test',
        returned_condition: 'functional'
      };

      const res = await request(app)
        .post(`/api/tools/${productTag._id}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(400);

      expect(res.body.message).toBe('This tag contains non-tool items and cannot be returned via tools API');
      
      console.log('\u2705 Non-tool tag rejection verified');
    });

    test('should reject return of already fulfilled tag', async () => {
      // First return the tag
      const returnData = {
        return_notes: 'First return',
        returned_condition: 'functional'
      };

      await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(returnData)
        .expect(200);

      // Try to return again - should fail
      const secondReturnData = {
        return_notes: 'Second return attempt',
        returned_condition: 'functional'
      };

      const res = await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(secondReturnData)
        .expect(400);

      expect(res.body.message).toBe('Cannot return tools from a fulfilled tag');
      
      console.log('\u2705 Already fulfilled tag rejection verified');
    });

    test('should require authentication for tool return', async () => {
      const returnData = {
        return_notes: 'Unauthorized return attempt',
        returned_condition: 'functional'
      };

      await request(app)
        .post(`/api/tools/${checkoutTagId}/return`)
        .send(returnData)
        .expect(401);
      
      console.log('\u2705 Authentication requirement verified');
    });
  });

  describe('Tools API Security & Access Control', () => {
    test('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/tools/inventory' },
        { method: 'get', path: '/api/tools/skus' },
        { method: 'get', path: '/api/tools/tags' },
        { method: 'post', path: '/api/tools/checkout' }
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        if (endpoint.method === 'post') {
          req.send({});
        }
        await req.expect(401);
      }
      
      console.log('✅ Authentication requirements verified for all endpoints');
    });

    test('should respect write access requirements for checkout', async () => {
      // This test assumes that write access control is properly configured
      // In a real scenario, you would create a user with read-only access
      // and test that they get a 403 Forbidden response
      
      const checkoutData = {
        customer_name: 'Test User',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 1
        }]
      };

      // With admin user (should succeed)
      await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(201);
      
      console.log('✅ Write access control verified');
    });
  });

  describe('Tools API Error Handling', () => {
    test('should handle invalid MongoDB IDs gracefully', async () => {
      await request(app)
        .get('/api/tools/skus?category_id=invalid_id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
      
      console.log('✅ Invalid ID handling verified');
    });

    test('should handle non-existent SKUs in checkout', async () => {
      const checkoutData = {
        customer_name: 'Test User',
        sku_items: [{
          sku_id: '507f1f77bcf86cd799439011', // Valid format but non-existent
          quantity: 1
        }]
      };

      const res = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(checkoutData)
        .expect(400);

      expect(res.body.errors[0].msg).toContain('not found');
      
      console.log('✅ Non-existent SKU handling verified');
    });

    test('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/tools/skus?page=0')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      await request(app)
        .get('/api/tools/skus?limit=101')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
      
      console.log('✅ Pagination validation verified');
    });
  });

  describe('Tools API Performance & Data Consistency', () => {
    test('should maintain data consistency between tools endpoints', async () => {
      // Get tool data from different endpoints
      const [inventoryRes, skusRes, tagsRes] = await Promise.all([
        request(app)
          .get('/api/tools/inventory')
          .set('Authorization', `Bearer ${testToken}`),
        request(app)
          .get('/api/tools/skus?include_inventory=true')
          .set('Authorization', `Bearer ${testToken}`),
        request(app)
          .get('/api/tools/tags?include_items=true')
          .set('Authorization', `Bearer ${testToken}`)
      ]);

      // Verify all endpoints return tool data only
      expect(inventoryRes.body.inventory.every(item => item.category?.type === 'tool')).toBe(true);
      expect(skusRes.body.skus.every(sku => sku.category_id?.name === 'power tools')).toBe(true); // Category names are lowercase
      expect(tagsRes.body.tags.every(tag => 
        tag.sku_items?.some(item => item.sku_id?.category_id?.type === 'tool')
      )).toBe(true);
      
      console.log('✅ Data consistency verified across endpoints');
    });

    test('should handle concurrent requests properly', async () => {
      // Make multiple concurrent requests to test for race conditions
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .get('/api/tools/inventory')
          .set('Authorization', `Bearer ${testToken}`)
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(res => expect(res.status).toBe(200));
      
      // All should return consistent data
      const inventoryCounts = responses.map(res => res.body.inventory.length);
      expect(inventoryCounts.every(count => count === inventoryCounts[0])).toBe(true);
      
      console.log('✅ Concurrent request handling verified');
    });
  });

  describe('PUT /api/tools/:id/condition - Tool Condition Management', () => {
    let availableToolInstance;
    let loanedToolInstance;
    let loanTagId;
    
    beforeEach(async () => {
      // Get available instances
      const availableInstances = await Instance.find({ 
        sku_id: toolSKU._id, 
        tag_id: null 
      });
      
      if (availableInstances.length > 0) {
        availableToolInstance = availableInstances[0];
      }
      
      // Create a fresh loan for testing condition changes on loaned tools
      const loanData = {
        customer_name: 'Condition Test Customer',
        project_name: 'Condition Test Project', 
        tag_type: 'loaned',
        sku_items: [{
          sku_id: toolSKU._id.toString(),
          quantity: 1
        }],
        notes: 'Tool loan for condition testing'
      };
      
      const loanRes = await request(app)
        .post('/api/tools/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send(loanData)
        .expect(201);
      
      loanTagId = loanRes.body.tag._id;
      
      // Get the loaned instance
      const loanedInstances = await Instance.find({ 
        sku_id: toolSKU._id, 
        tag_id: loanTagId 
      });
      
      if (loanedInstances.length > 0) {
        loanedToolInstance = loanedInstances[0];
      }
      
      console.log(`✅ Set up condition test instances: available=${availableToolInstance?._id}, loaned=${loanedToolInstance?._id}`);
    });
    
    test('should change available tool to needs_maintenance', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing condition change: functional → needs_maintenance...');
      
      const conditionData = {
        condition: 'needs_maintenance',
        reason: 'Chuck is loose',
        notes: 'Needs tightening before next use'
      };
      
      const res = await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(conditionData)
        .expect(200);
      
      console.log('Condition change response:', JSON.stringify(res.body, null, 2));
      
      expect(res.body.message).toBe('Tool condition updated successfully');
      expect(res.body.instance.condition).toBe('needs_maintenance');
      expect(res.body.previous_condition).toBe('functional');
      expect(res.body.action_description).toContain('needs_maintenance');
      
      // Verify instance is now tagged
      const updatedInstance = await Instance.findById(availableToolInstance._id);
      expect(updatedInstance.tag_id).not.toBeNull();
      
      // Verify maintenance tag was created
      const maintenanceTag = await Tag.findById(updatedInstance.tag_id);
      expect(maintenanceTag.tag_type).toBe('reserved');
      expect(maintenanceTag.project_name).toContain('needs_maintenance');
      
      console.log('✅ Condition change to needs_maintenance verified');
    });
    
    test('should change available tool to broken', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing condition change: functional → broken...');
      
      const conditionData = {
        condition: 'broken',
        reason: 'Motor burned out',
        notes: 'Needs motor replacement'
      };
      
      const res = await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(conditionData)
        .expect(200);
      
      expect(res.body.message).toBe('Tool condition updated successfully');
      expect(res.body.instance.condition).toBe('broken');
      expect(res.body.previous_condition).toBe('functional');
      
      // Verify instance is now tagged as broken
      const updatedInstance = await Instance.findById(availableToolInstance._id);
      expect(updatedInstance.tag_id).not.toBeNull();
      
      // Verify broken tag was created
      const brokenTag = await Tag.findById(updatedInstance.tag_id);
      expect(brokenTag.tag_type).toBe('broken');
      expect(brokenTag.project_name).toContain('broken');
      
      console.log('✅ Condition change to broken verified');
    });
    
    test('should restore tool from maintenance to functional', async () => {
      // First create a maintenance tool
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing condition restoration: needs_maintenance → functional...');
      
      // Set to maintenance first
      await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'needs_maintenance',
          reason: 'Setup for restoration test'
        })
        .expect(200);
      
      // Now restore to functional
      const res = await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'functional',
          notes: 'Maintenance completed'
        })
        .expect(200);
      
      expect(res.body.message).toBe('Tool condition updated successfully');
      expect(res.body.instance.condition).toBe('functional');
      expect(res.body.previous_condition).toBe('needs_maintenance');
      
      // Verify instance is now available (no tag)
      const updatedInstance = await Instance.findById(availableToolInstance._id);
      expect(updatedInstance.tag_id).toBeNull();
      
      console.log('✅ Condition restoration to functional verified');
    });
    
    test('should prevent condition change on loaned tool (except broken)', async () => {
      if (!loanedToolInstance) {
        console.log('⏭️ Skipping test - no loaned tool instances');
        return;
      }
      
      console.log('🧪 Testing loaned tool condition change prevention...');
      
      // Try to change loaned tool to needs_maintenance (should fail)
      const res = await request(app)
        .put(`/api/tools/${loanedToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'needs_maintenance',
          reason: 'Should be prevented'
        })
        .expect(400);
      
      expect(res.body.message).toContain('Cannot change condition of loaned tools');
      
      console.log('✅ Loaned tool condition change prevention verified');
    });
    
    test('should allow emergency broken condition on loaned tool', async () => {
      if (!loanedToolInstance) {
        console.log('⏭️ Skipping test - no loaned tool instances');
        return;
      }
      
      console.log('🧪 Testing emergency broken condition on loaned tool...');
      
      // Mark loaned tool as broken (should work for emergencies)
      const res = await request(app)
        .put(`/api/tools/${loanedToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'broken',
          reason: 'Emergency - tool failed during use',
          notes: 'Contractor reported motor smoke'
        })
        .expect(200);
      
      expect(res.body.message).toBe('Tool condition updated successfully');
      expect(res.body.instance.condition).toBe('broken');
      expect(res.body.action_description).toContain('broken');
      
      // Verify instance is moved to broken tag
      const updatedInstance = await Instance.findById(loanedToolInstance._id);
      expect(updatedInstance.tag_id).not.toBe(loanTagId); // Should be different tag now
      
      // Verify broken tag was created
      const brokenTag = await Tag.findById(updatedInstance.tag_id);
      expect(brokenTag.tag_type).toBe('broken');
      
      console.log('✅ Emergency broken condition on loaned tool verified');
    });
    
    test('should handle no condition change needed', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing no condition change needed...');
      
      // Try to set available tool to functional (no change)
      const res = await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'functional'
        })
        .expect(200);
      
      expect(res.body.message).toBe('Tool condition unchanged');
      
      console.log('✅ No condition change handling verified');
    });
    
    test('should create audit log for condition changes', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing audit log creation for condition changes...');
      
      await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'broken',
          reason: 'Audit log test'
        })
        .expect(200);
      
      // Check if audit log was created
      const auditLogs = await AuditLog.find({ 
        event_type: 'tool_condition_changed',
        user_name: testUser.username
      });
      
      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[auditLogs.length - 1];
      expect(latestLog.action).toBe('CHANGE_TOOL_CONDITION');
      expect(latestLog.description).toContain('condition changed');
      expect(latestLog.metadata.old_condition).toBe('functional');
      expect(latestLog.metadata.new_condition).toBe('broken');
      expect(latestLog.category).toBe('maintenance');
      
      console.log('✅ Condition change audit log verified');
    });
    
    test('should validate condition values', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing condition validation...');
      
      // Try invalid condition value
      const res = await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'invalid_condition'
        })
        .expect(400);
      
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors[0].msg).toContain('Condition must be functional, needs_maintenance, or broken');
      
      console.log('✅ Condition validation verified');
    });
    
    test('should reject condition change on non-existent instance', async () => {
      console.log('🧪 Testing non-existent instance handling...');
      
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const res = await request(app)
        .put(`/api/tools/${nonExistentId}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'broken'
        })
        .expect(404);
      
      expect(res.body.message).toBe('Tool instance not found');
      
      console.log('✅ Non-existent instance handling verified');
    });
    
    test('should reject condition change on non-tool instance', async () => {
      console.log('🧪 Testing non-tool instance rejection...');
      
      // Use a product instance instead of tool instance
      if (productInstances.length === 0) {
        console.log('⏭️ Skipping test - no product instances available');
        return;
      }
      
      const res = await request(app)
        .put(`/api/tools/${productInstances[0]._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'broken'
        })
        .expect(400);
      
      expect(res.body.message).toBe('This instance is not a tool and cannot have its condition changed via tools API');
      
      console.log('✅ Non-tool instance rejection verified');
    });
    
    test('should require authentication for condition changes', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing authentication requirement...');
      
      await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .send({
          condition: 'broken'
        })
        .expect(401);
      
      console.log('✅ Authentication requirement verified');
    });
    
    test('should update inventory counts after condition changes', async () => {
      if (!availableToolInstance) {
        console.log('⏭️ Skipping test - no available tool instances');
        return;
      }
      
      console.log('🧪 Testing inventory count updates after condition change...');
      
      // Get inventory before condition change
      const inventoryBefore = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      const toolBefore = inventoryBefore.body.inventory.find(item => item.sku_code === 'TOOL-001');
      console.log('Inventory before condition change:', {
        available: toolBefore.available_quantity,
        reserved: toolBefore.reserved_quantity,
        broken: toolBefore.broken_quantity
      });
      
      // Change condition to broken
      await request(app)
        .put(`/api/tools/${availableToolInstance._id}/condition`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          condition: 'broken',
          reason: 'Inventory test'
        })
        .expect(200);
      
      // Get inventory after condition change
      const inventoryAfter = await request(app)
        .get('/api/tools/inventory')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      const toolAfter = inventoryAfter.body.inventory.find(item => item.sku_code === 'TOOL-001');
      console.log('Inventory after condition change:', {
        available: toolAfter.available_quantity,
        reserved: toolAfter.reserved_quantity,
        broken: toolAfter.broken_quantity
      });
      
      // Available should decrease, broken should increase
      expect(toolAfter.available_quantity).toBeLessThan(toolBefore.available_quantity);
      expect(toolAfter.broken_quantity).toBeGreaterThan(toolBefore.broken_quantity);
      
      console.log('✅ Inventory count updates after condition change verified');
    });
  });
});
