# Stock Manager

A modern inventory management system for Facet Renovations, built with Vue 3, TypeScript, Express, and MongoDB. Features a clean SKU-centric architecture with individual product instance tracking.

## Key Features

- **SKU-centric inventory management** - Single source of truth for products
- **Individual instance tracking** - Track acquisition costs and locations per unit
- **Smart tagging system** - Reserve, loan, and track product usage
- **Role-based access control** (Admin, Warehouse Manager, Sales Rep)
- **Real-time inventory tracking** with automatic quantity calculations
- **Category-based organization** with hierarchical product categories
- **Cost tracking** - Compare acquisition costs vs current pricing
- **Location management** - Track physical location of each instance
- **JWT authentication** with persistent sessions

## Tech Stack

### Backend
- Node.js with Express.js
- MongoDB with Mongoose
- JWT for authentication
- Express Validator for input validation
- CORS enabled

### Frontend
- Vue 3 with Composition API
- TypeScript
- Pinia for state management
- Vue Router
- Vite for build tooling
- Axios for HTTP requests

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (running locally or remote connection)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd /home/proto/facet/Dev/stock_manager
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables:**
   ```bash
   cd ../backend
   cp .env.example .env
   # Edit .env file with your MongoDB URI and secrets
   ```

### Running the Application

**Option 1: Start both services together (Recommended)**
```bash
npm run dev
```

**Option 2: Start services individually**
1. **Backend server:**
   ```bash
   npm run dev:backend
   ```
   Server runs on http://localhost:5000

2. **Frontend development server:**
   ```bash
   npm run dev:frontend
   ```
   Application runs on http://localhost:3000

### Available Scripts

- `npm run dev` - Start both backend and frontend together
- `npm run dev:backend` - Start only the backend server
- `npm run dev:frontend` - Start only the frontend server
- `npm run build` - Build the frontend for production
- `npm run install` - Install dependencies for both backend and frontend
- `npm run clean` - Remove all node_modules
- `npm run reset` - Clean and reinstall everything

### Default Login Credentials

- **Admin:** username=`admin`, password=`admin123`
- **Warehouse Manager:** username=`warehouse`, password=`warehouse456`
- **Sales Rep:** username=`sales`, password=`any password`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - User logout

### SKUs (Products)
- `GET /api/skus` - Get all SKUs with inventory data
- `GET /api/skus/:id` - Get single SKU by ID
- `POST /api/skus` - Create new SKU (Admin/Warehouse only)
- `PUT /api/skus/:id` - Update SKU (Admin/Warehouse only)
- `DELETE /api/skus/:id` - Delete SKU (Admin/Warehouse only)

### Instances (Individual Units)
- `GET /api/instances/:sku_id` - Get instances for a SKU
- `POST /api/instances/add-stock` - Add new stock instances
- `PUT /api/instances/:id` - Update instance details
- `GET /api/instances/cost-breakdown/:sku_id` - Get cost analysis

### Inventory (Aggregate Data)
- `GET /api/inventory` - Get inventory summary with filters
- `GET /api/inventory/stats` - Get inventory statistics
- `POST /api/inventory/sync` - Sync inventory quantities

### Tags (Reservations/Loans)
- `GET /api/tags` - Get all tags with filters
- `POST /api/tags` - Create new tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

### Categories
- `GET /api/categories` - Get product categories
- `POST /api/categories` - Create category (Admin only)

## Database Architecture

### SKU (Product Master Data)
- `sku_code`: String (unique identifier)
- `name`: String (product name)
- `category_id`: ObjectId (references Category)
- `brand`: String
- `model`: String
- `details`: Object (category-specific fields like color, finish)
- `unit_cost`: Number (current cost)
- `cost_history`: Array (historical pricing)
- `status`: String (active/discontinued/pending)

### Instance (Individual Product Units)
- `sku_id`: ObjectId (references SKU)
- `acquisition_date`: Date (when acquired)
- `acquisition_cost`: Number (cost when purchased - frozen)
- `tag_id`: ObjectId (references Tag, null = available)
- `location`: String (physical location)
- `supplier`: String
- `reference_number`: String

### Inventory (Aggregate Quantities)
- `sku_id`: ObjectId (references SKU)
- `total_quantity`: Number (calculated)
- `available_quantity`: Number
- `reserved_quantity`: Number
- `broken_quantity`: Number
- `loaned_quantity`: Number
- `average_cost`: Number
- `total_value`: Number

### Tag (Reservations/Loans/Status)
- `tag_type`: String (reserved/broken/loaned/stock)
- `customer_name`: String
- `sku_items`: Array (SKU references with quantities)
- `status`: String (active/fulfilled/cancelled)
- `project_name`: String
- `due_date`: Date

### Category (Product Organization)
- `name`: String
- `slug`: String
- `parent_id`: ObjectId (for hierarchy)
- `is_active`: Boolean

## User Roles

1. **Admin**: Full access - can add, edit, delete items and manage all aspects
2. **Warehouse Manager**: Can add, edit, delete items but not manage users
3. **Sales Rep**: Read-only access to view inventory and check stock levels

## Deployment

### Backend Deployment
1. Set `NODE_ENV=production` in environment variables
2. Update MongoDB URI to production database
3. Update JWT secrets and passwords
4. Deploy to your preferred hosting platform

### Frontend Deployment
1. Update API URL in `.env` or vite config
2. Build the application: `npm run build`
3. Deploy `dist` folder to static hosting (Netlify, Vercel, etc.)
4. Set up domain: stock.facetrenovations.us

## Development Notes

- Frontend uses Vite proxy to route `/api` requests to backend during development
- Backend has CORS configured for both development and production origins
- Database indexes are set up for efficient querying
- All forms include validation and error handling
- Responsive design works on mobile devices

## Future Enhancements

- Barcode scanning integration
- Export/import functionality for inventory data
- Email notifications for low stock alerts
- Inventory history tracking
- Multi-location support
- Advanced reporting and analytics
