# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-24-curated-dataset-system/spec.md

> Created: 2025-08-24
> Version: 1.0.0

## Test Coverage

### Unit Tests

**DatasetStorage Interface**

- Test LocalDatasetStorage implementation with local file loading
- Validate dataset metadata extraction and versioning
- Test size validation and 100MB warning thresholds
- Verify dataset compression and optimization utilities
- Test error handling for corrupted or invalid datasets

**DatasetValidation Module**

- Test dataset quality validation (completeness, consistency)
- Verify parameter validation across different scenario types
- Test size optimization recommendations and guidance
- Validate metadata integrity and version tracking
- Test edge cases (empty datasets, malformed data)

**DatasetConsumption Engine**

- Test efficient dataset loading and caching mechanisms
- Verify memory usage optimization for large datasets
- Test dataset switching performance and instant loading
- Validate time scale navigation (day/week/month) functionality
- Test concurrent dataset loading and error handling

**StorageAbstraction Layer**

- Test abstracted storage interface for future flexibility
- Verify LocalDatasetStorage implementation compliance
- Test mock SupabaseDatasetStorage for migration testing
- Validate storage interface contract enforcement
- Test storage fallback mechanisms and error recovery

### Integration Tests

**Dataset Loading Workflow**

- Test complete dataset loading pipeline from local storage
- Verify dataset validation and quality checks
- Test size warning system and optimization guidance
- Validate dataset metadata extraction and display
- Test error handling for missing or corrupted datasets

**Frontend Integration**

- Test Zustand store integration with curated datasets
- Verify chart component rendering with curated data
- Test dataset switching and comparison capabilities
- Validate time scale navigation performance
- Test export functionality for stakeholder presentations

**Performance Integration**

- Test dataset loading time under 2 seconds requirement
- Verify memory usage under 50MB target
- Test 60fps chart rendering with curated datasets
- Validate instant scenario switching performance
- Test concurrent dataset operations and caching

### Performance Tests

**Dataset Loading Benchmarking**

- Benchmark 30-day dataset loading time across different sizes
- Test memory usage during dataset consumption and peak consumption
- Validate dataset compression effectiveness and size reduction
- Test caching performance and memory efficiency
- Benchmark dataset switching speed between different scenarios

**Visualization Performance**

- Test chart rendering performance with curated datasets
- Validate 60fps requirement across different chart types
- Test time scale navigation performance (day/week/month)
- Verify export functionality performance for large datasets
- Test concurrent chart rendering and dataset consumption

**Size Management Validation**

- Test 100MB warning system with various dataset sizes
- Validate size optimization recommendations and guidance
- Test dataset compression effectiveness and quality preservation
- Verify size validation accuracy across different data types
- Test edge cases (datasets approaching size limits)

### Mocking Requirements

**Local Storage API**

- Mock localStorage and IndexedDB for testing storage logic
- Simulate storage quota exceeded scenarios and cleanup behavior
- Mock file system operations for dataset loading testing
- Simulate corrupted dataset scenarios and recovery mechanisms

**Dataset Validation**

- Mock dataset corruption scenarios for validation testing
- Simulate size limit scenarios for optimization testing
- Mock parameter validation failures for error handling testing
- Simulate metadata corruption for versioning testing

**Performance APIs**

- Mock performance.now() for consistent timing tests
- Simulate memory pressure scenarios for resource management testing
- Mock requestIdleCallback for optimal dataset loading scheduling

### Test Data Sets

**Curated Dataset Variations**

- Baseline 30-day dataset: Standard parameters, ~5-10MB
- High-adoption scenario: Panama adoption rates, ~8-15MB
- Low-cash-out strategy: Conservative player behavior, ~6-12MB
- Growth variation scenarios: Different growth multipliers, ~7-14MB
- Edge case datasets: Extreme parameter combinations, ~10-20MB

**Expected Performance Outcomes**

- Loading time: <2 seconds for 30-day datasets
- Memory usage: <50MB for complete dataset consumption
- Rendering performance: 60fps chart updates
- Switching speed: Instant scenario changes
- Size validation: Accurate 100MB warnings and guidance

### Continuous Integration Tests

**Build Pipeline Tests**

- Dataset validation and quality checks during build process
- Size validation and optimization guidance generation
- Metadata extraction and versioning verification
- Storage abstraction layer compliance testing

**Cross-Environment Tests**

- Test dataset consumption across different browsers (Chrome, Firefox, Safari)
- Validate local storage compatibility across devices
- Test performance consistency across different hardware configurations
- Verify GitHub Pages compatibility and deployment validation

**Dataset Quality Tests**

- Validate curated dataset accuracy against expected parameters
- Test data consistency across different time scales
- Verify financial calculation accuracy and revenue distribution
- Test parameter validation and scenario completeness

