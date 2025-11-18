# ---- Base Image ----
FROM node:18-alpine AS base

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install all dependencies (dev + prod)
RUN npm install --production=false

# Copy the full project
COPY . .

# Build the NestJS project
RUN npm run build


# ---- Production Image ----
FROM node:18-alpine

WORKDIR /app

# Copy build artifacts and node_modules from the build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./

# Expose the application's port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
