# Multi-stage Dockerfile for DollarZing Engine

# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create data directory for volume mount
RUN mkdir -p /data/datasets

# Expose port
EXPOSE 3001

# Development command with hot reload
CMD ["npm", "run", "dev"]

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies including devDependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Create data directory with proper permissions
RUN mkdir -p /data/datasets && \
    chown -R nodeuser:nodejs /data && \
    chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Production command with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]