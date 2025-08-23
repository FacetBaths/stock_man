# Enhanced Authentication & User Management System

This document describes the comprehensive authentication and user management system implemented for the Stock Manager application.

## Overview

The enhanced authentication system provides:
- Secure JWT-based authentication with access and refresh tokens
- Role-based access control (RBAC)
- Account security features (login attempts, account locking)
- Comprehensive audit logging
- User management endpoints for administrators
- Password management and profile updates

## System Components

### 1. User Model (`/src/models/User.js`)

**Features:**
- Secure password hashing using bcrypt (cost factor 12)
- Role-based permissions: `admin`, `warehouse_manager`, `sales_rep`, `viewer`
- Account security: failed login tracking, temporary account locking
- Refresh token management for secure session handling
- User preferences and profile management
- Comprehensive validation and indexing

**Key Methods:**
- `comparePassword()` - Secure password verification
- `generateTokens()` - Creates JWT access + refresh token pairs
- `incLoginAttempts()` - Handles failed login security
- `toSafeObject()` - Returns user data without sensitive fields

### 2. Enhanced Authentication Middleware (`/src/middleware/authEnhanced.js`)

**Features:**
- JWT token verification with comprehensive error handling
- Role-based access control functions
- Rate limiting for authentication endpoints
- Request context population with user data
- Detailed error responses with appropriate HTTP status codes

**Key Functions:**
- `auth` - Main authentication middleware
- `requireAdminAccess` - Admin-only endpoint protection
- `requireRole(roles)` - Multi-role access control
- `rateLimitAuth(window, max)` - Endpoint-specific rate limiting

### 3. Audit Log System (`/src/models/AuditLog.js`)

**Features:**
- Comprehensive event tracking for security and compliance
- Structured logging with categories, severity levels
- User activity tracking and system event logging
- Performance optimized with proper indexing
- Configurable retention with capped collections

**Event Types:**
- Authentication events (login, logout, failures)
- User management (create, update, delete, role changes)
- System events (backups, migrations, errors)
- Business events (inventory, tags, customers, orders)

### 4. Authentication Routes (`/src/routes/auth.js`)

**Endpoints:**

#### Public Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/refresh` - Token refresh

#### Protected Endpoints
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Single device logout
- `POST /api/auth/logout-all` - Logout from all devices
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

#### Admin-Only Endpoints
- `POST /api/auth/register` - Register new users (admin-created)

### 5. User Management Routes (`/src/routes/users.js`)

**Admin-Only Endpoints:**

#### User Management
- `GET /api/users` - List users with filtering and pagination
- `GET /api/users/stats` - User statistics and analytics
- `GET /api/users/:id` - Get specific user details
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (soft delete)

#### Security Management
- `PUT /api/users/:id/reset-password` - Admin password reset
- `PUT /api/users/:id/unlock` - Unlock locked account
- `GET /api/users/:id/activity` - User activity history

## Security Features

### Password Security
- Minimum 6 character requirement
- Bcrypt hashing with cost factor 12
- Password change tracking with forced re-authentication
- Admin password reset functionality

### Account Protection
- Failed login attempt tracking (5 attempts = 2-hour lock)
- Automatic account unlocking after timeout
- Admin account unlock capability
- Account deactivation (soft delete) functionality

### Session Security
- Short-lived access tokens (15 minutes default)
- Long-lived refresh tokens (7 days, stored in database)
- Multiple device session management
- Token revocation on password change
- Logout from all devices functionality

### Rate Limiting
- Login attempts: 10 per 15 minutes
- Password changes: 5 per hour
- User creation: 10 per hour
- Password resets: 5 per hour

## Role-Based Access Control

### Role Hierarchy
1. **Admin** - Full system access
   - User management
   - System configuration
   - All business operations

2. **Warehouse Manager** - Inventory operations
   - Inventory management
   - Stock movements
   - Reporting

3. **Sales Representative** - Customer operations
   - Customer management
   - Order processing
   - Sales reporting

