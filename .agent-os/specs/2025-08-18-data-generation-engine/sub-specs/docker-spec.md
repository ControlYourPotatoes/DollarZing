# Docker Containerization Specification

This is the Docker containerization specification for the spec detailed in @.agent-os/specs/2025-08-18-data-generation-engine/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Container Architecture

### Engine Container (dollarzing-engine)
- **Base Image:** node:22-alpine
- **Purpose:** Data generation engine with Web Worker support
- **Port:** 3001 (internal API for generation requests)
- **Environment:** Node.js with TypeScript compilation
- **Volume Mounts:** ./engine:/app, shared data volume for dataset exchange

### Frontend Container (dollarzing-frontend)  
- **Base Image:** nginx:alpine (production) / node:22-alpine (development)
- **Purpose:** React application serving with static asset delivery
- **Port:** 3000 (web interface)
- **Environment:** Production build serving or development server
- **Volume Mounts:** ./src:/app/src, shared data volume for dataset access

### Shared Data Volume
- **Name:** dollarzing-data
- **Purpose:** Dataset exchange between engine and frontend containers
- **Mount Point:** /data/datasets (both containers)
- **Persistence:** Named volume for dataset caching across container restarts

## Development Environment

### Docker Compose Configuration
```yaml
version: '3.8'
services:
  engine:
    build: ./engine
    container_name: dollarzing-engine-dev
    ports:
      - "3001:3001"
    volumes:
      - ./engine:/app
      - dollarzing-data:/data/datasets
    environment:
      - NODE_ENV=development
    command: npm run dev
    
  frontend:
    build: ./
    container_name: dollarzing-frontend-dev  
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - dollarzing-data:/data/datasets
    environment:
      - NODE_ENV=development
    depends_on:
      - engine
    command: npm run dev
    
volumes:
  dollarzing-data:
```

### Engine Dockerfile (Development)
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Development command
CMD ["npm", "run", "dev"]
```

### Frontend Dockerfile (Development)  
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies  
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command  
CMD ["npm", "run", "dev"]
```

## Production Environment

### Multi-Stage Production Builds

**Engine Production Dockerfile**
```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
```

**Frontend Production Dockerfile**
```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage  
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Container Communication

### API Endpoints
- **Engine Health Check:** GET http://engine:3001/health
- **Dataset Generation:** POST http://engine:3001/generate
- **Dataset Status:** GET http://engine:3001/status/:jobId  
- **Dataset Retrieval:** GET http://engine:3001/dataset/:datasetId

### Data Exchange Protocol
1. **Frontend Request:** User triggers parameter change
2. **Generation Request:** POST to engine container with parameters
3. **Background Processing:** Engine generates dataset using Web Workers
4. **Dataset Storage:** Engine writes dataset to shared volume  
5. **Completion Notification:** Engine notifies frontend of completion
6. **Dataset Loading:** Frontend reads dataset from shared volume
7. **UI Update:** Frontend updates charts with new dataset

## Security Considerations

### Container Isolation
- Run containers with non-root user (node user for engine, nginx user for frontend)
- Limited resource allocation (CPU: 2 cores, Memory: 4GB for engine, 1GB for frontend)
- Network isolation with internal Docker network for container communication
- Read-only filesystem for production containers except /tmp and data volumes

### Data Volume Security  
- Restrict volume access to containerized applications only
- Implement dataset encryption for sensitive financial simulation data
- Regular volume cleanup to prevent unlimited disk usage
- Access logging for dataset read/write operations

## Resource Management

### CPU and Memory Limits
```yaml
services:
  engine:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
          
  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'  
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M
```

### Storage Management
- **Dataset Volume:** 10GB limit with automatic cleanup of datasets older than 30 days
- **Engine Container:** 2GB disk space for temporary processing files
- **Frontend Container:** 1GB disk space for static assets and cache
- **Log Rotation:** Automatic log rotation with 7-day retention policy

## Monitoring and Health Checks

### Health Check Endpoints
```dockerfile
# Engine container health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Frontend container health check  
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1
```

### Monitoring Metrics
- **Engine Performance:** Generation time, memory usage, worker thread utilization
- **Frontend Performance:** Response time, static asset delivery, concurrent user capacity
- **Storage Metrics:** Dataset storage usage, read/write performance, volume capacity
- **Container Metrics:** CPU utilization, memory consumption, network I/O, container restart frequency

## Development Workflow

### Quick Start Commands
```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f engine
docker-compose logs -f frontend  

# Rebuild containers
docker-compose build --no-cache

# Clean environment
docker-compose down -v
```

### Testing Environment  
```bash
# Run tests in containers
docker-compose exec engine npm test
docker-compose exec frontend npm test

# Integration testing
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# Monitor production health
docker-compose -f docker-compose.prod.yml ps
docker stats
```