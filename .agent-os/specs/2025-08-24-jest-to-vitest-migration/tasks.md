# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-24-jest-to-vitest-migration/spec.md

> Created: 2025-08-24
> Status: Ready for Implementation

## Tasks

- [x] 1. Jest Dependencies Removal and Vitest Installation
  - [x] 1.1 Remove Jest dependencies from package.json (jest, @types/jest, ts-jest)
  - [x] 1.2 Install Vitest dependencies (vitest, @vitest/ui)
  - [x] 1.3 Remove Jest configuration section from package.json
  - [x] 1.4 Update package.json test scripts to use Vitest commands
  - [x] 1.5 Verify all Jest-related files are cleaned up

- [x] 2. Vitest Configuration Integration
  - [x] 2.1 Add Vitest configuration to vite.config.ts with proper TypeScript reference
  - [x] 2.2 Configure test environment and global settings for existing test patterns
  - [x] 2.3 Set up test file include/exclude patterns to match current Jest setup
  - [x] 2.4 Configure coverage collection to match existing Jest coverage paths
  - [x] 2.5 Verify configuration works with existing TypeScript and ESM setup

- [ ] 3. Existing Test Migration Validation
  - [ ] 3.1 Run all existing engine tests with Vitest to identify any compatibility issues
  - [ ] 3.2 Fix any TypeScript global definition issues (describe, test, expect)
  - [ ] 3.3 Validate that all test mocks and assertions work with Vitest
  - [ ] 3.4 Verify test file pattern matching works correctly
  - [ ] 3.5 Ensure all existing tests pass without modification

- [ ] 4. Complete Task 8 Integration Tests - Independent Run Flow
  - [ ] 4.1 Write integration tests for complete independent run flow (Level 1 → jackpot or cash-out)
  - [ ] 4.2 Test multiple independent runs per player with separate run tracking
  - [ ] 4.3 Write tests for player lifecycle with multiple jackpot attempts (run completion → new run creation)
  - [ ] 4.4 Validate run isolation (one run's outcome doesn't affect another run)
  - [ ] 4.5 Test exponential progression accuracy ($1→$2→$4...→$512 bets, $2→$4→$8...→$1024 wins)
  - [ ] 4.6 Write tests for jackpot scenario (Level 10: $512 bet, $1024 win, forced completion)
  - [ ] 4.7 Test various player investment scenarios ($5 = 4 jackpot attempts, $20 = 18 jackpot attempts)
  - [ ] 4.8 Validate PlayerBalanceManager with multiple concurrent independent runs

- [ ] 5. Complete Task 8 Performance and System Tests
  - [ ] 5.1 Test 30-day simulation with realistic run completion rates and new run creation
  - [ ] 5.2 Test deterministic behavior with identical seed values across independent runs
  - [ ] 5.3 Write performance tests for large datasets (10,000+ players × multiple runs each)
  - [ ] 5.4 Validate memory usage with run history and transaction tracking
  - [ ] 5.5 Test audit trail completeness for regulatory compliance (all runs tracked)
  - [ ] 5.6 Test system recovery with run integrity preservation
  - [ ] 5.7 Verify all integration tests pass with independent run architecture

- [ ] 6. Performance and Developer Experience Validation
  - [ ] 6.1 Compare test execution speed between old Jest setup and new Vitest setup
  - [ ] 6.2 Test watch mode performance and reliability
  - [ ] 6.3 Validate that test coverage collection works properly
  - [ ] 6.4 Verify no ESM/TypeScript configuration warnings or errors
  - [ ] 6.5 Test UI mode functionality for enhanced developer experience

## Implementation Guidelines

### Dependencies & Constraints
- Must maintain all existing test functionality and coverage
- No breaking changes to existing test logic or assertions
- All Task 8 integration tests must be implemented as originally specified
- Vitest configuration must work seamlessly with existing Vite build setup
- TypeScript and ESM compatibility must be fully resolved

### Performance Targets
- Test execution should be faster than current Jest setup
- Watch mode should be more responsive and reliable
- Large test suites (engine tests) should complete without memory issues
- All 15 Task 8 integration test subtasks must execute within reasonable time

### Testing Standards
- All existing tests must pass without modification after migration
- New Task 8 integration tests must follow TDD approach
- Maintain existing test file organization and patterns
- Comprehensive integration test coverage for independent run system
- Performance tests must validate system handles large datasets efficiently

### Code Quality Requirements
- TypeScript type safety throughout all tests
- Clear separation between unit, integration, and performance tests
- Comprehensive error handling and validation in integration tests
- Mock time-based and random operations for deterministic testing