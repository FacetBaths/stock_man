const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Initial user setup
const createInitialUsers = async () => {
  try {
    console.log('Setting up initial users...');

    // Check if any users exist
    const existingUserCount = await User.countDocuments();
    if (existingUserCount > 0) {
      console.log(`Found ${existingUserCount} existing users. Skipping initial setup.`);
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@facet.local',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isActive: true,
      isEmailVerified: true
    });

    // Create warehouse manager user
    const warehouseUser = new User({
      username: 'warehouse',
      email: 'warehouse@facet.local',
      password: process.env.WAREHOUSE_PASSWORD || 'warehouse123',
      firstName: 'Warehouse',
      lastName: 'Manager',
      role: 'warehouse_manager',
      isActive: true,
      isEmailVerified: true
    });

    // Create sales rep user
    const salesUser = new User({
      username: 'sales',
      email: 'sales@facet.local',
      password: process.env.SALES_PASSWORD || 'sales123',
      firstName: 'Sales',
      lastName: 'Representative',
      role: 'sales_rep',
      isActive: true,
      isEmailVerified: true
    });

    // Create viewer user
    const viewerUser = new User({
      username: 'viewer',
      email: 'viewer@facet.local',
      password: process.env.VIEWER_PASSWORD || 'viewer123',
      firstName: 'Read Only',
      lastName: 'Viewer',
      role: 'viewer',
      isActive: true,
      isEmailVerified: true
    });

    // Save all users
    await adminUser.save();
    await warehouseUser.save();
    await salesUser.save();
    await viewerUser.save();

    console.log('✓ Initial users created successfully:');
    console.log('  - admin (System Administrator)');
    console.log('  - warehouse (Warehouse Manager)');
    console.log('  - sales (Sales Representative)');
    console.log('  - viewer (Read Only Viewer)');
    console.log('\nDefault passwords can be changed via environment variables:');
    console.log('  ADMIN_PASSWORD, WAREHOUSE_PASSWORD, SALES_PASSWORD, VIEWER_PASSWORD');
    console.log('\nUsers can change their passwords after first login via /api/auth/password');
    
    // Log initial setup (after users are created we can use admin user for the audit log)
    try {
      await AuditLog.logEvent({
        event_type: 'create',
        entity_type: 'system',
        user_id: adminUser._id,
        user_name: 'admin',
        action: 'Initial User Setup',
        description: 'System initialized with default users',
        metadata: {
          users_created: ['admin', 'warehouse', 'sales', 'viewer'],
          system_init: true
        },
        category: 'system',
        severity: 'low'
      });
    } catch (auditError) {
      console.log('Note: Could not create audit log entry for setup (this is normal for initial setup):', auditError.message);
    }

  } catch (error) {
    console.error('Error creating initial users:', error);
    throw error;
  }
};

// Run setup
const runSetup = async () => {
  try {
    await connectDB();
    await createInitialUsers();
    console.log('\n✅ Initial setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runSetup();
}

module.exports = {
  createInitialUsers,
  connectDB
};
