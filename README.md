# Stock Manager

A real-time inventory management system for Facet Renovations, built with Vue 3, TypeScript, Express, and MongoDB.

## Features

- **Real-time inventory tracking** with different product types (walls, toilets, bases, tubs, vanities, shower doors)
- **Role-based access control** (Admin, Warehouse Manager, Sales Rep)
- **Tabbed interface** for easy product type filtering
- **Global search** functionality across all product attributes
- **CRUD operations** for inventory items (Admin/Warehouse only)
- **Stock status tracking** (In Stock, Low Stock, Out of Stock)
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

### Inventory
- `GET /api/inventory` - Get all inventory items (with filters)
- `GET /api/inventory/stats` - Get inventory statistics
- `POST /api/inventory` - Create new item (Admin/Warehouse only)
- `PUT /api/inventory/:id` - Update item (Admin/Warehouse only)
- `DELETE /api/inventory/:id` - Delete item (Admin/Warehouse only)

## Database Models

### Item (Main inventory model)
- `product_type`: String (wall, toilet, base, tub, vanity, shower_door)
- `product_details`: ObjectId (references specific product type model)
- `quantity`: Number
- `location`: String (optional)
- `notes`: String (optional)

### Wall (Product details for walls)
- `product_line`: String
- `color_name`: String
- `dimensions`: String
- `finish`: String

### Generic Products (Toilet, Base, Tub, Vanity, ShowerDoor)
- `name`: String
- `brand`: String (optional)
- `model`: String (optional)
- `color`: String (optional)
- `dimensions`: String (optional)
- `finish`: String (optional)
- `description`: String (optional)

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
