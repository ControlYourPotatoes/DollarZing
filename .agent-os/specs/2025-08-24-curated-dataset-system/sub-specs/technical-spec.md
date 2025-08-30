# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-24-curated-dataset-system/spec.md

> Created: 2025-08-24
> Version: 1.0.0

## Technical Requirements

### Performance Requirements

- Load curated datasets (30-day) in under 2 seconds on standard hardware
- Support smooth 60fps chart rendering with curated data
- Memory usage under 50MB for complete dataset consumption
- Instant switching between different curated scenarios

### Storage Requirements

- Local storage with Git integration for dataset versioning
- Size validation with 100MB warnings and optimization guidance
- Abstracted storage interface for future Supabase migration
- Efficient dataset compression and caching strategies

### Data Architecture Requirements

- Leverage existing data structures from data/ project
- 27-dataset anchor system (3 Growth × 3 Risk × 3 Charity parameter matrix)
- Parameter interpolation algorithms for smooth transitions between anchor points
- Dataset metadata for versioning and parameter tracking
- Efficient serialization/deserialization for local storage
- Mathematical interpolation accuracy validation
- Size-optimized data formats for GitHub Pages compatibility

### Data Engine Requirements

- Parameter interpolation engine for smooth transitions between anchor datasets
- Mathematical algorithms for accurate intermediate value calculation
- Efficient anchor dataset loading and caching system
- Parameter validation and boundary management
- Interpolation performance optimization (sub-100ms parameter changes)
- Time scale interpolation for smooth daily/weekly/monthly navigation

## Approach Options

**Option A: Local Storage with Git Integration (Selected)**

- Pros: Zero technical debt, GitHub Pages compatible, easy versioning, simple deployment
- Cons: Limited by file size constraints, manual dataset updates
- Rationale: Aligns with current static hosting approach, provides immediate value, easy migration path

**Option B: Supabase Storage Integration**

- Pros: Handles large datasets, cloud-based management, easy scaling
- Cons: Adds complexity, requires external service, potential costs
- Rationale: Future migration path when local storage becomes limiting

**Option C: Hybrid Local + Cloud Approach**

- Pros: Best of both worlds, gradual migration
- Cons: Increased complexity, dual storage management
- Rationale: Over-engineering for current needs, can be added later

## External Dependencies

### Enhanced Existing Dependencies

- **data/ project structures** - Leverage existing serialization and validation, enhanced for 27-dataset management
- **Mathematical interpolation libraries** - Consider lightweight interpolation utilities for parameter transitions
- **Zustand state management** - Enhanced for parameter state and interpolation caching

### New Development Dependencies

- **Interpolation utilities** - Lightweight mathematical interpolation functions (linear, cubic, spline)
- **Performance optimization libraries** - Consider memoization utilities for interpolation caching
- **Future**: Supabase client libraries when migration is needed

## Project Structure Design

### Enhanced Directory Structure

```
/
├── data/                     # Dataset management (existing, enhanced)
│   ├── src/
│   │   ├── storage/          # Enhanced with local storage and size validation
│   │   ├── serialization/    # Optimized for curated dataset formats
│   │   ├── validation/       # Dataset quality and size validation
│   │   └── types/            # Enhanced for curated dataset metadata
│   └── tests/                # Comprehensive dataset management tests
├── src/                      # Frontend (enhanced for curated data)
│   ├── components/           # Enhanced chart components for dataset consumption
│   ├── pages/               # Updated for curated dataset navigation
│   ├── store/               # Enhanced Zustand store for curated data
│   ├── hooks/               # Dataset consumption and comparison hooks
│   └── utils/               # Dataset loading and validation utilities
├── datasets/                 # 27 Anchor dataset storage (Git-tracked)
│   ├── growth-base/          # Base growth scenarios (3 risk × 3 charity combinations)
│   ├── growth-mid/           # Mid growth scenarios (3 risk × 3 charity combinations) 
│   ├── growth-high/          # High growth scenarios (3 risk × 3 charity combinations)
│   ├── metadata/             # Dataset parameter definitions and interpolation rules
│   └── .gitattributes       # Git LFS configuration if needed
└── package.json             # Enhanced scripts for dataset management
```

### Storage Abstraction Layer

```typescript
// Abstract storage interface for parameter interpolation
interface DatasetStorage {
  loadAnchorDataset(parameters: ParameterCombination): Promise<SimulationDataset>;
  loadAllAnchorDatasets(): Promise<AnchorDatasetMatrix>;
  listDatasets(): Promise<DatasetMetadata[]>;
  validateDataset(dataset: SimulationDataset): ValidationResult;
  getDatasetSize(dataset: SimulationDataset): number;
}

// Parameter interpolation engine
interface ParameterInterpolator {
  interpolateParameters(target: Parameters, current: Parameters): InterpolatedDataset;
  findNearestAnchors(parameters: Parameters): AnchorDataset[];
  calculateTransitionSteps(from: Parameters, to: Parameters, duration: number): Parameters[];
  validateInterpolation(result: InterpolatedDataset): boolean;
}

// Local implementation (initial)
class LocalDatasetStorage implements DatasetStorage {
  // Local storage with Git integration
}

// Future Supabase implementation
class SupabaseDatasetStorage implements DatasetStorage {
  // Cloud storage with read-only access
}
```

## Implementation Strategy

### Phase A: Local Storage Foundation (Week 1)

1. Enhance existing data/ project structures for curated dataset consumption
2. Implement local storage with Git integration and size validation
3. Create dataset metadata system for versioning and parameter tracking
4. Add comprehensive validation for dataset quality and size limits

### Phase B: Dataset Consumption Engine (Week 1-2)

1. Build efficient dataset loading and caching system
2. Implement size validation with 100MB warnings and optimization guidance
3. Create dataset comparison tools for side-by-side analysis
4. Add time scale navigation (day/week/month) with curated data

### Phase C: Enhanced Visualization (Week 2)

1. Update chart components to consume curated datasets seamlessly
2. Implement dataset switching and comparison capabilities
3. Add export functionality for stakeholder presentations
4. Optimize performance for smooth 60fps rendering

### Phase D: Storage Abstraction & Testing (Week 2-3)

1. Create abstracted storage interface for future flexibility
2. Implement comprehensive testing for dataset consumption and validation
3. Add performance benchmarking and optimization
4. Document migration path to Supabase for future implementation

