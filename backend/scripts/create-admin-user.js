const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== CREATING ADMIN USER ===');
    
    // Check if admin user already exists
    const existingUser = await db.collection('users').findOne({ username: 'admin' });
    
    if (existingUser) {
      console.log('Admin user already exists:', existingUser.username);
      console.log('User ID:', existingUser._id);
      return existingUser;
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Create admin user
    const adminUser = {
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      permissions: ['view_inventory', 'edit_inventory', 'view_cost', 'manage_users', 'manage_tags'],
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('users').insertOne(adminUser);
    console.log('✅ Created admin user with ID:', result.insertedId);
    
    // Also create a warehouse manager user
    const warehouseUser = {
      username: 'warehouse',
      password: await bcrypt.hash('warehouse456', saltRounds),
      role: 'warehouse_manager', 
      email: 'warehouse@example.com',
      firstName: 'Warehouse',
      lastName: 'Manager',
      permissions: ['view_inventory', 'edit_inventory', 'manage_tags'],
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const warehouseResult = await db.collection('users').insertOne(warehouseUser);
    console.log('✅ Created warehouse user with ID:', warehouseResult.insertedId);
    
    console.log('\\n=== USERS CREATED ===');
    console.log('Admin user - username: admin, password: admin123');
    console.log('Warehouse user - username: warehouse, password: warehouse456');
    
    return { admin: adminUser, warehouse: warehouseUser };
    
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await client.close();
  }
}

createAdminUser();
