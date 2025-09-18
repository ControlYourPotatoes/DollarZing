# Spec Tasks

## Tasks

- [x] 1. Implement GameEngineSimulator configuration profiles
  - [x] 1.1 Write tests for profile builder and runtime option handling
  - [x] 1.2 Introduce configuration profile types and builder utilities
  - [x] 1.3 Update GameEngineSimulator to consume profiles and runtime options
  - [x] 1.4 Verify all tests pass

- [ ] 2. Add simulator factory helpers with default pooling behaviour
  - [ ] 2.1 Write tests for dev/prod factory helpers and pooling opt-out logic
  - [ ] 2.2 Implement factory functions enabling pooling by default
  - [ ] 2.3 Expose opt-out switches for pooling and environment overrides
  - [ ] 2.4 Verify all tests pass

- [ ] 3. Create modular `simulate` CLI command
  - [ ] 3.1 Write CLI tests covering new command flags and delegation
  - [ ] 3.2 Implement `simulate` command with player/dollar/day controls
  - [ ] 3.3 Update `test-game` command to delegate to shared execution path
  - [ ] 3.4 Verify all tests pass

- [ ] 4. Integrate dev observability and sanity dashboard
  - [ ] 4.1 Write tests for debugger attachment and summary aggregation
  - [ ] 4.2 Wire EventDebugInterface into dev runs with opt-out flag
  - [ ] 4.3 Emit sanity dashboard metrics from CLI output
  - [ ] 4.4 Verify all tests pass

- [ ] 5. Expand integration coverage and documentation
  - [ ] 5.1 Write integration tests for multi-day simulations exercising new pipeline
  - [ ] 5.2 Update developer documentation and spec references
  - [ ] 5.3 Verify all tests pass
