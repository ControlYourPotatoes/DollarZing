# Spec Tasks

## Tasks

- [x] 1. Implement GameEngineSimulator configuration profiles
  - [x] 1.1 Write tests for profile builder and runtime option handling
  - [x] 1.2 Introduce configuration profile types and builder utilities
  - [x] 1.3 Update GameEngineSimulator to consume profiles and runtime options
  - [x] 1.4 Verify all tests pass

- [x] 2. Add simulator factory helpers with default pooling behaviour
  - [x] 2.1 Write tests for dev/prod factory helpers and pooling opt-out logic
  - [x] 2.2 Implement factory functions enabling pooling by default
  - [x] 2.3 Expose opt-out switches for pooling and environment overrides
  - [x] 2.4 Verify all tests pass

- [x] 3. Create modular `simulate` CLI command
  - [x] 3.1 Write CLI tests covering new command flags and delegation
  - [x] 3.2 Implement `simulate` command with player/dollar/day controls
  - [x] 3.3 Update `test-game` command to delegate to shared execution path
  - [x] 3.4 Verify all tests pass

- [x] 4. Integrate dev observability and sanity dashboard
  - [x] 4.1 Write tests for debugger attachment and summary aggregation
  - [x] 4.2 Wire EventDebugInterface into dev runs with opt-out flag
  - [x] 4.3 Emit sanity dashboard metrics from CLI output
  - [x] 4.4 Verify all tests pass

- [ ] 5. Expand integration coverage and documentation
  - [ ] 5.1 Write integration tests for multi-day simulations exercising new pipeline
  - [ ] 5.2 Update developer documentation and spec references
  - [ ] 5.3 Verify all tests pass