4. **Viewer** - Read-only access
   - View inventory
   - View reports
   - No modifications

### Permission Matrix
```
Feature                  | Admin | Warehouse | Sales | Viewer
------------------------|--------|-----------|-------|--------
User Management         |   ✓    |     ✗     |   ✗   |   ✗
Inventory Management    |   ✓    |     ✓     |   ✗   |   ✓*
Customer Management     |   ✓    |     ✗     |   ✓   |   ✓*
Reports                 |   ✓    |     ✓     |   ✓   |   ✓
System Settings         |   ✓    |     ✗     |   ✗   |   ✗

* Read-only access
```

## Initial Setup

### Default Users
The system includes a setup script that creates default users:

```bash
node src/scripts/setupInitialUsers.js
```

**Default Accounts:**
- `admin` / `admin123` (System Administrator)
- `warehouse` / `warehouse123` (Warehouse Manager)
- `sales` / `sales123` (Sales Representative)
- `viewer` / `viewer123` (Read-only Viewer)

**Environment Variables:**
- `ADMIN_PASSWORD` - Admin user password
- `WAREHOUSE_PASSWORD` - Warehouse manager password
- `SALES_PASSWORD` - Sales rep password
- `VIEWER_PASSWORD` - Viewer password

### JWT Configuration
Required environment variables:
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_EXPIRE` - Access token expiration (default: 15m)

## API Usage Examples

### Authentication Flow
```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Response includes accessToken and refreshToken

# 2. Access protected endpoints
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# 3. Refresh token when expired
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'
```

### User Management (Admin Only)
```bash
# Get admin access token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.accessToken')

# List users
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Create new user
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "password123",
    "firstName": "New",
    "lastName": "User",
    "role": "sales_rep"
  }'

# Get user statistics
curl -X GET http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Audit Logging

All authentication and user management activities are automatically logged:

### Event Categories
- **Security**: Authentication, authorization, password changes
- **Business**: User management, profile updates
- **System**: System events, errors, maintenance

### Log Data
- Event type and description
- User identification
- Timestamp and IP address
- Changed data (before/after for updates)
- Metadata (user agent, request details)

## Integration with Existing Routes

The authentication system is designed to be integrated with existing API routes. Update existing routes by:

1. **Replace old middleware:**
   ```javascript
   // Old
   const { auth } = require('../middleware/auth');
   
   // New
   const { auth, requireRole } = require('../middleware/authEnhanced');
   ```

2. **Add role-based protection:**
   ```javascript
   // Warehouse manager only
   router.get('/inventory', [auth, requireRole(['admin', 'warehouse_manager'])], handler);
   
   // Admin only
   router.post('/users', [auth, requireAdminAccess], handler);
   ```

3. **Add audit logging:**
   ```javascript
   await AuditLog.logEvent({
     event_type: 'create',
     entity_type: 'inventory',
     entity_id: item._id,
     user_id: req.user.id,
     user_name: req.user.username,
     action: 'Item Created',
     description: `Created inventory item ${item.name}`,
     category: 'business'
   });
   ```

## Monitoring and Maintenance

### Health Checks
- Monitor failed login rates
- Track locked accounts
- Audit token usage patterns
- Review user activity logs

### Maintenance Tasks
- Regular password policy reviews
- Audit log cleanup (automated via capped collection)
- User access reviews
- Security event analysis

## Security Best Practices Implemented

1. **Password Security**
   - Strong hashing (bcrypt cost 12)
   - Minimum length requirements
   - Change tracking and forced re-authentication

2. **Session Management**
   - Short-lived access tokens
   - Secure refresh token storage
   - Multi-device session control

3. **Account Protection**
   - Login attempt tracking
   - Temporary account locking
   - Admin intervention capabilities

4. **Audit Trail**
   - Comprehensive activity logging
   - Security event tracking
   - Compliance-ready reporting

5. **Access Control**
   - Role-based permissions
   - Principle of least privilege
   - Administrative oversight

This system provides enterprise-grade security while maintaining developer-friendly APIs and comprehensive administrative controls.
