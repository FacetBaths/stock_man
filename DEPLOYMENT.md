# Deployment Guide

This application is configured for deployment with Railway (backend) and GitHub Pages (frontend).

## 🚀 Railway Deployment (Backend)

### Prerequisites
- Railway account at [railway.app](https://railway.app)
- **Database (Optional):** Choose one option:
  - **None** - Uses built-in JSON file database (simplest)
  - **Railway MongoDB** - One-click addon (recommended) 
  - **MongoDB Atlas** - External cloud database (advanced)

### Deployment Steps

1. **Connect to Railway:**
   - Go to [railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository (`FacetBaths/stock_man`)

2. **Configure Environment Variables:**
   **Minimum Required Variables (Railway dashboard):**
   ```bash
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ADMIN_PASSWORD=your-secure-admin-password
   WAREHOUSE_PASSWORD=your-secure-warehouse-password
   ```
   
   **Optional Variables:**
   ```bash
   # Only needed if using MongoDB (Options B or C below)
   MONGODB_URI=your-mongodb-connection-string
   ```

3. **Railway Configuration:**
   - The `railway.toml` and `Dockerfile` are already configured
   - Railway will automatically detect the Node.js backend in the `/backend` directory
   - The service will start on the port provided by Railway's `$PORT` environment variable

4. **Database Options (Choose One):**

   **Option A: JSON File Database (Simplest) ✅**
   - **No setup required!** Just deploy without setting `MONGODB_URI`
   - Data stored in `backend/data.json` file
   - Perfect for development, testing, and small applications
   - Automatically initialized on first run

   **Option B: Railway MongoDB Addon (Recommended for Production)**
   - In your Railway project: Add "MongoDB" service
   - Railway automatically provides `MONGODB_URI` environment variable
   - One-click setup, no external accounts needed
   - Scales with your Railway project

   **Option C: MongoDB Atlas (Advanced)**
   - Create account at [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a new cluster (free tier available)
   - Get connection string and set as `MONGODB_URI`
   - Most robust option for large-scale applications

### Backend URL
After deployment, your backend will be available at:
`https://your-railway-app.up.railway.app`

## 🌐 GitHub Pages Deployment (Frontend)

### Prerequisites
- GitHub repository with Pages enabled

### Deployment Steps

1. **Enable GitHub Pages:**
   - Go to repository settings
   - Navigate to "Pages" section
   - Select "GitHub Actions" as the source

2. **Configure Environment Variables:**
   - Update the `VITE_API_URL` in `.github/workflows/deploy.yml`
   - Replace `https://stock-manager-backend.up.railway.app/api` with your actual Railway backend URL

3. **Automatic Deployment:**
   - The GitHub Action workflow (`.github/workflows/deploy.yml`) will automatically:
     - Build the Vue.js frontend
     - Deploy to GitHub Pages on every push to `main` branch

### Frontend URL
After deployment, your frontend will be available at:
`https://facetbaths.github.io/stock_man`

## 🔧 Configuration Files

### Railway Configuration
- `railway.toml` - Railway deployment configuration
- `Dockerfile` - Container configuration for Railway
- `backend/.env.example` - Environment variables template

### GitHub Pages Configuration
- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `frontend/vite.config.ts` - Vite build configuration with proper base path

## 🔒 Security Notes

- **Environment Variables:** Never commit actual `.env` files - they're in `.gitignore`
- **CORS:** Backend is configured to allow requests from GitHub Pages domain
- **JWT Secrets:** Use strong, unique JWT secrets in production
- **Database:** Use strong passwords and connection strings

## 🔄 Development vs Production

### Development
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- API calls proxied through Vite dev server

### Production
- Frontend: GitHub Pages with `/stock_man/` base path
- Backend: Railway with Railway-provided domain
- Direct API calls to Railway backend URL

## 📝 Updating After Deployment

1. **Backend Updates:** Push to `main` branch - Railway auto-deploys
2. **Frontend Updates:** Push to `main` branch - GitHub Actions auto-deploys
3. **Environment Variables:** Update in Railway dashboard as needed

## ⚠️ Common Issues

1. **CORS Errors:** Ensure Railway backend URL is updated in CORS configuration
2. **API URL:** Update `VITE_API_URL` in GitHub Actions workflow after Railway deployment
3. **Base Path:** GitHub Pages serves from `/stock_man/` - ensure routing works correctly

## 📊 Monitoring

- **Railway:** Check logs and metrics in Railway dashboard
- **GitHub Pages:** Check Actions tab for deployment status
- **Health Check:** `GET /api/health` endpoint available for monitoring
