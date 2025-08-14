# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend package.json and install dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy backend source code
COPY backend/src ./src

# Expose the port (Railway will set the PORT environment variable)
EXPOSE ${PORT:-5000}

# Start the backend server
CMD ["npm", "start"]
