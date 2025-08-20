# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-18-data-generation-engine/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Technical Requirements

### Performance Requirements
- Generate 365-day dataset with daily snapshots in under 5 seconds
- Support background generation via Web Workers without UI blocking
- Memory usage under 100MB for complete yearly dataset
- Smooth 60fps chart rendering with generated datasets

### Project Structure Requirements
- Separate data generation logic from frontend presentation layer
- Independent engine/ directory for generation algorithms
- Dedicated data/ directory for dataset management and storage
- Maintain existing src/ structure for UI components
- Docker containerization support for engine and frontend

### Data Architecture Requirements  
- Enhanced data structures supporting daily, weekly, monthly, and yearly aggregations
- Player journey tracking with individual progression paths
- Financial flow records with detailed revenue distribution breakdowns
- Level progression data with success rates and bottleneck identification
- Metadata tracking for dataset versioning and parameter lineage

### Storage Requirements
- IndexedDB integration for large dataset browser storage
- Dataset versioning system for parameter change tracking
- Efficient serialization/deserialization for yearly data volumes
- Local storage fallback for metadata and user preferences

## Approach Options

**Option A: Monolithic Generation Engine**
- Pros: Simple architecture, all generation logic in one place, easier debugging
- Cons: Difficult to scale individual components, harder to test specific algorithms

**Option B: Modular Generation System with Web Workers** (Selected)
- Pros: Scalable architecture, testable components, background processing, non-blocking UI
- Cons: More complex setup, inter-worker communication overhead

**Option C: Server-Side Generation with API**
- Pros: Unlimited processing power, centralized data management
- Cons: Infrastructure costs, network dependency, conflicts with client-side architecture goal

**Rationale:** Option B provides the best balance of performance, maintainability, and alignment with existing client-side architecture. Web Workers enable background processing while modular design supports testing and future extensibility.

## External Dependencies

### New Production Dependencies
- **idb (7.1.1)** - IndexedDB wrapper for efficient browser storage
- **Justification:** Modern, promise-based IndexedDB interface with TypeScript support, essential for large dataset storage

### New Development Dependencies  
- **@types/web (0.0.139)** - TypeScript definitions for Web Workers API
- **Justification:** Type safety for Web Worker implementation and background processing

### Enhanced Existing Dependencies
- **Web Workers API** - Built-in browser API, no additional dependency
- **Justification:** Essential for background processing and UI responsiveness during generation

### Docker Dependencies
- **Node.js 22 LTS** - Runtime for data generation engine container
- **nginx:alpine** - Lightweight web server for frontend container
- **Justification:** Clean separation of concerns, consistent development/testing environments

## Project Structure Design

### New Directory Structure
```
/
├── engine/                    # Data generation engine (Node.js)
│   ├── src/
│   │   ├── simulation/        # Core simulation algorithms
│   │   ├── generators/        # Data generation classes
│   │   ├── workers/           # Web Worker implementations
│   │   └── types/             # Shared TypeScript types
│   ├── tests/                 # Engine-specific tests
│   ├── package.json          # Engine dependencies
│   ├── Dockerfile            # Engine container
│   └── tsconfig.json         # Engine TypeScript config
├── data/                     # Dataset management (shared)
│   ├── src/
│   │   ├── storage/          # IndexedDB and storage logic
│   │   ├── serialization/    # Data serialization utilities
│   │   └── types/            # Data structure definitions
│   └── tests/                # Data management tests
├── src/                      # Frontend (existing, enhanced)
│   ├── components/           # Existing UI components
│   ├── pages/               # Existing page components
│   ├── store/               # Enhanced Zustand store
│   └── hooks/               # Data consumption hooks
├── docker-compose.yml       # Multi-container orchestration
└── package.json            # Root dependencies and scripts
```

### Container Architecture
- **Engine Container**: Node.js environment for data generation with Web Worker support
- **Frontend Container**: nginx serving static React application
- **Development Mode**: Both containers with hot reload and shared volume mounts
- **Production Mode**: Optimized builds with multi-stage Dockerfiles

## Implementation Strategy

### Phase A: Project Structure Setup (Week 1)
1. Create separated directory structure (engine/, data/, enhanced src/)
2. Configure Docker containers with proper networking and volume mounts  
3. Set up independent TypeScript configurations for each module
4. Establish build processes for both engine and frontend

### Phase B: Core Generation Engine (Week 1-2)
1. Implement enhanced data structures matching refactor plan specifications
2. Create modular simulation algorithms (player behavior, financial calculations, growth modeling)
3. Build Web Worker wrapper for background processing
4. Add comprehensive parameter validation and error handling

### Phase C: Dataset Management (Week 2)
1. Integrate IndexedDB for browser-based dataset storage
2. Implement dataset versioning and metadata tracking  
3. Create serialization/deserialization optimizations for performance
4. Add dataset cleanup and management utilities

### Phase D: Integration & Testing (Week 2-3)
1. Update existing Zustand store to consume generated datasets
2. Integrate generation triggers with existing UI parameter controls
3. Comprehensive testing of generation speed and data accuracy
4. Performance optimization and memory usage profiling