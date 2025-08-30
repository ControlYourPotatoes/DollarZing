# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-27-dataset-generation-orchestrator/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Technical Requirements

- **CLI Tool Architecture**: Node.js/TypeScript CLI script located in `engine/src/orchestrator/` directory
- **Parameter Configuration**: Single source of truth for 3×3×3 parameter matrix definitions with type-safe configuration
- **Game Engine Integration**: Programmatic interface to existing game engine simulation with configurable parameters
- **Batch Processing**: Sequential execution of 27 game engine runs with parameter isolation and state management
- **Progress Reporting**: Real-time console output showing current parameter combination, completion percentage, and elapsed time
- **Error Handling**: Graceful failure handling that continues processing remaining combinations and reports failed runs
- **Output Organization**: Structured dataset storage with consistent naming convention and metadata files
- **Validation System**: Dataset completeness verification including size checks and required field validation

## Approach Options

**Option A:** Standalone CLI Script
- Pros: Simple implementation, minimal dependencies, easy to run independently
- Cons: Potential code duplication with game engine, limited reusability

**Option B:** Integrated Orchestrator Service (Selected)
- Pros: Leverages existing game engine infrastructure, better code reuse, type safety with existing types
- Cons: More complex integration, requires careful dependency management

**Option C:** External Orchestration Tool
- Pros: Tool-agnostic approach, could work with multiple engines
- Cons: Over-engineered for current needs, complex communication layer

**Rationale:** Option B provides the best balance of code reuse and maintainability while leveraging the existing factory pattern architecture and TypeScript types already established in the game engine.

## External Dependencies

- **Node.js fs/promises** - File system operations for dataset storage and organization
- **Node.js path** - Cross-platform path handling for output directory management
- **Commander.js** - CLI argument parsing and command structure (if not already included)
- **Justification:** These are minimal, well-established dependencies focused on core orchestration functionality without introducing heavy external libraries

## Implementation Architecture

### Project Structure (Updated)
```
engine/
├── src/                    # Pure simulation engine library
│   ├── types/             # Core simulation types and interfaces
│   ├── simulation/        # Core simulation logic
│   └── index.ts           # Clean library exports
├── cli/                   # CLI tools and commands
│   ├── src/
│   │   ├── commands/      # Individual CLI commands
│   │   │   ├── test-game.ts    # Single game testing
│   │   │   ├── simulate.ts     # Short simulations  
│   │   │   └── generate.ts     # Dataset generation
│   │   ├── orchestrator/  # Dataset orchestrator
│   │   └── index.ts       # Main CLI entry
│   └── tsconfig.json      # CLI-specific TypeScript config
├── bin/                   # Executable entry points
│   └── dollarzing        # Main CLI executable
├── generated-datasets/    # Output directory
└── package.json          # Updated with CLI scripts
```

### Parameter Configuration System
```typescript
interface ParameterMatrix {
  growthRates: [15, 35, 60];  // Base, Mid, High percentages
  riskLevels: ['low', 'mid', 'high'];  // Conservative, Balanced, Aggressive
  charityPercentages: [10, 20, 30];  // Low, Mid, High percentages
}
```

### CLI Command Structure
- `dollarzing test-game` - Run single game for debugging
- `dollarzing simulate` - Run short simulation tests
- `dollarzing generate` - Generate anchor datasets
- `dollarzing generate --dry-run` - Preview generation

### Batch Processing Engine
- Sequential execution to avoid resource conflicts
- Parameter isolation using factory pattern dependency injection
- Progress tracking with completion callbacks
- Error boundary handling for individual runs

### Output Structure
```
engine/generated-datasets/
├── anchor-datasets/
│   ├── growth-15_risk-low_charity-10/
│   │   ├── dataset.json
│   │   └── metadata.json
│   └── [26 more combinations...]
└── generation-report.json
```

### Integration Points
- Clean separation: library (src/) vs tools (cli/)
- Game engine simulation controller access through library exports
- Factory pattern configuration for parameter injection
- Existing TypeScript type definitions for simulation parameters
- Output format compatibility with planned data interpolation engine