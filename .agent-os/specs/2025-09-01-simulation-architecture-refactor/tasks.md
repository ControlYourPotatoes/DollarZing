# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-simulation-architecture-refactor/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [x] 1. Create focused component classes

  - [x] 1.1 Write tests for DayProcessor class
  - [x] 1.2 Create DayProcessor class with daily simulation logic
  - [x] 1.3 Write tests for PlayerManager class
  - [x] 1.4 Create PlayerManager class with player lifecycle management
  - [x] 1.5 Write tests for GameProcessor class
  - [x] 1.6 Create GameProcessor class with game resolution logic
  - [x] 1.7 Verify all component tests pass

- [x] 2. Move and refactor SimulationController

  - [x] 2.1 Write tests for GameEngineSimulator class
  - [x] 2.2 Move SimulationController to simulation/ directory
  - [x] 2.3 Rename SimulationController to GameEngineSimulator
  - [x] 2.4 Refactor GameEngineSimulator to use new component classes
  - [x] 2.5 Update class documentation and comments
  - [x] 2.6 Verify all GameEngineSimulator tests pass

- [x] 3. Update imports and references

  - [x] 3.1 Write tests for import resolution
  - [x] 3.2 Update all import statements throughout codebase
  - [x] 3.3 Update export statements in index files
  - [x] 3.4 Verify no circular dependencies exist
  - [x] 3.5 Run full test suite to ensure no regressions

- [ ] 4. Remove legacy SimulationController and migrate to GameEngineSimulator

  **Context for Agent:**

  The old `SimulationController` (772 lines) in `engine/src/types/simulation-controller.ts` is a monolithic class that has been replaced by the new `GameEngineSimulator` (538 lines) in `engine/src/simulation/game-engine-simulator.ts` which delegates to focused component classes (`DayProcessor`, `PlayerManager`, `GameProcessor`).

  **Key Interface Differences:**

  - **Constructor**: Old takes `SimulationConfig`, new takes component instances (dependency injection)
  - **Main method**: Old has `runSimulation()`, new has `executeSimulation()`
  - **Component access**: Old creates components internally, new exposes them via constructor
  - **Architecture**: Old is monolithic, new delegates to focused components

  **Current Usage (to be migrated):**

  1. `engine/cli/src/commands/test-game.ts` - CLI command for testing games
  2. `engine/cli/src/orchestrator/execution/game-engine-adapter.ts` - Dataset orchestrator adapter
  3. `engine/src/index.ts` - Main export (line 33)
  4. `engine/tests/import-resolution.test.ts` - Legacy compatibility tests

  **Migration Strategy:**

  - Update CLI commands to use `GameEngineSimulator` with proper component initialization
  - Handle constructor parameter differences (dependency injection pattern)
  - Update method calls from `runSimulation()` to `executeSimulation()`
  - Remove legacy exports and tests
  - Delete old files after migration is complete

  - [ ] 4.1 Update CLI commands to use GameEngineSimulator
    - [ ] 4.1.1 Update `engine/cli/src/commands/test-game.ts` - Replace SimulationController with GameEngineSimulator
    - [ ] 4.1.2 Update `engine/cli/src/orchestrator/execution/game-engine-adapter.ts` - Replace SimulationController with GameEngineSimulator
    - [ ] 4.1.3 Handle interface differences: `runSimulation()` vs `executeSimulation()`, constructor parameters
  - [ ] 4.2 Update exports and imports
    - [ ] 4.2.1 Remove SimulationController export from `engine/src/index.ts`
    - [ ] 4.2.2 Update import statements in CLI files to use GameEngineSimulator
    - [ ] 4.2.3 Update type imports (SimulationConfig, SimulationProgress, etc.)
  - [ ] 4.3 Update tests
    - [ ] 4.3.1 Remove legacy SimulationController tests from `engine/tests/import-resolution.test.ts`
    - [ ] 4.3.2 Update any remaining references in test files
  - [ ] 4.4 Remove legacy files
    - [ ] 4.4.1 Delete `engine/src/types/simulation-controller.ts` (772 lines)
    - [ ] 4.4.2 Delete `engine/tests/simulation-controller.test.ts` (522 lines)
  - [ ] 4.5 Verify migration
    - [ ] 4.5.1 Run CLI commands to ensure they work with GameEngineSimulator
    - [ ] 4.5.2 Run full test suite to ensure no regressions
    - [ ] 4.5.3 Verify no remaining references to SimulationController

- [ ] 5. Clean up types directory

  - [ ] 5.1 Write tests for types directory structure
  - [ ] 5.2 Move any remaining implementations out of types/
  - [ ] 5.3 Verify types/ contains only type definitions
  - [ ] 5.4 Update documentation for new structure
  - [ ] 5.5 Verify all tests pass after cleanup

- [ ] 6. Integration testing and validation
  - [ ] 6.1 Write integration tests for complete simulation flow
  - [ ] 6.2 Test backward compatibility with existing consumers
  - [ ] 6.3 Verify performance characteristics are maintained
  - [ ] 6.4 Run comprehensive test suite
  - [ ] 6.5 Update documentation and README files
