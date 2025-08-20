# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-18-data-generation-engine/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Test Coverage

### Unit Tests

**SimulationEngine Class**
- Validate yearly dataset generation with different parameter combinations
- Test daily snapshot calculations for accuracy and consistency
- Verify player journey simulation follows proper probability distributions
- Test level progression calculations match expected gaming mechanics
- Validate revenue distribution calculations (20% platform, 20% charity, 40% government, 40% players)

**ParameterValidation Module**  
- Test parameter boundary validation (adoption rates, cash-out strategies, growth multipliers)
- Verify parameter combination compatibility and conflict detection
- Test default parameter fallback mechanisms
- Validate parameter serialization/deserialization for storage

**DataStructures Module**
- Test DailySnapshot creation and aggregation calculations  
- Verify WeeklySnapshot and MonthlySnapshot aggregation accuracy
- Test PlayerJourney tracking and progression path validation
- Validate FinancialFlowRecord calculations and revenue breakdowns
- Test data structure serialization efficiency and integrity

**StorageManager Class**
- Test IndexedDB dataset storage and retrieval operations
- Verify dataset versioning and metadata tracking
- Test storage quota management and cleanup operations
- Validate data compression and serialization performance

### Integration Tests

**Generation Workflow**  
- Test complete parameter-to-dataset generation pipeline
- Verify Web Worker communication and error handling  
- Test dataset storage and immediate retrieval accuracy
- Validate generation performance meets sub-5-second requirement
- Test concurrent generation requests and queue management

**Frontend Integration**
- Test Zustand store integration with generated datasets
- Verify chart component rendering with yearly data volumes
- Test parameter change triggers and dataset regeneration
- Validate UI responsiveness during background generation
- Test error handling and user feedback during generation failures

**Docker Container Integration**
- Test engine container startup and health checks
- Verify frontend container serving and routing
- Test inter-container communication and data sharing
- Validate development vs production container behavior
- Test container orchestration and scaling

### Performance Tests

**Generation Speed Benchmarking**
- Benchmark 365-day dataset generation time across different parameter sets
- Test memory usage during generation and peak consumption
- Validate Web Worker performance vs main thread comparison
- Test IndexedDB write/read performance with large datasets
- Benchmark serialization/deserialization speed optimization

**Data Accuracy Validation**
- Compare generated datasets with existing real-time calculation results
- Validate statistical consistency across multiple generation runs with same parameters
- Test edge cases (extreme adoption rates, maximum cash-out scenarios)
- Verify financial calculation accuracy to 6 decimal places for compliance
- Test data integrity after storage/retrieval cycles

### Mocking Requirements

**Web Workers API**
- Mock Web Worker message passing for unit test environments
- Simulate worker termination and error scenarios
- Mock concurrent worker execution for load testing

**IndexedDB Storage**  
- Mock IndexedDB operations for testing storage logic without browser dependency
- Simulate storage quota exceeded scenarios and cleanup behavior
- Mock storage corruption and recovery mechanisms

**Browser Performance API**
- Mock performance.now() for consistent timing tests
- Simulate memory pressure scenarios for resource management testing
- Mock requestIdleCallback for optimal generation scheduling

### Test Data Sets

**Parameter Combinations**
- Low adoption (1-5%), average cash-out (30%), organic growth (1-3%)
- High adoption (Panama scenario 15-25%), high cash-out (10%), marketing multiplier (2-5x)
- Extreme scenarios: Maximum adoption (50%), minimum cash-out (5%), zero growth
- Edge cases: Single player scenarios, maximum level (512) only scenarios

**Expected Outcomes**
- Baseline 365-day dataset: ~50,000 daily data points, 27,000 total records
- High-adoption scenario: ~150,000 daily data points, 75,000 total records  
- Performance targets: <5 second generation, <100MB memory, 60fps rendering
- Accuracy targets: Financial calculations within 0.0001% of real-time equivalents

### Continuous Integration Tests

**Build Pipeline Tests**
- Docker container build validation for both engine and frontend
- TypeScript compilation across all modules (engine/, data/, src/)
- Dependency vulnerability scanning for new packages (idb, @types/web)
- Bundle size analysis ensuring frontend remains optimized

**Cross-Environment Tests**  
- Test generation consistency across different Node.js versions
- Validate browser compatibility for IndexedDB operations (Chrome, Firefox, Safari)
- Test mobile device performance with limited memory constraints
- Verify production build optimization maintains functionality