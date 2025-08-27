# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-27-dataset-generation-orchestrator/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Test Coverage

### Unit Tests

**ParameterMatrix**
- Validates 3×3×3 parameter combinations generate exactly 27 configurations
- Ensures parameter values match expected ranges and types
- Tests parameter serialization for game engine consumption

**OrchestratorConfig**
- Tests configuration validation and error handling for invalid parameters
- Validates output directory creation and path handling
- Tests CLI argument parsing and default value handling

**BatchProcessor**
- Tests sequential execution logic without actual game engine calls
- Validates progress tracking calculations and reporting format
- Tests error handling for individual run failures

**DatasetValidator**
- Tests dataset completeness validation against required fields
- Validates dataset size requirements and data format expectations
- Tests metadata generation and validation

### Integration Tests

**Real Game Engine Integration**
- Tests orchestrator successfully runs actual game engine with 3 representative parameter combinations (one from each growth rate tier)
- Validates real dataset generation produces expected data structure and size
- Tests parameter injection through factory pattern with real simulation objects
- Verifies generated datasets match quality requirements used by data interpolation engine

**Full Batch Processing**
- Tests complete orchestration workflow with 5 parameter combinations (subset of full 27)
- Validates real file system operations, directory creation, and dataset organization
- Tests progress reporting with actual execution times and real completion tracking
- Verifies error recovery when one real simulation fails mid-batch

**CLI End-to-End**
- Tests full CLI workflow from command invocation to dataset output with real game engine
- Validates actual output directory structure matches specification
- Tests real error handling scenarios (invalid parameters, file system issues)

### Strategic Mocking (Limited Use)

**Unit Test Mocking Only:**
- **Game Engine Simulation:** Mock only for fast unit tests of batch logic and parameter matrix validation
- **File System Operations:** Mock only in unit tests for error condition simulation (disk full, permissions)
- **Progress Callbacks:** Mock only for unit testing batch processing logic timing

**Integration Test Philosophy:**
- Use real game engine for all integration tests to validate actual behavior
- Use real file system operations to test actual orchestrator workflow
- Mock external dependencies (network, etc.) but not core orchestrator functionality