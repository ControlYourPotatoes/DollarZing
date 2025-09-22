# Multi-stage Dockerfile for DollarZing Frontend

# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Create data directory for volume mount
RUN mkdir -p /data/datasets

# Expose port
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"]

# Build stage  
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
ARG VITE_PRESENTATION_MANIFEST_URL
ARG VITE_PRESENTATION_BASE_URL
ARG VITE_PRESENTATION_OVERRIDES
ENV VITE_PRESENTATION_MANIFEST_URL=${VITE_PRESENTATION_MANIFEST_URL}
ENV VITE_PRESENTATION_BASE_URL=${VITE_PRESENTATION_BASE_URL}
ENV VITE_PRESENTATION_OVERRIDES=${VITE_PRESENTATION_OVERRIDES}
COPY . .

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create data directory for volume mount
RUN mkdir -p /data/datasets

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["nginx", "-g", "daemon off;"]